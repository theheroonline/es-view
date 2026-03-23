# 项目重构任务拆解清单

## 1. 使用方式

这份文档是 [docs/project-refactor-roadmap.md](docs/project-refactor-roadmap.md) 的执行版。

它解决三个问题：

1. 每一步到底改哪些目录和文件。
2. 每一步的影响面大不大。
3. 每一步最容易引入什么回归。

注意：

- 三个模块会共用一套分层规则。
- 三个模块不会共用同一套功能设计。
- MySQL、Redis、Elasticsearch 的重构目标不同，任务顺序和粒度也要不同。

## 2. 模块差异前提

在拆任务前，先把三套模块的功能边界说清楚。

### MySQL

- 重点是“工作区型页面”
- 核心问题是：页面编排重、结构操作多、数据编辑链路长
- 代表文件：
  - `src/modules/mysql/pages/TableManager.tsx`
  - `src/modules/mysql/pages/table-manager/hooks/`
  - `src/modules/mysql/pages/table-manager/components/`

### Redis

- 重点是“Key 浏览与编辑流”
- 核心问题是：页面里混合了加载、筛选、TTL、批量删除、编辑弹窗等流程
- 代表文件：
  - `src/modules/redis/pages/Browser.tsx`
  - `src/modules/redis/services/client.ts`

### Elasticsearch

- 重点是“请求驱动型浏览与控制台能力”
- 核心问题是：查询条件、结果缓存、上下文菜单、请求模式切换都堆在页面里
- 代表文件：
  - `src/modules/es/pages/DataBrowser.tsx`
  - `src/modules/es/pages/RestConsole.tsx`
  - `src/modules/es/services/client.ts`

结论：

1. 可以统一目录和层次。
2. 不能强行统一 feature 拆分模板。
3. 优先把“相同职责的代码”统一，而不是把“不同功能的页面”做成一样。

## 3. 任务分组总览

| 任务组 | 目标 | 主要对象 |
|---|---|---|
| A | 统一前端壳层和状态层边界 | App、state |
| B | 把 MySQL TableManager 从页面拆成标准 feature | MySQL |
| C | 给 Redis Browser 做适合它的 feature 化 | Redis |
| D | 给 ES DataBrowser 做适合它的 feature 化 | Elasticsearch |
| E | 收口 transport 和 service 层 | lib、modules/*/services |
| F | 重整 backend 分层 | backend |
| G | 用测试给结构重构加护栏 | 前端 + Go |

---

## A. 前端壳层与状态层

### A1. 拆 App 根装配

已完成。可对照：

- `src/App.tsx`
- `src/app/providers/AppProviders.tsx`
- `src/app/routes/AppRoutes.tsx`
- `src/app/shell/AppShell.tsx`
- `src/app/shell/AppSidebar.tsx`
- `src/app/shell/AppWorkspace.tsx`
- `src/app/shell/AppOverlays.tsx`
- `src/app/shell/AppTopbarStatus.tsx`

**要做什么**

把 `src/App.tsx` 从“既是根组件、又是侧栏容器、还是路由装配点”的状态，拆成根装配 + 壳层子容器。

**要改的文件**

- 现有文件：
  - `src/App.tsx`
- 新增文件：
  - `src/app/providers/AppProviders.tsx`
  - `src/app/routes/AppRoutes.tsx`
  - `src/app/shell/AppSidebar.tsx`
  - `src/app/shell/AppWorkspace.tsx`
  - `src/app/shell/AppTopbar.tsx`

**影响面**

- 高
- 会影响应用启动结构、Provider 套娃顺序、侧栏渲染、路由承载点

**回归点**

1. Provider 顺序错误导致 context 初始化失败
2. 懒加载页面挂载位置变化导致空白页或 loading 状态异常
3. 侧栏收起、连接切换、顶部状态条显示异常

**验收点**

1. 页面启动正常
2. 三个模块切换正常
3. 连接侧栏、顶部状态、workspace 区域行为一致

### A2. 收缩 SharedConnectionState 的职责

已完成当前阶段收口：

- `SharedConnectionState` 不再向外暴露完整 `LocalState`
- 连接辅助逻辑已迁到 `src/lib/connection/`
- 消费方改为使用 `profiles`、`getProfileById`、`getSecretById`

**要做什么**

让共享状态只管连接档案、激活连接、持久化，不继续承接模块领域态。

**要改的文件**

- `src/state/SharedConnectionState.tsx`
- `src/lib/types.ts`
- 可能新增：
  - `src/lib/connection/types.ts`
  - `src/lib/connection/normalizeProfile.ts`

**影响面**

- 中到高
- 会影响连接信息读取、保存、删除、当前连接映射

**回归点**

1. 连接保存后无法恢复
2. `activeConnectionIdByEngine` 映射错乱
3. 删除连接后残留脏状态

**验收点**

1. 新增连接、编辑连接、删除连接正常
2. 重启应用后持久化恢复正常
3. 各模块切换连接时不会串状态

### A3. 把模块领域类型从 Context 中搬走

已完成当前阶段收口：

- `MysqlContext` 不再定义 MySQL 领域类型
- MySQL 过滤树、打开表签、SQL 执行结果等类型已迁到 `src/modules/mysql/types.ts`
- Redis 和 ES 的 Context 保持为状态容器，不再额外引入新的领域类型

**要做什么**

把模块业务类型迁到模块目录或共享类型目录，Context 文件只保留状态容器能力。

**要改的文件**

- `src/state/MysqlContext.tsx`
- `src/state/RedisContext.tsx`
- `src/state/ElasticsearchContext.tsx`
- `src/modules/mysql/types.ts`
- `src/modules/redis/types.ts`
- `src/modules/es/types.ts`
- 可能新增：
  - `src/modules/mysql/features/table-manager/types.ts`
  - `src/modules/mysql/features/sql-query/types.ts`

**影响面**

- 中
- 主要影响 import 路径和类型归属，不一定直接影响运行逻辑

**回归点**

1. 类型引用路径改错导致构建失败
2. 循环依赖
3. Context 暴露接口与页面使用方不一致

**验收点**

1. `src/state/` 中不再定义大量领域对象
2. 类型查找路径更清晰
3. 构建通过

---

## B. MySQL 模块任务清单

### 模块目标

MySQL 的重点不是“再多拆几个 hook”，而是把已经拆出来的大量 hook、组件和工作区状态组织成正式 feature。

### B1. 把 table-manager 从 pages 子目录升级成 feature 目录

已完成当前阶段收口：

- 目录已从 `src/modules/mysql/pages/table-manager/` 迁移到 `src/modules/mysql/features/table-manager/`
- `src/modules/mysql/pages/TableManager.tsx` 已改为从 `features/table-manager` 导入
- `TableManager.tsx` 继续保留为页面入口层

**要做什么**

将 `src/modules/mysql/pages/table-manager/` 迁为 `src/modules/mysql/features/table-manager/`，让 `TableManager.tsx` 真正变成页面入口层。

**要改的文件和目录**

- 现有目录：
  - `src/modules/mysql/pages/table-manager/components/`
  - `src/modules/mysql/pages/table-manager/hooks/`
  - `src/modules/mysql/pages/table-manager/utils/`
- 目标目录：
  - `src/modules/mysql/features/table-manager/components/`
  - `src/modules/mysql/features/table-manager/hooks/`
  - `src/modules/mysql/features/table-manager/utils/`
  - `src/modules/mysql/features/table-manager/types.ts`
  - `src/modules/mysql/features/table-manager/state/`
  - `src/modules/mysql/features/table-manager/services/`
- 页面入口：
  - `src/modules/mysql/pages/TableManager.tsx`

**影响面**

- 高
- import 路径变化广，涉及页面、hooks、components、utils 全链路

**回归点**

1. 路径迁移后构建错误
2. 相对路径层级变化导致共享依赖引入失败
3. 类型重名或导出名冲突再次出现

**验收点**

1. `TableManager.tsx` 只承担页面入口
2. feature 目录内部自洽
3. 页面功能不变，构建通过

### B2. 拆出 TableManager 视图容器层

已完成当前阶段收口：

- `TableManager.tsx` 已将 overview / workspace / data / structure / info 的视图装配下沉到 feature 容器
- 已新增 `TableManagerWorkspace.tsx`、`TableOverviewPane.tsx`、`TableDataPane.tsx`、`TableStructurePane.tsx`、`TableInfoPane.tsx`
- 页面入口保留状态编排和 overlay 挂载，不再直接拼接 tab 视图主体

**要做什么**

把 `TableManager.tsx` 里仍然承担的大块视图编排继续下沉到容器组件。

**要改的文件**

- `src/modules/mysql/pages/TableManager.tsx`
- 新增：
  - `src/modules/mysql/features/table-manager/components/TableManagerWorkspace.tsx`
  - `src/modules/mysql/features/table-manager/components/TableOverviewPane.tsx`
  - `src/modules/mysql/features/table-manager/components/TableDataPane.tsx`
  - `src/modules/mysql/features/table-manager/components/TableStructurePane.tsx`
  - `src/modules/mysql/features/table-manager/components/TableInfoPane.tsx`

**影响面**

- 中到高
- 影响渲染装配逻辑、tab 切换、overview / workspace 视图衔接

**回归点**

1. `data` / `structure` / `info` 切换错乱
2. overview 多选、右键、打开表签行为出问题
3. 弹窗挂载层级变化导致状态丢失

**验收点**

1. 页面本体文件显著缩小
2. overview 和 workspace 的职责边界清楚
3. 所有现有 modal/menu 仍能正常打开和关闭

### B3. 把 TableManager 的类型与状态进一步专属化

已完成当前阶段收口：

- 已新增 `src/modules/mysql/features/table-manager/types.ts` 作为 TableManager 类型主入口
- 已新增 `src/modules/mysql/features/table-manager/state/useTableManagerState.ts` 收口页面局部工作区状态
- `utils/typeHelpers.ts` 已退化为兼容转发层，页面与核心 create-table 流程改为优先依赖 feature 类型入口

**要做什么**

把当前混在 `MysqlContext` 和 `table-manager/utils` 里的工作区类型收拢到 feature 自己的类型文件。

**要改的文件**

- `src/state/MysqlContext.tsx`
- `src/modules/mysql/pages/table-manager/utils/index.ts` 或现有 utils 出口
- 新增：
  - `src/modules/mysql/features/table-manager/types.ts`
  - `src/modules/mysql/features/table-manager/state/useTableManagerState.ts`

**影响面**

- 中
- 主要影响类型归属、状态初始化、hook 参数组织

**回归点**

1. hook 参数过多，迁移后反而更绕
2. 状态默认值迁移时遗漏字段
3. 打开表签缓存状态丢失

**验收点**

1. `MysqlContext` 只保存模块共享态
2. TableManager feature 具备自己的局部状态组织
3. hook 参数组更稳定

### B4. 把 MySQL service 分成模块 service 和 feature service

已完成当前阶段收口：

- 模块级 service 已按 `connectionClient.ts`、`queryClient.ts`、`schemaClient.ts`、`transferClient.ts` 拆分
- `src/modules/mysql/services/client.ts` 已退化为兼容导出层
- TableManager 已新增 `tableDataService.ts`、`tableSchemaService.ts`、`tableExportService.ts`，对应 hook 已切到 feature service
- `SqlQuery`、`DataBrowser`、`Connections`、`useMysqlSidebarWorkspace` 已开始改用分类后的模块 service

**要做什么**

不要让所有 MySQL 调用都堆在一个 `client.ts` 里，把通用数据库能力和 TableManager 专属能力分开。

**要改的文件**

- `src/modules/mysql/services/client.ts`
- 新增：
  - `src/modules/mysql/services/connectionClient.ts`
  - `src/modules/mysql/services/queryClient.ts`
  - `src/modules/mysql/services/schemaClient.ts`
  - `src/modules/mysql/features/table-manager/services/tableDataService.ts`
  - `src/modules/mysql/features/table-manager/services/tableSchemaService.ts`
  - `src/modules/mysql/features/table-manager/services/tableExportService.ts`

**影响面**

- 中到高
- 会影响多个 hook 的 API 入口

**回归点**

1. 查询与结构操作调用到错误的 service
2. 错误信息丢失或日志 source 错乱
3. import/export 相关链路回归

**验收点**

1. `client.ts` 不再像总入口杂糅所有行为
2. TableManager 自己依赖的服务集中在 feature 内
3. SQL 查询页和表管理页的服务边界更清晰

### B5. 优先补 MySQL 行为测试

已完成当前阶段收口：

- 已建立 `src/test/setup.ts` 作为 Vitest + Testing Library 的统一测试入口
- 已新增 `src/modules/mysql/__tests__/` 首批测试文件
- 当前已覆盖 overview 交互、TableManager data actions、export selection、SqlQuery state 这四类高回归行为

**要做什么**

优先为最复杂、最容易回归的工作流补测试。

**要改的文件**

- 新增测试目录：
  - `src/modules/mysql/__tests__/`
- 推荐首批测试文件：
  - `src/modules/mysql/__tests__/table-manager-overview.test.tsx`
  - `src/modules/mysql/__tests__/table-manager-data-actions.test.ts`
  - `src/modules/mysql/__tests__/table-manager-export-selection.test.tsx`
  - `src/modules/mysql/__tests__/sql-query-state.test.ts`

**影响面**

- 低到中
- 主要影响测试配置和 mock 方式

**回归点**

1. 测试 mock 和实际 Wails 接口不一致
2. 右键菜单、异步加载、延迟状态不稳定

**验收点**

1. 多表导出、右键行为、数据操作至少有一层覆盖
2. 后续继续拆 TableManager 时有护栏

---

## C. Redis 模块任务清单

### 模块目标

Redis 不需要照着 MySQL 去做“大工作区架构”。它更适合围绕 Browser 页面拆成若干清晰流程块。

### C1. 把 Browser 页面拆成流程型 feature

已完成当前阶段收口：

- `src/modules/redis/pages/Browser.tsx` 已缩成 feature 入口页
- 已新增 `src/modules/redis/features/browser/`，承接 Browser 的 feature 组件、服务和类型入口
- Browser 主体已拆成列表面板、详情面板和 feature 容器，数据库加载 / key 扫描 / 详情刷新 / 编辑 / TTL / 删除流程已从页面入口下沉

**要做什么**

围绕“数据库列表”“key 列表扫描”“详情面板”“编辑流”“TTL 流”“删除流”拆出 feature 内部结构。

**要改的文件**

- `src/modules/redis/pages/Browser.tsx`
- 新增目录：
  - `src/modules/redis/features/browser/components/`
  - `src/modules/redis/features/browser/hooks/`
  - `src/modules/redis/features/browser/services/`
  - `src/modules/redis/features/browser/types.ts`

**影响面**

- 高
- 因为现在 Browser 页面内聚了大部分流程逻辑

**回归点**

1. 切换 database 后 key 列表不同步
2. 搜索 pattern 自动查询失效
3. key 详情、TTL 倒计时、编辑器联动异常

**验收点**

1. Browser 页面只做 feature 入口
2. 扫描、详情、编辑、删除、TTL 五个流程可独立定位

### C2. 提取 Redis Browser 的流程 hook

已完成当前阶段收口：

- `src/modules/redis/features/browser/hooks/` 已补齐数据库、扫描、详情、编辑、TTL、删除六个流程 hook
- `src/modules/redis/features/browser/components/RedisBrowserFeature.tsx` 已收敛为 hooks、面板与模态框的组装层
- Redis Browser 的异步时序已按流程边界拆开，后续测试可直接针对单个 hook 补齐

**要做什么**

将流程拆成适合 Redis 的 hook，而不是套 MySQL 的 action 命名方式。

**要改的文件**

- `src/modules/redis/pages/Browser.tsx`
- 新增：
  - `src/modules/redis/features/browser/hooks/useRedisDatabases.ts`
  - `src/modules/redis/features/browser/hooks/useRedisScanKeys.ts`
  - `src/modules/redis/features/browser/hooks/useRedisKeyDetail.ts`
  - `src/modules/redis/features/browser/hooks/useRedisKeyEditor.ts`
  - `src/modules/redis/features/browser/hooks/useRedisKeyTtl.ts`
  - `src/modules/redis/features/browser/hooks/useRedisKeyDelete.ts`

**影响面**

- 中到高
- 主要影响页面状态拆分和异步调用时序

**回归点**

1. `loadKeys(true)` 与搜索框、数据库切换的自动加载时序错乱
2. `selectedKey` 和 `selectedKeyDetail` 同步失效
3. TTL 倒计时重复启动多个 interval

**验收点**

1. 每个流程都有单独 hook 管理
2. 页面只负责拼装
3. 时序相关逻辑更容易测试

### C3. 收缩 RedisContext 的业务面

已完成当前阶段收口：

- `src/state/RedisContext.tsx` 现仅保留活动连接解析、按连接切换重置的共享数据库选择，以及按 id 获取连接能力
- Redis Browser 的数据库列表、扫描结果、游标、详情与错误状态已回收到 `src/modules/redis/features/browser/hooks/useRedisBrowserState.ts`
- Browser 页面专属状态不再暴露到 Context，Console 仍可复用共享数据库选择

**要做什么**

保留 Redis 模块共享运行态，页面专属态尽量回到 feature 内。

**要改的文件**

- `src/state/RedisContext.tsx`
- `src/modules/redis/features/browser/types.ts`
- `src/modules/redis/types.ts`

**影响面**

- 中

**回归点**

1. 页面刷新后状态恢复策略变化
2. context 与 local state 责任重叠

**验收点**

1. Browser 专属态不再持续膨胀到 Context
2. 模块状态边界更接近 MySQL 和 ES 的约束方式

### C4. 补 Redis Browser 测试

已完成当前阶段收口：

- 已新增扫描、编辑、删除、TTL 四个 Redis Browser 流程测试文件
- 现有测试覆盖以 hook 级流程为主，直接校验服务调用、状态回写与刷新链路
- Redis Browser 的核心 CRUD/TTL 行为已具备基础回归保护

**要做什么**

优先覆盖“最像流程”的功能，不必一开始就做全部 UI 细节。

**要改的文件**

- 新增：
  - `src/modules/redis/__tests__/browser-scan-flow.test.tsx`
  - `src/modules/redis/__tests__/browser-edit-key.test.tsx`
  - `src/modules/redis/__tests__/browser-delete-keys.test.tsx`
  - `src/modules/redis/__tests__/browser-ttl.test.tsx`

**影响面**

- 低到中

**回归点**

1. 定时器和异步请求 mock 不稳定
2. SCAN 分页与详情加载联动缺 mock 数据

**验收点**

1. Redis Browser 的核心 CRUD/TTL 流有测试兜底

---

## D. Elasticsearch 模块任务清单

### 模块目标

ES 的重点不是像 MySQL 那样拆工作区，也不是像 Redis 那样拆 CRUD 流，而是把“查询条件构造”“请求执行”“结果视图”“上下文操作”几类职责拆开。

### D1. 把 DataBrowser 拆成查询驱动 feature

**要做什么**

围绕条件编辑、结果缓存、表格/JSON 双视图、上下文菜单，拆出 DataBrowser feature。

因为 `src/modules/es/pages/DataBrowser.tsx` 体量过大，这一项执行时继续拆成更小的微步骤。默认要求：每一步尽量只动 1 到 2 个文件，只解决一种职责，不做顺手扩散。

#### D1.1 建立 feature 落点

已完成当前阶段收口：

- 已建立 `src/modules/es/features/data-browser/` 最小落点
- 已补 `src/modules/es/features/data-browser/index.ts` 作为后续迁移统一入口
- 本步未搬运页面逻辑，保持运行行为不变

**要做什么**

先建立 `src/modules/es/features/data-browser/` 的最小目录和导出落点，不搬代码，只把 feature 外壳准备好。

**要改的文件**

- 新增：
  - `src/modules/es/features/data-browser/index.ts`

**影响面**

- 低
- 只影响目录结构和后续迁移落点

**回归点**

1. feature 入口路径约定和后续文件命名不一致

**验收点**

1. ES feature 目录存在稳定入口
2. 本步不改运行行为

#### D1.2 创建 feature 容器文件

**要做什么**

新增 `EsDataBrowserFeature.tsx`，先放最小壳子，不搬页面主体逻辑。

**要改的文件**

- 新增：
  - `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx`

**影响面**

- 低
- 只新增承接文件

**回归点**

1. feature 默认导出和命名不统一

**验收点**

1. feature 容器文件可被页面入口引用
2. 本步不改运行行为

#### D1.3 页面改为 feature 入口

**要做什么**

把 `pages/DataBrowser.tsx` 降为单纯入口，直接转发到 feature 容器。此时 feature 容器仍可暂时承接原页面完整实现。

**要改的文件**

- `src/modules/es/pages/DataBrowser.tsx`
- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx`

**影响面**

- 中
- 主要是页面入口职责变化

**回归点**

1. 页面默认导出丢失
2. 路由仍引用旧页面实现导致重复逻辑

**验收点**

1. `pages/DataBrowser.tsx` 只剩 feature 入口
2. 行为保持不变，构建通过

#### D1.4 提取类型骨架

已完成当前阶段收口：

- 已新增 `src/modules/es/features/data-browser/types.ts`
- `ViewMode`、`BoolType`、`ConditionItem`、context menu state、cache state 已从页面顶部抽到 feature 类型文件
- 当前旧页面实现已改为引用 feature 类型，运行行为保持不变

**要做什么**

先把 `ViewMode`、`BoolType`、`ConditionItem`、context menu state、cache state 这些局部类型迁到 feature `types.ts`，不改业务逻辑。

**要改的文件**

- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx`
- 新增：
  - `src/modules/es/features/data-browser/types.ts`

**影响面**

- 低到中
- 主要影响类型归属和 import 路径

**回归点**

1. 类型迁移后漏改引用
2. React/Dayjs 类型 import 断裂

**验收点**

1. 主文件顶部类型定义明显减少
2. 运行行为不变

#### D1.5 提取 state 骨架，不动请求逻辑

已完成当前阶段收口：

- 已新增 `src/modules/es/features/data-browser/hooks/useEsDataBrowserState.ts`
- DataBrowser 的 query/result/view/modal/context menu 相关本地 state 已先收拢到 state hook
- effect、查询执行、文档操作和 UI 壳暂时仍留在旧页面实现中，未改变行为

**要做什么**

把 query state、result state、view/modal state 整理到本地 state hook，但 effect、查询执行、文档操作仍先留在 feature 容器里。

**要改的文件**

- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx`
- 新增：
  - `src/modules/es/features/data-browser/hooks/useEsDataBrowserState.ts`

**影响面**

- 中到高
- 主要影响组件内部状态归属

**回归点**

1. cache 恢复和默认 state 不一致
2. modal/context menu 状态初始化异常

**验收点**

1. state 定义不再散落在主组件里
2. 组件主体更接近编排层

#### D1.6 拆查询栏与索引选择 UI

已完成当前阶段收口：

- 已新增 `src/modules/es/features/data-browser/components/EsDataBrowserToolbar.tsx`
- 顶部索引选择、查询按钮、过滤按钮区域已从页面主文件中拆出
- 当前只拆了查询栏 UI 壳，未改条件面板、分页条、结果区与请求逻辑

**要做什么**

先拆最上面的查询栏和索引选择区，只处理 UI 壳和事件透传，不改变查询执行函数。

**要改的文件**

- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx`
- 新增：
  - `src/modules/es/features/data-browser/components/EsDataBrowserToolbar.tsx`

**影响面**

- 中
- 主要影响 props 透传与按钮行为接线

**回归点**

1. 选索引、清空索引、查询按钮动作接线错误
2. loading 状态在 toolbar 上显示不一致

**验收点**

1. 查询栏从主文件中拆出
2. 行为保持一致

#### D1.7 拆条件面板 UI

已完成当前阶段收口：

- 已新增 `src/modules/es/features/data-browser/components/EsQueryConditionsPanel.tsx`
- 查询条件标题栏、关闭按钮、条件增删改与时间范围输入区域已从页面主文件中拆出
- 当前只拆了条件面板 UI 壳，未动分页条、结果区、dialogs、context menu 和查询执行逻辑

**要做什么**

只拆查询条件面板，保留条件增删改和 RangePicker 行为不变。

**要改的文件**

- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx`
- 新增：
  - `src/modules/es/features/data-browser/components/EsQueryConditionsPanel.tsx`

**影响面**

- 中到高
- 主要影响条件编辑 UI 的 props 面

**回归点**

1. 条件开关、插入、删除操作失效
2. 时间范围条件的值回写异常

**验收点**

1. 条件面板从主文件中拆出
2. 条件编辑行为保持一致

#### D1.8 拆结果区 UI

已完成当前阶段收口：

- `src/modules/es/features/data-browser/components/EsDataBrowserResults.tsx` 已承接结果工具栏、表格视图、JSON 视图与行选择/展开 UI
- `src/modules/es/pages/DataBrowser.tsx` 已只保留结果区状态与行为接线，不再内联结果展示 JSX

**要做什么**

只拆结果工具栏、表格/JSON 视图区，不同时处理上下文菜单和编辑删除模态框。

**要改的文件**

- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx`
- 新增：
  - `src/modules/es/features/data-browser/components/EsDataBrowserResults.tsx`

**影响面**

- 中到高
- 主要影响结果展示与行选择接线

**回归点**

1. 表格视图与 JSON 视图切换丢状态
2. 选中行、展开行状态失效

**验收点**

1. 结果显示区域从主文件中拆出
2. 视图切换与选择行为保持一致

#### D1.9 拆 dialogs 与 context menu

已完成当前阶段收口：

- `src/modules/es/features/data-browser/components/EsDataBrowserDialogs.tsx` 已承接编辑文档与删除确认弹窗 UI
- `src/modules/es/pages/DataBrowser.tsx` 仅保留编辑/删除行为接线
- `src/modules/es/features/data-browser/components/EsDataBrowserContextMenu.tsx` 已承接右键菜单 UI
- `src/modules/es/pages/DataBrowser.tsx` 仅保留右键菜单行为接线

**要做什么**

最后再拆编辑文档、删除确认、多选删除确认和右键菜单相关 UI 壳组件。

**要改的文件**

- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx`
- 新增：
  - `src/modules/es/features/data-browser/components/EsDataBrowserDialogs.tsx`
  - `src/modules/es/features/data-browser/components/EsDataBrowserContextMenu.tsx`

**影响面**

- 中到高
- 主要影响文档操作与右键菜单交互

**回归点**

1. 编辑、删除动作接线丢失
2. context menu 依赖的 field/value 信息丢失

**验收点**

1. dialogs 与 context menu 从主文件中拆出
2. 文档操作行为保持一致

#### D1.10 收尾 cache 与自动查询时序

已完成当前阶段收口：

- `src/modules/es/features/data-browser/hooks/useEsDataBrowserCache.ts` 已承接按连接恢复与写回 DataBrowser cache 的逻辑
- `src/modules/es/pages/DataBrowser.tsx` 已移除本地 cache map 与对应恢复/写回 effect
- `src/modules/es/features/data-browser/hooks/useEsDataBrowserAutoQuery.ts` 已承接自动查询触发与 loading/error/result 时序
- `src/modules/es/pages/DataBrowser.tsx` 已移除自动查询 effect，本地仅保留 executeQuery 与输入同步逻辑
- `src/modules/es/features/data-browser/hooks/useEsDataBrowserPaginationInputs.ts` 已承接 page/size 输入框同步与提交逻辑
- `src/modules/es/pages/DataBrowser.tsx` 已移除本地 pagination input effect 与 commit 逻辑
- `src/modules/es/features/data-browser/hooks/useEsSearchExecution.ts` 已承接 executeQuery、手动查询与深分页 loading message 链路
- `src/modules/es/pages/DataBrowser.tsx` 已移除本地查询执行主体，页面继续保留文档动作与结果编排
- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx` 已接管 DataBrowser 完整编排实现
- `src/modules/es/pages/DataBrowser.tsx` 已收口为纯 feature 入口页

**要做什么**

在前面各块稳定后，再整理 cache 恢复、自动查询、输入框同步、深分页 loading message 等 effect/时序逻辑，为 D2 的 hook 化做准备。

**要改的文件**

- `src/modules/es/pages/DataBrowser.tsx`
- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx`
- 可能新增：
  - `src/modules/es/features/data-browser/hooks/useEsDataBrowserCache.ts`

**影响面**

- 中到高
- 主要影响自动查询和缓存恢复链路

**回归点**

1. 索引切换后旧缓存残留
2. 自动查询触发次数变化
3. page/size 输入框与真实分页状态不同步

**验收点**

1. DataBrowser 页面只剩 feature 入口
2. query state、result state、view state 各自成层

### D2. 提取 ES 查询构造和结果缓存 hook

已完成当前阶段收口：

- `src/modules/es/features/data-browser/hooks/useEsSearchExecution.ts` 已承接查询执行与深分页链路
- `src/modules/es/features/data-browser/hooks/useEsDocumentActions.ts` 已承接编辑文档、单条删除与批量删除动作
- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx` 已进一步收缩为状态、视图和动作 hook 的编排层

**要做什么**

围绕 ES 真实需求来拆，而不是照搬 MySQL 的 action hook 风格。

**要改的文件**

- `src/modules/es/pages/DataBrowser.tsx`
- 新增：
  - `src/modules/es/features/data-browser/hooks/useEsQueryConditions.ts`
  - `src/modules/es/features/data-browser/hooks/useEsSearchExecution.ts`
  - `src/modules/es/features/data-browser/hooks/useEsDataBrowserCache.ts`
  - `src/modules/es/features/data-browser/hooks/useEsContextMenu.ts`
  - `src/modules/es/features/data-browser/hooks/useEsDocumentActions.ts`

**当前进度**

- `src/modules/es/features/data-browser/hooks/useEsSearchExecution.ts` 已承接查询执行与深分页链路
- `src/modules/es/features/data-browser/hooks/useEsDocumentActions.ts` 已承接编辑文档、单条删除与批量删除动作
- `src/modules/es/features/data-browser/hooks/useEsContextMenu.ts` 已承接右键菜单开关、复制、展开和菜单动作分发
- `src/modules/es/features/data-browser/hooks/useEsQueryConditions.ts` 已承接默认条件工厂、条件增删改启停、索引切换重置以及从右键菜单追加条件/排序
- `src/modules/es/features/data-browser/components/EsDataBrowserFeature.tsx` 已进一步收缩为状态、查询、菜单和文档动作的编排层

**影响面**

- 中到高

**回归点**

1. 条件数组与缓存还原逻辑不一致
2. 文档编辑、删除、刷新动作与当前索引脱节
3. 选中项和展开行状态丢失

**验收点**

1. 查询和结果流程可独立维护
2. 页面不再混杂太多 UI 与请求逻辑

### D3. 整理 ES service 的双模式调用

**要做什么**

ES 模块同时处理浏览器 HTTP 和 Wails HTTP，这是它和另外两个模块最大的不同。要把这种差异收口到 transport，而不是藏在页面或业务 service 里。

**要改的文件**

- `src/modules/es/services/client.ts`
- `src/lib/wailsapi.ts`
- 新增：
  - `src/lib/transport/http/esHttpTransport.ts`
  - `src/lib/transport/wails/esDesktopTransport.ts`
  - `src/modules/es/features/data-browser/services/esSearchService.ts`
  - `src/modules/es/features/data-browser/services/esDocumentService.ts`

**当前进度**

- `src/lib/transport/http/esHttpTransport.ts` 已承接浏览器模式的 ES 请求拼装与透传
- `src/lib/transport/wails/esDesktopTransport.ts` 已承接桌面模式的 http_request 调用
- `src/modules/es/services/client.ts` 已收口为“构造请求上下文 + 选择 transport”的兼容入口，不再内联 fetch 与 invoke 分支
- `src/modules/es/services/indexService.ts` 已承接 IndexManager 的索引详情、创建、删除、刷新调用
- `src/modules/es/services/clusterService.ts` 已承接连接探测与索引列表拉取调用
- `src/modules/es/services/restConsoleService.ts` 已承接 RestConsole 的原始请求执行入口
- `src/modules/es/services/searchService.ts` 已承接模块级字段加载与搜索请求
- `src/modules/es/services/documentService.ts` 已承接模块级文档变更请求
- `src/lib/transport/es/selectEsTransport.ts` 已承接 ES transport 选择分支，`src/modules/es/services/client.ts` 不再直连 `isWails()`
- `src/modules/es/features/data-browser/services/esSearchService.ts` 已承接 Data Browser 搜索与字段加载调用
- `src/modules/es/features/data-browser/services/esDocumentService.ts` 已承接 Data Browser 文档变更调用
- `src/modules/es/pages/RestConsole.tsx`、`src/modules/es/pages/IndexManager.tsx`、`src/modules/es/pages/SqlQuery.tsx` 已切到更明确的 ES domain service
- `src/state/ElasticsearchContext.tsx` 与 `src/hooks/useConnectionWorkspace.ts` 已切到 cluster service，不再直连 ES client

**影响面**

- 高
- 会影响 ES 全模块请求路径

**回归点**

1. 桌面模式和浏览器模式表现不一致
2. Auth header 或 `x-es-target` 透传失败
3. 错误信息处理方式变化

**验收点**

1. ES service 不再直接关心 `isWails()` 分支
2. 双模式切换仍可用

### D4. 补 ES 行为与 service 测试

**要做什么**

优先测试最容易在结构整理时被破坏的条件构造和请求层。

**要改的文件**

- 新增：
  - `src/modules/es/__tests__/data-browser-query-conditions.test.ts`
  - `src/modules/es/__tests__/data-browser-cache.test.ts`
  - `src/modules/es/__tests__/es-service-transport.test.ts`
  - `src/modules/es/__tests__/rest-console-request.test.ts`

**当前进度**

- `src/modules/es/__tests__/data-browser-query-conditions.test.ts` 已覆盖默认条件工厂、索引切换重置、条件插入、上下文加条件与删除回退
- `src/modules/es/__tests__/data-browser-cache.test.tsx` 已覆盖按连接缓存恢复与无连接时状态重置
- `src/modules/es/__tests__/es-service-transport.test.ts` 已覆盖 transport 选择、浏览器头透传以及桌面 verifyTls/auth 透传
- `src/modules/es/__tests__/rest-console-request.test.tsx` 已覆盖 RestConsole service 落点与批量请求执行链
- `src/modules/es/__tests__/sql-service.test.ts` 已覆盖 SQL service 的命中结果整形与字段过滤投影

**影响面**

- 低到中

**回归点**

1. query DSL 构造断言不稳定
2. transport mock 需要区分浏览器与桌面模式

**验收点**

1. ES 查询构造和请求落点有回归保护

---

## E. transport 与 service 层清单

### E1. 建立统一 transport 目录

**要做什么**

把底层调用规范拉齐，但不要求三模块功能一样。

**要改的文件**

- `src/lib/wailsapi.ts`
- 新增：
  - `src/lib/transport/requireDesktop.ts`
  - `src/lib/transport/mapInvokeError.ts`
  - `src/lib/transport/wails/invokeDesktop.ts`
  - `src/lib/transport/http/requestHttp.ts`

**当前进度**

- `src/lib/transport/requireDesktop.ts` 已统一桌面模式检测与错误提示
- `src/lib/transport/mapInvokeError.ts` 已统一桌面调用异常映射
- `src/lib/transport/wails/invokeDesktop.ts` 已统一桌面 invoke 入口
- `src/lib/transport/http/requestHttp.ts` 已统一浏览器侧原始 HTTP 请求入口
- `src/lib/wailsapi.ts` 已补充 runtime 快照能力，保留兼容 invoke/isWails/waitForWails
- `src/lib/transport/http/esHttpTransport.ts` 与 `src/lib/transport/wails/esDesktopTransport.ts` 已切到统一底层 transport helper
- `src/lib/storage.ts` 已改用统一的 `invokeDesktop`，保留桌面失败后回退 localStorage 的策略
- `src/modules/mysql/services/runtime.ts` 与 `src/modules/redis/services/runtime.ts` 已开始接入统一桌面 transport 基础件

**影响面**

- 高
- 三个模块 service 都会碰到

**回归点**

1. 底层参数适配不一致
2. 错误消息格式变化
3. 初始化等待时机改变

**验收点**

1. transport 只做底层调用
2. module service 只做业务接口和结果整形

### E2. 分模块收口 service

**要做什么**

分别整理三套 service，不追求同构，只追求职责清楚。

**要改的文件**

- `src/modules/mysql/services/client.ts`
- `src/modules/redis/services/client.ts`
- `src/modules/es/services/client.ts`

**当前进度**

- MySQL 侧已保持 `connectionClient/queryClient/schemaClient/transferClient` 的分类出口
- Redis 侧已新增 `runtime.ts`、`connectionClient.ts`、`databaseClient.ts`、`commandClient.ts`、`keyClient.ts`
- `src/modules/redis/services/client.ts` 已退化为 barrel export，外部调用开始按连接 / 命令 / key 查询与变更分类接入
- Redis Browser feature service 与 `useConnectionWorkspace.ts`、`src/modules/redis/pages/Console.tsx`、`src/modules/redis/pages/Connections.tsx` 已改为使用更具体的 Redis service
- Elasticsearch 侧 `searchService/documentService/indexService/clusterService` 已改为直接依赖 `esRequest`，不再依赖 `client.ts` 中的业务包装函数
- `src/modules/es/services/client.ts` 已收口为 request/transport 适配层，保留 `esRequest/esRequestRaw` 作为底层能力
- 已新增 `src/modules/es/services/sqlService.ts`，`src/modules/es/pages/SqlQuery.tsx` 的查询执行与结果整形已下沉到 SQL service

**影响面**

- 高

**回归点**

1. 调用入口变化导致 hook 侧大量改动
2. 错误 source 名称漂移影响日志排查

**验收点**

1. MySQL service 更偏数据库操作分类
2. Redis service 更偏 key / database 流程分类
3. ES service 更偏 search / document / raw request / sql 分类

---

## F. backend 任务清单

### F1. 先拆目录，再拆 package 责任

**要做什么**

先形成目录级边界，再逐步清 package 依赖，避免一次性大搬家。

**要改的文件和目录**

- 现有文件：
  - `backend/app.go`
  - `backend/app_lifecycle.go`
  - `backend/app_state.go`
  - `backend/state_store.go`
  - `backend/mysql.go`
  - `backend/mysql_transfer.go`
  - `backend/mysql_transfer_service.go`
  - `backend/mysql_transfer_dump.go`
  - `backend/mysql_transfer_sql.go`
  - `backend/redis.go`
  - `backend/elasticsearch.go`
  - `backend/elasticsearch_module.go`
  - `backend/helpers.go`
  - `backend/modules.go`
- 目标目录：
  - `backend/app/`
  - `backend/modules/mysql/`
  - `backend/modules/redis/`
  - `backend/modules/elasticsearch/`
  - `backend/infra/state_store/`
  - `backend/shared/`

**影响面**

- 很高
- 影响 Go package 结构、Wails 入口装配、内部引用

**回归点**

1. Wails 暴露方法失联
2. package import 循环
3. 构建路径和导出类型变化

**验收点**

1. Wails 绑定接口不变
2. 目录职责清楚
3. Go 构建通过

### F2. 按模块拆后端职责，而不是机械按文件数拆分

**要做什么**

根据三种数据库模块的真实差异拆 Go 层：

- MySQL：连接、查询、结构、transfer
- Redis：连接与 key 操作
- ES：HTTP 代理与认证

**要改的文件**

- MySQL：
  - `backend/mysql.go`
  - `backend/mysql_transfer.go`
  - `backend/mysql_transfer_service.go`
  - `backend/mysql_transfer_dump.go`
  - `backend/mysql_transfer_sql.go`
- Redis：
  - `backend/redis.go`
- Elasticsearch：
  - `backend/elasticsearch.go`
  - `backend/elasticsearch_module.go`

**影响面**

- 高

**回归点**

1. MySQL transfer 相关链路断裂
2. Redis 连接复用逻辑被破坏
3. ES 认证参数转发异常

**验收点**

1. 三个模块在 Go 侧也形成清楚边界
2. 不同模块的职责差异被真实反映出来

---

## G. 测试与回归护栏清单

### G1. 建立前端测试入口

**要做什么**

让测试按模块落位，不把不同模块的测试混成一锅。

**要改的文件和目录**

- 新增：
  - `src/modules/mysql/__tests__/`
  - `src/modules/redis/__tests__/`
  - `src/modules/es/__tests__/`

**影响面**

- 低

**回归点**

1. 测试环境 mock Wails 不完整
2. 各模块上下文依赖不同，测试装配重复

**验收点**

1. 三个模块测试目录独立
2. 测试命名能直接看出模块和流程

### G2. 建立 Go 测试入口

**要做什么**

先从纯逻辑多、最容易断的地方补最小单测。

**要改的文件**

- 新增测试文件建议：
  - `backend/mysql_transfer_sql_test.go`
  - `backend/mysql_transfer_service_test.go`
  - `backend/elasticsearch_test.go`
  - `backend/redis_test.go`

**影响面**

- 低到中

**回归点**

1. 现有代码可测试性不足，需要少量重构
2. 测试数据构造成本较高

**验收点**

1. 至少关键纯逻辑有测试覆盖
2. backend 重构时不只靠 `go fmt` 和编译

---

## 4. 推荐执行顺序

### 第一批

1. A1 拆 App 根装配
2. A2 收缩 SharedConnectionState
3. A3 搬走 Context 里的领域类型
4. B1 把 table-manager 升级为 feature 目录

### 第二批

1. B2 拆 TableManager 容器层
2. B3 收口 MySQL feature 类型与局部状态
3. B4 整理 MySQL service
4. B5 补 MySQL 测试

### 第三批

1. C1 Redis Browser feature 化
2. C2 Redis 流程 hook 化
3. D1.1-D1.10 微步骤推进 ES DataBrowser feature 化
4. D2 ES 查询与缓存 hook 化

### 第四批

1. E1 建统一 transport
2. E2 分模块收口 service
3. C4 与 D4 同步补测试

### 第五批

1. F1 backend 目录重整
2. F2 backend 模块职责拆分
3. G2 补 Go 测试

## 5. 不同模块不要做成一样的地方

这是执行时最容易犯错的部分。

### 不要统一成同一种 feature 粒度

- MySQL 适合“大 feature + 多子面板”
- Redis 适合“页面流程块”
- ES 适合“查询构造 + 请求执行 + 结果展示”

### 不要统一成同一种 hook 风格

- MySQL 可以保留 action 导向 hook
- Redis 更适合按流程命名 hook
- ES 更适合按 query、cache、document、request 命名 hook

### 不要统一成同一种状态归属

- MySQL 有 opened tables、filter tree、right panel tab 这类工作区态
- Redis 更偏当前 database、selected key、detail、editor state
- ES 更偏 selected index、conditions、result、view mode、context menu

### 不要统一成同一种 service 边界

- MySQL service 应围绕 query / schema / transfer 分组
- Redis service 应围绕 database / key / ttl / delete / editor 分组
- ES service 应围绕 search / document / raw request / transport 分组

## 6. 每轮执行时都要检查的回归清单

### 通用回归

1. `pnpm build` 是否通过
2. 懒加载页面是否正常打开
3. i18n 文案是否仍能读取
4. Provider 顺序是否被破坏

### MySQL 回归

1. 打开数据库、打开表、切换 tab 是否正常
2. 右键菜单、列头菜单、overview 多选是否正常
3. SQL 执行、导入导出、索引管理是否正常

### Redis 回归

1. 数据库切换是否触发正确扫描
2. key 详情是否跟随选中项切换
3. 编辑、删除、TTL 修改是否正常

### ES 回归

1. 查询条件构造是否正确
2. 搜索结果表格和 JSON 视图是否一致
3. 文档编辑、删除、刷新、context menu 是否正常

### backend 回归

1. Wails 方法名是否保持兼容
2. 桌面模式调用是否仍能穿透到后端
3. 认证、连接、查询类方法是否仍返回既有格式