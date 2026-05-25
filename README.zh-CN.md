# Multi-Database Browsing / 多数据库浏览器

> 基于 **Wails (Go)** + **React** 构建的本地多数据库桌面客户端，支持 **Elasticsearch**、**MySQL**、**Redis** 三种数据库连接，提供统一的数据浏览、管理和查询界面。

---

## 📖 简介

本来是嫌装多个客户端太麻烦（DBeaver、es-client、AnotherRedisDesktopManager 各装一个），干脆自己写了个整合的。既然写了就开源出来，后续加啥功能看工作需要。

---

## 🧭 主要功能

### Elasticsearch
- **数据浏览** — 高级条件过滤、分页查看，支持 JSON 和表格视图
- **SQL 查询 & REST 控制台** — SQL 转 ES 查询 + Monaco 编辑器 REST 控制台
- **索引管理** — 创建、删除、查看索引和模板
- **深度分页** — `from/size` 自动分页（≤10k）+ `search_after` 手动分页（任意深度）
- **认证支持** — Basic Auth、API Key、自定义请求头、跳过 TLS 验证
- **集群监控** — 集群健康、统计信息、版本兼容性检测
- **索引生命周期管理** — ILM 策略浏览

### MySQL
- **库表浏览** — 数据库、表、字段、索引结构查看
- **索引管理** — 创建/编辑/删除索引（支持唯一索引、多列索引、自定义类型）
- **SQL 执行** — 查询结果展示、多表导入导出
- **表格管理器** — Excel 式内联编辑、批量编辑、排序、筛选
- **竞态条件防护** — 使用 `db.table` 全限定名替代 `USE` 命令
- **断线自动重试** — 检测 Error 2006/2013 等断线错误自动重连一次
- **可伸缩布局** — 表列表面板可拖拽调整宽度（持久化到 localStorage）

### Redis
- **Key 浏览** — 基于 SCAN 的增量式浏览（支持大数据库）
- **层级树导航** — `:` 分隔符的文件夹式树形浏览
- **数据编辑器** — 表格式新增/编辑、批量删除、TTL 修改
- **类型支持** — String、Hash、List、Set、ZSet 详情查看
- **控制台** — 原始命令执行（内置 Redis CLI）
- **连接池优化** — 单连接 + `SELECT` 命令替代多连接（加载速度提升 3-5 倍）

### SSH 隧道
- **统一隧道** — MySQL 和 Redis 连接支持 SSH 堡垒机
- **主机密钥验证** — `known_hosts` 管理

### 全局特性
- **双传输模式** — Wails IPC（桌面）或 HTTP 代理（浏览器开发模式）
- **国际化** — 完整的中文 / English 翻译
- **结构化错误** — 后端 `AppError` 带错误码，前端可解析定位
- **二进制安全传输** — 非 UTF-8 字节自动 Base64 编码
- **状态持久化** — 连接配置、窗口布局等持久化到磁盘

---

## 📦 技术栈

| 层 | 技术 |
|-------|-----------|
| **后端** | Go 1.25 + Wails v2.11 |
| **前端** | React 19 + TypeScript 5.9 + Ant Design 6 + Vite 7 |
| **MySQL 驱动** | [`go-sql-driver/mysql`](https://github.com/go-sql-driver/mysql) |
| **Redis 驱动** | [`redis/go-redis/v9`](https://github.com/redis/go-redis/v9) |
| **Elasticsearch** | Go `net/http` 代理 |
| **SSH 隧道** | [`golang.org/x/crypto`](https://pkg.go.dev/golang.org/x/crypto) |
| **国际化** | `react-i18next` |

---

## 🏗 架构

```
main.go  ───  Wails Runtime
   │
backend/app/  (App 结构体、生命周期、代理、状态管理)
   │
   ├── backend/modules/
   │   ├── elasticsearch/    # 连接、查询、索引管理、TLS
   │   ├── mysql/            # 连接、查询、schema 检查、重试、数据迁移
   │   └── redis/            # 键操作、命令执行、TLS
   │
   ├── backend/infra/
   │   ├── sshtunnel/        # SSH 隧道管理
   │   └── state_store/      # 持久化配置存储
   │
   └── backend/shared/       # 错误处理、日志、工具函数
           │
     (Wails IPC invoke/bind)
           ▼
src/lib/transport/           # 桌面端 (wails) + 浏览器 (HTTP) 传输抽象层
   │
   ▼
src/ ─── App.tsx ─── app/ ─── routes/ ─── modules/
                                            │
                               ┌────────────┼────────────┐
                           modules/es/  modules/mysql/ modules/redis/
```

**架构特点：**

1. **模块化** — 三种数据库引擎各为独立模块（后端 + 前端）
2. **预挂载页面** — 所有页面同时挂载，CSS `display` 切换显隐 — Tab 切换瞬间完成，无需重新查询
3. **双传输模式** — 前端可通过 Wails IPC（桌面）或 HTTP（浏览器开发模式，设置 `VITE_PLATFORM=browser`）运行
4. **Feature 文件夹** — 复杂功能（数据浏览器、表管理器、键浏览器）独立组织为 feature，包含自己的 hooks/services/components

> 详细架构设计见 [docs/design.md](docs/design.md)，IPC 方法列表见 [docs/ipc-api.md](docs/ipc-api.md)

---

## 🚀 快速开始

### 环境要求
- **Node.js 18+**
- **Go 1.25+**
- **Wails CLI** — `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### 安装运行

```bash
# 1. 安装依赖
pnpm install && go mod download

# 2. 开发模式（热重载）
wails dev

# 3. 生产构建
wails build

# 输出路径：
#   Windows: build/bin/multi-database-browsing.exe
#   Linux:   build/bin/multi-database-browsing
#   macOS:   build/bin/multi-database-browsing.app
```

### 离线编译

```bash
# 在有网环境执行：
go mod vendor

# 在隔离环境执行：
GOPROXY=off wails build
```

---

## 🛠 常用命令

```bash
# 前端
pnpm run dev        # Vite 开发服务器 (localhost:5173)
pnpm run build      # 生产构建 → dist/
pnpm run lint       # ESLint 代码检查
pnpm run test       # Vitest 测试（14 个前端测试文件）

# Go 后端
go mod tidy         # 整理依赖
go mod vendor       # 离线编译依赖
go fmt ./...        # 代码格式化
go test ./...       # 运行所有 Go 测试（4 个测试文件）

# Wails
wails dev           # 开发模式
wails build         # 生产构建
wails build -debug  # 调试构建
wails doctor        # 环境检查
```

---

## 📁 目录结构

```
├── main.go                 # Wails 入口
├── wails.json              # Wails 配置
├── package.json            # 前端依赖
├── go.mod                  # Go 模块
│
├── backend/
│   ├── app/                # Wails 绑定、生命周期、代理、状态
│   ├── modules/
│   │   ├── elasticsearch/  # ES 模块
│   │   ├── mysql/          # MySQL 模块
│   │   └── redis/          # Redis 模块
│   ├── infra/
│   │   ├── sshtunnel/      # SSH 隧道
│   │   └── state_store/    # 持久化状态
│   └── shared/             # 公共工具
│
├── src/
│   ├── app/                # 壳层布局、路由、浮层
│   ├── modules/
│   │   ├── es/             # Elasticsearch
│   │   ├── mysql/          # MySQL
│   │   └── redis/          # Redis
│   ├── lib/                # 传输层、连接配置、类型定义
│   ├── state/              # React Context
│   ├── hooks/              # 共享 Hooks
│   ├── styles/             # CSS 文件
│   └── i18n/               # 国际化
│
├── docs/                   # 文档
├── assets/                 # 图标
└── public/                 # 静态资源
```

---

## ⚡ 性能优化

| 优化项 | 问题 | 方案 | 效果 |
|---|---|---|---|
| **Redis 连接复用** | 每次加载创建 16 个连接 | 单连接 + `SELECT` | 提速 3-5 倍 |
| **MySQL 竞态条件** | `USE db` 导致异步冲突 | `db.table` 全限定名 | 彻底消除竞态 |
| **MySQL 断线重试** | Error 2006/2013 | 自动检测并重连 | 无感恢复 |
| **ES 深度分页** | from/size 上限 1 万条 | search_after 任意深度 | 无限分页 |
| **预挂载页面** | Tab 切换重新查询 | CSS 显隐切换 | 提速 ~40% |
| **二进制传输** | BLOB 数据 JSON 损坏 | Base64 编码 | 安全传输 |

---

## 🧪 测试

| 层 | 框架 | 数量 |
|---|---|---|
| **Go 后端** | `testing` | 4 个测试文件 |
| **React 前端** | Vitest + Testing Library | 14 个测试文件 |
| **合计** | | **18 个测试文件** |

```bash
# 后端测试
go test -v -cover ./...

# 前端测试
pnpm run test
```

---

## ⚠️ 已知限制

- ❌ Redis pub/sub 订阅不支持
- ❌ Redis 慢日志分析不支持
- ❌ ES 跨集群查询不支持
- ⚠️ ES 表格视图未虚拟化，大结果集可能卡顿
- ⚠️ MySQL TableManager 未做 memo 优化，频繁状态变更可能影响性能

---

## 🔧 配置

**wails.json** — 窗口大小、应用名、构建命令
**.env** — `VITE_PLATFORM=browser` 切换浏览器开发模式（详见 [.env.example](.env.example)）
**用户数据目录** — `~/.config/multi-database-browsing/` (Linux)、`%APPDATA%/multi-database-browsing/` (Windows)

---

## 📄 许可证

无特定许可证。

> **Happy browsing! 🎉**
