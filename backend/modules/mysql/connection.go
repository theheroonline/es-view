package mysql

import (
	"context"
	"database/sql"
	"fmt"
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
	db.SetConnMaxLifetime(90 * time.Second)
	db.SetConnMaxIdleTime(60 * time.Second)
	db.SetMaxIdleConns(1)
	db.SetMaxOpenConns(5)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return "", fmt.Errorf("failed to ping database: %w", err)
	}

	m.connManager.mu.Lock()
	defer m.connManager.mu.Unlock()
	if existing, exists := m.connManager.connections[req.ConnectionID]; exists {
		_ = existing.Close()
	}
	m.connManager.connections[req.ConnectionID] = db

	return "Connected successfully", nil
}

func (m *Module) MysqlDisconnect(connectionID string) (string, error) {
	m.connManager.mu.Lock()
	defer m.connManager.mu.Unlock()
	if db, exists := m.connManager.connections[connectionID]; exists {
		err := db.Close()
		delete(m.connManager.connections, connectionID)
		if err != nil {
			return "", fmt.Errorf("failed to close connection: %w", err)
		}
		_ = m.connManager.sshTunnels.Close(connectionID)
		return "Disconnected successfully", nil
	}
	return "", fmt.Errorf("connection not found: %s", connectionID)
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
