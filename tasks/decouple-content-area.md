# 计划：右侧内容区按引擎解耦

## 目标

将共享的 `.mdb-content` + `AppRoutes` 拆成三个独立的引擎内容区：
- `EsContentArea` — 只渲染 ES 页面（/data, /sql, /rest, /indices）
- `MysqlContentArea` — 只渲染 MySQL 页面（/mysql/tables, /mysql/table, /mysql/sql）
- `RedisContentArea` — 只渲染 Redis 页面（/redis/browser, /redis/console）

每种引擎的内容区有独立的滚动容器、独立的生命周期，互不影响。新增引擎只需加一个新的 ContentArea 组件，不需要改共享文件。

## 原则

- **代码可以冗余，但尽量每个类型的右侧页面要独立**
- 最小化对现有功能的影响
- 不改变现有路由 URL 结构

## 改动清单

### Step 1：拆分 AppRoutes.tsx → 三个 per-engine 路由组件

**当前状态**：`AppRoutes.tsx` 有一个 `pageByPath` 字典包含所有 9 个引擎页面，全部同时渲染。

**改动方案**：

1. 新建 `src/modules/es/routes/EsContentArea.tsx` — 只包含 ES 的 4 个页面
2. 新建 `src/modules/mysql/routes/MysqlContentArea.tsx` — 只包含 MySQL 的 3 个页面
3. 新建 `src/modules/redis/routes/RedisContentArea.tsx` — 只包含 Redis 的 2 个页面

每个 ContentArea 组件结构：
```tsx
export function EsContentArea() {
  // 内部用 useLocation 判断当前路由是否匹配引擎页面
  const { pathname } = useLocation();

  // 页面配置表只属于当前引擎
  const pages: [string, React.ReactNode][] = [
    ["/data", <EsDataBrowserPage />],
    ["/sql", <EsSqlQueryPage />],
    ["/rest", <EsRestConsolePage />],
    ["/indices", <EsIndexManagerPage />],
  ];

  return (
    <>
      {pages.map(([path, element]) => (
        <div key={path} className="engine-page-wrapper" data-active={pathname === path ? "true" : "false"}>
          {element}
        </div>
      ))}
    </>
  );
}
```

每个引擎的 ContentArea 自带 CSS 类 `engine-page-wrapper`（或各自引擎前缀的类），互不干扰。

**删除** `src/app/routes/AppRoutes.tsx` 中的 `pageByPath` 映射和相关逻辑。保留 `Routes` redirect 逻辑（`/mysql → /mysql/tables`，`/redis → /redis/browser`）——这段逻辑与引擎内容无关，是路由导航层面的，可以留在原处或者移到各自 ContentArea。

### Step 2：AppWorkspace.tsx → 引入引擎内容区

**当前状态**：
```tsx
<section className="mdb-content">
  <AppRoutes />
</section>
```

**改动后**：
```tsx
<section className="mdb-content">
  <EsContentArea />
  <MysqlContentArea />
  <RedisContentArea />
</section>
```

三个 ContentArea 全部挂载，但各自用 `data-active` 控制内部页面显示。引擎级别的切换由 `currentEngine` 决定哪个 ContentArea 激活。

### Step 3：CSS 调整

**当前**：
```css
.mdb-page-wrapper { display: none; overflow-y: auto; height: 100%; }
.mdb-page-wrapper[data-active="true"] { display: flex; flex-direction: column; }
```

**改动后**：

保留 `.mdb-page-wrapper` 的滚动行为不变，但改为引擎前缀的类：
```css
/* 引擎内容区容器 */
.es-content-area { display: none; }
.es-content-area[data-active="true"] { display: flex; flex-direction: column; height: 100%; }

.mysql-content-area { display: none; }
.mysql-content-area[data-active="true"] { display: flex; flex-direction: column; height: 100%; }

.redis-content-area { display: none; }
.redis-content-area[data-active="true"] { display: flex; flex-direction: column; height: 100%; }

/* 页面级 wrapper（复用原有逻辑） */
.engine-page-wrapper {
  display: none;
  overflow-y: auto;
  height: 100%;
}
.engine-page-wrapper[data-active="true"] {
  display: flex;
  flex-direction: column;
}
```

### Step 4：路由 redirect 逻辑处理

当前 `AppRoutes.tsx` 中有两个 redirect：
```tsx
// /mysql → /mysql/tables
// /redis → /redis/browser
```

方案 A：保留在 `AppRoutes.tsx` 中（只负责 redirect，不渲染页面）
方案 B：移到各引擎 ContentArea 内部

选择 **方案 A**——redirect 是全局导航逻辑，不属于某个引擎的内容。保留 `AppRoutes.tsx` 但只负责 `<Routes>` redirect，不再渲染页面。

### Step 5：验证不受影响的文件

以下文件 **不需要改动**：
- `src/lib/routeEngine.ts` — URL 到引擎的映射不变
- `src/app/shell/AppShell.tsx` — workspaceVisible 逻辑不变
- `src/app/shell/AppSidebar.tsx` — 导航回调不变
- `src/hooks/useConnectionWorkspace.ts` — 引擎默认路由不变
- 所有 3 个 WorkspaceTabs 组件 — tab 的 NavLink 不变
- 所有 9 个页面组件 — 无需改动
- `src/layout/WorkspaceChrome.tsx` — 布局容器不变

## 改动影响分析

### 风险点

1. **`/mysql/table` 路由** — 当前映射到 `MysqlTableManagerPage`，但 URL 和 `/mysql/tables` 指向同一个组件。需要确认这个重复映射是否有意（可能是兼容旧 URL），如果是，迁移时要保留。

2. **MySQL 的 openedTables** — `MysqlWorkspaceTabs` 接收 `openedTables` 和 `activeOpenedTableKey`，但内容区在 `MysqlContentArea` 中。两者需要协调——目前 `MysqlTableManagerPage` 已经通过 Context 管理自己的状态，所以 ContentArea 只需要渲染页面，不需要传递额外的 props。

3. **Suspense fallback** — 当前 `AppRoutes` 外层有 `<Suspense>`。拆分后需要确认 Suspense 边界是否仍在正确位置。建议将 Suspense 保持在 AppRoutes 层或移到 AppWorkspace 层。

4. **ES 的 4 个页面 + MySQL 的 3 个 + Redis 的 2 个 = 9 个**，仍然全部挂载。区别在于从"一个扁平列表"变成"三个引擎分组"。挂载数量没有减少，但逻辑分组更清晰。

## 文件改动汇总

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `src/modules/es/routes/EsContentArea.tsx` | ES 页面渲染容器 |
| 新建 | `src/modules/mysql/routes/MysqlContentArea.tsx` | MySQL 页面渲染容器 |
| 新建 | `src/modules/redis/routes/RedisContentArea.tsx` | Redis 页面渲染容器 |
| 修改 | `src/app/routes/AppRoutes.tsx` | 移除 pageByPath，保留 redirect |
| 修改 | `src/app/shell/AppWorkspace.tsx` | 引入三个 ContentArea |
| 修改 | `src/styles.css` | 新增 ContentArea 和 page wrapper CSS |

## 最终架构

```
AppWorkspace.tsx
  ├── EsWorkspaceTabs        (visible=ES)
  ├── MysqlWorkspaceTabs     (visible=MySQL)
  ├── RedisWorkspaceTabs     (visible=Redis)
  └── section.mdb-content
       ├── EsContentArea     [data-active=ES]
       │    ├── /data        → EsDataBrowserPage
       │    ├── /sql         → EsSqlQueryPage
       │    ├── /rest        → EsRestConsolePage
       │    └── /indices     → EsIndexManagerPage
       ├── MysqlContentArea  [data-active=MySQL]
       │    ├── /mysql/tables → MysqlTableManagerPage
       │    ├── /mysql/table  → MysqlTableManagerPage
       │    └── /mysql/sql    → MysqlSqlQueryPage
       └── RedisContentArea  [data-active=Redis]
            ├── /redis/browser → RedisBrowserPage
            └── /redis/console → RedisConsolePage
```

每个 ContentArea 有独立的 `data-active`，由 `currentEngine` 控制。ContentArea 内部各页面也有独立的 `data-active`，由 `location.pathname` 控制。两层 `display:none` 嵌套，但滚动位置由内层 `.engine-page-wrapper` 的 `overflow-y: auto` 独立维护。
