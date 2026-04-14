package redis

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	goRedis "github.com/redis/go-redis/v9"

	"multi-database-browsing/backend/infra/sshtunnel"
)

type RedisConnectRequest struct {
	ConnectionID string `json:"connectionId"`
	Host         string `json:"host"`
	Port         uint16 `json:"port"`
	Database     int    `json:"database"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	SshEnabled   bool   `json:"sshEnabled"`
	SshHost      string `json:"sshHost"`
	SshPort      int    `json:"sshPort"`
	SshUsername  string `json:"sshUsername"`
	SshPassword  string `json:"sshPassword"`
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
	Size        *uint64         `json:"size"`
	Value       json.RawMessage `json:"value"`
	Truncated   bool            `json:"truncated"`
	Unsupported bool            `json:"unsupported"`
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
	for _, dbClients := range r.connections {
		for _, client := range dbClients {
			if client != nil {
				_ = client.Close()
			}
		}
	}
	r.connections = make(map[string]map[int]*goRedis.Client)
	r.options = make(map[string]*goRedis.Options)
	r.sshTunnels.CloseAll()
}

func cloneRedisOptions(opts *goRedis.Options, database int) *goRedis.Options {
	cloned := *opts
	cloned.DB = database
	return &cloned
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
