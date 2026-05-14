# #6 — ES 模块后端重构计划

## 目标

将 ES 模块后端从"无状态 HTTP 代理"升级为"连接感知"模块，与 MySQL/Redis 保持架构一致：
- **现状**：前端构造完整请求（URL + auth + body），后端仅做 HTTP 转发
- **目标**：前端传 `connectionId` + 操作参数，后端从连接管理器查找凭据，组装并发出请求

---

## 改动范围

| 层级 | 文件 | 变更类型 |
|------|------|----------|
| 后端 | `backend/modules/elasticsearch/connection.go` | **新增** |
| 后端 | `backend/modules/elasticsearch/types.go` | **修改**（新增请求/响应类型） |
| 后端 | `backend/modules/elasticsearch/module.go` | **修改**（新增方法，保留旧方法兼容） |
| 后端 | `backend/app/app.go` | **修改**（新增字段） |
| 后端 | `backend/app/proxy.go` | **修改**（新增方法，保留旧方法） |
| 后端 | `main.go` | 无变更 |
| 前端 | `src/modules/es/services/transport.ts` | **修改**（新增 connectionId 接口） |
| 前端 | `src/modules/es/services/client.ts` | **修改**（新增 connectionId 调用路径） |
| 前端 | `src/lib/transport/wails/esDesktopTransport.ts` | **修改**（移除 auth 字段） |
| 前端 | `src/lib/wailsapi.ts` | **修改**（新增 `es_request` 参数映射） |
| 前端 | 所有 `src/modules/es/services/*.ts` | **修改**（8 个 service 文件签名变更） |
| 前端 | 所有 features/hooks 使用 `EsConnection` | **修改**（传 connectionId 替代完整连接对象） |

---

## 执行步骤

### Phase 1：后端新增连接管理（0 风险，向后兼容）

**Step 1.1** — 新增 `backend/modules/elasticsearch/connection.go`

```go
type EsConnectionInfo struct {
    BaseURL    string
    AuthType   string
    Username   string
    Password   string
    ApiKey     string
    VerifyTLS  bool
    Client     *http.Client // 复用连接池
    SSHLocalPort int        // 0 = no SSH tunnel
}

func (m *Module) EsConnect(req EsConnectRequest) (string, error) {
    // 类似 MySQL: 处理 SSH tunnel, 创建 http.Client, 存入 connections map
    // 返回 "Connected successfully"
}

func (m *Module) EsDisconnect(connectionID string) (string, error) {
    // 从 map 移除，关闭 SSH tunnel
}

func (m *Module) EsPing(connectionID string) (string, error) {
    // GET / 验证连接
}
```

**Step 1.2** — 新增 `EsConnectionManager` 到 `module.go`

```go
type Module struct {
    connManager *EsConnectionManager // 新增
}

func NewModule() *Module {
    return &Module{
        connManager: NewEsConnectionManager(),
    }
}
```

**Step 1.3** — 修改 `HttpRequest` 方法签名，新增 `HttpRequestByConnectionID`

```go
// 旧方法保留（前端逐步迁移期间继续使用）
func (m *Module) HttpRequest(params HttpRequestParams) (string, error) { ... }

// 新方法：前端传 connectionId，后端从 connManager 查找凭据
func (m *Module) HttpRequestByConnectionID(req EsRequestByID) (string, error) {
    info, err := m.connManager.Get(req.ConnectionID)
    if err != nil {
        return "", shared.NewConnectionFailed("elasticsearch", ...)
    }
    // 从 info 中取 auth/tls 组装请求
}
```

**Step 1.4** — 在 `app.go` + `proxy.go` 中暴露新方法

```go
func (a *App) EsConnect(req esmodule.EsConnectRequest) (string, error)
func (a *App) EsDisconnect(connectionID string) (string, error)
func (a *App) EsPing(connectionID string) (string, error)
func (a *App) HttpRequestByConnectionID(req esmodule.EsRequestByID) (string, error)
```

### Phase 2：前端适配（向后兼容，新旧共存）

**Step 2.1** — 在 `wailsapi.ts` 中新增 `http_request_by_connection_id` 映射

```typescript
const OBJECT_PARAM_METHODS = {
  "http_request": true,
  "http_request_by_connection_id": true,
};
```

**Step 2.2** — 在 `client.ts` 中新增 `esRequestById` 函数

```typescript
// 新路径：传 connectionId，后端查找凭据
export async function esRequestById<T>(
  connectionId: string,
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  const request = buildTransportRequestById(connectionId, path, options);
  // ... 调用 http_request_by_connection_id
}
```

**Step 2.3** — 在各 service 文件中同时支持两种调用路径

```typescript
// searchService.ts
export async function searchEsDocuments(
  connection: EsConnection,
  index: string,
  body: unknown
) {
  // 过渡期：检查是否有 connectionId 字段
  if (typeof connection === 'string') {
    return esRequestById(connection, `/${index}/_search`, { method: "POST", body });
  }
  return esRequest(connection, `/${index}/_search`, { method: "POST", body });
}
```

**Step 2.4** — 在 ES 连接逻辑中调用后端 `EsConnect`

在 `useConnectionWorkspace.ts` 的 ES connect 分支中，新增 `invoke("es_connect", ...)` 调用。

### Phase 3：验证 + 移除旧路径

**Step 3.1** — 验证所有 ES 请求走新路径

在 `HttpRequest`（旧）和 `HttpRequestByConnectionID`（新）中各加一行 log，观察运行日志。

**Step 3.2** — 移除旧 `HttpRequest` 及相关透传

- 删除 `HttpRequestParams` 中的 `Auth` 字段（不再需要前端传）
- 删除 `proxy.go` 中的 `HttpRequest` 方法
- 删除前端 `esDesktopTransport` 中的 `auth` 组装逻辑
- 删除前端 `client.ts` 中的 `esRequest`（旧路径）

### Phase 4：前端连接管理简化

**Step 4.1** — ES 不再需要在前端保存密码

前端 `SharedConnectionState` 中的 secrets 对 ES 连接不再包含密码/API Key（仅后端持有）。

**Step 4.2** — `EsConnection` 类型简化

```typescript
// 之前
interface EsConnection {
  id: string; name: string; engine: EngineType;
  baseUrl: string; authType: AuthType;
  username?: string; password?: string; apiKey?: string; // 删除
  verifyTls: boolean; ssh?: SshTunnelConfig; // 删除
}

// 之后
interface EsConnection {
  id: string; name: string; engine: EngineType;
  baseUrl: string; // 仅保留 URL，认证全在后端
}
```

---

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 前端 ES 功能完全不可用 | 高 | Phase 1 不删旧方法，新旧共存 |
| 连接状态不一致 | 中 | 在 `useConnectionWorkspace` 中确保 EsConnect 在激活连接时调用 |
| SSH 隧道管理复杂 | 中 | 复用 `sshtunnel.Manager`，与 MySQL/Redis 完全相同的模式 |
| HTTP Client 复用失效 | 低 | `http.Client` 本身是连接池，开箱即用 |

---

## 预计工时：3-5 天

| 阶段 | 工时 | 说明 |
|------|------|------|
| Phase 1 后端 | 1 天 | connection.go + 连接管理 |
| Phase 2 前端 | 2 天 | service 文件适配 + invoke 路径 |
| Phase 3 验证 | 0.5 天 | 测试 + 日志观察 |
| Phase 4 清理 | 1 天 | 移除旧路径 + 类型简化 |

---

# #7 — Proxy.go 胶水代码消除计划

## 目标

消除 `proxy.go` 中 20+ 个一行透传的胶水方法，利用 Wails 特性直接暴露 Module 方法给前端。

---

## 方案对比

### 方案 A：Wails 多 Binding（推荐）

**原理**：Wails 支持 `Bind` 多个结构体，每个结构体的导出方法都可通过 IPC 调用。

```go
// main.go
app := backendapp.NewApp()

err := wails.Run(&options.App{
    Bind: []interface{}{
        app,              // App 结构体：state 相关方法
        app.MySQL(),      // MySQL Module
        app.Redis(),      // Redis Module
        app.Elasticsearch(), // ES Module（需在 #6 重构后才有足够方法）
    },
})
```

**前端调用变化**：
```typescript
// 之前：通过 App 结构体
invoke("mysql_query", { connectionId: "x", sql: "SELECT 1" })
// 解析为 window.go.app.App.MysqlQuery("x", "SELECT 1")

// 之后：直接调用 Module 方法
// Wails 会将所有 Bound 结构体的方法合并到同一个命名空间
invoke("mysql_query", { connectionId: "x", sql: "SELECT 1" })
// 解析为 window.go.app.MysqlModule.MysqlQuery("x", "SELECT 1")
```

**关键验证点**：Wails v2.11 是否支持多 Binding 的命名空间隔离？需要写 PoC 验证。

### 方案 B：代码生成 proxy.go

**原理**：用 `go generate` 扫描 Module 的导出方法，自动生成 proxy 委托代码。

```go
// backend/app/generate_proxy.go
//go:generate go run generate_proxy.go

// generate_proxy.go 输出 proxy.go:
// func (a *App) MysqlQuery(connectionID string, query string) (mysqlmodule.MysqlQueryResult, error) {
//     return a.mysql.MysqlQuery(connectionID, query)
// }
```

### 方案 C：保留现状，添加注释（最低风险）

**理由**：
- proxy.go 虽然冗余，但**零 bug 风险**
- 提供统一的入口点，前端不需要知道方法在哪个 Module
- Wails 多 Binding 的命名空间行为可能不稳定
- 143 行代码，维护成本极低

---

## 推荐执行路径

### Step 0：PoC 验证（0.5 天）

写一个最小 Wails 项目，验证多 Binding 行为：

```go
type MysqlModule struct{}
func (m *MysqlModule) MysqlPing() string { return "pong" }

type RedisModule struct{}
func (r *RedisModule) RedisPing() string { return "pong" }

// Bind: []interface{}{&MysqlModule{}, &RedisModule{}}
// 前端能否同时调用 mysql_ping 和 redis_ping？
```

**验证项**：
1. 多 Binding 是否支持？
2. 方法命名空间是否冲突？（如果 MysqlModule 和 RedisModule 都有 `Ping()` 方法）
3. `snakeToPascalCase` 解析是否仍然工作？

### Step 1：如果 PoC 成功 → 执行方案 A

1. 为每个 Module 新增 getter 方法：
   ```go
   func (a *App) MySQL() *mysqlmodule.Module { return a.mysql }
   func (a *App) Redis() *redismodule.Module { return a.redis }
   func (a *App) Elasticsearch() *esmodule.Module { return a.elasticsearch }
   ```

2. 修改 `main.go` 的 `Bind` 列表

3. 删除 `proxy.go` 中所有 MySQL/Redis/ES 的透传方法（保留 `HttpRequest` 等 App 特有方法）

4. **注意**：`wailsapi.ts` 中的 `SINGLE_STRING_PARAM_METHODS` 和 `OBJECT_PARAM_METHODS` 需要更新，因为方法名映射逻辑不变，但解析路径可能从 `App` 变为 `MysqlModule`。

### Step 2：如果 PoC 失败 → 执行方案 B

1. 创建 `backend/app/gen_proxy.go`

2. 扫描所有 Module 的导出方法（反射或 AST 解析）

3. 生成 `proxy.go` 文件

4. `go generate` 集成到构建流程

### Step 3：如果风险太高 → 执行方案 C

1. 在 `proxy.go` 顶部添加注释说明设计意图

2. 不再新增新的胶水方法

3. 后续如果 Module 方法增多，再考虑重构

---

## 风险评估

| 方案 | 风险 | 收益 |
|------|------|------|
| A（多 Binding） | **高** — Wails 行为不确定 | 消除 143 行胶水代码 |
| B（代码生成） | **中** — 维护成本转移到 gen 脚本 | 自动生成，保持一致性 |
| C（保留现状） | **无** | 无代码减少，但零风险 |

---

## 预计工时：0.5-1 天

| 步骤 | 工时 | 说明 |
|------|------|------|
| Step 0 PoC | 0.5h | 写最小验证项目 |
| Step 1 方案A | 0.5天 | 如果 PoC 成功 |
| Step 2 方案B | 0.5天 | 如果 PoC 失败 |
| Step 3 方案C | 5min | 写注释 |

---

## 与 #6 的依赖关系

- #7 方案 A 需要 #6 完成后才能最大化收益（ES Module 重构后才有足够的方法值得直接暴露）
- #7 可以独立于 #6 执行（先对 MySQL/Redis 做）
- **建议先完成 #6，再执行 #7**

---

*最后更新：2026-05-14*
