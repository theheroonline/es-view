package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	goMySQL "github.com/go-sql-driver/mysql"

	"multi-database-browsing/backend/infra/sshtunnel"
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
			return "", fmt.Errorf("failed to establish SSH tunnel: %w", err)
		}
		addr = fmt.Sprintf("127.0.0.1:%d", localPort)
	} else {
		addr = fmt.Sprintf("%s:%d", req.Host, req.Port)
	}
	config.Addr = addr

	dsn := config.FormatDSN()

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return "", fmt.Errorf("failed to open connection: %w", err)
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
		return "", fmt.Errorf("failed to ping database: %w", err)
	}

	// Graceful reconnect: swap atomically, close old pool in background
	m.connManager.mu.Lock()
	oldDB := m.connManager.connections[req.ConnectionID]
	m.connManager.connections[req.ConnectionID] = db
	m.connManager.mu.Unlock()

	// Stop any existing heartbeat for this connection
	m.connManager.mu.Lock()
	if oldCancel := m.connManager.heartbeats[req.ConnectionID]; oldCancel != nil {
		oldCancel()
	}
	m.connManager.heartbeats[req.ConnectionID] = nil
	m.connManager.mu.Unlock()

	// Start heartbeat goroutine to keep the connection alive
	go m.startHeartbeat(req.ConnectionID, db)

	// Close old pool in background to avoid blocking the swap
	if oldDB != nil {
		go func() {
			// SetIdleTimeout to 0 so idle connections close immediately
			oldDB.SetConnMaxIdleTime(1 * time.Second)
			// Give in-flight queries a moment to finish
			time.Sleep(2 * time.Second)
			if err := oldDB.Close(); err != nil {
				log.Printf("[mysql] error closing old connection pool %s: %v", req.ConnectionID, err)
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
		return "", fmt.Errorf("connection not found: %s", connectionID)
	}

	if err := db.Close(); err != nil {
		log.Printf("[mysql] error closing connection pool %s: %v", connectionID, err)
	}
	_ = m.connManager.sshTunnels.Close(connectionID)
	return "Disconnected successfully", nil
}

func (m *Module) MysqlPing(connectionID string) (string, error) {
	m.connManager.mu.RLock()
	db, exists := m.connManager.connections[connectionID]
	m.connManager.mu.RUnlock()
	if !exists {
		return "", fmt.Errorf("connection not found: %s", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return "", fmt.Errorf("ping failed: %w", err)
	}
	return "Pong", nil
}

// startHeartbeat runs a background goroutine that periodically pings the
// database to keep the connection alive. It stops when the context is cancelled.
func (m *Module) startHeartbeat(connectionID string, db *sql.DB) {
	ctx, cancel := context.WithCancel(context.Background())

	m.connManager.mu.Lock()
	m.connManager.heartbeats[connectionID] = cancel
	m.connManager.mu.Unlock()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	consecutiveFails := 0
	const maxConsecutiveFails = 3

	for {
		select {
		case <-ctx.Done():
			log.Printf("[mysql] heartbeat stopped for connection %s", connectionID)
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
				log.Printf("[mysql] heartbeat ping failed for connection %s (%d/%d): %v", connectionID, consecutiveFails, maxConsecutiveFails, err)
				if consecutiveFails >= maxConsecutiveFails {
					log.Printf("[mysql] removing connection %s after %d consecutive ping failures", connectionID, maxConsecutiveFails)
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
