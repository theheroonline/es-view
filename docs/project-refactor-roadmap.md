# 项目重构路线图

配套执行清单见 [docs/project-refactor-task-breakdown.md](docs/project-refactor-task-breakdown.md)。

## 1. 文档目标

这份路线图不是泛泛的“建议列表”，而是面向当前仓库结构的执行清单。

目标有三个：

1. 把前端和后端的职责边界重新划清。
2. 让 MySQL、Redis、Elasticsearch 三个模块形成统一的组织方式。
3. 给后续继续拆分 `TableManager`、补测试、整理 Wails 调用层提供固定路径。

## 2. 当前结构判断

### 2.1 前端

- 根装配和跨模块编排集中在 `src/App.tsx`
- 共享连接状态集中在 `src/state/SharedConnectionState.tsx`
- 各模块业务状态位于：
  - `src/state/MysqlContext.tsx`
  - `src/state/RedisContext.tsx`
  - `src/state/ElasticsearchContext.tsx`
- API 调用目前分散在：
  - `src/lib/wailsapi.ts`
  - `src/modules/mysql/services/client.ts`
  - `src/modules/redis/services/client.ts`
  - `src/modules/es/services/client.ts`
- MySQL 模块已经进入“子特性拆分”阶段，重逻辑集中在：
  - `src/modules/mysql/pages/TableManager.tsx`
  - `src/modules/mysql/pages/table-manager/components/`
  - `src/modules/mysql/pages/table-manager/hooks/`
  - `src/modules/mysql/pages/table-manager/utils/`

### 2.2 后端

- Wails 入口和模块组织已经迁移为分层 package
- 典型文件分布：
   - App 入口与生命周期：`backend/app/app.go`、`backend/app/lifecycle.go`
   - 状态相关：`backend/infra/state_store/state_store.go`
   - MySQL：`backend/modules/mysql/`
   - Redis：`backend/modules/redis/`
   - Elasticsearch：`backend/modules/elasticsearch/`

### 2.3 已知风险

1. Context 仍然承载了部分领域模型，不只是界面态。
2. Wails 调用层有统一封装，但各模块仍然写了不少重复的环境判断和错误包装。
3. 仓库当前缺少前端与 Go 层的自动化测试文件。

## 3. 目标结构

### 3.1 前端目标结构

```text
src/
  app/
    providers/
    routes/
    shell/
  lib/
    transport/
    connection/
    shared-types/
  modules/
    mysql/
      features/
        table-manager/
          components/
          hooks/
          services/
          state/
          types.ts
          utils/
      components/
      hooks/
      pages/
      services/
      i18n/
      types.ts
    redis/
      features/
      components/
      hooks/
      pages/
      services/
      i18n/
      types.ts
    es/
      features/
      components/
      hooks/
      pages/
      services/
      i18n/
      types.ts
  state/
    SharedConnectionState.tsx
```

### 3.2 后端目标结构

```text
backend/
  app/
    app.go
    lifecycle.go
    state.go
  modules/
    mysql/
      module.go
      query_service.go
      schema_service.go
      transfer_service.go
      transfer_dump.go
      transfer_sql.go
    redis/
      module.go
    elasticsearch/
      module.go
      http_service.go
  infra/
    state_store/
    mysql_driver/
    redis_driver/
    http_client/
  shared/
    helpers.go
```

## 4. 分阶段路线图

---

## 阶段 0：先建立约束，再继续拆功能

### 目标

先把目录规范、类型边界、测试入口定下来，否则后面的拆分会持续返工。

### 目录级动作

1. 新增前端架构文档目录：`docs/`
2. 约定 `src/state/` 只保留跨页面共享状态容器，不再放模块领域类型。
3. 约定 `src/modules/*/services/` 只保留业务接口，不直接扩散底层 transport 细节。

### 文件级动作

1. 审查并收口以下文件职责：
   - `src/state/SharedConnectionState.tsx`
   - `src/state/MysqlContext.tsx`
   - `src/state/RedisContext.tsx`
   - `src/state/ElasticsearchContext.tsx`
2. 在前端增加测试入口约定：
   - `src/modules/mysql/__tests__/`
   - `src/modules/redis/__tests__/`
   - `src/modules/es/__tests__/`
3. 在后端增加测试入口约定：
   - `backend/.../*_test.go`

### 本阶段完成标准

1. 写清楚哪些类型属于共享层，哪些类型属于模块层。
2. 新功能不再把领域类型直接写进 Context 文件。
3. 测试目录结构确定下来。

---

## 阶段 1：收缩状态层和 App 壳层

当前进度：

- 已完成 `src/App.tsx` 壳层拆分
- 已完成 `SharedConnectionState` 第一轮职责收口

### 目标

把“连接持久化状态”“模块运行态”“页面工作态”拆开，先削减最上层的耦合。

### 目录级动作

1. 保留 `src/state/SharedConnectionState.tsx` 作为全局连接状态入口。
2. 将模块特有领域状态逐步迁移到模块内部：
   - `src/modules/mysql/state/`
   - `src/modules/redis/state/`
   - `src/modules/es/state/`
3. 新增 App 装配层目录：
   - `src/app/providers/`
   - `src/app/routes/`
   - `src/app/shell/`

### 文件级动作

1. 拆分 `src/App.tsx` 为以下职责：
   - `src/app/providers/AppProviders.tsx`
   - `src/app/routes/AppRoutes.tsx`
   - `src/app/shell/AppSidebar.tsx`
   - `src/app/shell/AppWorkspace.tsx`
2. 让 `src/App.tsx` 只保留根装配调用。
3. 将 `src/state/MysqlContext.tsx` 中的下列内容迁移到 MySQL 模块内部：
   - `MysqlFilterOperator`
   - `MysqlFilterConditionNode`
   - `MysqlFilterGroupNode`
   - `MysqlFilterNode`
   - `MysqlOpenedTable`
   - `MysqlQueryResult`
   - `ExecutedStatementResult`
   - `SqlQueryState`
4. `src/state/MysqlContext.tsx` 最终只保留：
   - 当前激活连接映射
   - 当前模块共享运行态
   - 少量 setter / getter
5. 对 `src/state/RedisContext.tsx` 和 `src/state/ElasticsearchContext.tsx` 做同样审查，避免继续累积模块领域类型。

### 推荐迁移落点

- MySQL 查询相关类型：`src/modules/mysql/types.ts` 或 `src/modules/mysql/features/sql-query/types.ts`
- TableManager 工作区类型：`src/modules/mysql/features/table-manager/types.ts`
- 连接共享类型：`src/lib/connection/types.ts`

### 本阶段完成标准

1. `src/App.tsx` 降为纯装配文件。
2. `src/state/` 不再承载大量模块领域类型定义。
3. 三个模块的状态入口职责写法开始一致。

---

## 阶段 2：把 MySQL 的子特性结构正式定型

当前进度：

- 已完成 `table-manager` 目录从 `pages/` 到 `features/` 的迁移
- `src/modules/mysql/pages/TableManager.tsx` 已切为 feature 入口页的导入方式
- 已完成 workspace / overview / data / structure / info 的视图容器下沉
- 已完成 TableManager feature 的类型入口与局部状态入口收口
- 已完成 MySQL 模块 service 与 TableManager feature service 的第一轮拆分
- 已完成首批 MySQL 行为测试与 Vitest 基础设施落位

### 目标

你已经把 `TableManager` 拆出很多 hook 和组件，这一阶段要把它从“页面下的拆分产物”升级成“标准 feature 目录”。

### 目录级动作

将当前目录：

- `src/modules/mysql/pages/table-manager/components/`
- `src/modules/mysql/pages/table-manager/hooks/`
- `src/modules/mysql/pages/table-manager/utils/`

演进为：

- `src/modules/mysql/features/table-manager/components/`
- `src/modules/mysql/features/table-manager/hooks/`
- `src/modules/mysql/features/table-manager/services/`
- `src/modules/mysql/features/table-manager/state/`
- `src/modules/mysql/features/table-manager/utils/`
- `src/modules/mysql/features/table-manager/types.ts`

### 文件级动作

1. 保留 `src/modules/mysql/pages/TableManager.tsx`，但它只做 feature 入口页。
2. 将以下文件按职责归组：
   - 视图行为：
     - `useTableOverviewActions.ts`
     - `useTableSelectionActions.ts`
     - `useTableMenuDismiss.ts`
   - 数据行为：
     - `useTableDataActions.ts`
     - `useTableSqlExecution.ts`
     - `useExportImport.ts`
     - `useExcelTable.ts`
   - 结构行为：
     - `useTableColumnActions.ts`
     - `useTableSchemaActions.ts`
     - `useTableIndexManagementActions.ts`
     - `useCreateTable.ts`
   - 生命周期与打开流程：
     - `useTableLifecycleActions.ts`
     - `useTableLifecycleEffects.ts`
   - 交互菜单：
     - `useTableContextMenuActions.ts`
     - `useTableTreeMenuActions.ts`
     - `useTableColumnHeaderMenuActions.ts`
     - `useContextMenuStyle.ts`
3. 视图类组件继续留在 feature 内：
   - `AddRowModal.tsx`
   - `ColumnEditModal.tsx`
   - `IndexManagementModal.tsx`
   - `ExportSelectionModal.tsx`
   - `SortDataModal.tsx`
   - `SqlExecutionModal.tsx`
   - `CopyTableDialog.tsx`
   - `ConfirmDialog.tsx`
   - `TreeContextMenu.tsx`
   - `RowContextMenu.tsx`
   - `ColumnHeaderContextMenu.tsx`
   - `SuccessOverlay.tsx`
4. 从 `TableManager.tsx` 继续迁出的最后一批内容应是：
   - workspace 级视图分发
   - overview 区域装配
   - data / structure / info 三类 tab 容器装配
5. 已新增并落位以下视图容器组件：
   - `src/modules/mysql/features/table-manager/components/TableManagerWorkspace.tsx`
   - `src/modules/mysql/features/table-manager/components/TableOverviewPane.tsx`
   - `src/modules/mysql/features/table-manager/components/TableDataPane.tsx`
   - `src/modules/mysql/features/table-manager/components/TableStructurePane.tsx`
   - `src/modules/mysql/features/table-manager/components/TableInfoPane.tsx`

### 本阶段完成标准

1. `TableManager.tsx` 成为 feature 入口页，而不是总协调器。
2. MySQL 的复杂页面拆分方法形成正式模板。
3. MySQL 模块可以作为 Redis 和 ES 的重构参照物。

---

## 阶段 3：统一三个模块的目录模板

当前进度：

- 已完成 Redis Browser feature 目录落位
- `src/modules/redis/pages/Browser.tsx` 已降为 feature 入口页
- 已完成列表面板、详情面板与 Browser feature 容器拆分
- 已完成数据库、扫描、详情、编辑、TTL、删除六个 Browser 流程 hook 拆分
- 已完成 RedisContext 收口，Browser 专属列表/扫描/详情状态已回收到 feature 本地
- 已完成 Redis Browser 扫描、编辑、删除、TTL 四条主流程测试补齐

### 目标

在 MySQL 结构稳定后，把 Redis 和 Elasticsearch 拉齐，减少模块间学习成本。

### 目录级动作

为三个模块统一采用如下模板：

```text
src/modules/<engine>/
  components/
  hooks/
  pages/
  services/
  i18n/
  types.ts
  features/
```

### 文件级动作

1. 保持页面入口命名统一：
   - `src/modules/mysql/pages/*.tsx`
   - `src/modules/redis/pages/*.tsx`
   - `src/modules/es/pages/*.tsx`
2. 对 Redis 先挑一个复杂页面做 feature 化试点：
   - `src/modules/redis/pages/Browser.tsx`
   - 目标落点：`src/modules/redis/features/browser/`
3. 对 ES 先挑一个复杂页面做 feature 化试点：
   - `src/modules/es/pages/DataBrowser.tsx`
   - 目标落点：`src/modules/es/features/data-browser/`
   - 执行时建议拆成微步骤：每一步尽量只动 1 到 2 个文件，先 page -> feature entry，再整理类型和局部 state，再逐块拆 UI，最后收尾 cache 与自动查询时序

当前补充进度：

- 已建立 ES DataBrowser feature 最小落点，尚未开始搬运页面逻辑
4. 三个模块的 `services/client.ts` 保留为模块入口，但不再承担过多环境细节和重复错误处理。

### 推荐优先顺序

1. MySQL 先定型
2. Redis Browser 跟进
3. ES DataBrowser 跟进

### 本阶段完成标准

1. 三个模块都可以用同一套目录规则定位文件。
2. 后续新增功能不再纠结是放 pages、components、hooks 还是单独 feature。

---

## 阶段 4：统一 transport 和 service 层

### 目标

消除模块内部重复的 Wails 检查、错误日志包装和参数映射逻辑。

### 目录级动作

新增：

- `src/lib/transport/`
- `src/lib/transport/wails/`
- `src/lib/transport/http/`
- `src/lib/transport/errors/`

### 文件级动作

1. 将 `src/lib/wailsapi.ts` 改造成底层 transport 适配器，而不是业务直接调用层。
2. 在 `src/lib/transport/` 下建立统一能力：
   - `invokeDesktop.ts`
   - `requestHttp.ts`
   - `requireDesktop.ts`
   - `mapInvokeError.ts`
3. 改造以下文件，只保留业务接口，不再自行判断环境：
   - `src/modules/mysql/services/client.ts`
   - `src/modules/redis/services/client.ts`
   - `src/modules/es/services/client.ts`
4. ES 的浏览器模式与 Wails 模式切换逻辑，建议下沉到 transport 层，不再由业务 service 自己判断 `isWails()`。

### 建议拆分方式

1. transport 处理：环境、重试、错误标准化、参数适配
2. module service 处理：领域接口和 DTO 映射
3. hook / page 处理：界面流程和状态编排

### 本阶段完成标准

1. 三个模块的 service 写法风格一致。
2. 错误日志和环境检查不再在每个 client.ts 中重复出现。
3. 后续新增数据库模块时，只要接 transport 和 service 即可。

---

## 阶段 5：后端 package 分层

### 目标

当前 Go 代码已经有文件拆分，但仍以单 package 为主。下一步要把“Wails 暴露层”和“业务实现层”拆开。

### 目录级动作

将当前平铺目录：

- `backend/app/app.go`
- `backend/app/lifecycle.go`
- `backend/app/state.go`
- `backend/modules/mysql/`
- `backend/modules/redis/`
- `backend/modules/elasticsearch/`
- `backend/infra/state_store/state_store.go`
- `backend/shared/db.go`

逐步整理为：

- `backend/app/`
- `backend/modules/mysql/`
- `backend/modules/redis/`
- `backend/modules/elasticsearch/`
- `backend/infra/state_store/`
- `backend/shared/`

### 文件级动作

1. `backend/app/app.go` 只保留 App 结构和依赖注入。
2. `backend/app/lifecycle.go`、`backend/app/state.go` 继续保持为 App 生命周期和状态转发。
3. MySQL 已完成模块内拆分，继续围绕 `backend/modules/mysql/` 补测试和收尾。
4. Redis 已完成模块内拆分，继续围绕 `backend/modules/redis/` 补测试和收尾。
5. Elasticsearch 已完成模块内拆分，继续围绕 `backend/modules/elasticsearch/` 补测试和收尾。
6. `backend/infra/state_store/state_store.go` 已承接状态持久化。
7. `backend/shared/db.go` 保留跨模块共享 helper。

### 注意事项

1. Wails 暴露的方法签名要保持稳定，避免前端绑定破坏。
2. 优先改目录和内部调用，不先改接口名称。
3. 每完成一个模块层迁移，就补一个最小单测集。

### 本阶段完成标准

1. App 入口层、模块层、基础设施层边界清楚。
2. MySQL transfer 已有的分层经验可以推广到 Redis 和 ES。
3. Go 测试可以按 package 自然落位。

---

## 阶段 6：补测试，作为结构重构的护栏

### 目标

让结构重构从“靠 build 验证”升级到“靠测试保护”。

### 目录级动作

1. 前端按模块建设测试目录：
   - `src/modules/mysql/__tests__/`
   - `src/modules/redis/__tests__/`
   - `src/modules/es/__tests__/`
2. 后端按 package 补 `*_test.go`

### 文件级动作

#### 前端优先补的测试

1. `TableManager` 相关行为
   - 多表导出弹窗流程
   - 右键菜单动作触发
   - 过滤树 / 排序 / visibleColumns 状态切换
2. MySQL service 层
   - 参数映射
   - 错误日志包装
3. Redis Browser
   - 批量删除
   - TTL 修改
4. ES DataBrowser / RestConsole
   - 请求参数构造
   - 响应解析

#### 后端优先补的测试

1. MySQL SQL 拆分和 transfer 逻辑
   - `backend/modules/mysql/transfer.go`
   - `backend/modules/mysql/helpers.go`
2. Query 类型判断逻辑
   - `backend/modules/mysql/helpers.go` 中的关键纯函数
3. Elasticsearch HTTP 请求封装
   - `backend/modules/elasticsearch/module.go`
4. Redis 参数解析和结果转换
   - `backend/modules/redis/helpers.go`

### 本阶段完成标准

1. MySQL 复杂流程至少有一组前端行为测试兜底。
2. Go 层纯逻辑具备最小回归测试。
3. 结构迁移可以在测试保护下持续推进。

## 5. 推荐执行顺序

如果只按投入产出比排序，建议按下面顺序推进：

1. 阶段 1：状态层和 App 壳层收口
2. 阶段 2：MySQL TableManager feature 定型
3. 阶段 4：统一 transport 和 service 层
4. 阶段 5：后端 package 分层收尾
5. 阶段 6：测试补齐并反向巩固结构

原因：

- 阶段 1 和阶段 2 会立刻降低前端耦合。
- 阶段 4 能减少重复代码继续扩散。
- 阶段 3 适合在 MySQL 模板定型后推广，不宜过早并行做。
- 阶段 5 影响 Go 目录结构，改动面较大，适合前端边界先稳定后再做。
- 阶段 6 应该尽早开始，但在执行上要伴随每一阶段逐步补，不必等全部重构完成。

## 6. 本轮建议先落的第一批文件

如果下一轮要直接动手，我建议先从下面这批文件开始：

### 第一优先级

- `src/App.tsx`
- `src/state/SharedConnectionState.tsx`
- `src/state/MysqlContext.tsx`
- `src/modules/mysql/pages/TableManager.tsx`

### 第二优先级

- `src/lib/wailsapi.ts`
- `src/modules/mysql/services/client.ts`
- `src/modules/redis/services/client.ts`
- `src/modules/es/services/client.ts`

### 第三优先级

- `backend/app/app.go`
- `backend/app/lifecycle.go`
- `backend/app/state.go`
- `backend/modules/mysql/`
- `backend/modules/redis/`
- `backend/modules/elasticsearch/`

## 7. 不建议现在就做的事

1. 不建议先全面重命名 Wails 暴露方法。
2. 不建议在没有统一目录规则前，同时重构三个模块的页面结构。
3. 不建议在没有测试护栏时直接大规模搬 backend package。
4. 不建议把所有类型一股脑搬到 `src/lib/types.ts` 这种单点文件中。

## 8. 验收方式

每个阶段至少做以下验证：

1. 前端构建通过：`pnpm build`
2. 前端诊断无新增错误
3. Go 代码格式化通过：`go fmt ./...`
4. 新增测试可运行时，前端和后端测试都应纳入验证

当前已知的非阻断项：

- `index.html` 中 `/wails/ipc.js` 缺少 `type="module"` 的 Vite 警告，目前不阻断构建