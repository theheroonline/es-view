package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"maps"
	"time"

	goMySQL "github.com/go-sql-driver/mysql"

	"multi-database-browsing/backend/infra/sshtunnel"
	"multi-database-browsing/backend/shared"
)

func (m *Module) MysqlConnect(req MysqlConnectRequest) (string, error) {
	config := goMySQL.NewConfig()
	config.User = req.Username
	config.Passwd = req.Password
	config.Net = "tcp"
	config.DBName = req.Database
	config.ParseTime = true
	config.Loc = time.Local
	config.Timeout = 3 * time.Second
	config.ReadTimeout = 5 * time.Second
	config.WriteTimeout = 5 * time.Second

	// Default charset/collation (can be overridden by DriverParams)
	config.Params = map[string]string{
		"charset":   "utf8mb4",
		"collation": "utf8mb4_unicode_ci",
	}

	// Apply custom driver parameters
	if req.DriverParams != nil {
		maps.Copy(config.Params, req.DriverParams)
	}

	// Configure TLS
	if req.TlsMode != "" {
		tlsConfigKey, err := setupTLS(&req)
		if err != nil {
			return "", shared.NewConnectionFailed("mysql", "TLS configuration error: "+err.Error())
		}
		if tlsConfigKey != "" {
			config.TLSConfig = tlsConfigKey
		}
	}

	// Build SSH tunnel address
	var addr string
	if req.SshEnabled {
		sshCfg := sshtunnel.Config{
			Host:           req.SshHost,
			Port:           req.SshPort,
			Username:       req.SshUsername,
			Password:       req.SshPassword,
			PrivateKeyPath: req.SshPrivateKeyPath,
			PrivateKeyPem:  req.SshPrivateKeyPem,
			Passphrase:     req.SshPassphrase,
			UseAgent:       req.SshUseAgent,
			HostKeyMode:    req.SshHostKeyMode,
			KnownHostsPath: req.SshKnownHostsPath,
		}
		tunnel := m.connManager.sshTunnels.GetOrCreate(req.ConnectionID, sshCfg)
		targetAddr := fmt.Sprintf("%s:%d", req.Host, req.Port)
		localPort, err := tunnel.ConnectAndForward(targetAddr)
		if err != nil {
			return "", shared.NewConnectionFailed("mysql", "failed to establish SSH tunnel: "+err.Error())
		}
		addr = fmt.Sprintf("127.0.0.1:%d", localPort)
	} else {
		addr = fmt.Sprintf("%s:%d", req.Host, req.Port)
	}
	config.Addr = addr

	dsn := config.FormatDSN()

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return "", shared.NewConnectionFailed("mysql", "failed to open connection: "+err.Error())
	}

	maxOpenConns := req.MaxOpenConns
	if maxOpenConns <= 0 {
		maxOpenConns = 50
	}
	maxIdleConns := req.MaxIdleConns
	if maxIdleConns <= 0 {
		maxIdleConns = 5
	}
	connMaxLifetime := time.Duration(req.ConnMaxLifetime) * time.Second
	if connMaxLifetime <= 0 {
		connMaxLifetime = 25 * time.Minute
	}
	connMaxIdleTime := 3 * time.Minute

	db.SetMaxOpenConns(maxOpenConns)
	db.SetMaxIdleConns(maxIdleConns)
	db.SetConnMaxLifetime(connMaxLifetime)
	db.SetConnMaxIdleTime(connMaxIdleTime)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		// Clean up TLS config on connection failure
		if req.TlsMode == "custom" {
			goMySQL.DeregisterTLSConfig("mdb-custom-" + req.ConnectionID)
		}
		return "", shared.NewConnectionFailed("mysql", "failed to ping database: "+err.Error())
	}

	// Execute init SQL statements
	if req.InitSql != "" {
		if err := executeInitSQL(db, req); err != nil {
			db.Close()
			if req.TlsMode == "custom" {
				goMySQL.DeregisterTLSConfig("mdb-custom-" + req.ConnectionID)
			}
			return "", shared.NewConnectionFailed("mysql", err.Error())
		}
	}

	// Create heartbeat context and cancel function BEFORE starting goroutine.
	hbCtx, hbCancel := context.WithCancel(context.Background())

	// Atomic swap: connection + heartbeat cancel in a single lock scope.
	m.connManager.mu.Lock()
	oldDB := m.connManager.connections[req.ConnectionID]
	oldHeartbeatCancel := m.connManager.heartbeats[req.ConnectionID]
	m.connManager.connections[req.ConnectionID] = db
	m.connManager.heartbeats[req.ConnectionID] = hbCancel
	// Store connect request for auto-reconnect
	if req.AutoReconnect {
		m.connManager.connectReqs[req.ConnectionID] = req
	}
	m.connManager.mu.Unlock()

	// Stop existing heartbeat before starting the new one.
	if oldHeartbeatCancel != nil {
		oldHeartbeatCancel()
	}

	// Start new heartbeat with pre-created context.
	go m.startHeartbeat(req.ConnectionID, db, hbCtx)

	// Close old pool in background to avoid blocking the swap
	if oldDB != nil {
		go func() {
			oldDB.SetConnMaxIdleTime(1 * time.Second)
			time.Sleep(2 * time.Second)
			if err := oldDB.Close(); err != nil {
				shared.Logger.Error("error closing old connection pool",
					slog.String("connection_id", req.ConnectionID),
					slog.Any("error", err))
			}
		}()
	}

	return "Connected successfully", nil
}

func (m *Module) MysqlDisconnect(connectionID string) (string, error) {
	m.connManager.mu.Lock()
	db, exists := m.connManager.connections[connectionID]
	if exists {
		delete(m.connManager.connections, connectionID)
	}
	// Stop heartbeat goroutine
	if cancel := m.connManager.heartbeats[connectionID]; cancel != nil {
		cancel()
		delete(m.connManager.heartbeats, connectionID)
	}
	// Remove stored connect request
	delete(m.connManager.connectReqs, connectionID)
	m.connManager.mu.Unlock()

	if !exists {
		return "", shared.NewAppError(shared.ErrConnectionNotFound, "connection not found: "+connectionID, "mysql")
	}

	if err := db.Close(); err != nil {
		shared.Logger.Error("error closing connection pool",
			slog.String("connection_id", connectionID),
			slog.Any("error", err))
	}
	// Clean up TLS config
	goMySQL.DeregisterTLSConfig("mdb-custom-" + connectionID)
	_ = m.connManager.sshTunnels.Close(connectionID)
	return "Disconnected successfully", nil
}

func (m *Module) MysqlPing(connectionID string) (string, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[connectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return "", shared.NewAppError(shared.ErrConnectionNotFound, "connection not found: "+connectionID, "mysql")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return "", shared.NewAppError(shared.ErrTimeout, "ping failed: "+err.Error(), "mysql")
	}
	return "Pong", nil
}

// startHeartbeat runs a background goroutine that periodically pings the
// database to keep the connection alive. It stops when ctx is cancelled.
func (m *Module) startHeartbeat(connectionID string, db *sql.DB, ctx context.Context) {

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	consecutiveFails := 0
	const maxConsecutiveFails = 3

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.connManager.mu.RLock()
			currentDB := m.connManager.connections[connectionID]
			req, hasReq := m.connManager.connectReqs[connectionID]
			m.connManager.mu.RUnlock()
			if currentDB != db {
				return
			}

			pingCtx, pingCancel := context.WithTimeout(context.Background(), 3*time.Second)
			err := db.PingContext(pingCtx)
			pingCancel()
			if err != nil {
				consecutiveFails++
				shared.Logger.Error("mysql heartbeat ping failed",
					slog.String("connection_id", connectionID),
					slog.Any("error", err),
					slog.Int("consecutive_fails", consecutiveFails))

				if consecutiveFails >= maxConsecutiveFails {
					// Try auto-reconnect if enabled
					if hasReq && req.AutoReconnect {
						if m.tryAutoReconnect(connectionID, req) {
							consecutiveFails = 0
							continue
						}
					}

					shared.Logger.Warn("removing connection after heartbeat ping failures",
						slog.String("connection_id", connectionID),
						slog.Int("failures", maxConsecutiveFails))
					m.connManager.mu.Lock()
					delete(m.connManager.connections, connectionID)
					delete(m.connManager.heartbeats, connectionID)
					delete(m.connManager.connectReqs, connectionID)
					m.connManager.mu.Unlock()
					db.Close()
					if req.TlsMode == "custom" {
						goMySQL.DeregisterTLSConfig("mdb-custom-" + connectionID)
					}
					return
				}
			} else {
				consecutiveFails = 0
			}
		}
	}
}

// tryAutoReconnect attempts to re-establish a failed connection.
// Returns true if reconnect succeeded.
func (m *Module) tryAutoReconnect(connectionID string, req MysqlConnectRequest) bool {
	maxAttempts := req.MaxReconnectAttempts
	if maxAttempts <= 0 {
		maxAttempts = 5
	}
	interval := req.ReconnectInterval
	if interval <= 0 {
		interval = 10
	}

	shared.Logger.Info("attempting auto-reconnect for MySQL connection",
		slog.String("connection_id", connectionID),
		slog.Int("max_attempts", maxAttempts))

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		time.Sleep(time.Duration(interval) * time.Second)

		// Check if connection was explicitly disconnected during wait
		m.connManager.mu.RLock()
		_, stillExists := m.connManager.connections[connectionID]
		m.connManager.mu.RUnlock()
		if !stillExists {
			return false
		}

		// Rebuild connection using the stored request
		result, err := m.MysqlConnect(req)
		if err != nil {
			shared.Logger.Error("auto-reconnect attempt failed",
				slog.String("connection_id", connectionID),
				slog.Int("attempt", attempt),
				slog.Any("error", err))
			continue
		}

		shared.Logger.Info("auto-reconnect succeeded",
			slog.String("connection_id", connectionID),
			slog.Int("attempt", attempt),
			slog.String("result", result))
		return true
	}

	shared.Logger.Warn("auto-reconnect exhausted all attempts",
		slog.String("connection_id", connectionID),
		slog.Int("attempts", maxAttempts))
	return false
}

// executeInitSQL parses and executes init SQL statements after connection.
func executeInitSQL(db *sql.DB, req MysqlConnectRequest) error {
	statements := splitMysqlStatements(req.InitSql)
	for _, stmt := range statements {
		if !shouldExecuteMysqlStatement(stmt) {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		_, err := db.ExecContext(ctx, stmt)
		cancel()
		if err != nil {
			if req.IgnoreSqlErrors {
				shared.Logger.Warn("init SQL statement failed (ignored)",
					slog.String("statement", stmt),
					slog.Any("error", err))
				continue
			}
			return fmt.Errorf("init SQL failed: %s: %w", stmt, err)
		}
	}
	return nil
}
