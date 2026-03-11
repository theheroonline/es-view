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

// MysqlIndexMeta represents index metadata
type MysqlIndexMeta struct {
	Name      string   `json:"name"`
	Columns   []string `json:"columns"`
	Unique    bool     `json:"unique"`
	Primary   bool     `json:"primary"`
	IndexType string   `json:"indexType"`
}

// MysqlListIndexesRequest represents parameters for listing indexes
type MysqlListIndexesRequest struct {
	ConnectionID string `json:"connectionId"`
	Database     string `json:"database"`
	TableName    string `json:"tableName"`
}

// MysqlCreateIndexRequest represents parameters for creating an index
type MysqlCreateIndexRequest struct {
	ConnectionID string   `json:"connectionId"`
	Database     string   `json:"database"`
	TableName    string   `json:"tableName"`
	IndexName    string   `json:"indexName"`
	Columns      []string `json:"columns"`
	Unique       bool     `json:"unique"`
	IndexType    string   `json:"indexType"`
}

// MysqlDropIndexRequest represents parameters for dropping an index
type MysqlDropIndexRequest struct {
	ConnectionID string `json:"connectionId"`
	Database     string `json:"database"`
	TableName    string `json:"tableName"`
	IndexName    string `json:"indexName"`
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

	// Set character set to ensure proper encoding
	if _, err := db.Exec("SET NAMES utf8mb4"); err != nil {
		return MysqlQueryResult{}, fmt.Errorf("failed to set character set: %w", err)
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

		// Convert byte slices to strings for proper UTF-8 handling
		for i, val := range values {
			if bytes, ok := val.([]byte); ok {
				values[i] = string(bytes)
			}
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

	// Use database-qualified query instead of USE command to avoid race conditions
	query := "SHOW TABLES"
	if database != "" {
		query = fmt.Sprintf("SHOW TABLES FROM `%s`", database)
	}

	rows, err := db.Query(query)
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

	// Use database-qualified table name to avoid race conditions from USE command
	var query string
	if database != "" {
		query = fmt.Sprintf("DESCRIBE `%s`.`%s`", database, tableName)
	} else {
		query = fmt.Sprintf("DESCRIBE `%s`", tableName)
	}

	rows, err := db.Query(query)
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

// MysqlListIndexes returns list of indexes for a table
func (a *App) MysqlListIndexes(req MysqlListIndexesRequest) ([]MysqlIndexMeta, error) {
	a.mysqlConnManager.mu.RLock()
	db, exists := a.mysqlConnManager.connections[req.ConnectionID]
	a.mysqlConnManager.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	// Use database-qualified table name to avoid race conditions from USE command
	var query string
	if req.Database != "" {
		query = fmt.Sprintf("SHOW INDEX FROM `%s`.`%s`", req.Database, req.TableName)
	} else {
		query = fmt.Sprintf("SHOW INDEX FROM `%s`", req.TableName)
	}

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list indexes: %w", err)
	}
	defer rows.Close()

	// Map to track unique indexes
	indexMap := make(map[string]*MysqlIndexMeta)

	for rows.Next() {
		var table, nonUnique, keyName, seqInIndex, columnName, collation, cardinality, subPart, packed, null_, indexType, comment, indexComment, visible, expression sql.NullString

		if err := rows.Scan(&table, &nonUnique, &keyName, &seqInIndex, &columnName, &collation, &cardinality, &subPart, &packed, &null_, &indexType, &comment, &indexComment, &visible, &expression); err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}

		if !keyName.Valid {
			continue
		}

		name := keyName.String
		if _, exists := indexMap[name]; !exists {
			indexTypeStr := "BTREE"
			if indexType.Valid {
				indexTypeStr = indexType.String
			}
			indexMap[name] = &MysqlIndexMeta{
				Name:      name,
				Columns:   []string{},
				Unique:    nonUnique.Valid && nonUnique.String == "0",
				Primary:   name == "PRIMARY",
				IndexType: indexTypeStr,
			}
		}

		if columnName.Valid {
			indexMap[name].Columns = append(indexMap[name].Columns, columnName.String)
		}
	}

	// Convert map to slice
	indexes := make([]MysqlIndexMeta, 0)
	for _, index := range indexMap {
		indexes = append(indexes, *index)
	}

	return indexes, nil
}

// MysqlCreateIndex creates a new index on a table
func (a *App) MysqlCreateIndex(req MysqlCreateIndexRequest) (string, error) {
	a.mysqlConnManager.mu.RLock()
	db, exists := a.mysqlConnManager.connections[req.ConnectionID]
	a.mysqlConnManager.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	if len(req.Columns) == 0 {
		return "", fmt.Errorf("at least one column is required for index")
	}

	// Build column list
	columnList := ""
	for i, col := range req.Columns {
		if i > 0 {
			columnList += ", "
		}
		columnList += fmt.Sprintf("`%s`", col)
	}

	// Build CREATE INDEX statement with database-qualified table name
	uniqueStr := ""
	if req.Unique {
		uniqueStr = "UNIQUE "
	}

	typeStr := ""
	if req.IndexType != "" && req.IndexType != "BTREE" {
		typeStr = fmt.Sprintf(" USING %s", req.IndexType)
	}

	var query string
	if req.Database != "" {
		query = fmt.Sprintf("CREATE %sINDEX `%s` ON `%s`.`%s` (%s)%s", uniqueStr, req.IndexName, req.Database, req.TableName, columnList, typeStr)
	} else {
		query = fmt.Sprintf("CREATE %sINDEX `%s` ON `%s` (%s)%s", uniqueStr, req.IndexName, req.TableName, columnList, typeStr)
	}

	if _, err := db.Exec(query); err != nil {
		return "", fmt.Errorf("failed to create index: %w", err)
	}

	return fmt.Sprintf("Index '%s' created successfully", req.IndexName), nil
}

// MysqlDropIndex removes an index from a table
func (a *App) MysqlDropIndex(req MysqlDropIndexRequest) (string, error) {
	a.mysqlConnManager.mu.RLock()
	db, exists := a.mysqlConnManager.connections[req.ConnectionID]
	a.mysqlConnManager.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	// Cannot drop PRIMARY key using DROP INDEX
	if req.IndexName == "PRIMARY" {
		return "", fmt.Errorf("cannot drop PRIMARY key using DROP INDEX, use ALTER TABLE instead")
	}

	// Use database-qualified table name to avoid race conditions from USE command
	var query string
	if req.Database != "" {
		query = fmt.Sprintf("DROP INDEX `%s` ON `%s`.`%s`", req.IndexName, req.Database, req.TableName)
	} else {
		query = fmt.Sprintf("DROP INDEX `%s` ON `%s`", req.IndexName, req.TableName)
	}

	if _, err := db.Exec(query); err != nil {
		return "", fmt.Errorf("failed to drop index: %w", err)
	}

	return fmt.Sprintf("Index '%s' dropped successfully", req.IndexName), nil
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
