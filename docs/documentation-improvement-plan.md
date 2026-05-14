# 文档改进计划

> 本文档基于对 README.md、docs/design.md、CLAUDE.md 及关键源代码的全面审查，
> 列出所有发现的问题和改进建议，按优先级排序，便于逐项改进。

---

## P0 — 紧急（架构信息严重过时/错误）

### 1. README 前端架构树与实际代码严重不符

**位置**：`README.md` 第 62-96 行

**问题**：README 中的前端架构树列出了 `src/lib/wailsapi.ts`、`src/lib/types.ts`、`src/lib/storage.ts` 等路径，但实际代码已重构为 `src/lib/transport/`（含 `wails/`、`http/`、`es/` 子目录）、`src/lib/connection/`（含 `types.ts`、`profile.ts`）等。`wailsapi.ts` 不再是简单的 IPC 包装，而是有完整的传输层抽象（desktop/http 双模式）。此外还缺少 `src/lib/composeProviders.tsx`、`src/lib/errorLog.ts`、`src/lib/routeEngine.ts` 等文件。

**改进方案**：用 `src/lib/` 下的实际目录结构重写架构树，或直接引用 `docs/design.md` 中第 92-144 行的准确结构。

**验证方式**：对比 `src/` 目录实际结构与文档中的架构树，确保每个文件/目录都存在且描述正确。

---

### 2. README 后端架构树完全过时

**位置**：`README.md` 第 98-112 行

**问题**：README 列出的后端结构是单文件模式（`elasticsearch.go`、`mysql.go`、`redis.go`、`helpers.go`、`types.go`），但实际已拆分为：
- `backend/modules/mysql/` 下有 `connection.go`、`query.go`、`schema.go`、`transfer.go`、`retry.go`、`utils.go`、`helpers.go`、`types.go`、`module.go`
- `backend/modules/redis/` 下有 `module.go`、`helpers.go`、`types.go`
- `backend/modules/elasticsearch/` 下有 `module.go`、`types.go`
- 新增了 `backend/infra/sshtunnel/` 和 `backend/infra/state_store/` 目录
- 新增了 `backend/shared/db.go`

**改进方案**：完全重写后端架构树，与 `docs/design.md` 第 54-82 行的结构保持一致。

**验证方式**：对比 `backend/` 目录实际结构与文档中的架构树。

---

### 3. 三份文档信息重复且不同步

**位置**：`README.md`、`docs/design.md`、`CLAUDE.md`

**问题**：三份文档包含大量重复信息（架构、技术栈、模块说明），但内容不一致：
- 架构树各不相同
- 技术栈版本矛盾（见第 4 项）
- 文件职责描述有差异

**改进方案**：明确各文档的定位，避免重复：
- **README.md**：面向用户 — 快速上手 + 功能概览 + 故障排查。架构部分只保留高层概览，详细架构引用 `docs/design.md`
- **docs/design.md**：面向开发者 — 详细架构设计、状态管理、IPC 通信等
- **CLAUDE.md**：面向 AI 助手 — 编码规则、约定、性能陷阱（已被 .gitignore 排除，不进入仓库）

具体操作：
1. README 的架构树简化为顶层目录 + 一句话说明，删除详细的文件级列表
2. README 添加链接："详细架构设计请参阅 [docs/design.md](docs/design.md)"
3. 检查三份文档中的重复内容，确保每项信息只在一个地方维护

**验证方式**：搜索三份文档中的相同关键词，确认信息源唯一。

---

## P1 — 重要（影响用户/开发者体验）

### 4. 技术栈版本在三份文档中矛盾

**位置**：`README.md` 第 9-16 行、`docs/design.md` 第 11-22 行、`CLAUDE.md` 第 9-13 行

**问题**：
| 技术 | README | design.md | CLAUDE.md |
|------|--------|-----------|-----------|
| React | 19 | 18 | 19 |
| TypeScript | 未指定 | 未指定 | 5.9 |
| Ant Design | 未指定版本 | 未指定版本 | 6 |
| Vite | 未指定 | 未指定 | 7 |
| Go | 1.21+ | 1.21+ | 1.25 |

**改进方案**：以 `package.json` 和 `go.mod` 中的实际版本为准，统一更新三份文档。建议在 README 中只写主版本（如 "React 19"），在 design.md 中写完整版本。

**验证方式**：`cat package.json | grep -E "react|antd|vite|typescript"` 和 `head -3 go.mod`。

---

### 5. .env 文档与实际不符

**位置**：`README.md` 第 249-256 行

**问题**：README 的 `.env` 示例展示了 `DEBUG=true` 和 `API_TIMEOUT=30000`，但实际 `.env` 只有一行 `VITE_PLATFORM=browser`，且 `DEBUG` 和 `API_TIMEOUT` 在代码中并不存在。

**改进方案**：
1. 删除虚构的环境变量
2. 记录实际使用的 `VITE_PLATFORM` 变量及其可选值：
   ```
   # .env
   VITE_PLATFORM=browser   # 可选值: browser (纯前端开发) | wails (桌面应用模式)
   ```
3. 说明该变量的作用：控制传输层选择 HTTP 代理还是 Wails IPC

**验证方式**：`grep -r "VITE_PLATFORM" src/` 确认实际使用方式。

---

### 6. proxy.go 零注释的公共 API 层

**位置**：`backend/app/proxy.go`（113 行，0 个函数注释）

**问题**：`proxy.go` 是 Wails 绑定的核心文件，所有前端可调用的后端方法都在此定义，但没有任何 godoc 注释。这是前后端通信的桥梁，应该是最需要文档的地方。

**改进方案**：为每个公开方法添加 godoc 注释，格式如下：
```go
// MysqlQuery executes a SQL query on the specified MySQL connection.
// Returns a MysqlQueryResult with columns, rows, affectedRows, and isResultSet flag.
// Returns an error if the connection is not found or the query fails.
func (a *App) MysqlQuery(connectionID string, query string) (mysqlmodule.MysqlQueryResult, error) {
```

至少需要注释的方法（共 18 个）：
- `HttpRequest` — ES HTTP 代理
- `MysqlConnect` / `MysqlDisconnect` / `MysqlPing` — MySQL 连接管理
- `MysqlQuery` / `MysqlListDatabases` / `MysqlListTables` / `MysqlDescribeTable` — MySQL 查询
- `MysqlListIndexes` / `MysqlCreateIndex` / `MysqlDropIndex` — MySQL 索引
- `MysqlExportDatabase` / `MysqlExportTable` / `MysqlExportTables` / `MysqlImportSql` — MySQL 导入导出
- `RedisConnect` / `RedisDisconnect` / `RedisListDatabases` — Redis 连接
- `RedisScanKeys` / `RedisGetKeyDetail` / `RedisExecute` / `RedisSetKey` / `RedisDeleteKey` / `RedisDeleteKeys` / `RedisUpdateKeyTTL` — Redis 操作

**验证方式**：`go doc ./backend/app/` 查看生成的文档。

---

### 7. app.go 缺少结构体和构造函数注释

**位置**：`backend/app/app.go`

**问题**：`App` 结构体是整个后端的入口，但没有注释说明其职责和生命周期。`NewApp()` 也没有注释。

**改进方案**：
```go
// App is the top-level application struct bound to the Wails frontend.
// It holds references to all database modules and the state store,
// and exposes methods that the frontend can invoke via Wails IPC.
type App struct {

// NewApp creates a new App instance with initialized modules.
// Call Startup() after creation to set the Wails context.
func NewApp() *App {
```

**验证方式**：`go doc ./backend/app/ App` 和 `go doc ./backend/app/ NewApp`。

---



## P2 — 改进（提升文档质量）

### 9. 缺少贡献指南

**位置**：项目根目录

**问题**：没有 CONTRIBUTING.md 或 README 中的贡献部分。新贡献者不知道代码风格要求、PR 流程、commit 规范等。

**改进方案**：在 README 中添加"贡献指南"章节，或创建独立的 `CONTRIBUTING.md`，至少包含：
- 代码风格：Go 使用 `gofmt`，TypeScript 使用 ESLint（`pnpm run lint`）
- PR 流程：Fork → Branch → PR → Review → Merge
- Commit 规范：建议使用 Conventional Commits（`feat:`, `fix:`, `docs:` 等）
- 开发环境设置：引用 README 的 Quick Start

**验证方式**：新开发者按照指南能成功提交 PR。

---

### 10. 缺少界面截图

**位置**：`README.md` 顶部

**问题**：一个数据库管理 GUI 工具没有界面截图，用户无法直观了解产品外观和功能。

**改进方案**：
1. 在 `assets/` 目录下添加 2-3 张截图（连接管理、数据浏览、SQL 查询）
2. 在 README 的项目标题下方添加截图：
   ```markdown
   ## 截图 / Screenshots
   | ES 数据浏览 | MySQL 表管理 | Redis 键浏览 |
   |:---:|:---:|:---:|
   | ![ES](assets/screenshot-es.png) | ![MySQL](assets/screenshot-mysql.png) | ![Redis](assets/screenshot-redis.png) |
   ```

**验证方式**：README 在 GitHub 上渲染后能看到截图。

---

### 11. design.md 缺少 SSH 隧道详细设计

**位置**：`docs/design.md`

**问题**：SSH 隧道是重要功能（MySQL 和 Redis 远程连接都依赖它），但 design.md 只在架构树中提到了 `sshtunnel/tunnel.go`，没有详细说明。

**改进方案**：在 design.md 中添加章节：
- 隧道创建/复用/关闭的生命周期
- `sshtunnel.Manager` 的 `GetOrCreate` 模式（按 connectionID 复用）
- 与 MySQL/Redis 连接管理器的集成方式
- 错误处理和重连策略

**验证方式**：新开发者阅读后能理解 SSH 隧道的工作原理。

---

### 12. design.md 缺少错误处理架构说明

**位置**：`docs/design.md`

**问题**：文档没有描述全局错误处理策略。

**改进方案**：添加"错误处理"章节：
- Go 错误如何通过 Wails IPC 传递到前端（作为 JavaScript 异常）
- 前端 `mapInvokeError()` 的错误规范化逻辑
- `ErrorBoundary` 和 `ErrorLogModal` 的使用方式
- 各模块的错误日志前缀约定（`[mysql]`、`[redis]`）

**验证方式**：开发者能根据文档定位和调试错误。

---

### 13. design.md 缺少安全考量说明

**位置**：`docs/design.md`

**问题**：密码、API Key 等敏感信息如何存储、传输和保护，文档中完全没有提及。

**改进方案**：添加"安全考量"章节：
- 密钥存储：`AppStateStore` 将连接配置保存到 OS 配置目录的 JSON 文件中（明文）
- 传输安全：SSH 隧道加密、ES 支持 HTTPS + 跳过 TLS 验证选项
- 已知限制：密码以明文存储在本地磁盘，未来可考虑使用 OS 密钥链

**验证方式**：用户了解其凭证的存储方式和安全风险。

---

### 14. useConnectionWorkspace.ts 核心逻辑缺少注释

**位置**：`src/hooks/useConnectionWorkspace.ts`（619 行）

**问题**：这是管理所有引擎连接生命周期的核心 Hook，几乎没有行内注释。特别是：
- `handleConnectionChange` 的三种场景（A/B/C）在 design.md 中有描述，但代码中没有对应注释
- `switchViewSync` 的时序关键点（必须 await）没有注释提醒
- `ENGINE_CONFIG` 中 `needsConnect: false` 对 ES 的含义没有解释

**改进方案**：
1. 在 `handleConnectionChange` 函数顶部添加场景说明注释：
   ```typescript
   // Scenario A: Already focused + same engine → early-return, sidebar supplements navigation
   // Scenario B: Active but not focused → switch focus + restore workspace + navigate
   // Scenario C: New connection → switchViewSync → backend connect → load data → navigate
   ```
2. 在 `switchViewSync` 中标注 `await activateConnection()` 的重要性
3. 在 `ENGINE_CONFIG` 中注释 ES 不需要 connect/disconnect 的原因（无状态 HTTP 代理）

**验证方式**：代码注释与 design.md 第 7 章的描述一致。

---

### 15. design.md 技术栈版本过时

**位置**：`docs/design.md` 第 11-22 行

**问题**：design.md 仍写 "React 18"，应更新为 React 19。

**改进方案**：更新技术栈表格，与 `package.json` 中的实际版本一致。此改进应与第 4 项一起完成。

**验证方式**：与 package.json 版本号一致。

---

## P3 — 锦上添花（完善细节）

### 16. 功能限制列表不完整

**位置**：`README.md` 第 44-48 行

**问题**：README 列出了 3 个限制，但 CLAUDE.md 中提到了更多已知 UX 限制。

**改进方案**：补充用户可感知的限制：
```markdown
### 功能限制 ⚠️
- ❌ Redis pub/sub 订阅不支持
- ❌ Redis 慢日志分析不支持
- ❌ Elasticsearch 跨集群查询不支持
- ⚠️ ES 数据浏览表格视图未虚拟化，大结果集可能卡顿
- ⚠️ ES 右键菜单可能同时显示应用菜单和浏览器原生菜单
- ⚠️ MySQL TableManager 组件未做 memo 优化，频繁状态变更可能影响性能
```

**验证方式**：与 CLAUDE.md 中的 "Known UX limitations" 和 "Performance notes" 交叉核对。

---

### 17. "测试与验证" 章节内容空洞

**位置**：`README.md` 第 321-368 行

**问题**：性能基准测试部分只有注释描述，没有实际可运行的命令或脚本。后端测试说"部分 Go 代码有单元测试"但未指明哪些。

**改进方案**：
1. 将基准测试改为手动测试步骤（更诚实）
2. 列出实际有测试的 Go 包：`go test -v ./backend/modules/mysql/ ./backend/modules/redis/ ...`
3. 或者标注为"待完善"：
   ```markdown
   > ⚠️ 自动化测试覆盖仍在完善中，目前主要依赖手动测试验证
   ```

**验证方式**：`go test ./... 2>&1 | head -20` 确认哪些包有测试。

---

### 18. 缺少 IPC API 文档

**位置**：项目文档

**问题**：前后端之间的 IPC 接口没有独立文档。design.md 有方法映射表，但缺少参数和返回值类型。

**改进方案**：在 `docs/` 下创建 `ipc-api.md`，为每个 IPC 方法记录：
- 方法名（前端 snake_case → 后端 PascalCase）
- 请求参数及类型
- 返回值及类型
- 可能的错误
- 示例调用

可以半自动生成：从 `proxy.go` 的函数签名提取，再补充说明。

**验证方式**：前端开发者无需阅读 Go 代码即可正确调用后端方法。

---

### 19. 缺少 .env.example

**位置**：项目根目录

**问题**：`.env` 被 .gitignore 排除，但没有提供 `.env.example` 供新开发者参考。

**改进方案**：创建 `.env.example`：
```bash
# 传输层模式
# browser = 纯前端开发（通过 HTTP 代理访问数据库）
# wails   = 桌面应用模式（通过 Wails IPC 访问后端）
VITE_PLATFORM=browser
```

注意：`.env.example` 不应被 .gitignore 排除，需确认 `.gitignore` 中的 `*.local` 规则不会影响它。

**验证方式**：新开发者复制 `.env.example` 为 `.env` 后能正常运行 `pnpm run dev`。

---

### 20. main.go 缺少包注释

**位置**：`main.go`

**问题**：作为程序入口，缺少包级注释。

**改进方案**：
```go
// Package main is the entry point for the Multi-Database Browsing desktop application.
// It initializes the Wails runtime with the backend App and embedded frontend assets.
package main
```

**验证方式**：`go doc ./` 能显示包说明。

---

## 改进进度追踪

完成一项后，在对应行前标记 ✅：

- [x] P0-1: README 前端架构树更新
- [x] P0-2: README 后端架构树更新
- [x] P0-3: 三份文档去重和同步
- [x] P1-4: 技术栈版本统一
- [x] P1-5: .env 文档修正
- [x] P1-6: proxy.go 添加 godoc 注释
- [x] P1-7: app.go 添加注释
- [ ] P2-9: 添加贡献指南（用户选择跳过）
- [x] P2-10: 添加界面截图（已留占位符）
- [x] P2-11: design.md 添加 SSH 隧道设计
- [x] P2-12: design.md 添加错误处理架构
- [x] P2-13: design.md 添加安全考量
- [x] P2-14: useConnectionWorkspace.ts 添加注释
- [x] P2-15: design.md 技术栈版本更新
- [x] P3-16: 功能限制列表补全
- [x] P3-17: 测试章节修正
- [x] P3-18: 创建 IPC API 文档
- [x] P3-19: 创建 .env.example
- [x] P3-20: main.go 添加包注释
