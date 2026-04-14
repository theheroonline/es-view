package mysql

import (
	"database/sql"
	"sync"

	"multi-database-browsing/backend/infra/sshtunnel"
)

// MysqlConnectRequest represents MySQL connection parameters.
type MysqlConnectRequest struct {
	ConnectionID string `json:"connectionId"`
	Host         string `json:"host"`
	Port         uint16 `json:"port"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	Database     string `json:"database"`
	SshEnabled   bool   `json:"sshEnabled"`
	SshHost      string `json:"sshHost"`
	SshPort      int    `json:"sshPort"`
	SshUsername  string `json:"sshUsername"`
	SshPassword  string `json:"sshPassword"`
}

// MysqlQueryResult represents the result of a query.
type MysqlQueryResult struct {
	Columns      []string        `json:"columns"`
	Rows         [][]interface{} `json:"rows"`
	AffectedRows int64           `json:"affectedRows"`
	IsResultSet  bool            `json:"isResultSet"`
}

// MysqlColumnMeta represents column metadata.
type MysqlColumnMeta struct {
	Field   string  `json:"field"`
	Type    string  `json:"type"`
	Null    string  `json:"null"`
	Key     string  `json:"key"`
	Default *string `json:"default"`
	Extra   string  `json:"extra"`
}

// MysqlIndexMeta represents index metadata.
type MysqlIndexMeta struct {
	Name      string   `json:"name"`
	Columns   []string `json:"columns"`
	Unique    bool     `json:"unique"`
	Primary   bool     `json:"primary"`
	IndexType string   `json:"indexType"`
}

// MysqlListIndexesRequest represents parameters for listing indexes.
type MysqlListIndexesRequest struct {
	ConnectionID string `json:"connectionId"`
	Database     string `json:"database"`
	TableName    string `json:"tableName"`
}

// MysqlCreateIndexRequest represents parameters for creating an index.
type MysqlCreateIndexRequest struct {
	ConnectionID string   `json:"connectionId"`
	Database     string   `json:"database"`
	TableName    string   `json:"tableName"`
	IndexName    string   `json:"indexName"`
	Columns      []string `json:"columns"`
	Unique       bool     `json:"unique"`
	IndexType    string   `json:"indexType"`
}

// MysqlDropIndexRequest represents parameters for dropping an index.
type MysqlDropIndexRequest struct {
	ConnectionID string `json:"connectionId"`
	Database     string `json:"database"`
	TableName    string `json:"tableName"`
	IndexName    string `json:"indexName"`
}

// MysqlExportRequest represents parameters for export operations.
type MysqlExportRequest struct {
	ConnectionID string   `json:"connectionId"`
	Database     string   `json:"database"`
	Table        string   `json:"tableName,omitempty"`
	Tables       []string `json:"tableNames,omitempty"`
	IncludeData  bool     `json:"includeData"`
}

// MysqlImportSqlRequest represents parameters for SQL import operations.
type MysqlImportSqlRequest struct {
	ConnectionID string `json:"connectionId"`
	Database     string `json:"database"`
	Table        string `json:"tableName,omitempty"`
}

// MysqlConnectionManager manages MySQL connections.
type MysqlConnectionManager struct {
	mu          sync.RWMutex
	connections map[string]*sql.DB
	sshTunnels  *sshtunnel.Manager
}

// NewMysqlConnectionManager creates a new manager.
func NewMysqlConnectionManager() *MysqlConnectionManager {
	return &MysqlConnectionManager{
		connections: make(map[string]*sql.DB),
		sshTunnels:  sshtunnel.NewManager(),
	}
}

func (m *MysqlConnectionManager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, db := range m.connections {
		if db != nil {
			_ = db.Close()
		}
	}
	m.connections = make(map[string]*sql.DB)
	m.sshTunnels.CloseAll()
}
