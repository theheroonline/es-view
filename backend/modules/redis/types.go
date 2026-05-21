package redis

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	goRedis "github.com/redis/go-redis/v9"

	"golang.org/x/sync/singleflight"

	"multi-database-browsing/backend/infra/sshtunnel"
)

type RedisConnectRequest struct {
	ConnectionID string `json:"connectionId"`
	Host         string `json:"host"`
	Port         uint16 `json:"port"`
	Database     int    `json:"database"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	// SSH tunnel (basic)
	SshEnabled   bool   `json:"sshEnabled"`
	SshHost      string `json:"sshHost"`
	SshPort      int    `json:"sshPort"`
	SshUsername  string `json:"sshUsername"`
	SshPassword  string `json:"sshPassword"`
	// SSH key authentication
	SshPrivateKeyPath string `json:"sshPrivateKeyPath"`
	SshPrivateKeyPem  string `json:"sshPrivateKeyPem"`
	SshPassphrase     string `json:"sshPassphrase"`
	SshUseAgent       bool   `json:"sshUseAgent"`
	// SSH host key verification
	SshHostKeyMode    string `json:"sshHostKeyMode"`
	SshKnownHostsPath string `json:"sshKnownHostsPath"`
	// TLS
	TlsMode           string `json:"tlsMode"` // "" | "required" | "verify_ca" | "verify_identity" | "custom"
	TlsCaCertPath     string `json:"tlsCaCertPath"`
	TlsCaCertPem      string `json:"tlsCaCertPem"`
	TlsClientCertPath string `json:"tlsClientCertPath"`
	TlsClientCertPem  string `json:"tlsClientCertPem"`
	TlsClientKeyPath  string `json:"tlsClientKeyPath"`
	TlsClientKeyPem   string `json:"tlsClientKeyPem"`
}

type RedisDatabaseInfo struct {
	Index     int64   `json:"index"`
	Label     string  `json:"label"`
	KeyCount  *uint64 `json:"keyCount"`
	IsDefault bool    `json:"isDefault"`
}

type RedisKeySummary struct {
	Name    string `json:"name"`
	KeyType string `json:"keyType"`
	TTLMS   *int64 `json:"ttlMs"`
}

type RedisScanResult struct {
	NextCursor string            `json:"nextCursor"`
	Items      []RedisKeySummary `json:"items"`
	HasMore    bool              `json:"hasMore"`
}

type RedisKeyDetail struct {
	Name        string          `json:"name"`
	KeyType     string          `json:"keyType"`
	TTLMS       *int64          `json:"ttlMs"`
	Encoding    *string         `json:"encoding"`
	ValueEncoding string        `json:"valueEncoding"` // "utf8" | "base64" | "binary"
	Size        *uint64         `json:"size"`
	Value       json.RawMessage `json:"value"`
	Truncated   bool            `json:"truncated"`
	Unsupported bool            `json:"unsupported"`
	IsBinary    bool            `json:"isBinary"`
}

type RedisCommandResult struct {
	Command string `json:"command"`
	Output  string `json:"output"`
}

type RedisScanRequest struct {
	ConnectionID string  `json:"connectionId"`
	Database     int     `json:"database"`
	Pattern      *string `json:"pattern"`
	Cursor       *string `json:"cursor"`
	Count        *uint64 `json:"count"`
}

type RedisKeyRequest struct {
	ConnectionID string `json:"connectionId"`
	Database     int    `json:"database"`
	Key          string `json:"key"`
}

type RedisExecuteRequest struct {
	ConnectionID string   `json:"connectionId"`
	Database     int      `json:"database"`
	Command      string   `json:"command"`
	Args         []string `json:"args"`
}

type RedisSetKeyRequest struct {
	ConnectionID string          `json:"connectionId"`
	Database     int             `json:"database"`
	Key          string          `json:"key"`
	OriginalKey  string          `json:"originalKey"`
	KeyType      string          `json:"keyType"`
	Value        json.RawMessage `json:"value"`
	TTL          *int64          `json:"ttl"`
	TTLMS        *int64          `json:"ttlMs"`
	Overwrite    bool            `json:"overwrite"`
}

type RedisDeleteKeysRequest struct {
	ConnectionID string   `json:"connectionId"`
	Database     int      `json:"database"`
	Keys         []string `json:"keys"`
}

type RedisUpdateTTLRequest struct {
	ConnectionID string `json:"connectionId"`
	Database     int    `json:"database"`
	Key          string `json:"key"`
	TTL          int64  `json:"ttl"`
}

type redisZSetEntry struct {
	Member string  `json:"member"`
	Score  float64 `json:"score"`
}

type RedisConnectionManager struct {
	mu          sync.RWMutex
	connections map[string]map[int]*goRedis.Client
	options     map[string]*goRedis.Options
	sshTunnels  *sshtunnel.Manager
	// inFlight deduplicates concurrent client creation for the same (connID, db) pair.
	inFlight    singleflight.Group
}

func NewRedisConnectionManager() *RedisConnectionManager {
	return &RedisConnectionManager{
		connections: make(map[string]map[int]*goRedis.Client),
		options:     make(map[string]*goRedis.Options),
		sshTunnels:  sshtunnel.NewManager(),
	}
}

func (r *RedisConnectionManager) CloseAll() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for connID, dbClients := range r.connections {
		for db, client := range dbClients {
			if client != nil {
				if err := client.Close(); err != nil {
					log.Printf("[redis] error closing connection %s db %d: %v", connID, db, err)
				}
			}
		}
	}
	r.connections = make(map[string]map[int]*goRedis.Client)
	r.options = make(map[string]*goRedis.Options)
	r.sshTunnels.CloseAll()
}

func cloneRedisOptions(opts *goRedis.Options, database int) *goRedis.Options {
	cloned := &goRedis.Options{
		Addr:            opts.Addr,
		ClientName:      opts.ClientName,
		Protocol:        opts.Protocol,
		Username:        opts.Username,
		Password:        opts.Password,
		CredentialsProvider: opts.CredentialsProvider,
		DB:              database,
		MaxRetries:      opts.MaxRetries,
		MinRetryBackoff: opts.MinRetryBackoff,
		MaxRetryBackoff: opts.MaxRetryBackoff,
		DialTimeout:     opts.DialTimeout,
		ReadTimeout:     opts.ReadTimeout,
		WriteTimeout:    opts.WriteTimeout,
		ContextTimeoutEnabled: opts.ContextTimeoutEnabled,
		PoolFIFO:        opts.PoolFIFO,
		PoolSize:        opts.PoolSize,
		PoolTimeout:     opts.PoolTimeout,
		MinIdleConns:    opts.MinIdleConns,
		MaxIdleConns:    opts.MaxIdleConns,
		ConnMaxIdleTime: opts.ConnMaxIdleTime,
		ConnMaxLifetime: opts.ConnMaxLifetime,
		TLSConfig:       opts.TLSConfig, // Reference is fine for TLSConfig (read-only after creation)
		Limiter:         opts.Limiter,
		DisableIndentity: opts.DisableIndentity,
		IdentitySuffix:   opts.IdentitySuffix,
	}
	return cloned
}

func getRedisTTLMilliseconds(req RedisSetKeyRequest) *int64 {
	if req.TTLMS != nil {
		return req.TTLMS
	}

	return req.TTL
}

func applyRedisKeyTTL(ctx context.Context, client *goRedis.Client, key string, ttlMS *int64) error {
	if ttlMS == nil || *ttlMS <= 0 {
		return client.Persist(ctx, key).Err()
	}

	return client.PExpire(ctx, key, time.Duration(*ttlMS)*time.Millisecond).Err()
}
