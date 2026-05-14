# Multi-Database-Browsing 架构改进总体方案

> 基于对项目代码的深入审计，本文档涵盖 14+ 个缺陷的修复方案，按优先级分三阶段执行。
> **执行状态：第一阶段 + P2 工程化改进已完成（2026-05-14）**

---

## 执行结果

| 编号 | 任务 | 状态 | 变更 |
|------|------|------|------|
| #1+#4 | 心跳 Goroutine 泄漏修复 + 并发锁合并 | ✅ 完成 | `backend/modules/mysql/connection.go` |
| #2 | Redis singleflight 替换为标准库 | ✅ 完成 | `backend/modules/redis/{module,types}.go`, `go.mod` |
| #3 | SQL 标识符转义统一 | ✅ 完成 | `backend/modules/mysql/schema.go` |
| #5-Step1 | 状态存储文件权限收紧 | ✅ 完成 | `backend/infra/state_store/state_store.go` |
| #8 | 统一错误处理体系 | ✅ 完成 | `backend/shared/errors.go`, 三个模块错误路径迁移 |
| #9 | 后端单元测试 | ✅ 完成 | 3 个测试文件，14 个用例全部通过 |
| #10 | 结构化日志引入 | ✅ 完成 | `backend/shared/logger.go`, 全局替换 log.Printf |
| #6 | ES 模块后端重构 | ⏸ 暂缓 | 架构变更大，需独立迭代 |
| #7 | Proxy.go 胶水代码消除 | ⏸ 暂缓 | 需先验证 Wails 多 Binding 支持 |
| #5-Step2 | 操作系统密钥链集成 | ⏸ 暂缓 | 跨平台依赖，独立迭代 |
| #11-13 | 废弃 API / 巨型文件 / 状态管理 | ⏸ 暂缓 | 日常开发中伴随迭代拆分 |

---

## 第一阶段：安全与并发修复（高优先级，建议 3-5 天）

### 1. 心跳 Goroutine 泄漏修复

**问题**：`MysqlConnect` 中 `go m.startHeartbeat()` 在 goroutine 内部才写入 cancel 函数到 map。如果在 goroutine 启动后、写入前调用 `MysqlDisconnect`，cancel 为 nil，心跳永不停止。

**修复方案**：在启动 goroutine 前创建 context 并同步写入 map。

**改动文件**：`backend/modules/mysql/connection.go`

```go
// 当前（有缺陷）：
m.connManager.mu.Lock()
m.connManager.heartbeats[req.ConnectionID] = nil
m.connManager.mu.Unlock()
go m.startHeartbeat(req.ConnectionID, db)
// startHeartbeat 内部才写入 cancel —— 时间窗口内 disconnect 找不到 cancel

// 修复后：
ctx, cancel := context.WithCancel(context.Background())

m.connManager.mu.Lock()
// 原子写入 cancel，确保 Disconnect 能立即找到并调用
m.connManager.heartbeats[req.ConnectionID] = cancel
m.connManager.mu.Unlock()

// 将 context 和 db 作为参数传入，startHeartbeat 不再需要自己创建/写入
go m.startHeartbeat(req.ConnectionID, db, ctx)
```

对应修改 `startHeartbeat` 签名，移除内部创建 context 和写入 map 的逻辑。

**风险评估**：极低，纯内部重构，无 API 变更。

---

### 2. Redis Singleflight 替换为标准库

**问题**：`getRedisClient` 中 50+ 行手动实现 singleflight，使用 `sync.Map.Swap` + channel + for 循环，逻辑嵌套深且脆弱。

**修复方案**：用 `golang.org/x/sync/singleflight` 替代。

**改动文件**：`backend/modules/redis/module.go`、`backend/modules/redis/types.go`

```go
import "golang.org/x/sync/singleflight"

// RedisConnectionManager 新增字段：
inFlight singleflight.Group

// getRedisClient 简化为：
func (m *Module) getRedisClient(connectionID string, database int) (*goRedis.Client, error) {
    // ... 检查缓存逻辑不变 ...

    key := fmt.Sprintf("%s:%d", connectionID, database)
    result, err, _ := m.connManager.inFlight.Do(key, func() (interface{}, error) {
        // 创建 Redis 客户端的逻辑
        return m.createRedisClient(connectionID, database)
    })
    if err != nil {
        return nil, err
    }
    return result.(*goRedis.Client), nil
}
```

**影响**：`go.mod` 新增 `golang.org/x/sync` 依赖（已在项目中间接依赖，风险低）。

---

### 3. SQL 标识符转义统一

**问题**：`schema.go` 中直接使用 `` `%s` `` 格式化数据库名/表名，未调用 `escapeMysqlIdentifier`。而 `transfer.go` 中使用了该函数。两套转义逻辑不一致。

虽然 `escapeMysqlIdentifier` 已正确实现（双反引号转义），但 `schema.go` 没有使用它。

**修复方案**：`schema.go` 中所有标识符拼接统一改为调用 `escapeMysqlIdentifier`。

**改动文件**：`backend/modules/mysql/schema.go`

需修改的位置：
- L54: `fmt.Sprintf("SHOW TABLES FROM \`%s\`", database)` → `fmt.Sprintf("SHOW TABLES FROM %s", escapeMysqlIdentifier(database))`
- L91: `fmt.Sprintf("DESCRIBE \`%s\`.\`%s\`", database, tableName)` → `fmt.Sprintf("DESCRIBE %s.%s", escapeMysqlIdentifier(database), escapeMysqlIdentifier(tableName))`
- L130: `SHOW INDEX FROM` 同样修改
- L246, L248: `CREATE INDEX` 中所有标识符
- L273, L275: `DROP INDEX` 中所有标识符

**风险评估**：低，纯字符串格式化修改，行为向后兼容（正常标识符结果不变）。

---

### 4. MySQL 连接管理并发锁合并

**问题**：`MysqlConnect` 中两次加锁之间存在间隙。虽然实际风险较低（connections 和 heartbeats 是独立 map），但逻辑上应保持一致性。

**修复方案**：合并为一次加锁操作。

**改动文件**：`backend/modules/mysql/connection.go`（与 #1 合并修改）

```go
// 方案：在一次锁中完成连接 swap + 心跳 cancel 写入
m.connManager.mu.Lock()
oldDB := m.connManager.connections[req.ConnectionID]
m.connManager.connections[req.ConnectionID] = db
oldCancel := m.connManager.heartbeats[req.ConnectionID]
m.connManager.heartbeats[req.ConnectionID] = cancel // cancel 已在 #1 中提前创建
m.connManager.mu.Unlock()

if oldCancel != nil {
    oldCancel()
}
```

---

### 5. 状态存储安全加固

**问题**：数据库密码以明文 JSON 存储在 `~/.config/multi-database-browsing/multi-database-browsing.state.json`，文件权限 `0o644`（其他用户可读）。

**修复方案（分两步）**：

**Step 1（快速修复）**：收紧文件权限 + 混淆编码

- 将 `os.WriteFile` 权限从 `0o644` 改为 `0o600`（仅文件所有者可读写）
- secrets 中的密码字段做 base64 编码（非加密，但避免明文扫描）

**改动文件**：
- `backend/infra/state_store/state_store.go`：修改权限
- `backend/app/state.go`：SaveState/LoadState 时编码/解码 secrets

**Step 2（长期方案）**：操作系统密钥链

- 使用 `github.com/keybase/go-keychain` (macOS) / `github.com/danieljoos/wincred` (Windows) / `github.com/godbus/dbus` (Linux Secret Service)
- 引入 `github.com/zalando/go-keyring` 作为跨平台抽象
- secrets 中只存引用 key，实际密码存于系统密钥链

> **注意**：Step 2 需要跨平台测试，建议独立为一个迭代。

---

## 第二阶段：架构改进（中优先级，建议 5-7 天）

### 6. ES 模块后端重构

**问题**：ES 后端仅是一个无状态 HTTP 代理，前端承担了连接认证、URL 拼装、请求构造。安全敏感信息（密码、API Key）在前端组装后通过 IPC 传输。

**当前数据流**：
```
前端 → buildTransportAuth(connection) → 密码明文通过 IPC → 后端 HttpRequest → ES
```

**修复方案**：后端接管 ES 连接管理，与 MySQL/Redis 模式统一。

**改动文件**：
- 新增 `backend/modules/elasticsearch/connection.go`
- 修改 `backend/modules/elasticsearch/module.go`
- 新增 `backend/modules/elasticsearch/types.go`（已有，需扩展）
- 修改 `src/modules/es/services/*.ts`（8 个文件）

**设计**：

```go
// 后端新增连接管理
type EsConnectionManager struct {
    mu         sync.RWMutex
    connections map[string]*EsConnectionInfo // connectionID → {url, auth}
}

type EsConnectionInfo struct {
    BaseURL  string
    AuthType string // "basic" | "apiKey" | "none"
    Username string
    Password string
    ApiKey   string
    Client   *http.Client // 可复用连接池，支持 TLS 配置
}

// 新增方法
func (m *Module) EsConnect(req EsConnectRequest) (string, error)
func (m *Module) EsDisconnect(connectionID string) (string, error)
func (m *Module) EsPing(connectionID string) (string, error)

// 修改现有方法
func (m *Module) HttpRequest(connectionID string, params EsRequestParams) (string, error)
// params 不再包含 auth/url，只包含 {method, path, body, headers}
```

**前端改动**：所有 service 文件改为传递 `connectionID` + 操作参数，不再构造 auth 信息。

**风险评估**：**高**，这是最大的架构变更，涉及前后端 10+ 文件。建议：
1. 先在后端新增 `EsConnect`，保持旧 `HttpRequest` 兼容
2. 前端逐步迁移 service 调用
3. 验证完成后移除旧路径

---

### 7. Proxy.go 胶水代码消除

**问题**：`proxy.go` 20+ 个方法，每个方法都是一行 `return a.mysql.Xxx()`。

**修复方案（两个选项）**：

**选项 A（推荐）**：利用 Wails 的多 Binding 特性，直接将 Module 绑定到前端

```go
// main.go 中绑定多个模块
options.Bind(
    app,                    // App 结构（保留 state 相关方法）
    app.mysql,             // MySQL Module
    app.redis,             // Redis Module
    app.elasticsearch,     // ES Module
)
```

这样 `MysqlQuery` 等方法的 IPC 路径变为 `MysqlQuery`（直接从 Module 暴露），无需 proxy.go 透传。

**选项 B**：保留 App 作为统一入口，用代码生成消除胶水代码

```go
// 使用 go generate + template 生成 proxy.go
//go:generate go run tools/gen_proxy.go

// gen_proxy.go 扫描 Module 的导出方法，生成对应的 proxy 委托
```

> **推荐选项 A**，因为 Wails 原生支持多 Binding，且 Module 已经是独立的结构体。但需要确认 Wails v2.11 的 multi-binding 是否支持跨模块方法调用（即前端能否调用 `window.go.backend.MysqlModule.MysqlQuery()`）。

**改动文件**：`main.go`、`backend/app/proxy.go`（可删除大部分内容）、前端 `invoke` 调用路径

---

### 8. 统一错误处理体系

**问题**：各引擎错误返回格式不统一，前端无法做差异化处理。

**修复方案**：定义 `AppError` 结构体。

**新增文件**：`backend/shared/errors.go`

```go
type ErrorCode string

const (
    ErrConnectionFailed  ErrorCode = "CONNECTION_FAILED"
    ErrConnectionNotFound ErrorCode = "CONNECTION_NOT_FOUND"
    ErrQueryFailed       ErrorCode = "QUERY_FAILED"
    ErrSchemaError       ErrorCode = "SCHEMA_ERROR"
    ErrAuthFailed        ErrorCode = "AUTH_FAILED"
    ErrTimeout           ErrorCode = "TIMEOUT"
)

type AppError struct {
    Code    ErrorCode `json:"code"`
    Message string    `json:"message"`
    Engine  string    `json:"engine,omitempty"`
    Detail  string    `json:"detail,omitempty"` // 开发模式下的详细错误
}

func (e *AppError) Error() string { return e.Message }

// 辅助函数
func NewConnectionFailed(engine, message string, detail error) *AppError { ... }
func Wrap(err error, code ErrorCode, engine string) *AppError { ... }
func IsAppError(err error, code ErrorCode) bool { ... }
```

**前端**：`mapInvokeError.ts` 解析 Wails 错误字符串中的 JSON，还原为 `AppError` 对象。

**改动范围**：各引擎模块中的 `fmt.Errorf` 替换为 `NewAppError`/`Wrap`。

**迁移策略**：
1. 先定义 `AppError` 和辅助函数
2. 从 MySQL 模块开始迁移（最复杂）
3. Redis 模块迁移
4. ES 模块迁移
5. 前端适配

---

## 第三阶段：工程化改进（低优先级，建议持续迭代）

### 9. 后端单元测试框架搭建

**问题**：后端零测试覆盖。

**修复方案**：

**Step 1**：搭建测试基础设施

```
backend/
├── modules/mysql/
│   ├── connection_test.go      # 连接/断开/心跳测试
│   ├── schema_test.go          # SQL 标识符转义测试（配合 #3）
│   ├── utils_test.go           # scanRows 等工具函数测试
│   └── transfer_test.go        # 导出/导入测试
├── modules/redis/
│   ├── module_test.go          # getRedisClient singleflight 测试（配合 #2）
│   └── helpers_test.go         # JSON 规范化测试
├── shared/
│   └── errors_test.go          # AppError 测试（配合 #8）
└── infra/sshtunnel/
    └── tunnel_test.go          # SSH 隧道测试
```

**Step 2**：测试策略

| 测试类型 | 方式 | 覆盖范围 |
|----------|------|----------|
| 单元测试 | `go test` + mock | SQL 转义、工具函数、错误处理 |
| 集成测试 | `go test` + 本地 MySQL/Redis/ES 容器 | 连接管理、查询、schema |
| 并发测试 | `go test -race` | 心跳 goroutine、singleflight、连接管理 |

**Step 3**：CI 集成

```bash
go test -v -race ./backend/...
```

**优先级排序**：
1. `utils_test.go` — 最易编写，无外部依赖
2. `errors_test.go` — 纯逻辑测试
3. `helpers_test.go`（Redis）— 纯逻辑测试
4. `schema_test.go` — 验证 SQL 转义安全性
5. `connection_test.go`（MySQL）— 验证心跳修复
6. `module_test.go`（Redis）— 验证 singleflight 修复

---

### 10. 结构化日志引入

**问题**：后端仅使用 `fmt.Println` 和 `log.Printf`，无结构化日志。

**修复方案**：使用 Go 1.21+ 标准库 `log/slog`（零外部依赖）。

**改动文件**：全局替换 `log.Printf` → `slog.Info/Debug/Error`

```go
// 示例：MySQL 心跳
slog.Info("mysql heartbeat started",
    "connection_id", connectionID,
    "interval", "30s")

slog.Error("mysql heartbeat ping failed",
    "connection_id", connectionID,
    "error", err,
    "consecutive_fails", consecutiveFails)
```

**建议**：添加 `connection_id` 到所有日志条目，支持多连接追踪。

---

### 11. 废弃 API 清理

**问题**：`SharedConnectionState.tsx` 保留了 `@deprecated` 的 API。

**修复方案**：

**改动文件**：`src/state/SharedConnectionState.tsx`

删除以下字段及实现：
- `activeConnectionIdByEngine`（L19-20, L149-155）
- `setActiveConnection`（L31-32, L144-146）
- 对应的 `useMemo` 和 `useCallback`

**前置条件**：搜索项目中是否还有外部消费者引用这些 API。

---

### 12. 前端巨型文件拆分

**问题**：部分 Hook 和组件文件过大。

| 文件 | 行数 | 拆分建议 |
|------|------|----------|
| `useMysqlSidebarWorkspace.ts` | 821 | 拆为 `useMysqlDatabaseTree` + `useMysqlSidebarActions` + `useMysqlContextMenu` |
| `useConnectionWorkspace.ts` | 627 | 拆为 `useEngineConnection` + `useConnectionLifecycle` + `useConnectionSwitch` |
| `styles.css` | ~100 行(实际 4010) | 拆为 `base.css` + `shell.css` + `mysql.css` + `redis.css` + `es.css` |

**建议**：这部分改动量大、风险高，建议在日常开发中伴随功能迭代逐步拆分，而非一次性重构。

---

### 13. 前端状态管理优化（远期）

**问题**：React Context + useState 模式下，任何状态变化都会触发 Provider 全部消费者 re-render。

**评估**：
- 当前项目规模下，Context 性能问题可能不明显（用户连接数有限）
- 引入 Zustand/Jotai 是重大架构决策，需评估迁移成本
- 建议先用 React DevTools Profiler 实测，确认瓶颈后再决策

**如果确认需要**：
- 优先将 `SharedConnectionState` 迁移为 Zustand store
- 各引擎 Context 保持不动（引擎间状态独立）
- 渐进迁移，不一次性全部替换

---

## 执行优先级总览

| 优先级 | 编号 | 任务 | 预估工时 | 风险 |
|--------|------|------|----------|------|
| P0 | #1 | 心跳 Goroutine 泄漏修复 | 0.5h | 低 |
| P0 | #2 | Redis singleflight 替换 | 1h | 低 |
| P0 | #3 | SQL 标识符转义统一 | 0.5h | 低 |
| P0 | #4 | MySQL 连接管理并发锁合并 | 0.5h（与 #1 合并） | 低 |
| P0 | #5-Step1 | 状态存储文件权限收紧 | 0.5h | 低 |
| P1 | #5-Step2 | 操作系统密钥链集成 | 1-2 天 | 中 |
| P1 | #6 | ES 模块后端重构 | 3-5 天 | 高 |
| P1 | #8 | 统一错误处理体系 | 2-3 天 | 中 |
| P2 | #7 | Proxy.go 胶水代码消除 | 0.5-1 天 | 中 |
| P2 | #9 | 后端单元测试 | 持续 | 低 |
| P2 | #10 | 结构化日志引入 | 0.5 天 | 低 |
| P3 | #11 | 废弃 API 清理 | 0.5h | 低 |
| P3 | #12 | 前端巨型文件拆分 | 持续 | 中 |
| P3 | #13 | 前端状态管理优化 | 待定 | 高 |

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| #6 ES 重构影响所有 ES 功能 | 保留旧 API 兼容路径，双写验证后再移除 |
| #7 多 Binding 可能不兼容 | 先写 PoC 验证 Wails 支持 |
| #8 错误体系迁移中途破坏现有调用 | 先添加 AppError，旧 `fmt.Errorf` 逐步替换，中间态共存 |
| #12 巨型文件拆分引入回归 | 拆分前确保有测试覆盖（#9） |

---

## 测试策略

每个修复完成后需要验证：

| 修复 | 验证方式 |
|------|----------|
| #1 心跳修复 | 快速 connect → disconnect → 检查 goroutine 数（`runtime.NumGoroutine()`） |
| #2 singleflight | 并发创建同一 (connectionID, db) 的客户端，验证只创建一次 |
| #3 SQL 转义 | 添加包含反引号的数据库名/表名，验证不被突破 |
| #5 权限 | 检查文件权限 `ls -la ~/.config/multi-database-browsing/` |
| #8 错误体系 | 前端验证可解析错误码 |

---

*最后更新：2026-05-14*
