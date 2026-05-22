# Multi-Database Browsing / 多数据库浏览器（本地客户端）

**简短说明（中文）**：本项目是一个本地多数据库桌面客户端，使用 Wails (Go) + React 框架。支持 Elasticsearch、MySQL 与 Redis 三类连接，提供统一的数据浏览、管理、查询界面。
主要是为了方便自己使用(不想安装多个客户端)，所以开源出来(至于以后加啥功能,看问的工作需要吧)。

**参考项目**：
Dbeaver  
es-client  
AnotherRedisDesktopManager

**Short description (English)**: A local multi-database desktop client built with Wails (Go) and React, supporting Elasticsearch, MySQL, and Redis with a unified UI for browsing, querying, and managing data across all three databases.


## 技术栈 / Tech Stack 🏗️

- **后端 / Backend**: Go 1.25 (Wails v2.11)
- **前端 / Frontend**: React 19 + TypeScript 5.9 + Ant Design 6 + Vite 7
- **数据库驱动 / Drivers**:
  - MySQL: `github.com/go-sql-driver/mysql`
  - Redis: `github.com/redis/go-redis/v9`
  - Elasticsearch: HTTP 代理（Go net/http）

---

## 功能 / Features ✅

### Elasticsearch
- 📊 **数据浏览** - 高级条件过滤、分页查看
- 💡 **SQL 查询** - 简易 SQL 查询、REST 风格高级操作
- 📑 **索引管理** - 创建、删除、查看索引
- 🔄 **深度分页** - 自动分页（≤10k）+ 手动分页（search_after，支持任意深度）
- 📡 **HTTP 代理认证** - Basic Auth、API Key、自定义头支持

### MySQL
- 📚 **库表浏览** - 库表结构查看、字段信息详查
- 🔍 **索引管理** - 查看、创建、编辑、删除（支持唯一索引、多列索引）
- 🖥️ **SQL 执行** - 查询结果展示、多表导出
- 🛡️ **竞态条件防护** - 使用数据库限定名称（`db`.`table`）避免异步冲突
- 📥 **数据导入/导出** - 多表导出、数据导入、批量操作
- 🔄 **断线自动重试** - 检测到 Error 2006/2013 等断线错误时自动重连一次
- 📐 **可伸缩布局** - 表列表支持鼠标拖拽调整宽度，可折叠收起

### Redis
- 📌 **连接管理** - 快速切换数据库、连接池复用
- 🔑 **Key 浏览** - 基于 SCAN 的增量式 key 浏览（支持大数据库）
- 📁 **层级树导航** - 基于 `:` 分隔符的文件夹式树形浏览，支持展开/折叠
- 👁️ **类型支持** - String、Hash、List、Set、ZSet 详情查看
- ✏️ **数据编辑** - 表格式新增/编辑、批量删除、TTL 修改
- 🎛️ **命令执行** - Redis Console 原始命令执行
- ⚡ **性能优化** - 连接复用（1 个连接替代 16 个，加载提速 3-5 倍）

### 功能限制 ⚠️
- ❌ Redis pub/sub 订阅不支持
- ❌ Redis 慢日志分析不支持
- ❌ Elasticsearch 跨集群查询不支持
- ⚠️ ES 数据浏览表格视图未虚拟化，大结果集可能卡顿
- ⚠️ ES 右键菜单可能同时显示应用菜单和浏览器原生菜单
- ⚠️ MySQL TableManager 组件未做 memo 优化，频繁状态变更可能影响性能

---

## 本地化 / Localization 🌐

- **支持语言** - 中文（简体）、English
- **框架** - `react-i18next`
- **结构** - 共享资源 (`src/i18n/resources`) + 模块资源 (`src/modules/*/i18n`)
- **翻译覆盖** - 所有用户交互文本已国际化

---

## 架构与结构 / Architecture 🏢

本项目采用 **前后端分离 + 模块化** 架构。前端按引擎（ES / MySQL / Redis）组织功能模块，后端对应三个独立模块通过 Wails IPC 通信。

**后端目录结构**:
```
backend/
├── app/            # Wails 绑定入口 (proxy.go 暴露所有 IPC 方法)
├── modules/        # 数据库模块: elasticsearch/  mysql/  redis/
│   └── mysql/      # connection.go | query.go | schema.go | transfer.go | retry.go
├── infra/          # 基础设施: sshtunnel/  state_store/
└── shared/         # shared/ 层: errors.go (结构化错误) | logger.go (slog日志) | value.go (安全值转换)
```

**前端目录结构**:
```
src/
├── modules/        # 引擎功能模块: es/  mysql/  redis/
│   └── */routes/   # ContentArea 组件 — 同时挂载所有页面，CSS切换显隐
├── state/          # React Context: 跨引擎连接状态 + 各引擎工作区状态
├── hooks/          # 共享 Hooks (连接生命周期等)
├── lib/            # 传输层 (transport/), 连接配置 (connection/), 类型定义, 二进制值处理 (binaryValue.ts)
├── styles/         # CSS 按关注点拆分: base | layout | components | mysql | redis | elasticsearch | utilities
└── app/            # Shell 布局: 侧边栏 + 工作区 + 路由 + 浮层 (ConnectionOverlays)
```

> 详细架构设计（含状态管理、IPC 通信、SSH 隧道、错误处理）请参阅 [docs/design.md](docs/design.md)。
> IPC 方法完整列表请参阅 [docs/ipc-api.md](docs/ipc-api.md)。

**架构特点：**
1. **模块化** — 三个数据库模块独立，共享壳层
2. **上下文管理** — Context 层保存模块级状态（索引、数据、筛选）
3. **传输层抽象** — ES 请求支持 Wails IPC (桌面) 和 HTTP 代理 (浏览器) 双模式
4. **状态持久化** — `AppStateStore` 保存连接配置、最近使用数据
5. **ContentArea 预挂载** — 所有页面同时挂载，切换 Tab 不重新查询，保留组件状态
6. **结构化错误** — 后端统一 `AppError`，前端可解析错误码和引擎信息

---

## 快速开始 / Quick Start 💡

### 前置需求 / Prerequisites
- **Node.js 18+** (前端依赖)
- **Go 1.25** (后端编译)
- **Wails CLI** - 执行：`go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Git** (可选，用于克隆仓库)
- **开发环境**: Windows 11 (也支持 macOS / Linux)

### 1️⃣ 安装依赖 / Install Dependencies

```bash
# 前端依赖
pnpm install

# Go 依赖（已在 vendor/ 中）
go mod download
```

### 2️⃣ 开发模式 / Development Mode

```bash
# 启动开发服务器（自动打开应用窗口，支持热重载）
wails dev
```

应用将在新窗口中打开，修改 React/Go 代码后自动刷新。

### 3️⃣ 生产构建 / Production Build

```bash
# 生成优化后的生产二进制
wails build

# 输出位置：
# - Windows: build/bin/multi-database-browsing.exe
# - Linux:   build/bin/multi-database-browsing
# - macOS:   build/bin/multi-database-browsing.app
```

### 4️⃣ 离线编译 / Offline Build（仅网络隔离环境）

如需在完全离线的网络环境编译，提前在联网环境执行一次：

```bash
# 在联网环境下载所有依赖到 vendor/
go mod vendor
```

然后在离线环境执行：

```bash
# 使用 vendor/ 中的离线依赖编译
GOPROXY=off wails build
```

**何时需要离线编译？**
- ✅ 网络受限的企业内网
- ✅ 编译时无互联网访问权限
- ❌ 普通开发流程（不需要）

### 5️⃣ 调试构建 / Debug Build

```bash
# 包含调试符号，便于排查问题
wails build -debug

# 也可结合开发模式的快速迭代
wails dev
```

---

## 常用开发命令 / Useful Commands 🔧

### 前端命令
```bash
pnpm run dev          # 启动 Vite dev server（localhost:5173）
pnpm run build        # 生产构建（输出到 dist/）
pnpm run lint         # ESLint 代码检查
pnpm run lint:fix     # 自动修复 lint 问题
```

### Go 后端命令
```bash
go mod tidy           # 整理依赖（删除未使用、添加缺失）
go mod vendor         # 创建/更新 vendor/ 目录（离线编译）
go fmt ./...          # 代码格式化
go test ./...         # 运行所有测试
```

### Wails 框架命令
```bash
wails dev             # 开发模式（推荐）
wails build           # 生产构建
wails build -debug    # 调试构建
wails doctor          # 检查环境与依赖完整性
```

---

## 配置文件 / Configuration 🔧

### wails.json
应用级配置文件，控制窗口和构建行为：

```json
{
  "appname": "multi-database-browsing",
  "appurl": "http://localhost:5173",
  "outputfilename": "multi-database-browsing",
  "frontend": {
    "dir": "src",
    "build": "pnpm run build",
    "install": "pnpm install",
    "dev": "pnpm run dev"
  },
  "windows": {
    "width": 1200,
    "height": 800
  }
}
```

**常见修改：**
- `width` / `height` - 初始窗口大小
- `appname` / `outputfilename` - 应用名称和二进制名

### .env（可选）
开发时的环境变量，控制传输层模式：

```bash
# .env (或 .env.local)
VITE_PLATFORM=browser   # browser = 纯前端开发（HTTP 代理）
                        # wails   = 桌面应用模式（Wails IPC）
```

详细说明请参阅 [.env.example](.env.example)。

### 用户数据目录
应用运行时的配置和缓存：
- **Windows**: `%APPDATA%\multi-database-browsing\`
- **Linux**: `~/.config/multi-database-browsing/`
- **macOS**: `~/Library/Application Support/multi-database-browsing/`

---

## 性能优化 / Performance 📊

### Redis 连接复用 🔥
**问题**：每次访问 Redis 都创建新连接，导致频繁握手

**解决**：
- 单连接 + SELECT 命令切换数据库
- 连接池管理（减少握手开销）
- **效果**：加载速度提升 **3-5 倍**，数据库列表加载提速 **94%**

### MySQL 竞态条件防护 🛡️
**问题**：多个异步操作同时执行 USE 命令，导致错误的数据库切换

**示例**：
```
任务 A: USE database1; SELECT * FROM table1;
任务 B: USE database2; SELECT * FROM table2;
↓
可能执行顺序：A 的 USE → B 的 USE → A 的 SELECT (错误！)
```

**解决**：使用数据库限定名称，完全避免 USE 命令
```sql
-- 错误（有竞态风险）
USE mydb;
SELECT * FROM users;

-- 正确（无竞态风险）
SELECT * FROM mydb.users;
```

### MySQL 断线自动重试 🔄
**问题**：数据库空闲超时或网络中断导致 Error 2006/2013

**解决**：`queryWithRetry()` / `execWithRetry()` 检测到断线错误后自动重连一次
- 检测错误：Error 2006 (server has gone away), Error 2013 (lost connection), broken pipe, connection refused 等
- 仅重试一次，避免无限循环

### Elasticsearch 分层分页 📄
**问题**：Elasticsearch 默认限制前 10000 条记录（不支持 offset > 10000）

**解决**：
1. **自动分页** (≤10k) - 使用 `from/size` 快速查询
2. **手动分页** (>10k) - 使用 `search_after` 支持任意深度
3. **进度显示** - queryingPage → skippingData → locatingData → fetchingPage

### React 代码分割 ⚡
- **Vite 自动分割** - react-vendor、antd-vendor、i18n-vendor、sql-vendor 分离
- **路由级懒加载** - 模块按需加载
- **ContentArea 预挂载** - 同引擎页面同时挂载，Tab 切换不重新查询
- **结果**：初始加载时间减少 ~40%

### 二进制值安全传输 🔒
**问题**：非 UTF-8 字节（如 BLOB 数据）在 JSON 中会损坏

**解决**：`BinaryCellValue` 接口标记 + UTF-8/Base64 编码
- 后端：`shared.SafeStringValue()` 自动检测 UTF-8，非 UTF-8 转 Base64
- 前端：`decodeCellValue()` 解码回可读字符串

---

## 测试与验证 / Testing & Verification ✅

### 前端测试
> ⚠️ 自动化测试覆盖仍在完善中，目前主要依赖手动测试验证

```bash
wails dev                # 启动应用
# 在 UI 中手动执行测试场景，观察控制台输出
```

### 后端测试
后端模块包含单元测试，执行：

```bash
go test ./...            # 运行所有测试
go test -v ./...         # 详细输出
go test -cover ./...     # 显示覆盖率
```

### 手动验证场景
- **MySQL 多表导出**: 在 Table Manager 中右键多表 → 导出 → 验证 SQL 内容
- **ES 深度分页**: 查询超过 10000 条记录的索引 → 验证 search_after 分页
- **Redis SCAN 性能**: 打开含大量键的数据库 → 验证加载时间
- **Redis 层级树**: 打开含大量键的 Redis → 验证 `:` 分隔符的文件夹浏览
- **i18n 完整性**: 切换中/英文 → 验证所有文本已翻译

---

## 迁移历史 / Migration History 📝

该项目从 **Tauri (Rust)** 迁移到 **Wails (Go)**：

### 为什么迁移？
1. **编译简化** - Go 依赖少，`go mod vendor` 即可完全离线编译
2. **网络友好** - 无需 Rust 编译链，减少网络依赖
3. **前端无改** - React 代码 100% 复用
4. **API 兼容** - `invoke()` 调用完全相同，无需前端修改

### 迁移清单
- ✅ 后端框架：Rust → Go (Wails v2)
- ✅ 前端 API：修改 `src/lib/wailsapi.ts`（snake_case → PascalCase）
- ✅ 删除 `src-tauri/` 目录
- ✅ 更新 `package.json`（移除 Tauri CLI）
- ✅ 配置离线编译（`go mod vendor`）

---

## 故障排查 / Troubleshooting 🐛

### "Wails runtime not available"
**原因**：在浏览器或普通 Node 环境中运行，而非 Wails 应用窗口

**解决**：
```bash
# ✅ 正确
wails dev              # 在应用窗口中运行

# ❌ 错误
pnpm run dev           # 仅启动 Vite dev server（无 Go 后端）
```

### MySQL 连接失败

**检查清单**：
```bash
# 1. 验证 MySQL 服务运行
mysql -h <host> -u <user> -p<password> -e "SELECT 1"

# 2. 检查权限
GRANT ALL ON *.* TO 'user'@'%' WITH GRANT OPTION;

# 3. 查看应用日志
# 开发模式：wails dev 的控制台输出
```

**常见原因**：
- ❌ 用户密码错误或无权限
- ❌ MySQL 未启动或网络不通
- ❌ 防火墙阻止（修改 `my.cnf` 的 bind-address）
- 💡 如果是断线后操作，重试机制会自动触发一次重连

### Redis 连接失败

**检查清单**：
```bash
# 1. 验证 Redis 服务运行
redis-cli -h <host> -p <port> PING

# 2. 检查认证（如已配置）
redis-cli -h <host> -a <password> PING

# 3. 测试网络连接
telnet <host> <port>
```

**常见原因**：
- ❌ Redis 未启动或端口错误
- ❌ 认证密码错误
- ❌ 防火墙/网络隔离

### Elasticsearch 连接失败

**检查清单**：
```bash
# 1. 验证 ES 服务运行和版本
curl http://<host>:<port>/

# 2. 检查认证（如已配置）
curl -u user:password http://<host>:<port>/

# 3. 测试 TLS（如使用 HTTPS）
curl --insecure https://<host>:<port>/
```

**常见原因**：
- ❌ ES 未启动或地址/端口错误
- ❌ Basic Auth 密码错误
- ❌ TLS 证书验证失败（点击"跳过 TLS 验证"）

### 编译失败

**问题：Node 依赖缺失**
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**问题：Go 依赖问题**
```bash
go mod tidy
go mod vendor
```

**问题：Wails 环境问题**
```bash
wails doctor              # 诊断环境
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

**问题：Windows 编译报错**
```bash
# 确保 Go CGO 已启用
# PowerShell:
$env:CGO_ENABLED=1
$env:CC="gcc"             # 需要 GCC（通过 MinGW 或 TDM-GCC）
# Git Bash:
export CGO_ENABLED=1
wails build
```

---

## 结构优化规划 / Refactor Plan 🧭

### ✅ 已完成
- 共享桌面壳层拆分 - `WorkspaceChrome.tsx`
- 数据库模块自包含 - es / mysql / redis 独立结构
- i18n 模块聚合 - 共享资源 + 模块资源
- MySQL 导出/导入分层 - transfer service / dump helper / SQL parser
- MySQL 多表导出交互优化 - 弹窗选择表
- 后端模块化重构 - `backend/modules/mysql/`, `backend/modules/redis/`, `backend/modules/elasticsearch/`
- 路由驱动 Tab 可见性 - `getEngineFromPath()` 替代 `activeEngine` 状态
- CSS 按关注点拆分 - 8 个独立样式文件
- ContentArea 预挂载 - Tab 切换不重新查询，保留状态
- ConnectionOverlays 提取 - 连接对话框/右键菜单独立组件
- MysqlSplitLayout - 可伸缩分割面板（表列表拖拽宽度）
- MysqlOverlays 提取 - MySQL 专属浮层菜单
- MySQL 断线重试 - Error 2006/2013 自动重连
- 结构化错误系统 - `AppError` + `ErrorCode` JSON 序列化
- 结构化日志 - slog 替代 log.Println
- Redis 层级 Key 树 - `:` 分隔符文件夹浏览
- 二进制值安全传输 - `BinaryCellValue` + Base64 编码
- 死组件清理 - ErrorBoundary, useVirtualTable, 遗留 DataBrowser 等已移除

### 🔄 下一步建议
1. **前端行为测试** - MySQL 表总览右键菜单的多表导出流程
2. **工作区行为分离** - TableManager 中与右侧工作区无关的逻辑提取
3. **Redis 连接重连** - 连接断开后的自动重连逻辑
4. **ES 表格虚拟化** - 大数据浏览时的性能优化
5. **暗色模式支持** - 全局主题切换

---

## 主要改进历史 / Recent Improvements 🚀

### 2026-05 更新

#### CSS 架构拆分 🎨
- 3896 行单体 `styles.css` 拆分为 8 个文件（base/layout/components/mysql/redis/elasticsearch/utilities）
- 更易维护、按需加载

#### ContentArea 预挂载 ⚡
- 每引擎新增 `{Engine}ContentArea.tsx` — 所有页面同时挂载
- CSS `display: none/flex` 切换显隐
- Tab 切换不重新查询，组件状态完整保留

#### ConnectionOverlays 提取 📋
- 连接对话框和右键菜单从 `AppOverlays.tsx` 中独立
- 减少 635+ 行代码

#### MySQL 可伸缩布局 📐
- 新增 `MysqlSplitLayout` — 表列表可拖拽调整宽度（200-500px）
- 宽度持久化到 localStorage，支持折叠收起

#### MySQL 断线重试 🔄
- 新增 `retry.go` — 自动检测并重连一次
- 支持 Error 2006/2013、broken pipe、connection refused 等

#### 结构化错误系统 🛡️
- `AppError` + `ErrorCode` — JSON 序列化，前端可解析
- 7 种错误码：CONNECTION_FAILED, QUERY_FAILED, SCHEMA_ERROR, 等

#### 结构化日志 📝
- slog 替代 log.Println — 全局 Logger + 引擎级作用

#### Redis 层级 Key 树 📁
- 基于 `:` 分隔符的文件夹树形浏览
- 文件夹优先排序，支持展开/折叠

#### 二进制值安全传输 🔒
- `BinaryCellValue` 接口 — UTF-8 直接传输，非 UTF-8 Base64 编码
- 前端 `decodeCellValue()` 解码回可读字符串

### 2026-03 更新

#### MySQL 索引管理 ✨
- 完整的索引管理 UI（查看、创建、编辑、删除）
- 支持唯一索引、多列索引、自定义索引类型
- 防止删除主键索引

#### Elasticsearch 深度分页 ⚡
- **自动分页**（≤10k）- 使用 from/size
- **手动分页**（>10k）- 使用 search_after
- **进度提示** - 四个加载阶段清晰显示

#### Redis 性能优化 🔥
- 连接池复用（1 个连接替代 16 个）
- 数据库初始化速度 +94%
- 整体页面加载速度 **3-5 倍提升**

#### MySQL 竞态条件修复
- 数据库限定名称（`db`.`table`）替代 USE 命令
- 消除异步操作冲突

#### 前端代码优化
- Context 重命名（`AppContext` → `ElasticsearchContext`）
- Elasticsearch 索引选择改为原生 select
- 修复 `_id` 字段排序错误

---

## 主要文件与路径速查 / Quick Reference 📑

| 功能 | 文件位置 |
|------|---------|
| Wails IPC 入口 | [backend/app/app.go](backend/app/app.go) — 所有 IPC 方法 |
| 架构文档 | [docs/design.md](docs/design.md) |
| IPC 方法列表 | [docs/ipc-api.md](docs/ipc-api.md) |
| ES 数据浏览 | [src/modules/es/pages/DataBrowser.tsx](src/modules/es/pages/DataBrowser.tsx) |
| MySQL 表管理 | [src/modules/mysql/pages/TableManager.tsx](src/modules/mysql/pages/TableManager.tsx) |
| MySQL 可伸缩布局 | [src/modules/mysql/features/table-manager/components/MysqlSplitLayout.tsx](src/modules/mysql/features/table-manager/components/MysqlSplitLayout.tsx) |
| MySQL 断线重试 | [backend/modules/mysql/retry.go](backend/modules/mysql/retry.go) |
| Redis 键树 | [src/modules/redis/features/browser/components/RedisKeyTree.tsx](src/modules/redis/features/browser/components/RedisKeyTree.tsx) |
| 结构化错误 | [backend/shared/errors.go](backend/shared/errors.go) |
| 结构化日志 | [backend/shared/logger.go](backend/shared/logger.go) |
| 二进制值处理 | [src/lib/binaryValue.ts](src/lib/binaryValue.ts) |
| 连接生命周期 | [src/hooks/useConnectionWorkspace.ts](src/hooks/useConnectionWorkspace.ts) |
| CSS 入口 | [src/styles/index.css](src/styles/index.css) |

---

## 许可证 / License 📄

无特定许可证。

---

**Happy browsing! 🎉 Have fun exploring your databases!**
