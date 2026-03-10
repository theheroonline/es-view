package main

import (
	"database/sql"
	"fmt"
	"sync"

	_ "github.com/go-sql-driver/mysql"
)

// MysqlConnectRequest represents MySQL connection parameters
type MysqlConnectRequest struct {
	ConnectionID string `json:"connectionId"`
	Host         string `json:"host"`
	Port         uint16 `json:"port"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	Database     string `json:"database"`
}

// MysqlQueryResult represents the result of a query
type MysqlQueryResult struct {
	Columns      []string        `json:"columns"`
	Rows         [][]interface{} `json:"rows"`
	AffectedRows int64           `json:"affectedRows"`
	IsResultSet  bool            `json:"isResultSet"`
}

// MysqlColumnMeta represents column metadata
type MysqlColumnMeta struct {
	Field   string  `json:"field"`
	Type    string  `json:"type"`
	Null    string  `json:"null"`
	Key     string  `json:"key"`
	Default *string `json:"default"`
	Extra   string  `json:"extra"`
}

// MysqlConnectionManager manages MySQL connections
type MysqlConnectionManager struct {
	mu          sync.RWMutex
	connections map[string]*sql.DB
}

// NewMysqlConnectionManager creates a new manager
func NewMysqlConnectionManager() *MysqlConnectionManager {
	return &MysqlConnectionManager{
		connections: make(map[string]*sql.DB),
	}
}

// MysqlConnect establishes a MySQL connection
func (a *App) MysqlConnect(req MysqlConnectRequest) (string, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		req.Username, req.Password, req.Host, req.Port, req.Database)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return "", fmt.Errorf("failed to open connection: %w", err)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		db.Close()
		return "", fmt.Errorf("failed to ping database: %w", err)
	}

	a.mysqlConnManager.mu.Lock()
	defer a.mysqlConnManager.mu.Unlock()
	a.mysqlConnManager.connections[req.ConnectionID] = db

	return "Connected successfully", nil
}

// MysqlDisconnect closes a MySQL connection
func (a *App) MysqlDisconnect(connectionID string) (string, error) {
	a.mysqlConnManager.mu.Lock()
	defer a.mysqlConnManager.mu.Unlock()

	if db, exists := a.mysqlConnManager.connections[connectionID]; exists {
		err := db.Close()
		delete(a.mysqlConnManager.connections, connectionID)
		if err != nil {
			return "", fmt.Errorf("failed to close connection: %w", err)
		}
		return "Disconnected successfully", nil
	}

	return "", fmt.Errorf("connection not found: %s", connectionID)
}

// MysqlPing tests MySQL connection
func (a *App) MysqlPing(connectionID string) (string, error) {
	a.mysqlConnManager.mu.RLock()
	db, exists := a.mysqlConnManager.connections[connectionID]
	a.mysqlConnManager.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("connection not found: %s", connectionID)
	}

	err := db.Ping()
	if err != nil {
		return "", fmt.Errorf("ping failed: %w", err)
	}

	return "Pong", nil
}

// MysqlQuery executes a query and returns results
func (a *App) MysqlQuery(connectionID string, query string) (MysqlQueryResult, error) {
	a.mysqlConnManager.mu.RLock()
	db, exists := a.mysqlConnManager.connections[connectionID]
	a.mysqlConnManager.mu.RUnlock()

	if !exists {
		return MysqlQueryResult{}, fmt.Errorf("connection not found: %s", connectionID)
	}

	rows, err := db.Query(query)
	if err != nil {
		return MysqlQueryResult{}, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return MysqlQueryResult{}, fmt.Errorf("failed to get columns: %w", err)
	}

	result := MysqlQueryResult{
		Columns:     columns,
		Rows:        [][]interface{}{},
		IsResultSet: true,
	}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		err := rows.Scan(valuePtrs...)
		if err != nil {
			return MysqlQueryResult{}, fmt.Errorf("scan failed: %w", err)
		}

		result.Rows = append(result.Rows, values)
	}

	return result, nil
}

// MysqlListDatabases returns list of databases
func (a *App) MysqlListDatabases(connectionID string) ([]string, error) {
	a.mysqlConnManager.mu.RLock()
	db, exists := a.mysqlConnManager.connections[connectionID]
	a.mysqlConnManager.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	rows, err := db.Query("SHOW DATABASES")
	if err != nil {
		return nil, fmt.Errorf("failed to list databases: %w", err)
	}
	defer rows.Close()

	databases := make([]string, 0)
	for rows.Next() {
		var dbName string
		if err := rows.Scan(&dbName); err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		databases = append(databases, dbName)
	}

	return databases, nil
}

// MysqlListTables returns list of tables in database
func (a *App) MysqlListTables(connectionID string, database string) ([]string, error) {
	a.mysqlConnManager.mu.RLock()
	db, exists := a.mysqlConnManager.connections[connectionID]
	a.mysqlConnManager.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	rows, err := db.Query(fmt.Sprintf("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '%s' ORDER BY TABLE_NAME", database))
	if err != nil {
		return nil, fmt.Errorf("failed to list tables: %w", err)
	}
	defer rows.Close()

	tables := make([]string, 0)
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		tables = append(tables, tableName)
	}

	return tables, nil
}

// MysqlDescribeTable returns table structure
func (a *App) MysqlDescribeTable(connectionID string, database string, tableName string) ([]MysqlColumnMeta, error) {
	a.mysqlConnManager.mu.RLock()
	db, exists := a.mysqlConnManager.connections[connectionID]
	a.mysqlConnManager.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	rows, err := db.Query(fmt.Sprintf("DESCRIBE `%s`.`%s`", database, tableName))
	if err != nil {
		return nil, fmt.Errorf("failed to describe table: %w", err)
	}
	defer rows.Close()

	columns := make([]MysqlColumnMeta, 0)
	for rows.Next() {
		var col MysqlColumnMeta
		var defaultVal sql.NullString
		if err := rows.Scan(&col.Field, &col.Type, &col.Null, &col.Key, &defaultVal, &col.Extra); err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		if defaultVal.Valid {
			col.Default = &defaultVal.String
		}
		columns = append(columns, col)
	}

	return columns, nil
}

// CloseAll closes all connections
func (m *MysqlConnectionManager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, db := range m.connections {
		if db != nil {
			_ = db.Close()
		}
	}
}
