package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisConnectRequest represents Redis connection parameters
type RedisConnectRequest struct {
	ConnectionID string `json:"connectionId"`
	Host         string `json:"host"`
	Port         uint16 `json:"port"`
	Database     int    `json:"database"`
	Username     string `json:"username"`
	Password     string `json:"password"`
}

// RedisDatabaseInfo represents database information
type RedisDatabaseInfo struct {
	Index      int64   `json:"index"`
	Label      string  `json:"label"`
	KeyCount   *uint64 `json:"keyCount"`
	IsDefault  bool    `json:"isDefault"`
}

// RedisKeySummary represents key summary
type RedisKeySummary struct {
	Name    string `json:"name"`
	KeyType string `json:"keyType"`
	TTLMS   *int64 `json:"ttlMs"`
}

// RedisScanResult represents scan results
type RedisScanResult struct {
	NextCursor string            `json:"nextCursor"`
	Items      []RedisKeySummary `json:"items"`
	HasMore    bool              `json:"hasMore"`
}

// RedisKeyDetail represents detailed key information
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

// RedisCommandResult represents command execution result
type RedisCommandResult struct {
	Command string `json:"command"`
	Output  string `json:"output"`
}

// RedisScanRequest represents scan request parameters
type RedisScanRequest struct {
	ConnectionID string  `json:"connectionId"`
	Database     int     `json:"database"`
	Pattern      *string `json:"pattern"`
	Cursor       *string `json:"cursor"`
	Count        *uint64 `json:"count"`
}

// RedisKeyRequest represents key request parameters
type RedisKeyRequest struct {
	ConnectionID string `json:"connectionId"`
	Database     int    `json:"database"`
	Key          string `json:"key"`
}

// RedisExecuteRequest represents command execution request
type RedisExecuteRequest struct {
	ConnectionID string   `json:"connectionId"`
	Database     int      `json:"database"`
	Command      string   `json:"command"`
	Args         []string `json:"args"`
}

// RedisSetKeyRequest represents set key request
type RedisSetKeyRequest struct {
	ConnectionID string          `json:"connectionId"`
	Database     int             `json:"database"`
	Key          string          `json:"key"`
	KeyType      string          `json:"keyType"`
	Value        json.RawMessage `json:"value"`
	TTL          *int64          `json:"ttl"`
}

// RedisDeleteKeysRequest represents delete keys request
type RedisDeleteKeysRequest struct {
	ConnectionID string   `json:"connectionId"`
	Database     int      `json:"database"`
	Keys         []string `json:"keys"`
}

// RedisUpdateTTLRequest represents update TTL request
type RedisUpdateTTLRequest struct {
	ConnectionID string `json:"connectionId"`
	Database     int    `json:"database"`
	Key          string `json:"key"`
	TTL          int64  `json:"ttl"`
}

// RedisConnectionManager manages Redis connections
type RedisConnectionManager struct {
	mu          sync.RWMutex
	connections map[string]*redis.Client
}

// NewRedisConnectionManager creates a new manager
func NewRedisConnectionManager() *RedisConnectionManager {
	return &RedisConnectionManager{
		connections: make(map[string]*redis.Client),
	}
}

// RedisConnect establishes a Redis connection
func (a *App) RedisConnect(req RedisConnectRequest) (string, error) {
	addr := fmt.Sprintf("%s:%d", req.Host, req.Port)
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: req.Password,
		DB:       req.Database,
		Username: req.Username,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.Ping(ctx).Err()
	if err != nil {
		client.Close()
		return "", fmt.Errorf("failed to connect: %w", err)
	}

	a.redisConnManager.mu.Lock()
	defer a.redisConnManager.mu.Unlock()
	a.redisConnManager.connections[req.ConnectionID] = client

	return "Connected successfully", nil
}

// RedisDisconnect closes a Redis connection
func (a *App) RedisDisconnect(connectionID string) (string, error) {
	a.redisConnManager.mu.Lock()
	defer a.redisConnManager.mu.Unlock()

	if client, exists := a.redisConnManager.connections[connectionID]; exists {
		err := client.Close()
		delete(a.redisConnManager.connections, connectionID)
		if err != nil {
			return "", fmt.Errorf("failed to close connection: %w", err)
		}
		return "Disconnected successfully", nil
	}

	return "", fmt.Errorf("connection not found: %s", connectionID)
}

// RedisListDatabases returns list of available databases
func (a *App) RedisListDatabases(connectionID string) ([]RedisDatabaseInfo, error) {
	a.redisConnManager.mu.RLock()
	client, exists := a.redisConnManager.connections[connectionID]
	a.redisConnManager.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	databases := make([]RedisDatabaseInfo, 0)

	for i := 0; i < 16; i++ {
		db := RedisDatabaseInfo{
			Index:     int64(i),
			Label:     fmt.Sprintf("DB %d", i),
			IsDefault: i == 0,
		}

		opts := client.Options()
		redisDB := redis.NewClient(&redis.Options{
			Addr:     opts.Addr,
			Password: opts.Password,
			DB:       i,
			Username: opts.Username,
		})

		count, err := redisDB.DBSize(ctx).Result()
		redisDB.Close()

		if err == nil && count > 0 {
			keyCount := uint64(count)
			db.KeyCount = &keyCount
		}

		databases = append(databases, db)
	}

	return databases, nil
}

// RedisScanKeys scans for keys
func (a *App) RedisScanKeys(req RedisScanRequest) (RedisScanResult, error) {
	a.redisConnManager.mu.RLock()
	client, exists := a.redisConnManager.connections[req.ConnectionID]
	a.redisConnManager.mu.RUnlock()

	if !exists {
		return RedisScanResult{}, fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var cursor uint64
	if req.Cursor != nil {
		c, _ := strconv.ParseUint(*req.Cursor, 10, 64)
		cursor = c
	}

	var count int64 = 100
	if req.Count != nil {
		count = int64(*req.Count)
	}

	var pattern string
	if req.Pattern != nil {
		pattern = *req.Pattern
	}

	scanClient := redis.NewClient(&redis.Options{
		Addr:     client.Options().Addr,
		Password: client.Options().Password,
		DB:       req.Database,
		Username: client.Options().Username,
	})
	defer scanClient.Close()

	cmd := scanClient.Scan(ctx, cursor, pattern, count)
	keys, nextCursor, err := cmd.Result()
	if err != nil {
		return RedisScanResult{}, fmt.Errorf("scan failed: %w", err)
	}

	items := make([]RedisKeySummary, 0)  // Initialize as empty slice, not nil
	for _, key := range keys {
		keyType, ttl := a.getKeyTypeAndTTL(scanClient, ctx, key)
		item := RedisKeySummary{
			Name:    key,
			KeyType: keyType,
		}
		if ttl >= 0 {
			ttlMS := int64(ttl.Milliseconds())
			item.TTLMS = &ttlMS
		}
		items = append(items, item)
	}

	result := RedisScanResult{
		NextCursor: strconv.FormatUint(nextCursor, 10),
		Items:      items,
		HasMore:    nextCursor != 0,
	}

	return result, nil
}

// RedisGetKeyDetail gets detailed key information
func (a *App) RedisGetKeyDetail(req RedisKeyRequest) (RedisKeyDetail, error) {
	a.redisConnManager.mu.RLock()
	client, exists := a.redisConnManager.connections[req.ConnectionID]
	a.redisConnManager.mu.RUnlock()

	if !exists {
		return RedisKeyDetail{}, fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	dbClient := redis.NewClient(&redis.Options{
		Addr:     client.Options().Addr,
		Password: client.Options().Password,
		DB:       req.Database,
		Username: client.Options().Username,
	})
	defer dbClient.Close()

	keyType, ttl := a.getKeyTypeAndTTL(dbClient, ctx, req.Key)

	detail := RedisKeyDetail{
		Name:    req.Key,
		KeyType: keyType,
	}

	if ttl >= 0 {
		ttlMS := int64(ttl.Milliseconds())
		detail.TTLMS = &ttlMS
	}

	switch keyType {
	case "string":
		val, err := dbClient.Get(ctx, req.Key).Result()
		if err == nil {
			detail.Value = []byte(fmt.Sprintf(`"%s"`, val))
		}
	case "hash":
		vals, err := dbClient.HGetAll(ctx, req.Key).Result()
		if err == nil {
			data, _ := json.Marshal(vals)
			detail.Value = data
		}
	case "list":
		vals, err := dbClient.LRange(ctx, req.Key, 0, -1).Result()
		if err == nil {
			data, _ := json.Marshal(vals)
			detail.Value = data
		}
	case "set":
		vals, err := dbClient.SMembers(ctx, req.Key).Result()
		if err == nil {
			data, _ := json.Marshal(vals)
			detail.Value = data
		}
	case "zset":
		vals, err := dbClient.ZRangeByScoreWithScores(ctx, req.Key, &redis.ZRangeBy{Min: "-inf", Max: "+inf"}).Result()
		if err == nil {
			data, _ := json.Marshal(vals)
			detail.Value = data
		}
	default:
		detail.Unsupported = true
	}

	return detail, nil
}

// RedisExecute executes a Redis command
func (a *App) RedisExecute(req RedisExecuteRequest) (RedisCommandResult, error) {
	a.redisConnManager.mu.RLock()
	client, exists := a.redisConnManager.connections[req.ConnectionID]
	a.redisConnManager.mu.RUnlock()

	if !exists {
		return RedisCommandResult{}, fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	dbClient := redis.NewClient(&redis.Options{
		Addr:     client.Options().Addr,
		Password: client.Options().Password,
		DB:       req.Database,
		Username: client.Options().Username,
	})
	defer dbClient.Close()

	args := make([]interface{}, len(req.Args))
	for i, arg := range req.Args {
		args[i] = arg
	}

	result := dbClient.Do(ctx, append([]interface{}{req.Command}, args...)...)
	output, err := result.Result()
	if err != nil {
		return RedisCommandResult{}, err
	}

	return RedisCommandResult{
		Command: req.Command,
		Output:  fmt.Sprintf("%v", output),
	}, nil
}

// RedisSetKey sets a key value
func (a *App) RedisSetKey(req RedisSetKeyRequest) (string, error) {
	a.redisConnManager.mu.RLock()
	client, exists := a.redisConnManager.connections[req.ConnectionID]
	a.redisConnManager.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	dbClient := redis.NewClient(&redis.Options{
		Addr:     client.Options().Addr,
		Password: client.Options().Password,
		DB:       req.Database,
		Username: client.Options().Username,
	})
	defer dbClient.Close()

	var expiration time.Duration
	if req.TTL != nil && *req.TTL > 0 {
		expiration = time.Duration(*req.TTL) * time.Second
	}

	var value interface{}
	_ = json.Unmarshal(req.Value, &value)

	err := dbClient.Set(ctx, req.Key, value, expiration).Err()
	if err != nil {
		return "", fmt.Errorf("failed to set key: %w", err)
	}

	return "Key set successfully", nil
}

// RedisDeleteKey deletes a single key
func (a *App) RedisDeleteKey(req RedisKeyRequest) (string, error) {
	a.redisConnManager.mu.RLock()
	client, exists := a.redisConnManager.connections[req.ConnectionID]
	a.redisConnManager.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	dbClient := redis.NewClient(&redis.Options{
		Addr:     client.Options().Addr,
		Password: client.Options().Password,
		DB:       req.Database,
		Username: client.Options().Username,
	})
	defer dbClient.Close()

	err := dbClient.Del(ctx, req.Key).Err()
	if err != nil {
		return "", fmt.Errorf("failed to delete key: %w", err)
	}

	return "Key deleted successfully", nil
}

// RedisDeleteKeys deletes multiple keys
func (a *App) RedisDeleteKeys(req RedisDeleteKeysRequest) (string, error) {
	a.redisConnManager.mu.RLock()
	client, exists := a.redisConnManager.connections[req.ConnectionID]
	a.redisConnManager.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	dbClient := redis.NewClient(&redis.Options{
		Addr:     client.Options().Addr,
		Password: client.Options().Password,
		DB:       req.Database,
		Username: client.Options().Username,
	})
	defer dbClient.Close()

	err := dbClient.Del(ctx, req.Keys...).Err()
	if err != nil {
		return "", fmt.Errorf("failed to delete keys: %w", err)
	}

	return fmt.Sprintf("%d keys deleted", len(req.Keys)), nil
}

// RedisUpdateKeyTTL updates key TTL
func (a *App) RedisUpdateKeyTTL(req RedisUpdateTTLRequest) (string, error) {
	a.redisConnManager.mu.RLock()
	client, exists := a.redisConnManager.connections[req.ConnectionID]
	a.redisConnManager.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("connection not found: %s", req.ConnectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	dbClient := redis.NewClient(&redis.Options{
		Addr:     client.Options().Addr,
		Password: client.Options().Password,
		DB:       req.Database,
		Username: client.Options().Username,
	})
	defer dbClient.Close()

	expiration := time.Duration(req.TTL) * time.Second
	err := dbClient.Expire(ctx, req.Key, expiration).Err()
	if err != nil {
		return "", fmt.Errorf("failed to update TTL: %w", err)
	}

	return "TTL updated successfully", nil
}

// Helper function to get key type and TTL
func (a *App) getKeyTypeAndTTL(client *redis.Client, ctx context.Context, key string) (string, time.Duration) {
	keyType, _ := client.Type(ctx, key).Result()
	ttl, _ := client.TTL(ctx, key).Result()
	return keyType, ttl
}

// CloseAll closes all connections
func (r *RedisConnectionManager) CloseAll() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, client := range r.connections {
		if client != nil {
			_ = client.Close()
		}
	}
}
