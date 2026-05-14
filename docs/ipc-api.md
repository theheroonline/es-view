# IPC API 文档

> 前端通过 Wails `invoke()` 调用后端 Go 方法。
> - 前端使用 `invoke("snake_case_method", params)` 调用
> - 后端方法为 `func (a *App) PascalCaseMethod(params)` (PascalCase)
> - 转换由 [`src/lib/wailsapi.ts`](../src/lib/wailsapi.ts) 自动完成
> - Go 返回的 `error` 会作为 JavaScript 异常抛出，前端通过 `mapInvokeError()` 规范化

---

## 1. 调用约定

### 1.1 参数传递方式

| 方式 | 说明 | 示例 |
|------|------|------|
| **单字符串参数** | 方法只有一个 `string` 参数，前端传 `{ connectionId: "..." }`，后端解包为 `func(connectionID string)` | `mysql_disconnect`, `mysql_ping` |
| **对象参数** | 整个 `args` 对象作为后端方法参数 | `http_request` (整个对象传入) |
| **多参数** | 前端传对象，后端方法有多个参数，`wailsapi.ts` 将对象字段按顺序展开 | `mysql_query(connId, sql)` |
| **默认方式** | 前端传对象 `{...}`，后端接收单个 struct 参数 | `mysql_connect(MysqlConnectRequest)` |

### 1.2 特殊方法映射

| 前端命令 | 后端签名 | 参数展开方式 |
|----------|----------|-------------|
| `mysql_query` | `MysqlQuery(connectionID, query string)` | `{connectionId, sql}` → `[connectionId, sql]` |
| `mysql_describe_table` | `MysqlDescribeTable(connectionID, database, tableName string)` | `{connectionId, database, table}` → `[connectionId, database, table]` |
| `mysql_list_tables` | `MysqlListTables(connectionID, database string)` | `{connectionId, database}` → `[connectionId, database]` |
| `http_request` | `HttpRequest(params HttpRequestParams)` | 整个对象原样传入 |

---

## 2. Elasticsearch

### 2.1 `http_request` → `HttpRequest`

**用途**: 无状态 HTTP 代理，转发请求到 Elasticsearch 集群。每次请求独立，支持 Basic Auth 和 API Key 认证。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | `string` | 是 | ES 节点完整 URL (含协议和端口) |
| `method` | `string` | 是 | HTTP 方法 (GET, POST, PUT, DELETE) |
| `headers` | `map[string]string` | 否 | 自定义请求头 |
| `body` | `string` | 否 | 请求体 (JSON 字符串) |
| `verifyTls` | `bool` | 否 | 是否验证 TLS 证书，默认 true |
| `auth` | `AuthConfig` | 否 | 认证配置，见下方 |

**`AuthConfig` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `authType` | `string` | `"basic"` 或 `"apikey"` |
| `username` | `string` | Basic Auth 用户名 |
| `password` | `string` | Basic Auth 密码 |
| `apiKey` | `string` | API Key 值 |

**返回值**: `string` — ES JSON 响应原文

**可能错误**:
- `elasticsearch module is not initialized`

**示例**:
```typescript
invoke("http_request", {
  url: "http://localhost:9200/_cluster/health",
  method: "GET",
  verifyTls: true,
  auth: { authType: "basic", username: "elastic", password: "changeme" },
});
```

---

## 3. MySQL

### 3.1 连接管理

#### 3.1.1 `mysql_connect` → `MysqlConnect`

**用途**: 建立 MySQL 连接，可选通过 SSH 隧道。连接由 `connectionId` 标识，后续操作复用此 ID。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `connectionId` | `string` | 是 | — | 唯一连接标识 |
| `host` | `string` | 是 | — | MySQL 主机地址 |
| `port` | `uint16` | 是 | — | MySQL 端口 (通常 3306) |
| `username` | `string` | 是 | — | 数据库用户名 |
| `password` | `string` | 是 | — | 数据库密码 |
| `database` | `string` | 否 | 空 | 默认数据库 |
| `sshEnabled` | `bool` | 否 | false | 是否启用 SSH 隧道 |
| `sshHost` | `string` | 条件 | — | SSH 服务器地址 |
| `sshPort` | `int` | 条件 | — | SSH 端口 (通常 22) |
| `sshUsername` | `string` | 条件 | — | SSH 用户名 |
| `sshPassword` | `string` | 条件 | — | SSH 密码 |
| `maxOpenConns` | `int` | 否 | 50 | 最大打开连接数 |
| `maxIdleConns` | `int` | 否 | 10 | 最大空闲连接数 |
| `connMaxLifetime` | `int` | 否 | 300 | 连接最大存活时间（秒） |

**返回值**: `string` — 连接 ID

**可能错误**:
- 连接超时、认证失败、SSH 隧道建立失败等

#### 3.1.2 `mysql_disconnect` → `MysqlDisconnect`

**用途**: 关闭指定 MySQL 连接。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionID` | `string` | 是 | 要断开的连接 ID |

**返回值**: `string`

#### 3.1.3 `mysql_ping` → `MysqlPing`

**用途**: 发送心跳检测，验证连接是否存活。前端每 60 秒调用一次。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionID` | `string` | 是 | 要检测的连接 ID |

**返回值**: `string`

**可能错误**: 连接已断开、超时等

---

### 3.2 查询与 Schema

#### 3.2.1 `mysql_query` → `MysqlQuery`

**用途**: 执行 SQL 语句。使用 `database.table` 限定名（不用 `USE` 语句），避免并发竞态条件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionID` | `string` | 是 | 连接 ID |
| `query` | `string` | 是 | SQL 语句 (SELECT, INSERT, UPDATE, DELETE, DDL 等) |

**返回值**: `MysqlQueryResult`

**`MysqlQueryResult` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `columns` | `string[]` | 列名列表 (仅 SELECT 时有值) |
| `rows` | `[][]interface{}` | 行数据 (二维数组) |
| `affectedRows` | `int64` | 影响行数 (INSERT/UPDATE/DELETE 时有值) |
| `isResultSet` | `bool` | 是否为结果集查询 (SELECT 为 true, INSERT 等为 false) |

**可能错误**: 连接不存在、SQL 语法错误、表不存在等

**示例**:
```typescript
invoke("mysql_query", {
  connectionId: "conn-123",
  sql: "SELECT * FROM mydb.users LIMIT 100",
});
```

#### 3.2.2 `mysql_list_databases` → `MysqlListDatabases`

**用途**: 列出 MySQL 服务器上的所有数据库。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionID` | `string` | 是 | 连接 ID |

**返回值**: `string[]` — 数据库名列表

#### 3.2.3 `mysql_list_tables` → `MysqlListTables`

**用途**: 列出指定数据库中的所有表。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionID` | `string` | 是 | 连接 ID |
| `database` | `string` | 是 | 数据库名 |

**返回值**: `string[]` — 表名列表

#### 3.2.4 `mysql_describe_table` → `MysqlDescribeTable`

**用途**: 获取表的列定义信息（等价 `DESCRIBE table`）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionID` | `string` | 是 | 连接 ID |
| `database` | `string` | 是 | 数据库名 |
| `tableName` | `string` | 是 | 表名 |

**返回值**: `MysqlColumnMeta[]`

**`MysqlColumnMeta` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `field` | `string` | 列名 |
| `type` | `string` | 列类型 (如 `varchar(255)`, `int(11)`) |
| `null` | `string` | 是否允许 NULL (`YES` / `NO`) |
| `key` | `string` | 键类型 (`PRI`, `UNI`, `MUL`, `""`) |
| `default` | `*string` | 默认值 (指针，可为 nil) |
| `extra` | `string` | 额外信息 (如 `auto_increment`) |

---

### 3.3 索引管理

#### 3.3.1 `mysql_list_indexes` → `MysqlListIndexes`

**用途**: 获取表的所有索引信息。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `string` | 是 | 数据库名 |
| `tableName` | `string` | 是 | 表名 |

**返回值**: `MysqlIndexMeta[]`

**`MysqlIndexMeta` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 索引名 |
| `columns` | `string[]` | 索引包含的列 (多列索引时有多个) |
| `unique` | `bool` | 是否为唯一索引 |
| `primary` | `bool` | 是否为主键索引 |
| `indexType` | `string` | 索引类型 (`BTREE`, `FULLTEXT`, `SPATIAL` 等) |

#### 3.3.2 `mysql_create_index` → `MysqlCreateIndex`

**用途**: 在表上创建新索引。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `string` | 是 | 数据库名 |
| `tableName` | `string` | 是 | 表名 |
| `indexName` | `string` | 是 | 索引名 |
| `columns` | `string[]` | 是 | 索引列名列表 |
| `unique` | `bool` | 否 | 是否创建唯一索引 |
| `indexType` | `string` | 否 | 索引类型 (默认 `BTREE`) |

**返回值**: `string`

**可能错误**: 索引名已存在、列名不存在、尝试对主键创建索引等

#### 3.3.3 `mysql_drop_index` → `MysqlDropIndex`

**用途**: 删除表上的索引。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `string` | 是 | 数据库名 |
| `tableName` | `string` | 是 | 表名 |
| `indexName` | `string` | 是 | 索引名 |

**返回值**: `string`

**可能错误**: 索引不存在、尝试删除主键索引等

---

### 3.4 导入导出

#### 3.4.1 `mysql_export_database` → `MysqlExportDatabase`

**用途**: 导出整个数据库为 SQL dump（包含 CREATE TABLE + INSERT 语句）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `string` | 是 | 数据库名 |
| `includeData` | `bool` | 否 | 是否包含数据（仅结构时设为 false） |

**返回值**: `string` — SQL dump 内容

#### 3.4.2 `mysql_export_table` → `MysqlExportTable`

**用途**: 导出单表为 SQL。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `string` | 是 | 数据库名 |
| `tableNames` | `string[]` | 是 | 表名列表（此处传入单个表） |
| `includeData` | `bool` | 否 | 是否包含数据行 |

**返回值**: `string` — SQL dump 内容

#### 3.4.3 `mysql_export_tables` → `MysqlExportTables`

**用途**: 导出多表为 SQL。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `string` | 是 | 数据库名 |
| `tableNames` | `string[]` | 是 | 要导出的表名列表 |
| `includeData` | `bool` | 否 | 是否包含数据行 |

**返回值**: `string` — SQL dump 内容

#### 3.4.4 `mysql_import_sql` → `MysqlImportSql`

**用途**: 执行 SQL 文件导入。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `string` | 是 | 目标数据库名 |
| `tableNames` | `string` | 否 | 目标表名（可选） |

**返回值**: `string`

**可能错误**: SQL 语法错误、表冲突、权限不足等

---

## 4. Redis

### 4.1 连接管理

#### 4.1.1 `redis_connect` → `RedisConnect`

**用途**: 建立 Redis 连接，可选通过 SSH 隧道。连接由 `connectionId` 标识，后端按 `connectionID → map[db]*redis.Client` 管理连接池。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `connectionId` | `string` | 是 | — | 唯一连接标识 |
| `host` | `string` | 是 | — | Redis 主机地址 |
| `port` | `uint16` | 是 | — | Redis 端口 (通常 6379) |
| `database` | `int` | 否 | 0 | 逻辑数据库编号 (0-15) |
| `username` | `string` | 否 | 空 | Redis 6+ ACL 用户名 |
| `password` | `string` | 否 | 空 | Redis 密码 |
| `sshEnabled` | `bool` | 否 | false | 是否启用 SSH 隧道 |
| `sshHost` | `string` | 条件 | — | SSH 服务器地址 |
| `sshPort` | `int` | 条件 | — | SSH 端口 (通常 22) |
| `sshUsername` | `string` | 条件 | — | SSH 用户名 |
| `sshPassword` | `string` | 条件 | — | SSH 密码 |

**返回值**: `string` — 连接 ID

**可能错误**: 连接拒绝、认证失败、SSH 隧道建立失败等

#### 4.1.2 `redis_disconnect` → `RedisDisconnect`

**用途**: 关闭指定 Redis 连接及其所有数据库连接池。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionID` | `string` | 是 | 要断开的连接 ID |

**返回值**: `string`

#### 4.1.3 `redis_list_databases` → `RedisListDatabases`

**用途**: 获取 Redis 所有逻辑数据库的信息（索引、标签、键数量）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionID` | `string` | 是 | 连接 ID |

**返回值**: `RedisDatabaseInfo[]`

**`RedisDatabaseInfo` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `index` | `int64` | 数据库编号 (0, 1, 2, ...) |
| `label` | `string` | 数据库标签 (如 "db0") |
| `keyCount` | `*uint64` | 键数量 (指针，可为 nil) |
| `isDefault` | `bool` | 是否为默认数据库 |

---

### 4.2 键操作

#### 4.2.1 `redis_scan_keys` → `RedisScanKeys`

**用途**: 使用 SCAN 命令增量扫描键。不阻塞服务器，适合大数据库。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `int` | 是 | 数据库编号 |
| `pattern` | `*string` | 否 | 键模式 (如 `"user:*"`)，nil 表示 `"*"` |
| `cursor` | `*string` | 否 | 游标，首次调用传 nil 或 `"0"` |
| `count` | `*uint64` | 否 | 每次返回的最大键数量 |

**返回值**: `RedisScanResult`

**`RedisScanResult` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `nextCursor` | `string` | 下次扫描的游标，`"0"` 表示扫描完成 |
| `items` | `RedisKeySummary[]` | 扫描到的键列表 |
| `hasMore` | `bool` | 是否还有更多键 |

**`RedisKeySummary` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 键名 |
| `keyType` | `string` | 键类型 (`string`, `hash`, `list`, `set`, `zset`) |
| `ttlMs` | `*int64` | 剩余 TTL（毫秒），`-1` 表示永久，`-2` 表示已过期 |

#### 4.2.2 `redis_get_key_detail` → `RedisGetKeyDetail`

**用途**: 获取键的详细信息，包括类型、值、TTL、编码、大小。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `int` | 是 | 数据库编号 |
| `key` | `string` | 是 | 键名 |

**返回值**: `RedisKeyDetail`

**`RedisKeyDetail` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 键名 |
| `keyType` | `string` | 键类型 |
| `ttlMs` | `*int64` | 剩余 TTL（毫秒） |
| `encoding` | `*string` | 内部编码 (如 `"hashtable"`, `"ziplist"`) |
| `size` | `*uint64` | 键大小（字节数） |
| `value` | `json.RawMessage` | 键值（根据类型以不同 JSON 格式返回） |
| `truncated` | `bool` | 值是否被截断 |
| `unsupported` | `bool` | 是否为不支持的类型 |

#### 4.2.3 `redis_set_key` → `RedisSetKey`

**用途**: 创建或更新键值对。支持所有 Redis 数据类型。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `int` | 是 | 数据库编号 |
| `key` | `string` | 是 | 新键名 |
| `originalKey` | `string` | 否 | 原键名（重命名时使用） |
| `keyType` | `string` | 是 | 键类型 (`string`, `hash`, `list`, `set`, `zset`) |
| `value` | `json.RawMessage` | 是 | 键值（JSON 格式，根据类型而定） |
| `ttl` | `*int64` | 否 | TTL（秒） |
| `ttlMs` | `*int64` | 否 | TTL（毫秒） |
| `overwrite` | `bool` | 否 | 是否覆盖已存在的键 |

**返回值**: `string`

#### 4.2.4 `redis_delete_key` → `RedisDeleteKey`

**用途**: 删除单个键。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `int` | 是 | 数据库编号 |
| `key` | `string` | 是 | 要删除的键名 |

**返回值**: `string`

#### 4.2.5 `redis_delete_keys` → `RedisDeleteKeys`

**用途**: 批量删除多个键。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `int` | 是 | 数据库编号 |
| `keys` | `string[]` | 是 | 要删除的键名列表 |

**返回值**: `string`

#### 4.2.6 `redis_update_key_ttl` → `RedisUpdateKeyTTL`

**用途**: 更新键的过期时间。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `int` | 是 | 数据库编号 |
| `key` | `string` | 是 | 键名 |
| `ttl` | `int64` | 是 | 新的 TTL 值（秒），`-1` 为永久，`0` 为立即删除 |

**返回值**: `string`

---

### 4.3 命令执行

#### 4.3.1 `redis_execute` → `RedisExecute`

**用途**: 执行原始 Redis CLI 命令。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionId` | `string` | 是 | 连接 ID |
| `database` | `int` | 是 | 数据库编号 |
| `command` | `string` | 是 | 命令名 (如 `"GET"`, `"HGETALL"`, `"INFO"`) |
| `args` | `string[]` | 否 | 命令参数列表 |

**返回值**: `RedisCommandResult`

**`RedisCommandResult` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `command` | `string` | 执行的命令 |
| `output` | `string` | 命令执行结果 |

**示例**:
```typescript
invoke("redis_execute", {
  connectionId: "conn-456",
  database: 0,
  command: "HGETALL",
  args: ["user:1001"],
});
```

---

## 5. 状态持久化

#### 5.1 `load_state` → `LoadState`

**用途**: 加载应用持久化状态（连接配置、密钥、用户偏好等）。

**返回值**: `string` — JSON 序列化状态

#### 5.2 `save_state` → `SaveState`

**用途**: 保存应用状态到本地磁盘。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | `string` | 是 | JSON 序列化状态 |

**返回值**: 无（成功时不返回值，失败时抛出 error）

---

## 6. 错误处理

### 6.1 错误传递链路

```
Go error → Wails IPC → JavaScript Exception → mapInvokeError() → Error object
```

Go 方法返回的 `error` 会被 Wails 运行时转换为 JavaScript 异常。前端通过 `mapInvokeError()` 进行规范化。

### 6.2 `mapInvokeError()` 行为

位于 [`src/lib/transport/mapInvokeError.ts`](../src/lib/transport/mapInvokeError.ts):

- 如果 error 是 `Error` 实例 → 直接返回
- 如果 error 是 `string` → 包装为 `new Error(string)`
- 其他类型 → 包装为 `new Error("Desktop invocation failed")`
- 可通过 `context.message` 提供自定义回退消息

### 6.3 常见错误类型

| Go 错误来源 | 前端收到的错误消息 |
|-------------|-------------------|
| 连接不存在 | `connection not found` |
| SSH 隧道失败 | SSH 握手错误详情 |
| 数据库认证失败 | `Access denied for user...` |
| SQL 语法错误 | MySQL 错误代码 + 消息 |
| Redis 命令错误 | `ERR unknown command...` |
| ES HTTP 错误 | ES 返回的 HTTP 状态码 + JSON 错误 |

---

## 7. 注意事项

1. **MySQL 不使用 `USE` 语句**: 所有查询使用 `database.table` 限定名，避免并发查询时的数据库切换竞态条件。
2. **Redis 连接池**: 后端按 `connectionID → map[int]*redis.Client` 管理连接池，同一数据库编号的连接被复用，避免每次命令都握手。
3. **ES 无状态**: ES 是纯 HTTP 代理，不需要后端建立持久连接。每次请求都是独立的。
4. **SSH 隧道复用**: 同一 connectionID 的 MySQL/Redis 连接共享同一 SSH 隧道实例。
