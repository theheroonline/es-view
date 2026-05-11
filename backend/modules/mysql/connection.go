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
		maxIdleConns = 10
	}
	connMaxLifetime := time.Duration(req.ConnMaxLifetime) * time.Second
	if connMaxLifetime <= 0 {
		connMaxLifetime = 5 * time.Minute
	}

	db.SetConnMaxLifetime(connMaxLifetime)
	db.SetConnMaxIdleTime(connMaxLifetime)
	db.SetMaxIdleConns(maxIdleConns)
	db.SetMaxOpenConns(maxOpenConns)

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
