# Multi-Database Browsing / 多数据库浏览器（本地客户端）

**简短说明（中文）**：本项目是一个本地多数据库桌面客户端，使用 Wails (Go) + React 框架。支持 Elasticsearch、MySQL 与 Redis 三类连接。

**Short description (English)**: A local multi-database desktop client built with Wails (Go) and React, supporting Elasticsearch, MySQL, and Redis.

---

## 技术栈 / Tech Stack 🏗️

- **后端 / Backend**: Go (Wails v2)
- **前端 / Frontend**: React 19 + TypeScript + Ant Design
- **数据库驱动 / Drivers**:
  - MySQL: `github.com/go-sql-driver/mysql`
  - Redis: `github.com/redis/go-redis/v9`
  - Elasticsearch: HTTP 代理（Go net/http）

---

## 功能 / Features ✅

### Elasticsearch
- 📊 数据浏览、高级条件过滤、分页查看
- 💡 简易 SQL 查询、REST 风格高级操作
- 📑 索引管理（创建、删除、查看）
- 🔄 深度分页支持 - 支持超过 10000 条记录查询（自动+手动两层分页）
- 📡 HTTP 代理支持自定义认证（Basic Auth、API Key）

### MySQL
- 📚 库表浏览、表结构查看、字段信息详查
- 🔍 索引管理 - 查看、创建、编辑、删除索引（支持唯一索引、多列索引、指定索引类型）
- 🖥️ SQL 执行与查询结果展示
- 🛡️ 防竞态条件设计 - 使用数据库限定名称避免异步操作冲突

### Redis
- 📌 连接管理、下拉快速切换数据库
- 🔑 基于 SCAN 的分批 Key 浏览
- 👁️ 常见类型详情查看（String、Hash、List、Set、ZSet）
- ✏️ 表格式新增/编辑、批量删除
- ⏳ TTL 数字倒计时修改
- 🎛️ Redis Console 原始命令执行
- ⚡ 性能优化 - 连接复用，减少握手开销（加载速度提升 3-5 倍）

---

## 本地化 / Localization 🌐

- 支持中英两种语言（使用 `react-i18next`）
- 当前资源入口按模块聚合：共享资源位于 `src/i18n/resources`，模块资源注册位于 `src/modules/*/i18n`
- 历史全局词条已完成下线，文案现已按 shared / es / mysql / redis 归属到各自模块目录

---

## 结构拆分规划 / Refactor Plan 🧭

### 当前已完成
- 共享桌面壳层从 `src/App.tsx` 中抽到 `src/layout/WorkspaceChrome.tsx`
- Elasticsearch / MySQL / Redis 的侧栏区块与顶部标签区已拆到各自模块组件目录
- 国际化加载入口与实际词条已改为“共享资源 + 模块资源”聚合模式
- 后端 `App` 的生命周期、状态存储，以及 MySQL / Redis / Elasticsearch 的核心实现已进一步拆到独立模块
- MySQL 导入导出已继续拆分为 `mysql_transfer.go` 薄封装 + transfer service / dump helper / SQL parser 三层职责
- MySQL 表总览的多表导出已改为右键触发的确认弹窗，可在弹窗内勾选表并决定是否同时导出数据

### 下一步建议
1. 给 MySQL 表总览新增一层前端行为测试，补齐多表导出弹窗的选择与确认流
2. 评估是否将 MySQL query / schema / transfer 再继续拆成更细的目录层级，而不是仅按文件分层
3. 继续审视 TableManager 页面本体，抽离更多与右侧工作区无关的 overview 行为

---

## 快速开始 / Quick Start 💡

### 前置需求 / Prerequisites
- Node.js 18+ (for frontend)
- Go 1.21+ (for backend)
- Wails CLI: `go install github.com/wailsapp/wails/cmd/wails@latest`

### 1. 安装依赖 / Install Dependencies

```bash
# Install Node dependencies
pnpm install

# Download Go modules (already vendored in vendor/)
go mod download
```

### 2. 开发模式 / Development Mode

```bash
# Start development server (both frontend + backend)
wails dev
```

应用将在窗口中打开，支持热重载。

### 3. 构建生产版本 / Build Production

```bash
# Build frontend and package with Go backend
wails build

# Output: build/bin/multi-database-browsing.exe (Windows)
#         build/bin/multi-database-browsing (Linux/Mac)
```

### 4. 离线编译 / Offline Build

如果在网络隔离环境编译：

```bash
# Dependencies are already in vendor/ directory
go mod vendor

# Build with vendored dependencies
wails build -tags wails
```


## 常用开发命令 / Useful Commands 🔧

```bash
# 前端开发
pnpm run dev          # 启动 Vite 开发服务器
pnpm run build        # 构建生产包
pnpm run lint         # 代码检查

# Go 后端
go mod tidy          # 整理依赖
go mod vendor        # 创建 vendor 目录（离线编译）
go fmt ./...         # 格式化代码

# Wails
wails dev            # 开发模式 (推荐)
wails build          # 生产构建
wails build -debug   # 调试构建
```

---

## 配置文件 / Configuration 🔧

### wails.json
- 应用窗口大小、标题
- 前端构建/开发命令
- 前端资源目录

### .env
- 开发时的环境变量（可选）

---

## 迁移历史 / Migration History 📝

该项目从 **Tauri (Rust)** 迁移到 **Wails (Go)**：

### 为什么迁移？
1. **编译简单** - Go 依赖少，易于离线编译
2. **网络友好** - 支持 `go mod vendor` 完全离线
3. **前端无改** - React 代码 100% 复用
4. **API 兼容** - `invoke()` 调用完全相同

### 迁移内容
- ✅ 后端框架从 Rust → Go (Wails)
- ✅ 前端 API 导入改为 `src/lib/wailsapi.ts`
- ✅ 删除 `src-tauri` 目录
- ✅ 更新 `package.json`（移除 Tauri 依赖）
- ✅ 配置离线编译支持（`go mod vendor`）

---

## 故障排查 / Troubleshooting 🐛

### "Wails runtime not available"
- 确保在 Wails 应用中运行，而不是浏览器
- 检查 `src/lib/wailsapi.ts` 是否正确导入

### MySQL 连接失败
- 检查连接参数（主机、端口、用户名、密码）
- 确保 MySQL 服务运行中

### Redis 连接失败
- 检查 Redis 服务是否运行
- 确认认证信息（密码、用户名）
- 检查防火墙/网络连接

### 编译失败
- `go mod tidy && go mod vendor`
- `npm install`
- 确保 Wails CLI 已安装：`wails doctor`

---

## 性能优化 / Performance 📊

- **Redis 连接复用** - 单连接 + SELECT 命令，减少握手开销（加载快 3-5 倍）
- **Redis SCAN 命令** - 分批加载 key（避免单次加载过多）
- **Elasticsearch 分层分页** - 自动查询（≤10000）+ 手动查询（search_after）
- **MySQL 数据库限定名称** - 避免 USE 命令竞态条件
- **React 组件懒加载** - 代码分割，提升初始加载速度
- **Vite 生产构建** - 自动优化资源大小和缓存策略

---

## 主要改进历史 / Recent Improvements 🚀

### 2026-03 更新

#### MySQL 索引管理 ✨
- 添加完整的索引管理 UI（查看、创建、编辑、删除）
- 支持唯一索引、多列索引、自定义索引类型
- 防止删除主键索引

#### MySQL 导入导出继续模块化
- 将原本集中在单文件中的导入导出逻辑拆为对外封装、transfer service、dump 构建和 SQL 拆分辅助
- 保留原有 Wails 接口与导出结果提示，降低后续继续拆分的成本

#### MySQL 多表导出交互调整
- 表总览支持多选后右键打开“导出多表”弹窗
- 在弹窗内可勾选具体表，并切换是否同时导出表数据

#### Elasticsearch 深度分页支持 ⚡
- **自动查询**：限制前 10000 条（快速响应）
- **手动查询**：支持完整 search_after 分页（支持任意深度）
- 显示加载进度（queryingPage → skippingData → locatingData → fetchingPage）

#### Redis 性能优化 🔥
- 改用连接复用 + SELECT 命令（从 16 个新连接 → 1 个连接）
- 数据库列表加载速度提升 **94%**（减少网络握手）
- 整体页面加载速度提升 **3-5 倍**

#### MySQL 竞态条件修复
- 使用数据库限定名称（`database`.`table`）替代 USE 命令
- 避免异步操作互相干扰

#### 前端代码优化
- Context 命名重构：`AppContext` → `ElasticsearchContext`
- 改进 Elasticsearch 索引选择下拉菜单（原生 select）
- 修复 `_id` 字段排序错误

---

- 暂不支持 Redis 订阅 (pub/sub)
- 暂不支持 Redis 慢日志分析
- Elasticsearch 不支持跨集群操作

---

## 许可证 / License 📄

无特定许可证。

---

**Happy browsing! 🎉**
