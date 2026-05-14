package app

// This file exposes Wails-bound IPC methods that the frontend invokes.
// Each method delegates to a per-engine module (MySQL, Redis, Elasticsearch).
//
// Why not bind modules directly? Wails v2 supports multi-binding, but routing
// all IPC through App provides a single entry point and avoids namespace
// collisions between modules. The boilerplate cost is low (one line per method).
// If proxy grows significantly, consider:
//   1) Wails multi-binding: Bind []interface{}{app, app.MySQL(), app.Redis()}
//   2) go generate: scan module exported methods and auto-generate this file.
// See tasks/es-backend-refactor-plan.md for the detailed plan.

import (
	"fmt"

	esmodule "multi-database-browsing/backend/modules/elasticsearch"
	mysqlmodule "multi-database-browsing/backend/modules/mysql"
	redismodule "multi-database-browsing/backend/modules/redis"
)

// HttpRequest proxies an HTTP request to the Elasticsearch cluster.
// Supports Basic Auth and API Key authentication.
func (a *App) HttpRequest(params esmodule.HttpRequestParams) (string, error) {
	if a.elasticsearch == nil {
		return "", fmt.Errorf("elasticsearch module is not initialized")
	}

	return a.elasticsearch.HttpRequest(params)
}

// MysqlConnect establishes a connection to a MySQL database.
// Supports SSH tunneling if SSH config is provided.
func (a *App) MysqlConnect(req mysqlmodule.MysqlConnectRequest) (string, error) {
	return a.mysql.MysqlConnect(req)
}

// MysqlDisconnect closes a MySQL connection.
func (a *App) MysqlDisconnect(connectionID string) (string, error) {
	return a.mysql.MysqlDisconnect(connectionID)
}

// MysqlPing sends a ping to verify MySQL connectivity.
func (a *App) MysqlPing(connectionID string) (string, error) {
	return a.mysql.MysqlPing(connectionID)
}

// MysqlQuery executes a SQL query on the specified MySQL connection.
// Returns a MysqlQueryResult with columns, rows, affectedRows, and isResultSet flag.
func (a *App) MysqlQuery(connectionID string, query string) (mysqlmodule.MysqlQueryResult, error) {
	return a.mysql.MysqlQuery(connectionID, query)
}

// MysqlListDatabases returns all database names on the MySQL server.
func (a *App) MysqlListDatabases(connectionID string) ([]string, error) {
	return a.mysql.MysqlListDatabases(connectionID)
}

// MysqlListTables returns all table names in the specified database.
func (a *App) MysqlListTables(connectionID string, database string) ([]string, error) {
	return a.mysql.MysqlListTables(connectionID, database)
}

// MysqlDescribeTable returns column metadata for the specified table.
func (a *App) MysqlDescribeTable(connectionID string, database string, tableName string) ([]mysqlmodule.MysqlColumnMeta, error) {
	return a.mysql.MysqlDescribeTable(connectionID, database, tableName)
}

// MysqlListIndexes returns index information for the specified table.
func (a *App) MysqlListIndexes(req mysqlmodule.MysqlListIndexesRequest) ([]mysqlmodule.MysqlIndexMeta, error) {
	return a.mysql.MysqlListIndexes(req)
}

// MysqlCreateIndex creates a new index on the specified table.
func (a *App) MysqlCreateIndex(req mysqlmodule.MysqlCreateIndexRequest) (string, error) {
	return a.mysql.MysqlCreateIndex(req)
}

// MysqlDropIndex drops an existing index from the specified table.
func (a *App) MysqlDropIndex(req mysqlmodule.MysqlDropIndexRequest) (string, error) {
	return a.mysql.MysqlDropIndex(req)
}

// MysqlExportDatabase exports all tables from a database to SQL.
func (a *App) MysqlExportDatabase(req mysqlmodule.MysqlExportRequest) (string, error) {
	return a.mysql.MysqlExportDatabase(a.ctx, req)
}

// MysqlExportTable exports a single table to SQL.
func (a *App) MysqlExportTable(req mysqlmodule.MysqlExportRequest) (string, error) {
	return a.mysql.MysqlExportTable(a.ctx, req)
}

// MysqlExportTables exports multiple tables to SQL.
func (a *App) MysqlExportTables(req mysqlmodule.MysqlExportRequest) (string, error) {
	return a.mysql.MysqlExportTables(a.ctx, req)
}

// MysqlImportSql executes an SQL file import.
func (a *App) MysqlImportSql(req mysqlmodule.MysqlImportSqlRequest) (string, error) {
	return a.mysql.MysqlImportSql(a.ctx, req)
}

// RedisConnect establishes a connection to a Redis server.
// Supports SSH tunneling if SSH config is provided.
func (a *App) RedisConnect(req redismodule.RedisConnectRequest) (string, error) {
	return a.redis.RedisConnect(req)
}

// RedisDisconnect closes a Redis connection.
func (a *App) RedisDisconnect(connectionID string) (string, error) {
	return a.redis.RedisDisconnect(connectionID)
}

// RedisListDatabases returns database info for all Redis databases.
func (a *App) RedisListDatabases(connectionID string) ([]redismodule.RedisDatabaseInfo, error) {
	return a.redis.RedisListDatabases(connectionID)
}

// RedisScanKeys scans for keys matching the given pattern using SCAN command.
func (a *App) RedisScanKeys(req redismodule.RedisScanRequest) (redismodule.RedisScanResult, error) {
	return a.redis.RedisScanKeys(req)
}

// RedisGetKeyDetail returns detailed information about a key, including type, value, and TTL.
func (a *App) RedisGetKeyDetail(req redismodule.RedisKeyRequest) (redismodule.RedisKeyDetail, error) {
	return a.redis.RedisGetKeyDetail(req)
}

// RedisExecute executes a raw Redis CLI command.
func (a *App) RedisExecute(req redismodule.RedisExecuteRequest) (redismodule.RedisCommandResult, error) {
	return a.redis.RedisExecute(req)
}

// RedisSetKey creates or updates a key-value pair.
func (a *App) RedisSetKey(req redismodule.RedisSetKeyRequest) (string, error) {
	return a.redis.RedisSetKey(req)
}

// RedisDeleteKey deletes a single key.
func (a *App) RedisDeleteKey(req redismodule.RedisKeyRequest) (string, error) {
	return a.redis.RedisDeleteKey(req)
}

// RedisDeleteKeys deletes multiple keys matching the given pattern.
func (a *App) RedisDeleteKeys(req redismodule.RedisDeleteKeysRequest) (string, error) {
	return a.redis.RedisDeleteKeys(req)
}

// RedisUpdateKeyTTL updates the TTL of a key.
func (a *App) RedisUpdateKeyTTL(req redismodule.RedisUpdateTTLRequest) (string, error) {
	return a.redis.RedisUpdateKeyTTL(req)
}
