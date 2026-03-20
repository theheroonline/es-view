package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
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
	Index     int64   `json:"index"`
	Label     string  `json:"label"`
	KeyCount  *uint64 `json:"keyCount"`
	IsDefault bool    `json:"isDefault"`
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
	OriginalKey  string          `json:"originalKey"`
	KeyType      string          `json:"keyType"`
	Value        json.RawMessage `json:"value"`
	TTL          *int64          `json:"ttl"`
	TTLMS        *int64          `json:"ttlMs"`
	Overwrite    bool            `json:"overwrite"`
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

type redisZSetEntry struct {
	Member string  `json:"member"`
	Score  float64 `json:"score"`
}

func normalizeRedisStringValue(raw json.RawMessage) (string, error) {
	var value string
	if err := json.Unmarshal(raw, &value); err == nil {
		return value, nil
	}

	var generic interface{}
	if err := json.Unmarshal(raw, &generic); err != nil {
		return "", err
	}

	return fmt.Sprint(generic), nil
}

func normalizeRedisStringSlice(raw json.RawMessage) ([]string, error) {
	var values []string
	if err := json.Unmarshal(raw, &values); err == nil {
		return values, nil
	}

	var generic []interface{}
	if err := json.Unmarshal(raw, &generic); err != nil {
		return nil, err
	}

	values = make([]string, 0, len(generic))
	for _, item := range generic {
		values = append(values, fmt.Sprint(item))
	}

	return values, nil
}

func normalizeRedisHashValue(raw json.RawMessage) (map[string]string, error) {
	var values map[string]string
	if err := json.Unmarshal(raw, &values); err == nil {
		return values, nil
	}

	var generic map[string]interface{}
	if err := json.Unmarshal(raw, &generic); err != nil {
		return nil, err
	}

	values = make(map[string]string, len(generic))
	for key, value := range generic {
		values[key] = fmt.Sprint(value)
	}

	return values, nil
}

func normalizeRedisZSetValue(raw json.RawMessage) ([]redisZSetEntry, error) {
	var values []redisZSetEntry
	if err := json.Unmarshal(raw, &values); err != nil {
		return nil, err
	}

	return values, nil
}

func getRedisTTLMilliseconds(req RedisSetKeyRequest) *int64 {
	if req.TTLMS != nil {
		return req.TTLMS
	}

	return req.TTL
}

func applyRedisKeyTTL(ctx context.Context, client *redis.Client, key string, ttlMS *int64) error {
	if ttlMS == nil || *ttlMS <= 0 {
		return client.Persist(ctx, key).Err()
	}

	return client.PExpire(ctx, key, time.Duration(*ttlMS)*time.Millisecond).Err()
}

// RedisConnectionManager manages Redis connections with per-database client pools
type RedisConnectionManager struct {
	mu          sync.RWMutex
	connections map[string]map[int]*redis.Client // connectionId -> database -> client
	options     map[string]*redis.Options
}

// NewRedisConnectionManager creates a new manager
func NewRedisConnectionManager() *RedisConnectionManager {
	return &RedisConnectionManager{
		connections: make(map[string]map[int]*redis.Client),
		options:     make(map[string]*redis.Options),
	}
}

func cloneRedisOptions(opts *redis.Options, database int) *redis.Options {
	cloned := *opts
	cloned.DB = database
	return &cloned
}

func (a *App) RedisConnect(req RedisConnectRequest) (string, error) {
	return a.redis.RedisConnect(req)
}

func (a *App) RedisDisconnect(connectionID string) (string, error) {
	return a.redis.RedisDisconnect(connectionID)
}

func (a *App) RedisListDatabases(connectionID string) ([]RedisDatabaseInfo, error) {
	return a.redis.RedisListDatabases(connectionID)
}

func (a *App) RedisScanKeys(req RedisScanRequest) (RedisScanResult, error) {
	return a.redis.RedisScanKeys(req)
}

func (a *App) RedisGetKeyDetail(req RedisKeyRequest) (RedisKeyDetail, error) {
	return a.redis.RedisGetKeyDetail(req)
}

func (a *App) RedisExecute(req RedisExecuteRequest) (RedisCommandResult, error) {
	return a.redis.RedisExecute(req)
}

func (a *App) RedisSetKey(req RedisSetKeyRequest) (string, error) {
	return a.redis.RedisSetKey(req)
}

func (a *App) RedisDeleteKey(req RedisKeyRequest) (string, error) {
	return a.redis.RedisDeleteKey(req)
}

func (a *App) RedisDeleteKeys(req RedisDeleteKeysRequest) (string, error) {
	return a.redis.RedisDeleteKeys(req)
}

func (a *App) RedisUpdateKeyTTL(req RedisUpdateTTLRequest) (string, error) {
	return a.redis.RedisUpdateKeyTTL(req)
}

// getRedisClient retrieves or creates a client for the specified database
// Fixed: Optimized Ping check - only check when creating new client, not on every access
func (r *RedisModule) getRedisClient(connectionID string, database int) (*redis.Client, error) {
	r.connManager.mu.RLock()
	dbClients, exists := r.connManager.connections[connectionID]
	if !exists {
		r.connManager.mu.RUnlock()
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	if client, ok := dbClients[database]; ok {
		r.connManager.mu.RUnlock()
		return client, nil
	}

	baseOpts, hasOptions := r.connManager.options[connectionID]
	r.connManager.mu.RUnlock()
	if !hasOptions || baseOpts == nil {
		return nil, fmt.Errorf("connection options not found: %s", connectionID)
	}

	newClient := redis.NewClient(cloneRedisOptions(baseOpts, database))

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := newClient.Ping(ctx).Err(); err != nil {
		newClient.Close()
		return nil, fmt.Errorf("failed to connect to database %d: %w", database, err)
	}

	r.connManager.mu.Lock()
	defer r.connManager.mu.Unlock()

	dbClients, exists = r.connManager.connections[connectionID]
	if !exists {
		newClient.Close()
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	if existingClient, ok := dbClients[database]; ok {
		newClient.Close()
		return existingClient, nil
	}

	dbClients[database] = newClient
	return newClient, nil
}

// RedisConnect establishes a Redis connection
func (r *RedisModule) RedisConnect(req RedisConnectRequest) (string, error) {
	addr := fmt.Sprintf("%s:%d", req.Host, req.Port)
	baseOpts := &redis.Options{
		Addr:         addr,
		Password:     req.Password,
		DB:           req.Database,
		Username:     req.Username,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     5,
		MinIdleConns: 1,
	}
	client := redis.NewClient(baseOpts)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return "", fmt.Errorf("failed to connect: %w", err)
	}

	r.connManager.mu.Lock()
	defer r.connManager.mu.Unlock()

	if existingClients, exists := r.connManager.connections[req.ConnectionID]; exists {
		for _, existingClient := range existingClients {
			if existingClient != nil {
				_ = existingClient.Close()
			}
		}
	}

	r.connManager.connections[req.ConnectionID] = map[int]*redis.Client{
		req.Database: client,
	}
	r.connManager.options[req.ConnectionID] = cloneRedisOptions(baseOpts, req.Database)

	return "Connected successfully", nil
}

// RedisDisconnect closes a Redis connection
func (r *RedisModule) RedisDisconnect(connectionID string) (string, error) {
	r.connManager.mu.Lock()
	defer r.connManager.mu.Unlock()

	dbClients, exists := r.connManager.connections[connectionID]
	if !exists {
		return "", fmt.Errorf("connection not found: %s", connectionID)
	}

	// Close all database clients for this connection
	for _, client := range dbClients {
		if client != nil {
			_ = client.Close()
		}
	}

	delete(r.connManager.connections, connectionID)
	delete(r.connManager.options, connectionID)
	return "Disconnected successfully", nil
}

// RedisListDatabases returns list of available databases
func (r *RedisModule) RedisListDatabases(connectionID string) ([]RedisDatabaseInfo, error) {
	client, err := r.getRedisClient(connectionID, 0)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	databases := make([]RedisDatabaseInfo, 16)

	// Initialize all database info
	for i := 0; i < 16; i++ {
		databases[i] = RedisDatabaseInfo{
			Index:     int64(i),
			Label:     fmt.Sprintf("DB %d", i),
			IsDefault: i == 0,
		}
	}

	// Use INFO keyspace to get key counts for all databases in one round trip
	info, err := client.Info(ctx, "keyspace").Result()
	if err == nil {
		// Parse INFO keyspace output
		// Format: db0:keys=1000,expires=100,avg_ttl=5000\r\ndb1:keys=2000,expires=50,avg_ttl=3000\r\n...
		lines := strings.Split(info, "\r\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "db") {
				// Parse "db5:keys=1000,expires=100,avg_ttl=5000"
				parts := strings.Split(line, ":")
				if len(parts) == 2 {
					dbStr := strings.TrimPrefix(parts[0], "db")
					dbIdx, err := strconv.Atoi(dbStr)
					if err != nil || dbIdx < 0 || dbIdx >= 16 {
						continue
					}

					// Extract keys count from "keys=1000,expires=100,avg_ttl=5000"
					kvPairs := strings.Split(parts[1], ",")
					for _, kv := range kvPairs {
						kv = strings.TrimSpace(kv)
						if strings.HasPrefix(kv, "keys=") {
							keyCount, parseErr := strconv.ParseInt(strings.TrimPrefix(kv, "keys="), 10, 64)
							if parseErr == nil && keyCount > 0 {
								count := uint64(keyCount)
								databases[dbIdx].KeyCount = &count
							}
							break
						}
					}
				}
			}
		}
	}

	return databases, nil
}

// RedisScanKeys scans for keys
// Fixed: Added scan count limit to prevent excessive memory usage
func (r *RedisModule) RedisScanKeys(req RedisScanRequest) (RedisScanResult, error) {
	const maxScanCount = 10000 // Maximum keys to scan per request

	client, err := r.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return RedisScanResult{}, err
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
		// Fixed: Added validation to prevent excessive count values
		if count > maxScanCount {
			return RedisScanResult{}, fmt.Errorf("scan count (%d) exceeds maximum allowed value (%d)", count, maxScanCount)
		}
	}

	var pattern string
	if req.Pattern != nil {
		pattern = *req.Pattern
	}

	// Scan keys using the appropriate database client (no SELECT needed)
	cmd := client.Scan(ctx, cursor, pattern, count)
	keys, nextCursor, err := cmd.Result()
	if err != nil {
		return RedisScanResult{}, fmt.Errorf("scan failed in database %d: %w", req.Database, err)
	}

	// Use pipeline to batch fetch TYPE and TTL for all keys
	items, err := r.getKeysTypeAndTTLBatch(client, ctx, keys)
	if err != nil {
		return RedisScanResult{}, err
	}

	result := RedisScanResult{
		NextCursor: strconv.FormatUint(nextCursor, 10),
		Items:      items,
		HasMore:    nextCursor != 0,
	}

	return result, nil
}

// RedisGetKeyDetail gets detailed key information
func (r *RedisModule) RedisGetKeyDetail(req RedisKeyRequest) (RedisKeyDetail, error) {
	client, err := r.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return RedisKeyDetail{}, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	keyType, ttl := r.getKeyTypeAndTTL(client, ctx, req.Key)

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
		val, err := client.Get(ctx, req.Key).Result()
		if err == nil {
			data, _ := json.Marshal(val)
			detail.Value = data
		}
	case "hash":
		vals, err := client.HGetAll(ctx, req.Key).Result()
		if err == nil {
			data, _ := json.Marshal(vals)
			detail.Value = data
		}
	case "list":
		vals, err := client.LRange(ctx, req.Key, 0, -1).Result()
		if err == nil {
			data, _ := json.Marshal(vals)
			detail.Value = data
		}
	case "set":
		vals, err := client.SMembers(ctx, req.Key).Result()
		if err == nil {
			data, _ := json.Marshal(vals)
			detail.Value = data
		}
	case "zset":
		vals, err := client.ZRangeByScoreWithScores(ctx, req.Key, &redis.ZRangeBy{Min: "-inf", Max: "+inf"}).Result()
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
// Fixed: Added command validation and improved error messages
func (r *RedisModule) RedisExecute(req RedisExecuteRequest) (RedisCommandResult, error) {
	// Fixed: Validate command is not empty
	if strings.TrimSpace(req.Command) == "" {
		return RedisCommandResult{}, fmt.Errorf("command is required")
	}

	client, err := r.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return RedisCommandResult{}, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	args := make([]interface{}, len(req.Args))
	for i, arg := range req.Args {
		args[i] = arg
	}

	result := client.Do(ctx, append([]interface{}{req.Command}, args...)...)
	output, err := result.Result()
	if err != nil {
		return RedisCommandResult{}, fmt.Errorf("command execution failed for '%s' in database %d: %w", req.Command, req.Database, err)
	}

	return RedisCommandResult{
		Command: req.Command,
		Output:  fmt.Sprintf("%v", output),
	}, nil
}

// RedisSetKey sets a key value
// Fixed: Improved validation for key and value
func (r *RedisModule) RedisSetKey(req RedisSetKeyRequest) (string, error) {
	client, err := r.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Fixed: Enhanced key validation
	if strings.TrimSpace(req.Key) == "" {
		return "", fmt.Errorf("key is required and cannot be empty")
	}

	// Fixed: Added key length limit to prevent issues
	const maxKeyLength = 512 * 1024 * 1024 // 512MB - Redis allows up to 512MB for keys
	if len(req.Key) > maxKeyLength {
		return "", fmt.Errorf("key size (%d bytes) exceeds maximum allowed size", len(req.Key))
	}

	originalKey := strings.TrimSpace(req.OriginalKey)
	if originalKey == "" {
		originalKey = req.Key
	}

	// Fixed: Validate key type
	if req.KeyType == "" {
		return "", fmt.Errorf("key type is required")
	}

	if !req.Overwrite {
		exists, err := client.Exists(ctx, req.Key).Result()
		if err != nil {
			return "", fmt.Errorf("failed to check key existence: %w", err)
		}
		if exists > 0 {
			return "", fmt.Errorf("key already exists: %s (use overwrite flag to replace)", req.Key)
		}
	}

	if req.Overwrite && req.Key == originalKey {
		if err := client.Del(ctx, req.Key).Err(); err != nil {
			return "", fmt.Errorf("failed to replace key: %w", err)
		}
	} else if req.Overwrite && req.Key != originalKey {
		if err := client.Del(ctx, req.Key).Err(); err != nil {
			return "", fmt.Errorf("failed to replace target key: %w", err)
		}
	}

	switch req.KeyType {
	case "string":
		value, err := normalizeRedisStringValue(req.Value)
		if err != nil {
			return "", fmt.Errorf("failed to decode string value: %w", err)
		}
		if err := client.Set(ctx, req.Key, value, 0).Err(); err != nil {
			return "", fmt.Errorf("failed to set key: %w", err)
		}
	case "hash":
		values, err := normalizeRedisHashValue(req.Value)
		if err != nil {
			return "", fmt.Errorf("failed to decode hash value: %w", err)
		}
		if len(values) == 0 {
			return "", fmt.Errorf("hash value must contain at least one field")
		}

		args := make([]interface{}, 0, len(values)*2)
		for field, value := range values {
			args = append(args, field, value)
		}
		if err := client.HSet(ctx, req.Key, args...).Err(); err != nil {
			return "", fmt.Errorf("failed to set hash: %w", err)
		}
	case "list":
		values, err := normalizeRedisStringSlice(req.Value)
		if err != nil {
			return "", fmt.Errorf("failed to decode list value: %w", err)
		}
		if len(values) == 0 {
			return "", fmt.Errorf("list value must contain at least one item")
		}

		args := make([]interface{}, len(values))
		for index, value := range values {
			args[index] = value
		}
		if err := client.RPush(ctx, req.Key, args...).Err(); err != nil {
			return "", fmt.Errorf("failed to set list: %w", err)
		}
	case "set":
		values, err := normalizeRedisStringSlice(req.Value)
		if err != nil {
			return "", fmt.Errorf("failed to decode set value: %w", err)
		}
		if len(values) == 0 {
			return "", fmt.Errorf("set value must contain at least one member")
		}

		args := make([]interface{}, len(values))
		for index, value := range values {
			args[index] = value
		}
		if err := client.SAdd(ctx, req.Key, args...).Err(); err != nil {
			return "", fmt.Errorf("failed to set set members: %w", err)
		}
	case "zset":
		values, err := normalizeRedisZSetValue(req.Value)
		if err != nil {
			return "", fmt.Errorf("failed to decode zset value: %w", err)
		}
		if len(values) == 0 {
			return "", fmt.Errorf("zset value must contain at least one member")
		}

		members := make([]redis.Z, 0, len(values))
		for _, value := range values {
			members = append(members, redis.Z{Score: value.Score, Member: value.Member})
		}
		if err := client.ZAdd(ctx, req.Key, members...).Err(); err != nil {
			return "", fmt.Errorf("failed to set sorted set members: %w", err)
		}
	default:
		return "", fmt.Errorf("unsupported key type: %s (valid types: string, hash, list, set, zset)", req.KeyType)
	}

	if err := applyRedisKeyTTL(ctx, client, req.Key, getRedisTTLMilliseconds(req)); err != nil {
		return "", fmt.Errorf("failed to update key TTL: %w", err)
	}

	if req.Overwrite && originalKey != req.Key {
		if err := client.Del(ctx, originalKey).Err(); err != nil {
			return "", fmt.Errorf("failed to remove original key: %w", err)
		}
	}

	return fmt.Sprintf("Key '%s' set successfully in database %d", req.Key, req.Database), nil
}

// RedisDeleteKey deletes a single key
func (r *RedisModule) RedisDeleteKey(req RedisKeyRequest) (string, error) {
	client, err := r.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = client.Del(ctx, req.Key).Err()
	if err != nil {
		return "", fmt.Errorf("failed to delete key: %w", err)
	}

	return "Key deleted successfully", nil
}

// RedisDeleteKeys deletes multiple keys
func (r *RedisModule) RedisDeleteKeys(req RedisDeleteKeysRequest) (string, error) {
	client, err := r.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = client.Del(ctx, req.Keys...).Err()
	if err != nil {
		return "", fmt.Errorf("failed to delete keys: %w", err)
	}

	return fmt.Sprintf("%d keys deleted", len(req.Keys)), nil
}

// RedisUpdateKeyTTL updates key TTL
func (r *RedisModule) RedisUpdateKeyTTL(req RedisUpdateTTLRequest) (string, error) {
	client, err := r.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if req.TTL <= 0 {
		err = client.Persist(ctx, req.Key).Err()
	} else {
		expiration := time.Duration(req.TTL) * time.Millisecond
		err = client.PExpire(ctx, req.Key, expiration).Err()
	}
	if err != nil {
		return "", fmt.Errorf("failed to update TTL: %w", err)
	}

	return "TTL updated successfully", nil
}

// Helper function to get key types and TTLs in batch using pipeline
func (r *RedisModule) getKeysTypeAndTTLBatch(
	client *redis.Client,
	ctx context.Context,
	keys []string,
) ([]RedisKeySummary, error) {
	if len(keys) == 0 {
		return []RedisKeySummary{}, nil
	}

	// Use pipeline to batch execute TYPE and TTL commands
	pipe := client.Pipeline()
	cmds := make([]redis.Cmder, 0, len(keys)*2)

	for _, key := range keys {
		cmds = append(cmds, pipe.Type(ctx, key))
		cmds = append(cmds, pipe.TTL(ctx, key))
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("pipeline exec failed: %w", err)
	}

	// Extract results from pipeline commands
	items := make([]RedisKeySummary, len(keys))
	for i, key := range keys {
		typeCmd := cmds[i*2]
		ttlCmd := cmds[i*2+1]

		var keyType string
		var ttl time.Duration

		// Extract TYPE result
		if typeStatusCmd, ok := typeCmd.(*redis.StatusCmd); ok {
			keyType, _ = typeStatusCmd.Result()
		}

		// Extract TTL result
		if ttlDurationCmd, ok := ttlCmd.(*redis.DurationCmd); ok {
			ttl, _ = ttlDurationCmd.Result()
		}

		items[i] = RedisKeySummary{
			Name:    key,
			KeyType: keyType,
		}
		if ttl >= 0 {
			ttlMS := int64(ttl.Milliseconds())
			items[i].TTLMS = &ttlMS
		}
	}

	return items, nil
}

// Helper function to get key type and TTL
func (r *RedisModule) getKeyTypeAndTTL(client *redis.Client, ctx context.Context, key string) (string, time.Duration) {
	keyType, _ := client.Type(ctx, key).Result()
	ttl, _ := client.TTL(ctx, key).Result()
	return keyType, ttl
}

// CloseAll closes all connections
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
	r.connections = make(map[string]map[int]*redis.Client)
	r.options = make(map[string]*redis.Options)
}
