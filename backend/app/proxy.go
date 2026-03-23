package app

import (
	"fmt"

	esmodule "multi-database-browsing/backend/modules/elasticsearch"
	mysqlmodule "multi-database-browsing/backend/modules/mysql"
	redismodule "multi-database-browsing/backend/modules/redis"
)

func (a *App) HttpRequest(params esmodule.HttpRequestParams) (string, error) {
	if a.elasticsearch == nil {
		return "", fmt.Errorf("elasticsearch module is not initialized")
	}

	return a.elasticsearch.HttpRequest(params)
}

func (a *App) MysqlConnect(req mysqlmodule.MysqlConnectRequest) (string, error) {
	return a.mysql.MysqlConnect(req)
}

func (a *App) MysqlDisconnect(connectionID string) (string, error) {
	return a.mysql.MysqlDisconnect(connectionID)
}

func (a *App) MysqlPing(connectionID string) (string, error) {
	return a.mysql.MysqlPing(connectionID)
}

func (a *App) MysqlQuery(connectionID string, query string) (mysqlmodule.MysqlQueryResult, error) {
	return a.mysql.MysqlQuery(connectionID, query)
}

func (a *App) MysqlListDatabases(connectionID string) ([]string, error) {
	return a.mysql.MysqlListDatabases(connectionID)
}

func (a *App) MysqlListTables(connectionID string, database string) ([]string, error) {
	return a.mysql.MysqlListTables(connectionID, database)
}

func (a *App) MysqlDescribeTable(connectionID string, database string, tableName string) ([]mysqlmodule.MysqlColumnMeta, error) {
	return a.mysql.MysqlDescribeTable(connectionID, database, tableName)
}

func (a *App) MysqlListIndexes(req mysqlmodule.MysqlListIndexesRequest) ([]mysqlmodule.MysqlIndexMeta, error) {
	return a.mysql.MysqlListIndexes(req)
}

func (a *App) MysqlCreateIndex(req mysqlmodule.MysqlCreateIndexRequest) (string, error) {
	return a.mysql.MysqlCreateIndex(req)
}

func (a *App) MysqlDropIndex(req mysqlmodule.MysqlDropIndexRequest) (string, error) {
	return a.mysql.MysqlDropIndex(req)
}

func (a *App) MysqlExportDatabase(req mysqlmodule.MysqlExportRequest) (string, error) {
	return a.mysql.MysqlExportDatabase(a.ctx, req)
}

func (a *App) MysqlExportTable(req mysqlmodule.MysqlExportRequest) (string, error) {
	return a.mysql.MysqlExportTable(a.ctx, req)
}

func (a *App) MysqlExportTables(req mysqlmodule.MysqlExportRequest) (string, error) {
	return a.mysql.MysqlExportTables(a.ctx, req)
}

func (a *App) MysqlImportSql(req mysqlmodule.MysqlImportSqlRequest) (string, error) {
	return a.mysql.MysqlImportSql(a.ctx, req)
}

func (a *App) RedisConnect(req redismodule.RedisConnectRequest) (string, error) {
	return a.redis.RedisConnect(req)
}

func (a *App) RedisDisconnect(connectionID string) (string, error) {
	return a.redis.RedisDisconnect(connectionID)
}

func (a *App) RedisListDatabases(connectionID string) ([]redismodule.RedisDatabaseInfo, error) {
	return a.redis.RedisListDatabases(connectionID)
}

func (a *App) RedisScanKeys(req redismodule.RedisScanRequest) (redismodule.RedisScanResult, error) {
	return a.redis.RedisScanKeys(req)
}

func (a *App) RedisGetKeyDetail(req redismodule.RedisKeyRequest) (redismodule.RedisKeyDetail, error) {
	return a.redis.RedisGetKeyDetail(req)
}

func (a *App) RedisExecute(req redismodule.RedisExecuteRequest) (redismodule.RedisCommandResult, error) {
	return a.redis.RedisExecute(req)
}

func (a *App) RedisSetKey(req redismodule.RedisSetKeyRequest) (string, error) {
	return a.redis.RedisSetKey(req)
}

func (a *App) RedisDeleteKey(req redismodule.RedisKeyRequest) (string, error) {
	return a.redis.RedisDeleteKey(req)
}

func (a *App) RedisDeleteKeys(req redismodule.RedisDeleteKeysRequest) (string, error) {
	return a.redis.RedisDeleteKeys(req)
}

func (a *App) RedisUpdateKeyTTL(req redismodule.RedisUpdateTTLRequest) (string, error) {
	return a.redis.RedisUpdateKeyTTL(req)
}
