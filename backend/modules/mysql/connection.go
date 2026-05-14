package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
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
	config.Params = map[string]string{
		"charset":   "utf8mb4",
		"collation": "utf8mb4_unicode_ci",
	}
	config.ParseTime = true
	config.Loc = time.Local
	config.Timeout = 3 * time.Second
	config.ReadTimeout = 5 * time.Second
	config.WriteTimeout = 5 * time.Second

	var addr string
	if req.SshEnabled {
		sshCfg := sshtunnel.Config{
			Host:     req.SshHost,
			Port:     req.SshPort,
			Username: req.SshUsername,
			Password: req.SshPassword,
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
		return "", shared.NewConnectionFailed("mysql", "failed to ping database: "+err.Error())
	}

	// Create heartbeat context and cancel function BEFORE starting goroutine.
	// This ensures MysqlDisconnect can find and call cancel() immediately.
	hbCtx, hbCancel := context.WithCancel(context.Background())

	// Atomic swap: connection + heartbeat cancel in a single lock scope.
	m.connManager.mu.Lock()
	oldDB := m.connManager.connections[req.ConnectionID]
	oldHeartbeatCancel := m.connManager.heartbeats[req.ConnectionID]
	m.connManager.connections[req.ConnectionID] = db
	m.connManager.heartbeats[req.ConnectionID] = hbCancel
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
			// SetIdleTimeout to 0 so idle connections close immediately
			oldDB.SetConnMaxIdleTime(1 * time.Second)
			// Give in-flight queries a moment to finish
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
	m.connManager.mu.Unlock()

	if !exists {
		return "", shared.NewConnectionFailed("mysql", "connection not found: "+connectionID)
	}

	if err := db.Close(); err != nil {
		shared.Logger.Error("error closing connection pool",
			slog.String("connection_id", connectionID),
			slog.Any("error", err))
	}
	_ = m.connManager.sshTunnels.Close(connectionID)
	return "Disconnected successfully", nil
}

func (m *Module) MysqlPing(connectionID string) (string, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[connectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return "", shared.NewConnectionFailed("mysql", "connection not found: "+connectionID)
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
			shared.Logger.Info("mysql heartbeat stopped", slog.String("connection_id", connectionID))
			return
		case <-ticker.C:
			m.connManager.mu.RLock()
			currentDB := m.connManager.connections[connectionID]
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
					shared.Logger.Warn("removing connection after heartbeat ping failures",
						slog.String("connection_id", connectionID),
						slog.Int("failures", maxConsecutiveFails))
					// Clean up before returning to avoid goroutine/resource leaks
					m.connManager.mu.Lock()
					delete(m.connManager.connections, connectionID)
					delete(m.connManager.heartbeats, connectionID)
					m.connManager.mu.Unlock()
					db.Close()
					return
				}
			} else {
				consecutiveFails = 0
			}
		}
	}
}
