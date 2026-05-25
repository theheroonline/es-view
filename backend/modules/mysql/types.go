package mysql

import (
	"context"
	"database/sql"
	"sync"

	"multi-database-browsing/backend/infra/sshtunnel"
)

// MysqlConnectRequest represents MySQL connection parameters.
type MysqlConnectRequest struct {
	ConnectionID   string `json:"connectionId"`
	Host           string `json:"host"`
	Port           uint16 `json:"port"`
	Username       string `json:"username"`
	Password       string `json:"password"`
	Database       string `json:"database"`
	SshEnabled     bool   `json:"sshEnabled"`
	SshHost        string `json:"sshHost"`
	SshPort        int    `json:"sshPort"`
	SshUsername    string `json:"sshUsername"`
	SshPassword    string `json:"sshPassword"`
	// SSH key authentication
	SshPrivateKeyPath string `json:"sshPrivateKeyPath"`
	SshPrivateKeyPem  string `json:"sshPrivateKeyPem"`
	SshPassphrase     string `json:"sshPassphrase"`
	SshUseAgent       bool   `json:"sshUseAgent"`
	// SSH host key verification
	SshHostKeyMode    string `json:"sshHostKeyMode"`
	SshKnownHostsPath string `json:"sshKnownHostsPath"`
	// MySQL TLS
	TlsMode           string `json:"tlsMode"` // "" | "required" | "verify_ca" | "verify_identity" | "custom"
	TlsCaCertPath     string `json:"tlsCaCertPath"`
	TlsCaCertPem      string `json:"tlsCaCertPem"`
	TlsClientCertPath string `json:"tlsClientCertPath"`
	TlsClientCertPem  string `json:"tlsClientCertPem"`
	TlsClientKeyPath  string `json:"tlsClientKeyPath"`
	TlsClientKeyPem   string `json:"tlsClientKeyPem"`
	// Connection bootstrap
	InitSql         string            `json:"initSql"`
	IgnoreSqlErrors bool              `json:"ignoreSqlErrors"`
	DriverParams    map[string]string `json:"driverParams"` // custom DSN params
	// Pool settings
	MaxOpenConns   int `json:"maxOpenConns"`   // 0 = default 50
	MaxIdleConns   int `json:"maxIdleConns"`   // 0 = default 10
	ConnMaxLifetime int `json:"connMaxLifetime"` // seconds, 0 = default 300
	// Auto-reconnect
	AutoReconnect        bool `json:"autoReconnect"`
	MaxReconnectAttempts int  `json:"maxReconnectAttempts"`
	ReconnectInterval    int  `json:"reconnectInterval"` // seconds between reconnect attempts
}

// MysqlQueryResult represents the result of a query.
type MysqlQueryResult struct {
	Columns      []string        `json:"columns"`
	ColumnTypes  []string        `json:"columnTypes"`
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
	mu             sync.RWMutex
	connections    map[string]*sql.DB
	heartbeats     map[string]context.CancelFunc // stop funcs for heartbeat goroutines
	connectReqs    map[string]MysqlConnectRequest // original connect requests for auto-reconnect
	sshTunnels     *sshtunnel.Manager
}

// NewMysqlConnectionManager creates a new manager.
func NewMysqlConnectionManager() *MysqlConnectionManager {
	return &MysqlConnectionManager{
		connections: make(map[string]*sql.DB),
		heartbeats:  make(map[string]context.CancelFunc),
		connectReqs: make(map[string]MysqlConnectRequest),
		sshTunnels:  sshtunnel.NewManager(),
	}
}

func (m *MysqlConnectionManager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, cancel := range m.heartbeats {
		if cancel != nil {
			cancel()
		}
	}
	for _, db := range m.connections {
		if db != nil {
			_ = db.Close()
		}
	}
	m.connections = make(map[string]*sql.DB)
	m.heartbeats = make(map[string]context.CancelFunc)
	m.sshTunnels.CloseAll()
}
