package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	goRedis "github.com/redis/go-redis/v9"

	"multi-database-browsing/backend/infra/sshtunnel"
	"multi-database-browsing/backend/shared"
)

type Module struct {
	connManager *RedisConnectionManager
}

func NewModule() *Module {
	return &Module{connManager: NewRedisConnectionManager()}
}

func (m *Module) CloseAll() {
	m.connManager.CloseAll()
}

func (m *Module) getRedisClient(connectionID string, database int) (*goRedis.Client, error) {
	m.connManager.mu.RLock()
	dbClients, exists := m.connManager.connections[connectionID]
	if !exists {
		m.connManager.mu.RUnlock()
		return nil, shared.NewConnectionFailed("redis", "connection not found: "+connectionID)
	}

	if client, ok := dbClients[database]; ok {
		m.connManager.mu.RUnlock()
		return client, nil
	}

	baseOpts, hasOptions := m.connManager.options[connectionID]
	m.connManager.mu.RUnlock()
	if !hasOptions || baseOpts == nil {
		return nil, shared.NewConnectionFailed("redis", "connection options not found: "+connectionID)
	}

	key := fmt.Sprintf("%s:%d", connectionID, database)
	result, err, _ := m.connManager.inFlight.Do(key, func() (interface{}, error) {
		return m.createRedisClient(connectionID, database, baseOpts)
	})
	if err != nil {
		return nil, err
	}
	return result.(*goRedis.Client), nil
}

func (m *Module) createRedisClient(connectionID string, database int, baseOpts *goRedis.Options) (*goRedis.Client, error) {
	// Double-check after singleflight gate — another caller may have created it.
	m.connManager.mu.RLock()
	dbClients, exists := m.connManager.connections[connectionID]
	if exists {
		if client, ok := dbClients[database]; ok {
			m.connManager.mu.RUnlock()
			return client, nil
		}
	}
	m.connManager.mu.RUnlock()

	newClient := goRedis.NewClient(cloneRedisOptions(baseOpts, database))
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	err := newClient.Ping(ctx).Err()
	cancel()
	if err != nil {
		newClient.Close()
		return nil, shared.NewConnectionFailed("redis", fmt.Sprintf("failed to connect to database %d: %s", database, err))
	}

	m.connManager.mu.Lock()
	defer m.connManager.mu.Unlock()

	dbClients, exists = m.connManager.connections[connectionID]
	if !exists {
		newClient.Close()
		return nil, shared.NewConnectionFailed("redis", "connection not found: "+connectionID)
	}
	if existingClient, ok := dbClients[database]; ok {
		newClient.Close()
		return existingClient, nil
	}
	dbClients[database] = newClient
	return newClient, nil
}

func (m *Module) RedisConnect(req RedisConnectRequest) (string, error) {
	var addr string
	if req.SshEnabled {
		sshCfg := sshtunnel.Config{
			Host:           req.SshHost,
			Port:           req.SshPort,
			Username:       req.SshUsername,
			Password:       req.SshPassword,
			PrivateKeyPath: req.SshPrivateKeyPath,
			PrivateKeyPem:  req.SshPrivateKeyPem,
			Passphrase:     req.SshPassphrase,
			UseAgent:       req.SshUseAgent,
			HostKeyMode:    req.SshHostKeyMode,
			KnownHostsPath: req.SshKnownHostsPath,
		}
		tunnel := m.connManager.sshTunnels.GetOrCreate(req.ConnectionID, sshCfg)
		targetAddr := fmt.Sprintf("%s:%d", req.Host, req.Port)
		localPort, err := tunnel.ConnectAndForward(targetAddr)
		if err != nil {
			return "", shared.NewConnectionFailed("redis", "failed to establish SSH tunnel: "+err.Error())
		}
		addr = fmt.Sprintf("127.0.0.1:%d", localPort)
	} else {
		addr = fmt.Sprintf("%s:%d", req.Host, req.Port)
	}

	// Configure TLS
	tlsConfig, err := setupRedisTLS(&req)
	if err != nil {
		return "", shared.NewConnectionFailed("redis", "TLS configuration error: "+err.Error())
	}

	baseOpts := &goRedis.Options{
		Addr:         addr,
		Password:     req.Password,
		DB:           req.Database,
		Username:     req.Username,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		PoolSize:     25,
		MinIdleConns: 5,
		TLSConfig:    tlsConfig,
	}
	client := goRedis.NewClient(baseOpts)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return "", shared.NewConnectionFailed("redis", "failed to connect: "+err.Error())
	}

	m.connManager.mu.Lock()
	defer m.connManager.mu.Unlock()

	if existingClients, exists := m.connManager.connections[req.ConnectionID]; exists {
		for db, existingClient := range existingClients {
			if existingClient != nil {
				if err := existingClient.Close(); err != nil {
					shared.Logger.Error("error closing existing redis client",
						slog.String("connection_id", req.ConnectionID),
						slog.Int("db", db),
						slog.Any("error", err))
				}
			}
		}
	}

	m.connManager.connections[req.ConnectionID] = map[int]*goRedis.Client{req.Database: client}
	m.connManager.options[req.ConnectionID] = cloneRedisOptions(baseOpts, req.Database)

	return "Connected successfully", nil
}

func (m *Module) RedisDisconnect(connectionID string) (string, error) {
	m.connManager.mu.Lock()
	defer m.connManager.mu.Unlock()

	dbClients, exists := m.connManager.connections[connectionID]
	if !exists {
		return "", shared.NewConnectionFailed("redis", "connection not found: "+connectionID)
	}

	for db, client := range dbClients {
		if client != nil {
			if err := client.Close(); err != nil {
				shared.Logger.Error("error closing redis client",
					slog.String("connection_id", connectionID),
					slog.Int("db", db),
					slog.Any("error", err))
			}
		}
	}

	delete(m.connManager.connections, connectionID)
	delete(m.connManager.options, connectionID)
	// Close SSH tunnel if present.
	_ = m.connManager.sshTunnels.Close(connectionID)
	return "Disconnected successfully", nil
}

func (m *Module) RedisListDatabases(connectionID string) ([]RedisDatabaseInfo, error) {
	client, err := m.getRedisClient(connectionID, 0)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	databases := make([]RedisDatabaseInfo, 16)
	for i := 0; i < 16; i++ {
		databases[i] = RedisDatabaseInfo{Index: int64(i), Label: fmt.Sprintf("DB %d", i), IsDefault: i == 0}
	}

	info, err := client.Info(ctx, "keyspace").Result()
	if err == nil {
		lines := strings.Split(info, "\r\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "db") {
				parts := strings.Split(line, ":")
				if len(parts) == 2 {
					dbStr := strings.TrimPrefix(parts[0], "db")
					dbIdx, err := strconv.Atoi(dbStr)
					if err != nil || dbIdx < 0 || dbIdx >= 16 {
						continue
					}
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

func (m *Module) RedisScanKeys(req RedisScanRequest) (RedisScanResult, error) {
	client, err := m.getRedisClient(req.ConnectionID, req.Database)
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
	}

	var pattern string
	if req.Pattern != nil {
		pattern = *req.Pattern
	}

	cmd := client.Scan(ctx, cursor, pattern, count)
	keys, nextCursor, err := cmd.Result()
	if err != nil {
		return RedisScanResult{}, shared.NewAppError(shared.ErrQueryFailed, "scan failed: "+err.Error(), "redis")
	}

	items, err := m.getKeysTypeAndTTLBatch(client, ctx, keys)
	if err != nil {
		return RedisScanResult{}, err
	}

	return RedisScanResult{NextCursor: strconv.FormatUint(nextCursor, 10), Items: items, HasMore: nextCursor != 0}, nil
}

func (m *Module) RedisGetKeyDetail(req RedisKeyRequest) (RedisKeyDetail, error) {
	client, err := m.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return RedisKeyDetail{}, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	keyType, ttl := m.getKeyTypeAndTTL(client, ctx, req.Key)
	detail := RedisKeyDetail{Name: req.Key, KeyType: keyType}
	if ttl >= 0 {
		ttlMS := int64(ttl.Milliseconds())
		detail.TTLMS = &ttlMS
	}

	memUsage, err := client.MemoryUsage(ctx, req.Key).Result()
	if err == nil && memUsage >= 0 {
		size := uint64(memUsage)
		detail.Size = &size
	}
	enc, err := client.ObjectEncoding(ctx, req.Key).Result()
	if err == nil {
		detail.Encoding = &enc
	}

	switch keyType {
	case "string":
		val, err := client.Get(ctx, req.Key).Bytes()
		if err == nil {
			detail.IsBinary = isBinaryData(string(val))
			safeVal, enc := safeStringValue(val)
			detail.ValueEncoding = enc
			bv := shared.BinaryValue{Value: safeVal, Encoding: enc}
			data, _ := json.Marshal(bv)
			detail.Value = data
		}
	case "hash":
		vals, err := client.HGetAll(ctx, req.Key).Result()
		if err == nil {
			safeVals, enc := safeMapValue(vals)
			detail.ValueEncoding = enc
			// Wrap each hash value in a BinaryValue for frontend detection
			wrapped := make(map[string]shared.BinaryValue, len(safeVals))
			for k, v := range safeVals {
				wrapped[k] = shared.BinaryValue{Value: v, Encoding: enc}
			}
			data, _ := json.Marshal(wrapped)
			detail.Value = data
		}
	case "list":
		vals, err := client.LRange(ctx, req.Key, 0, -1).Result()
		if err == nil {
			safeVals, enc := safeSliceValue(vals)
			detail.ValueEncoding = enc
			wrapped := make([]shared.BinaryValue, len(safeVals))
			for i, v := range safeVals {
				wrapped[i] = shared.BinaryValue{Value: v, Encoding: enc}
			}
			data, _ := json.Marshal(wrapped)
			detail.Value = data
		}
	case "set":
		vals, err := client.SMembers(ctx, req.Key).Result()
		if err == nil {
			safeVals, enc := safeSliceValue(vals)
			detail.ValueEncoding = enc
			wrapped := make([]shared.BinaryValue, len(safeVals))
			for i, v := range safeVals {
				wrapped[i] = shared.BinaryValue{Value: v, Encoding: enc}
			}
			data, _ := json.Marshal(wrapped)
			detail.Value = data
		}
	case "zset":
		vals, err := client.ZRangeByScoreWithScores(ctx, req.Key, &goRedis.ZRangeBy{Min: "-inf", Max: "+inf"}).Result()
		if err == nil {
			entries := make([]redisZSetEntry, len(vals))
			for i, v := range vals {
				member, _ := v.Member.(string)
				entries[i] = redisZSetEntry{Member: member, Score: v.Score}
			}
			safeVals, enc := safeZSetValue(entries)
			detail.ValueEncoding = enc
			wrapped := make([]map[string]interface{}, len(safeVals))
			for i, v := range safeVals {
				wrapped[i] = map[string]interface{}{
					"member": shared.BinaryValue{Value: v.Member, Encoding: enc},
					"score":  v.Score,
				}
			}
			data, _ := json.Marshal(wrapped)
			detail.Value = data
		}
	default:
		detail.Unsupported = true
	}

	return detail, nil
}

func (m *Module) RedisExecute(req RedisExecuteRequest) (RedisCommandResult, error) {
	client, err := m.getRedisClient(req.ConnectionID, req.Database)
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
		return RedisCommandResult{}, err
	}

	return RedisCommandResult{Command: req.Command, Output: fmt.Sprintf("%v", output)}, nil
}

func (m *Module) RedisSetKey(req RedisSetKeyRequest) (string, error) {
	client, err := m.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if strings.TrimSpace(req.Key) == "" {
		return "", fmt.Errorf("key is required")
	}

	originalKey := strings.TrimSpace(req.OriginalKey)
	if originalKey == "" {
		originalKey = req.Key
	}

	if !req.Overwrite {
		exists, err := client.Exists(ctx, req.Key).Result()
		if err != nil {
			return "", fmt.Errorf("failed to check key existence: %w", err)
		}
		if exists > 0 {
			return "", fmt.Errorf("key already exists: %s", req.Key)
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
		members := make([]goRedis.Z, 0, len(values))
		for _, value := range values {
			members = append(members, goRedis.Z{Score: value.Score, Member: value.Member})
		}
		if err := client.ZAdd(ctx, req.Key, members...).Err(); err != nil {
			return "", fmt.Errorf("failed to set sorted set members: %w", err)
		}
	default:
		return "", fmt.Errorf("unsupported key type: %s", req.KeyType)
	}

	if err := applyRedisKeyTTL(ctx, client, req.Key, getRedisTTLMilliseconds(req)); err != nil {
		return "", fmt.Errorf("failed to update key TTL: %w", err)
	}

	if req.Overwrite && originalKey != req.Key {
		if err := client.Del(ctx, originalKey).Err(); err != nil {
			return "", fmt.Errorf("failed to remove original key: %w", err)
		}
	}

	return "Key set successfully", nil
}

func (m *Module) RedisDeleteKey(req RedisKeyRequest) (string, error) {
	client, err := m.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Del(ctx, req.Key).Err(); err != nil {
		return "", fmt.Errorf("failed to delete key: %w", err)
	}

	return "Key deleted successfully", nil
}

func (m *Module) RedisDeleteKeys(req RedisDeleteKeysRequest) (string, error) {
	client, err := m.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Del(ctx, req.Keys...).Err(); err != nil {
		return "", fmt.Errorf("failed to delete keys: %w", err)
	}

	return fmt.Sprintf("%d keys deleted", len(req.Keys)), nil
}

func (m *Module) RedisUpdateKeyTTL(req RedisUpdateTTLRequest) (string, error) {
	client, err := m.getRedisClient(req.ConnectionID, req.Database)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var updateErr error
	if req.TTL <= 0 {
		updateErr = client.Persist(ctx, req.Key).Err()
	} else {
		expiration := time.Duration(req.TTL) * time.Millisecond
		updateErr = client.PExpire(ctx, req.Key, expiration).Err()
	}
	if updateErr != nil {
		return "", fmt.Errorf("failed to update TTL: %w", updateErr)
	}

	return "TTL updated successfully", nil
}

func (m *Module) getKeysTypeAndTTLBatch(client *goRedis.Client, ctx context.Context, keys []string) ([]RedisKeySummary, error) {
	if len(keys) == 0 {
		return []RedisKeySummary{}, nil
	}

	pipe := client.Pipeline()
	cmds := make([]goRedis.Cmder, 0, len(keys)*2)

	for _, key := range keys {
		cmds = append(cmds, pipe.Type(ctx, key))
		cmds = append(cmds, pipe.TTL(ctx, key))
	}

	if _, err := pipe.Exec(ctx); err != nil {
		return nil, shared.NewAppError(shared.ErrQueryFailed, "pipeline exec failed: "+err.Error(), "redis")
	}

	items := make([]RedisKeySummary, len(keys))
	for i, key := range keys {
		typeCmd := cmds[i*2]
		ttlCmd := cmds[i*2+1]

		var keyType string
		var ttl time.Duration
		if typeStatusCmd, ok := typeCmd.(*goRedis.StatusCmd); ok {
			keyType, _ = typeStatusCmd.Result()
		}
		if ttlDurationCmd, ok := ttlCmd.(*goRedis.DurationCmd); ok {
			ttl, _ = ttlDurationCmd.Result()
		}

		items[i] = RedisKeySummary{Name: key, KeyType: keyType}
		if ttl >= 0 {
			ttlMS := int64(ttl.Milliseconds())
			items[i].TTLMS = &ttlMS
		}
	}

	return items, nil
}

func (m *Module) getKeyTypeAndTTL(client *goRedis.Client, ctx context.Context, key string) (string, time.Duration) {
	keyType, _ := client.Type(ctx, key).Result()
	ttl, _ := client.TTL(ctx, key).Result()
	return keyType, ttl
}
