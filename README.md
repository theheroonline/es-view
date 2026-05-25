# Multi-Database Browsing

> A local multi-database desktop client built with **Wails (Go)** + **React**, supporting **Elasticsearch**, **MySQL**, and **Redis** — with SSH tunnel support.

[中文版](README.zh-CN.md)

---

## 🧭 Overview

Multi-Database Browsing is a native desktop application that unifies three database management tools into one. Instead of switching between DBeaver, es-client, and AnotherRedisDesktopManager, you get a consistent UI for browsing, querying, and managing data across all three engines.

**参考项目**: Dbeaver · es-client · AnotherRedisDesktopManager

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Go 1.25 + Wails v2.11 |
| **Frontend** | React 19 + TypeScript 5.9 + Ant Design 6 + Vite 7 |
| **MySQL** | [`go-sql-driver/mysql`](https://github.com/go-sql-driver/mysql) |
| **Redis** | [`redis/go-redis/v9`](https://github.com/redis/go-redis/v9) |
| **Elasticsearch** | Go `net/http` proxy |
| **SSH Tunnel** | [`golang.org/x/crypto`](https://pkg.go.dev/golang.org/x/crypto) + [`skeema/knownhosts`](https://github.com/skeema/knownhosts) |
| **I18n** | `react-i18next` (中文 / English) |

---

## ✨ Features

### Elasticsearch
- **Data Browser** — Advanced filtering, pagination, JSON & table views
- **SQL & REST Query** — SQL-to-ES translation + Monaco-based REST console
- **Index Management** — Create, delete, inspect indices & templates
- **Deep Pagination** — `from/size` (≤10k) + `search_after` (arbitrary depth)
- **Auth Support** — Basic Auth, API Key, custom headers, TLS skip
- **Cluster Monitoring** — Health, stats, version compatibility
- **Index Lifecycle Management** — ILM policy browser

### MySQL
- **Schema Browser** — Databases, tables, columns, indexes
- **Index Management** — Create/edit/delete indexes (unique, multi-column, custom types)
- **SQL Execution** — Query with results, multi-table export/import
- **Table Manager** — Excel-like inline editing, batch edit, sort, filter
- **Race Condition Safety** — Fully-qualified `db.table` names (no `USE`)
- **Auto-Reconnect** — Detect Error 2006/2013 and retry once
- **Resizable Layout** — Draggable table list panel width (persisted to localStorage)

### Redis
- **Key Browser** — SCAN-based incremental browsing (large DB safe)
- **Hierarchical Tree** — `:` delimited folder-style navigation
- **Data Editor** — Table-style add/edit, batch delete, TTL modification
- **Type Support** — String, Hash, List, Set, ZSet detail viewer
- **Console** — Raw command execution (Redis CLI in-app)
- **Connection Pooling** — Single connection + `SELECT` (3-5x speedup)

### SSH Tunnel
- **Unified Tunnel** — SSH bastion host support for MySQL and Redis connections
- **Host Key Verification** — `known_hosts` management

### Cross-Cutting
- **Dual Transport** — Wails IPC (desktop) or HTTP proxy (browser dev)
- **i18n** — Full 中文 / English translation coverage
- **Structured Errors** — `AppError` with error codes, parseable by frontend
- **Binary Safety** — Non-UTF8 bytes auto-encoded as Base64 via `BinaryCellValue`
- **Persistent State** — Connection profiles, window layout, recent data saved to disk

---

## 🏗 Architecture

```
main.go  ───  Wails Runtime
   │
backend/app/  (App, lifecycle, proxy, state)
   │
   ├── backend/modules/
   │   ├── elasticsearch/    # module.go, types.go, tls.go
   │   ├── mysql/            # module.go, connection.go, query.go, schema.go, retry.go, transfer.go
   │   └── redis/            # module.go, helpers.go, types.go, tls.go
   │
   ├── backend/infra/
   │   ├── sshtunnel/        # SSH tunnel management
   │   └── state_store/      # Persistent config storage
   │
   └── backend/shared/       # errors.go, logger.go, value.go
           │
     (Wails IPC invoke/bind)
           ▼
src/lib/transport/           # Desktop (wails) + HTTP (browser) abstraction
   │
   ▼
src/ ─── App.tsx ─── app/ ─── routes/ ─── modules/
                                           │
                              ┌────────────┼────────────┐
                          modules/es/  modules/mysql/ modules/redis/
                          ┌─────┴─────┐
                     services/    features/
                     components/  pages/
                     hooks/       i18n/
                     __tests__/   routes/
```

**Key design decisions:**

1. **Modular** — Each database engine is a self-contained module (backend + frontend)
2. **Pre-mounted pages** — All pages mount simultaneously; CSS `display` toggles visibility — tab switching is instant with no re-query
3. **Dual transport** — Frontend can run via Wails IPC (desktop) or HTTP (browser dev via `VITE_PLATFORM=browser`)
4. **Feature folders** — Complex functionality (Data Browser, Table Manager, Key Browser) organized as features with their own hooks/services/components

> See [docs/design.md](docs/design.md) for detailed architecture, [docs/ipc-api.md](docs/ipc-api.md) for the IPC method catalog.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **Go 1.25+**
- **Wails CLI** — `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### Install & Run

```bash
# 1. Install dependencies
pnpm install && go mod download

# 2. Development mode (hot reload)
wails dev

# 3. Production build
wails build

# Output:
#   Windows: build/bin/multi-database-browsing.exe
#   Linux:   build/bin/multi-database-browsing
#   macOS:   build/bin/multi-database-browsing.app
```

### Offline Build

```bash
# On a connected machine:
go mod vendor

# On the air-gapped machine:
GOPROXY=off wails build
```

---

## 🛠 Commands

```bash
# Frontend
pnpm run dev        # Vite dev server (localhost:5173)
pnpm run build      # Production build → dist/
pnpm run lint       # ESLint
pnpm run test       # Vitest (18 test files)

# Go Backend
go mod tidy         # Tidy dependencies
go mod vendor       # Vendor for offline build
go fmt ./...        # Format code
go test ./...       # Run all Go tests

# Wails
wails dev           # Development mode
wails build         # Production build
wails build -debug  # Debug build
wails doctor        # Environment check
```

---

## 📁 Project Structure

```
├── main.go                 # Wails entry point
├── wails.json              # Wails project config
├── package.json            # Frontend deps
├── go.mod                  # Go modules
│
├── backend/
│   ├── app/                # Wails bind target, lifecycle, proxy, state
│   ├── modules/
│   │   ├── elasticsearch/  # ES: connection, query, index, TLS
│   │   ├── mysql/          # MySQL: connection, query, schema, retry, transfer
│   │   └── redis/          # Redis: keys, commands, helpers, TLS
│   ├── infra/
│   │   ├── sshtunnel/      # SSH tunnel support
│   │   └── state_store/    # Persistent app state
│   └── shared/             # Errors, logger, value utilities
│
├── src/
│   ├── app/                # Shell layout, routes, overlays, providers
│   ├── modules/
│   │   ├── es/             # Elasticsearch: pages, features, services
│   │   ├── mysql/          # MySQL: Table Manager, SQL, schema
│   │   └── redis/          # Redis: Browser, Console
│   ├── lib/                # Transport, connection, types, binary value
│   ├── state/              # React contexts (ES, MySQL, Redis)
│   ├── hooks/              # Shared hooks
│   ├── styles/             # 8 CSS files by concern
│   └── i18n/               # 中文 / English translations
│
├── docs/                   # design.md, ipc-api.md, refactor plans
├── assets/                 # App icon
└── public/                 # Static assets
```

---

## ⚡ Performance Highlights

| Optimization | Problem | Solution | Impact |
|---|---|---|---|
| **Redis connection reuse** | 16 connections per page load | Single connection + `SELECT` | 3-5x faster, +94% DB list speed |
| **MySQL race conditions** | `USE db` causes async conflicts | Fully-qualified `db.table` names | Eliminated race conditions |
| **MySQL auto-retry** | Error 2006/2013 disconnects | `queryWithRetry()` auto-reconnect | Transparent recovery |
| **ES deep pagination** | `from/size` capped at 10k | `search_after` for arbitrary depth | Unlimited pagination |
| **ContentArea pre-mount** | Tab switch re-queries | All pages mounted, CSS toggle | ~40% faster tab switching |
| **Binary value transport** | BLOB data corrupted in JSON | Base64 encoding via `BinaryCellValue` | Safe binary transfer |

---

## 🧪 Testing

| Layer | Framework | Count |
|---|---|---|
| **Go backend** | `testing` | 4 test files |
| **React frontend** | Vitest + Testing Library | 14 test files |
| **Total** | | **18 test files** across all modules |

```bash
# Backend
go test -v -cover ./...

# Frontend
pnpm run test
```

---

## ⚠️ Known Limitations

- ❌ Redis pub/sub not supported
- ❌ Redis slow log analysis not supported
- ❌ ES cross-cluster queries not supported
- ⚠️ ES table view not virtualized — large result sets may cause lag
- ⚠️ MySQL TableManager not memo-optimized — frequent state changes may affect performance

---

## 🔧 Configuration

**wails.json** — Window size, app name, build commands
**.env** — `VITE_PLATFORM=browser` for HTTP proxy dev mode (see [.env.example](.env.example))
**User data** — `~/.config/multi-database-browsing/` (Linux), `%APPDATA%/multi-database-browsing/` (Windows)

---

## 📄 License

No specific license.
