# Multi-Database Browsing 设计文档

> 本文档梳理项目的整体架构、左侧边栏功能域、右侧页面功能域。不涉具体代码实现，仅作结构与功能分析。

---

## 1. 项目概述

本项目是一个本地多数据库桌面客户端，使用 **Wails (Go) + React** 框架。支持 **Elasticsearch**、**MySQL** 与 **Redis** 三类数据库连接，提供统一的数据浏览、管理、查询界面。

### 1.1 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Wails v2.11 |
| 后端语言 | Go 1.25 |
| 前端框架 | React 19 + TypeScript 5.9 |
| UI 组件库 | Ant Design 6 |
| 构建工具 | Vite 7 |
| 路由 | React Router v7 |
| 状态管理 | React Context |
| 国际化 | i18next (中文 / 英文) |
| 样式 | 纯 CSS (无 CSS-in-JS) |

### 1.2 整体布局

```
+------------------------------------------------------------------+
|  Topbar: 品牌名 | 当前引擎/连接名 | 状态指示器                      |
+----------------+-------------------------------------------------+
|  Sidebar       |  Workspace (右侧工作区)                           |
|  (可折叠/伸缩)   |                                                 |
|                |  +-------------------------------------------+   |
|  [ES 连接列表]  |  |  Tab 栏: Data Browser | SQL | Rest | ... |   |
|  [MySQL 连接树] |  +-------------------------------------------+   |
|  [Redis 连接列表]|  |                                           |   |
|                |  |           页面内容区域                         |   |
|  ------------  |  |           (路由驱动, 懒加载)                    |   |
|  [语言切换]     |  |                                           |   |
+----------------+  +-------------------------------------------+   |
+------------------------------------------------------------------+
```

**核心交互逻辑：**
- 左侧边栏管理连接和导航，三类数据库共用同一侧边栏布局，按引擎类型分组展示
- 右侧工作区仅在至少一个连接激活时显示，通过 Tab 切换不同功能页面
- 不同引擎的 Tab 种类不同，页面内容也不同

---

## 2. 项目结构

### 2.1 后端 (Go)

```
backend/
  app/
    app.go              # App 结构体组合, 实例化所有模块
    lifecycle.go        # Wails 生命周期钩子 (Startup / Shutdown)
    proxy.go            # Wails 暴露的方法 (代理调用到各模块)
    state.go            # 状态加载/保存 (委托给 state_store)
  infra/
    sshtunnel/
      tunnel.go         # SSH 隧道管理 (支持 MySQL / Redis 远程连接)
    state_store/
      state_store.go    # 持久化应用状态 (连接配置 + 密钥)
  modules/
    elasticsearch/
      module.go         # ES HTTP 代理 (支持 Basic / API Key 认证)
      types.go          # 请求/响应类型定义
    mysql/
      module.go         # 模块入口: NewModule
      types.go          # 请求/响应类型定义
      connection.go     # 连接管理 (含 SSH 隧道)
      query.go          # SQL 查询执行
      schema.go         # 表/列/索引元数据查询
      transfer.go       # 导出/导入 SQL (TransferService)
      retry.go          # 查询重试逻辑
      utils.go          # SQL 解析工具函数
      helpers.go        # 行扫描、值规范化辅助函数
    redis/
      module.go         # 连接管理器, 扫描, 读写, TTL, 命令执行
      helpers.go        # JSON 值规范化 (string/hash/list/set/zset)
      types.go          # 请求/响应类型定义
```

**后端架构要点：**
- 三个数据库模块相互独立，各有连接管理器
- `proxy.go` 统一暴露 Wails 可调用的方法
- SSH 隧道在 `infra/sshtunnel` 层统一管理，为 MySQL/Redis 提供远程连接能力
- 状态持久化通过 `state_store` 实现，存储连接配置和密钥

### 2.2 前端 (React)

```
src/
  App.tsx                       # 根组件: AppProviders + AppShell
  main.tsx                      # 入口
  app/
    providers/
      AppProviders.tsx          # 嵌套 4 个 Context Provider
    routes/
      AppRoutes.tsx             # React Router 路由定义 (全部懒加载)
    shell/
      AppShell.tsx              # 主布局编排, 连接侧边栏 + 工作区
      AppSidebar.tsx            # 渲染 ES/MySQL/Redis 三个侧边栏区块
      AppTopbarStatus.tsx       # 顶部状态指示
      AppWorkspace.tsx          # 根据当前引擎渲染对应 Tab 和路由
      AppOverlays.tsx           # 连接对话框, 右键菜单等浮层
  components/                   # 共享 UI 组件
  hooks/                        # 共享 Hooks
  i18n/                         # 国际化配置 (中/英)
  layout/
    WorkspaceChrome.tsx         # 顶层布局: topbar + sidebar(可伸缩) + workspace
  lib/
    connection/                 # 连接配置类型和规范化
    transport/                  # 传输层: HTTP (浏览器) vs Wails (桌面)
    wailsapi.ts                 # Wails invoke 封装
    types.ts                    # 核心类型定义
    storage.ts                  # localStorage 持久化
  state/                        # Context Provider
    SharedConnectionState.tsx   # 连接配置, 密钥, 激活状态 (跨引擎共享)
    ElasticsearchContext.tsx    # ES 状态 (连接, 索引, 选中索引)
    MysqlContext.tsx            # MySQL 状态 (数据库, 表, 打开的表, SQL)
    RedisContext.tsx            # Redis 状态 (连接, 选中数据库编号)
  modules/
    es/                         # Elasticsearch 模块
      components/               # 侧边栏区块, 工作区 Tab, 连接对话框
      pages/                    # 路由页面: DataBrowser, SqlQuery, RestConsole, IndexManager
      services/                 # API 客户端 (HTTP 代理调用)
      features/data-browser/    # 数据浏览器功能域 (组件 + Hooks + 服务 + 类型)
    mysql/                      # MySQL 模块
      components/               # 侧边栏区块, 工作区 Tab, 连接对话框, 查询生成器
      pages/                    # 路由页面: TableManager, SqlQuery
      services/                 # API 客户端 (Wails invoke 调用)
      hooks/                    # 侧边栏工作区管理 Hook
      features/table-manager/   # 表管理器功能域 (15+ 组件, 15+ Hooks, 服务, 状态, 工具)
      constants/                # 数据库选项 (字符集, 排序规则)
      types.ts                  # TypeScript 类型
      i18n/                     # MySQL 翻译资源
    redis/                      # Redis 模块
      components/               # 侧边栏区块, 工作区 Tab, 连接对话框, 键详情/编辑器
      pages/                    # 路由页面: Browser, Console
      services/                 # API 客户端 (Wails invoke 调用)
      features/browser/         # 浏览器功能域 (组件 + Hooks + 服务 + 类型)
      utils.ts                  # 工具函数
```

**前端架构要点：**
- 采用 **模块优先** 组织方式：每个数据库类型自包含页面、服务、状态、翻译
- **Context 状态管理**：每个引擎有独立 Context 管理专属状态
- **功能域 (Feature) 模式**：复杂功能 (如 ES DataBrowser, MySQL TableManager, Redis Browser) 采用 feature 目录组织，包含 components/hooks/services/types
- **路由驱动**：所有页面通过 React Router 懒加载
- **传输层抽象**：`lib/transport/` 区分浏览器模式和 Wails 桌面模式

---

## 3. 路由总览

| 路由路径 | 页面 | 引擎 | 说明 |
|----------|------|------|------|
| `/` | 空状态 | 通用 | 无活跃连接时显示 |
| `/data` | ES 数据浏览器 | Elasticsearch | 文档浏览与查询 |
| `/sql` | ES SQL 查询 | Elasticsearch | SQL/PPL 查询 |
| `/rest` | ES REST 控制台 | Elasticsearch | 原始 HTTP 请求 |
| `/indices` | ES 索引管理 | Elasticsearch | 索引列表与管理 |
| `/mysql` | → `/mysql/tables` | MySQL | 重定向 |
| `/mysql/tables` | MySQL 表管理器 | MySQL | 表概览 + 数据/结构/信息 |
| `/mysql/table` | MySQL 单表视图 | MySQL | 独立表标签页 |
| `/mysql/sql` | MySQL SQL 查询 | MySQL | SQL 编辑器 |
| `/redis` | → `/redis/browser` | Redis | 重定向 |
| `/redis/browser` | Redis 浏览器 | Redis | 键浏览与管理 |
| `/redis/console` | Redis 控制台 | Redis | CLI 命令执行 |

---

## 4. 左侧边栏功能域

左侧边栏按引擎类型分为三个区块，共享同一套连接管理基础设施。

### 4.1 共享连接管理 (底层)

| 功能域 | 说明 |
|--------|------|
| 连接配置管理 | 创建、编辑、删除连接配置 (主机、端口、认证方式) |
| 密钥管理 | 密码、API Key、SSH 密码的存储与注入 |
| 连接生命周期 | 激活连接 (触发后端连接)、断开连接 |
| 连接状态跟踪 | 每个连接的状态：成功/空闲/失败 |
| 状态持久化 | 连接配置保存到本地磁盘，启动时恢复 |
| 焦点管理 | 记录每个引擎当前聚焦的连接 |

### 4.2 Elasticsearch 侧边栏区块

| 功能域 | 说明 |
|--------|------|
| 连接列表 | 展示所有 ES 连接配置，每个显示状态圆点、名称、连接状态标签 |
| 点击激活 | 点击连接后触发后端连接，验证连通性 |
| 右键菜单 | 编辑连接、删除连接、断开连接 |

**特点：** ES 侧边栏最简洁，仅展示连接列表，无层级树结构。

### 4.3 MySQL 侧边栏区块

| 功能域 | 说明 |
|--------|------|
| 连接列表 | 展示所有 MySQL 连接，显示状态 |
| 数据库树 | 激活后展开层级树：数据库 → 表 (含表数量) |
| 表操作 (右键菜单) | 打开表、设计表、复制表、清空表、删除表、导出表、导入表 |
| 数据库操作 (右键菜单) | 创建数据库、删除数据库、导出数据库、导入 SQL、数据库属性 |
| 拖拽传输 | 表节点可拖拽到另一个数据库，实现表复制/迁移 |
| 多选支持 | Shift / Ctrl 多选表进行批量操作 (导出、删除等) |
| 展开/折叠 | 数据库节点可展开/折叠，记忆展开状态 |

**特点：** MySQL 侧边栏最复杂，支持完整的数据库-表层级树和丰富操作。

### 4.4 Redis 侧边栏区块

| 功能域 | 说明 |
|--------|------|
| 连接列表 | 展示所有 Redis 连接，显示状态 |
| 点击激活 | 点击连接后触发后端连接 |
| 右键菜单 | 编辑连接、删除连接、断开连接 |

**特点：** 与 ES 类似，仅展示连接列表，无层级结构。Redis 的键浏览在右侧页面完成。

### 4.5 侧边栏通用交互

| 功能域 | 说明 |
|--------|------|
| 折叠/展开 | 侧边栏整体可折叠，节省空间 |
| 宽度调整 | 拖拽边框调整宽度 (220px - 520px) |
| 语言切换 | 底部语言切换按钮 (中/英) |

---

## 5. 右侧页面功能域

右侧为工作区，包含 Tab 栏和内容区域。不同引擎的 Tab 集合不同。

### 5.1 Elasticsearch 页面

#### 5.1.1 Data Browser (数据浏览器) — `/data`

| 功能域 | 说明 |
|--------|------|
| 索引选择器 | 下拉选择当前要浏览的索引 |
| 查询条件面板 | 构建查询条件，支持 AND/OR 逻辑，字段/操作符/值输入 |
| 结果展示 | 表格视图 / JSON 视图切换 |
| 字段过滤 | 选择只显示特定字段 |
| 分页导航 | 页码 + 每页条数，超过 10000 条时显示深度分页警告 |
| 行选择 | 勾选行进行批量操作 |
| 文档编辑 | JSON 编辑器修改单个文档 |
| 文档删除 | 单个/批量删除文档 |
| 右键菜单 | 添加条件、排序、编辑、删除 |
| 自动查询 | 条件变化后自动执行查询 |
| 查询缓存 | 缓存查询结果，减少重复请求 |

#### 5.1.2 SQL Query (SQL 查询) — `/sql`

| 功能域 | 说明 |
|--------|------|
| SQL 编辑器 | 输入 ES SQL / PPL 语句 |
| 结果展示 | 表格展示查询结果 |

#### 5.1.3 REST Console (REST 控制台) — `/rest`

| 功能域 | 说明 |
|--------|------|
| 原始请求输入 | 直接输入 HTTP 方法、路径、请求体 |
| 响应展示 | 显示 ES 返回的原始响应 |

#### 5.1.4 Index Manager (索引管理) — `/indices`

| 功能域 | 说明 |
|--------|------|
| 索引列表 | 展示所有索引，含健康状态、文档数等元信息 |
| 索引操作 | 创建索引、删除索引、刷新索引 |
| 索引详情 | 查看索引详细信息 |

#### 5.1.5 ES 工作区 Tab 集合

```
[Data Browser] [SQL Query] [Rest Console] [Index Manager]
```

### 5.2 MySQL 页面

#### 5.2.1 Table Manager (表管理器) — `/mysql/tables`

| 功能域 | 说明 |
|--------|------|
| 表概览面板 | 左侧显示当前数据库的表列表，支持多选、右键菜单 |
| **Data 标签页** | Excel 风格表格视图，展示表数据 |
| &nbsp;&nbsp;─ 内联编辑 | 双击单元格编辑数据 |
| &nbsp;&nbsp;─ 行操作 | 添加行、删除行、批量编辑 |
| &nbsp;&nbsp;─ 筛选排序 | 列头筛选、排序 |
| &nbsp;&nbsp;─ 分页 | 分页浏览大数据集 |
| **Structure 标签页** | 表结构管理 |
| &nbsp;&nbsp;─ 列管理 | 查看列定义、添加列、编辑列、删除列、调整列顺序 |
| &nbsp;&nbsp;─ 索引管理 | 查看索引、创建索引、编辑索引、删除索引 |
| **Info 标签页** | 表元信息 (存储引擎、行数、大小等) |
| 表操作 | 创建表、删除表、清空表、复制表 |
| 导出功能 | 导出单表/多表为 SQL (含结构 + 数据选项) |
| 导入功能 | 导入 SQL 文件到当前数据库 |
| SQL 执行 | 在表管理器内执行自定义 SQL |

#### 5.2.2 动态打开的表标签页

从侧边栏点击表节点时，会在 Table Manager 中单独打开一个该表的标签页 (如 `db.table`)，每个表标签页独立拥有 Data/Structure/Info 三个子标签。

#### 5.2.3 SQL Query (SQL 查询) — `/mysql/sql`

| 功能域 | 说明 |
|--------|------|
| SQL 编辑器 | 输入 SQL 语句 |
| 结果展示 | 表格展示查询结果 (支持多语句结果) |

#### 5.2.4 MySQL 工作区 Tab 集合

```
[Table Manager] [db.table1] [db.table2] ... [SQL Query]
```

### 5.3 Redis 页面

#### 5.3.1 Browser (键浏览器) — `/redis/browser`

| 功能域 | 说明 |
|--------|------|
| 数据库选择器 | 切换 Redis 逻辑数据库 (db0 - db15) |
| 键模式输入 | 支持通配符模式扫描键 (如 `user:*`) |
| 扫描数量控制 | 控制每次 SCAN 命令返回的键数量 |
| 键列表 | 展示扫描到的键，带类型标签和 TTL 指示 |
| 键详情面板 | 选中键后显示详细内容，根据类型 (string/hash/list/set/zset) 以不同格式展示 |
| 键编辑 | 编辑键的值 (支持所有类型) |
| 键删除 | 单个/批量删除键 |
| TTL 管理 | 查看和修改键的过期时间 |
| 键创建 | 新建键 (支持所有类型) |
| 批量操作 | 批量删除、批量导出 |

#### 5.3.2 Console (控制台) — `/redis/console`

| 功能域 | 说明 |
|--------|------|
| 命令输入 | 输入 Redis CLI 风格命令 (如 `GET key`, `HGETALL hash`) |
| 结果展示 | 显示命令执行结果 |

#### 5.3.3 Redis 工作区 Tab 集合

```
[Browser] [Console]
```

---

## 6. 状态管理架构

### 6.1 Context Provider 嵌套关系

```
SharedConnectionStateProvider (最外层)
  └── ElasticsearchProvider
        └── MysqlProvider
              └── RedisProvider (最内层)
```

**说明：** 三个引擎 Provider（ES / MySQL / Redis）彼此独立，都只依赖 `SharedConnectionStateProvider`。嵌套是 React Context 的必要结构 — 每个 Provider 需要包裹子树才能提供上下文，不能改为平级。嵌套层级不影响 Context 的可消费性。

### 6.2 各 Context 管理的状态

| Context | 管理的状态 |
|---------|-----------|
| **SharedConnectionState** | 所有连接配置 (profiles)、密钥 (secrets)、各引擎活跃连接列表、各引擎焦点连接、当前活跃引擎 |
| **ElasticsearchContext** | 当前 ES 连接对象、索引列表、索引元信息、当前选中索引 |
| **MysqlContext** | 当前 MySQL 连接对象、数据库列表、各数据库的表列表、当前展开的数据库、当前选中的数据库/表、已打开的表标签页、SQL 编辑器状态 |
| **RedisContext** | 当前 Redis 连接对象、当前选中的数据库编号 |

### 6.3 状态持久化

连接配置通过 `SharedConnectionState` 的 `loadState` / `saveState` 方法持久化到本地磁盘，启动时自动恢复。

---

## 7. 连接切换机制

### 7.1 连接激活流程

当用户在侧边栏点击一个连接时，由 `useConnectionWorkspace.ts` 中的 `handleConnectionChange` 处理：

```
handleConnectionChange(id)
  ├── 场景 A: 已聚焦 → 仅取消挂起 + 导航到默认路由
  ├── 场景 B: 已激活但未聚焦 → 切换焦点 + 恢复工作区数据 + 导航
  └── 场景 C: 新连接 → switchViewSync → 后端连接 → 加载初始数据 → 导航
```

### 7.2 `switchViewSync` 的时序设计

`switchViewSync` 是连接切换的核心方法，负责：
1. 清除错误状态
2. 取消该引擎的工作区挂起
3. 调用 `activateConnection` 更新 `SharedConnectionState` 中的 `activeEngine` 和 `focusedConnectionIdByEngine`

**关键：** `switchViewSync` 必须 `await activateConnection()`，确保 React 的 state 更新在后续异步操作（后端连接、数据加载）之前完成。如果不 await，引擎 Provider 在重新渲染时可能拿到过时的连接对象（null），导致页面 early return 显示空白。

### 7.3 工作区布局切换

`AppWorkspace.tsx` 中，三个引擎的 Tab 组件 **始终渲染在 DOM 中**，通过 CSS `display: none/flex` 控制可见性：

```tsx
<EsWorkspaceTabs visible={isEsWorkspace} ... />
<MysqlWorkspaceTabs visible={isMysqlWorkspace} ... />
<RedisWorkspaceTabs visible={isRedisWorkspace} ... />
<section className="mdb-content">
  <AppRoutes />  {/* 路由决定页面内容 */}
</section>
```

**要点：**
- Tab 栏通过 `activeEngine` 控制 `visible` 属性
- 页面内容由 `AppRoutes` 的路由路径决定
- `handleConnectionChange` 最后调用 `navigate(config.defaultRoute)` 确保路由与引擎同步

### 7.4 工作区挂起机制

当连接失败时，对应的引擎工作区被挂起（`isWorkspaceSuspendedByEngine[engine] = true`），此时 `canShowWorkspace()` 返回 false，显示空状态替代工作区。连接成功后取消挂起。

---

## 8. 后端通信 (IPC)

### 8.1 通信方式

前端通过 Wails 的 `invoke()` 方法调用后端 Go 方法。`src/lib/wailsapi.ts` 封装了 snake_case 到 PascalCase 的转换。

### 8.2 方法映射

| 前端调用 | 后端方法 | 引擎 |
|----------|----------|------|
| `esRequest` | HTTP 代理 (通用) | Elasticsearch |
| `mysqlConnect` / `mysqlDisconnect` | `MysqlConnect` / `MysqlDisconnect` | MySQL |
| `mysqlQuery` / `mysqlListDatabases` / `mysqlListTables` | `MysqlQuery` / `MysqlListDatabases` / `MysqlListTables` | MySQL |
| `mysqlDescribeTable` / `mysqlListIndexes` / `mysqlCreateIndex` / `mysqlDropIndex` | 对应 Go 方法 | MySQL |
| `mysqlExport*` / `mysqlImportSql` | `MysqlExport*` / `MysqlImportSql` | MySQL |
| `redisConnect` / `redisDisconnect` | `RedisConnect` / `RedisDisconnect` | Redis |
| `redisScanKeys` / `redisGetKeyDetail` / `redisSetKey` / `redisDeleteKey` / `redisUpdateKeyTtl` | 对应 Go 方法 | Redis |
| `redisExecute` | `RedisExecute` (CLI 命令) | Redis |

### 8.3 数据流向

#### 8.3.1 MySQL / Redis 请求链路

```
用户操作 (点击连接/执行查询)
  │
  ▼
React 组件 / Hook
  │  调用 invoke("mysql_query", { connectionId, sql })
  ▼
lib/wailsapi.ts          ← snake_case → PascalCase 转换
  │
  ▼
Wails 运行时 (IPC 通道)
  │
  ▼
backend/app/proxy.go     ← App.MysqlQuery() 代理调用
  │
  ▼
backend/modules/mysql/   ← 模块层: 连接管理 + SQL 执行
  │
  ▼
MySQL 数据库            ← 通过 go-sql-driver 原生协议
  │
  ▼
结果返回 (行数据 + 列元信息) → 前端渲染
```

#### 8.3.2 Elasticsearch 请求链路

```
用户操作 (查询文档/查看索引)
  │
  ▼
React 组件 / Hook
  │  调用 esRequest<T>() (HTTP 代理封装)
  ▼
lib/wailsapi.ts → invoke("http_request", { ... })
  │
  ▼
Wails 运行时 (IPC 通道)
  │
  ▼
backend/app/proxy.go     ← App.HttpRequest() 代理调用
  │
  ▼
backend/modules/elasticsearch/
  │  module.go: 构建 http.Client + 认证头 (Basic / API Key)
  │  转发原始 HTTP 请求到 ES 节点
  ▼
Elasticsearch HTTP API   ← 通过 HTTP/HTTPS 协议
  │
  ▼
ES JSON 响应 → 前端解析 + 渲染
```

#### 8.3.3 状态持久化链路

```
用户操作 (保存连接/删除连接)
  │
  ▼
SharedConnectionState.tsx
  │  调用 saveState({ profiles, secrets, lastConnectionId })
  ▼
lib/storage.ts
  │  桌面模式: invoke("save_state", ...)
  │  浏览器模式: localStorage.setItem()
  ▼
Wails 运行时
  │
  ▼
backend/app/state.go     ← SaveState()
  │
  ▼
backend/infra/state_store/
  │  序列化 JSON → 写入 ~/.multi-database-browsing/
  ▼
本地磁盘文件
```

---

## 9. 国际化 (i18n)

翻译资源按作用域组织：

| 作用域 | 文件位置 |
|--------|----------|
| 共享 (通用/侧边栏/连接) | `src/i18n/resources/shared.ts` |
| Elasticsearch | `src/modules/es/i18n/resources.ts` |
| MySQL | `src/modules/mysql/i18n/resources.ts` |
| Redis | `src/modules/redis/i18n/resources.ts` |

运行时由 `src/i18n/config.ts` 聚合所有资源，通过语言切换按钮在中英文间切换。

---

## 10. 关键设计决策

### 10.1 为什么选择 React Context 而非 Zustand / Redux？

- **复杂度匹配**：应用规模可控（三个引擎、各自独立状态），Context 已满足需求
- **无跨引擎状态**：ES / MySQL / Redis 各自状态完全独立，不存在跨模块状态共享需求，不需要 Redux 的全局 Store
- **SharedConnectionState** 作为唯一的跨引擎共享状态（连接配置 + 密钥），通过顶层 Context 提供

### 10.2 为什么 Tab 组件始终渲染而非条件渲染？

`AppWorkspace.tsx` 中，三个引擎的 Tab 组件通过 CSS `display: none/flex` 切换可见性，而非条件渲染：

- **避免重复初始化**：切换引擎时不重新挂载组件，保持已打开的表、查询结果等状态
- **简化状态管理**：不需要在挂载/卸载时保存/恢复各引擎的工作区状态
- **代价**：三个引擎的组件始终占据内存，但实际数据量不大（索引列表、数据库树、键列表均可控）

### 10.3 为什么采用模块优先组织？

每个数据库类型（ES、MySQL、Redis）的 pages / services / components / features / i18n 都放在 `modules/{es,mysql,redis}/` 下：

- **降低耦合**：每个引擎的开发几乎不依赖其他引擎的文件
- **便于增量重构**：可以单独重构某个引擎模块而不影响其他模块
- **功能域 (Feature) 模式**：复杂功能在模块内进一步按 feature 目录组织（如 `features/table-manager/`），将组件、Hooks、服务、状态、工具按功能域集中管理

### 10.4 为什么 ES 使用 HTTP 代理而 MySQL/Redis 使用原生驱动？

- **Elasticsearch** 本身就是 HTTP REST API，前端可以构建请求体，后端只需代理转发（加认证头），天然适合无状态代理模式
- **MySQL** 使用 `go-sql-driver` 原生连接，后端维持连接池（MaxOpen=5, MaxIdle=1, ConnMaxLifetime=90s）
- **Redis** 使用 `go-redis/v9` 原生连接，后端按连接 ID + 数据库编号管理连接池

### 10.5 为什么 MySQL 使用 database.table 限定名而非 USE 语句？

历史教训：早期使用 `USE database` 切换数据库，在并发查询时产生竞态条件。改为全程使用 `database`.`table` 限定名，消除状态依赖。

---

## 11. SSH 隧道

SSH 隧道为 MySQL 和 Redis 提供远程连接能力，由 `backend/infra/sshtunnel/tunnel.go` 统一管理。

### 11.1 架构

```
前端 → Wails IPC → Go 后端 → SSH 隧道 → 远程 MySQL/Redis
```

### 11.2 隧道生命周期

1. **创建**: 当连接配置包含 SSH 信息（主机、端口、用户名、认证方式）时，`Manager.GetOrCreate(connectionID)` 检查是否已存在活跃隧道，存在则复用，否则新建。
2. **连接**: 隧道通过 `ssh.Dial()` 建立，创建本地端口转发监听器（如 `localhost:随机端口`）。
3. **复用**: 同一 connectionID 的连接共享同一隧道实例，避免重复 SSH 握手。
4. **关闭**: 调用 `Manager.Close(connectionID)` 时关闭隧道，释放本地端口和 SSH 连接。应用退出时 `Shutdown()` 关闭所有隧道。

### 11.3 与数据库模块的集成

- **MySQL**: `mysql/connection.go` 中，若连接配置包含 SSH 信息，先通过 `Manager.GetOrCreate()` 获取隧道，然后连接到隧道的本地转发端口。
- **Redis**: `redis/module.go` 中，同样模式 — 先建立隧道，再连接 Redis 客户端到本地端口。
- 数据库模块不直接管理 SSH 连接，只与 `sshtunnel.Manager` 交互。

### 11.4 错误处理

- 隧道创建失败时，错误向上传递至连接层，前端显示连接失败。
- 隧道断开后不会自动重连 — 用户需要手动重新激活连接。
- 本地端口冲突时，SSH 库自动分配可用端口，不会使用固定端口号。

---

## 12. 错误处理

### 12.1 IPC 错误传递

Go 后端方法返回的 `error` 会通过 Wails 运行时自动转换为 JavaScript 异常。前端通过 `invoke()` 的 Promise `.catch()` 捕获。

### 12.2 前端错误规范化

`src/lib/transport/mapInvokeError.ts` 将 Wails invoke 错误统一规范化，添加上下文元数据（方法名、参数摘要），便于日志追踪。

### 12.3 React 错误边界

`src/components/ErrorBoundary.tsx` 捕获 React 组件树中的渲染错误，防止整个应用崩溃。错误由 `src/lib/errorLog.ts` 记录，用户可通过 `ErrorLogModal` 查看。

### 12.4 错误日志约定

Go 后端日志使用前缀标识模块来源：
- `[mysql]` — MySQL 模块
- `[redis]` — Redis 模块
- `[es]` — Elasticsearch 模块

前端通过 `logError()` 记录错误，包含 `source`（标识来源）和 `message`（人类可读描述）字段。

---

## 13. 安全考量

### 13.1 密钥存储

- 连接配置（含密码、API Key）通过 `AppStateStore` 持久化到 OS 配置目录的 JSON 文件中（`~/.config/multi-database-browsing/` 或等效路径）。
- **当前为明文存储**，未加密。本地磁盘访问者可读取凭证。
- 未来改进方向：集成 OS 密钥链（Windows Credential Manager、macOS Keychain、Linux Secret Service）。

### 13.2 传输安全

- **SSH 隧道**: MySQL 和 Redis 支持通过 SSH 加密隧道连接远程数据库，所有流量经 SSH 加密。
- **Elasticsearch**: 支持 HTTPS 连接，可配置跳过 TLS 证书验证（适用于自签名证书）。
- **Wails IPC**: 前端与后端通信在本地进程内，不暴露于网络。

### 13.3 SQL 注入防护

- MySQL 查询使用参数化查询（预处理语句），防止 SQL 注入。
- 表名/数据库名使用反引号包裹（`` `db`.`table` ``），避免标识符注入。

### 13.4 已知安全限制

- 密码明文存储在本地磁盘
- 无会话超时机制（连接建立后持续保持，直到用户手动断开或应用退出）
- 无请求速率限制（本地应用，不涉及外部 API 限流）

---

## 14. 性能考量

### 14.1 Redis 连接优化

- **连接池复用**：后端按 `connectionID → map[int]*goRedis.Client` 管理连接，同一数据库编号共享连接，避免每次命令都握手
- **避免 SELECT**：不使用 `SELECT dbN` 命令切换数据库，而是为每个数据库创建独立连接，消除隐式状态切换

### 14.2 MySQL 查询优化

- **预处理查询**：使用参数化查询防止 SQL 注入
- **限制结果集**：数据浏览默认使用 LIMIT + OFFSET，避免返回全量数据
- **索引缓存**：表结构信息、索引信息在前端 Context 缓存，减少重复查询

### 14.3 Elasticsearch 分页策略

- **浅层分页（≤10k）**：使用 ES 原生 `from` + `size` 分页，性能最佳
- **深分页（>10k）**：切换为 `search_after` 策略，避免 `from+size` 超过 ES 的 `index.max_result_window` 限制
- **索引缓存**：索引列表按连接缓存，切换连接时命中缓存，避免重复请求

### 14.4 前端渲染优化

- **路由懒加载**：所有页面组件通过 `React.lazy` + `Suspense` 加载，首屏不加载未使用的页面
- **条件渲染 Tab 内容**：Tab 组件始终在 DOM 中，但页面内容由 `AppRoutes` 路由控制，只渲染当前路由对应的组件
- **状态缓存按连接隔离**：每个连接的工作区状态（打开的表、SQL 编辑器内容等）按 `connectionId` 独立缓存，切换连接时保留状态

---

## 15. 已知限制与建议方向

### 15.1 当前限制

- Redis 不支持 Pub/Sub
- Redis 不支持慢日志分析
- ES 不支持跨集群查询
- 无深色模式切换
- 窗口状态 (位置、大小) 不在会话间持久化

### 15.2 建议下一步

1. 完善 MySQL 多表导出流程的行为测试
2. 考虑 Redis 连接持久化 / 重连逻辑
