#  ES View(本地客户端)

本项目是本地使用的 Elasticsearch 客户端，聚焦 ES 访问与 UI 功能，兼容 ES 7.1+。支持数据浏览、简易SQL操作、索引管理、连接配置，并支持多连接管理。

之前用的是大佬开源的es-client项目,后来那个功能太多了,就自己写个简单的用着


## 功能概览

- 数据浏览：条件过滤、分页查询、结果查看
- 简易SQL操作：SQL 生成器、查询执行、查询历史
- 索引管理：索引列表、创建/删除/刷新、详情查看
- 连接配置：多连接管理、连接测试、可直接使用带凭据的 Base URL

## 兼容性

- Elasticsearch 7.1+（SQL 查询与 _search）

- 验收：安装/卸载顺畅；说明完整

## 开发说明

```bash
npm install
npm run dev
```

### 开发模式代理（解决 CORS）

开发环境会自动通过 /es 走 Vite 代理，并根据请求头动态路由到不同的 ES 地址。无需在 ES 上开启 CORS。

## 打包说明（可选 Tauri）

```bash
npm run tauri:dev
npm run tauri:build
```
