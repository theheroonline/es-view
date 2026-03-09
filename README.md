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
- 数据浏览、条件过滤、分页查看
- 简易 SQL、REST 风格高级操作
- 索引管理

### MySQL
- 库表浏览、表结构查看
- SQL 执行与查询结果展示

### Redis
- 连接管理、单下拉切换数据库
- 基于 SCAN 的分批 Key 浏览
- 常见类型详情查看（String、Hash、List、Set、ZSet）
- 表格式新增/编辑、批量删除
- TTL 数字倒计时修改
- Redis Console 原始命令执行

---

## 本地化 / Localization 🌐

- 支持中英两种语言（使用 `react-i18next`）
- 配置文件: `src/locales/en.json` 与 `src/locales/zh.json`

---

## 快速开始 / Quick Start 💡

### 前置需求 / Prerequisites
- Node.js 18+ (for frontend)
- Go 1.21+ (for backend)
- Wails CLI: `go install github.com/wailsapp/wails/cmd/wails@latest`

### 1. 安装依赖 / Install Dependencies

```bash
# Install Node dependencies
npm install

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

---

## 项目结构 / Project Structure 📁

```
.
├── main.go                 # Wails app entry point
├── app.go                  # App struct and lifecycle
├── elasticsearch.go        # ES HTTP proxy
├── mysql.go                # MySQL operations
├── redis.go                # Redis operations
├── helpers.go              # UTF-8 and utilities
├── wails.json              # Wails configuration
├── go.mod / go.sum         # Go dependencies
├── vendor/                 # Vendored Go modules (for offline builds)
├── src/                    # React frontend
│   ├── main.tsx            # React entry
│   ├── App.tsx             # Main component
│   ├── lib/
│   │   ├── wailsapi.ts     # Wails invoke() wrapper
│   │   ├── storage.ts      # Local storage
│   │   └── types.ts        # TypeScript types
│   ├── modules/
│   │   ├── es/             # Elasticsearch module
│   │   ├── mysql/          # MySQL module
│   │   └── redis/          # Redis module
│   ├── locales/
│   │   ├── en.json         # English i18n
│   │   └── zh.json         # Chinese i18n
│   └── ...
├── package.json            # Node dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite config
└── README.md               # This file
```

---

## 后端 API / Backend API 🔌

所有后端命令通过 `invoke()` 调用：

### Elasticsearch
- `http_request(method, url, body)` - HTTP 请求代理

### MySQL
- `mysql_connect(req)` - 连接
- `mysql_disconnect(connectionId)` - 断开
- `mysql_ping(connectionId)` - 测试连接
- `mysql_query(connectionId, sql)` - 执行查询
- `mysql_list_databases(connectionId)` - 列出数据库
- `mysql_list_tables(connectionId)` - 列出表
- `mysql_describe_table(connectionId, tableName)` - 表结构

### Redis
- `redis_connect(req)` - 连接
- `redis_disconnect(connectionId)` - 断开
- `redis_list_databases(connectionId)` - 列出数据库
- `redis_scan_keys(req)` - 扫描 key
- `redis_get_key_detail(req)` - 获取 key 详情
- `redis_execute(req)` - 执行命令
- `redis_set_key(req)` - 设置 key
- `redis_delete_key(req)` - 删除 key
- `redis_delete_keys(req)` - 批量删除
- `redis_update_key_ttl(req)` - 更新 TTL

---

## UTF-8 编码处理 / UTF-8 Support 🌍

- Go 字符串原生 UTF-8 支持
- 无效字节序列自动转换为 U+FFFD (replacement character)
- 在 `helpers.go` 中提供工具函数处理边界情况

---

## 常用开发命令 / Useful Commands 🔧

```bash
# 前端开发
npm run dev          # 启动 Vite 开发服务器
npm run build        # 构建生产包
npm run lint         # 代码检查

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

### .env / .env.tauri
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

- Redis SCAN 命令批量加载 key（避免单次加载过多）
- MySQL 查询结果分页显示
- React 组件懒加载和代码分割
- Vite 生产构建自动优化

---

## 已知限制 / Known Limitations ⚠️

- 暂不支持 Redis 订阅 (pub/sub)
- 暂不支持 Redis 慢日志分析
- Elasticsearch 不支持跨集群操作

---

## 许可证 / License 📄

无特定许可证。

---

**Happy browsing! 🎉**
