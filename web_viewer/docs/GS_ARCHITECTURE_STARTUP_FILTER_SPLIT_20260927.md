# 卡片与卡池筛选的启动闭包拆分（2026-09-27）

## 输入与改动

- 输入 HEAD：`c4c79ae89528eb540383c0daa81e90831902c161`，分支 `codex/gs-architecture-rebuild`；ReadModels release：`409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`。
- 卡片稀有度标签计算从旧综合选择器移到现有卡片筛选模块；原函数只被 `App.vue` 使用，没有其他消费者。
- 卡池目录的分类和搜索函数在进入卡池目录时与 ReadModel 索引并行加载，随后一起发布给页面。初始闭包不再静态导入卡池目录工具；卡池详情仍通过同一个目录按需路径定位明细。
- 更新异步导航测试的源码截取边界，使其适配上一批已删除的旧通信索引加载器。

## 验证

- `npm run build:check`：通过，生产代码编译到本工程可重用的 `.analysis/build-check`，没有复制 public 语料。
- `npm run verify:build-audit`：`forbiddenModules=[]`、`productionLegacyModules=[]`、`legacyCallSites=[]`；初始 JS gzip 估算 107,773 字节。该数字是构建产物估算，不是实际网络传输或设备性能。
- `npm run verify:card-filters`：826 张标准化卡片、1,225 种筛选组合通过；`verify:gasha-catalog`：57 个主卡池、25 个筛选组合及 61 个详情关系通过；`verify:archive-async-navigation`：通过。
- Browser：复用 `127.0.0.1:5188` 的生产代码映射服务，465×493 视口。直接打开卡池目录后显示 57 个卡池及完整分类；选择 GROWING FES 后为 4/57，进入详情再返回时分类保留。直接打开天ヶ瀬 冬馬卡片目录，稀有度标签为 All 19、SSR 3、SR 12、R 3、N 1；选择 SSR 后只显示 3 张 SSR。页面非空，无框架覆盖层，error/warn 日志为空。

## 边界

- 启动禁用模块清零并不代表完整路由切换。32 条路由中入口 31、数据 30、动作 26 已迁移；parity 和设备验收仍未完成。
- 当前只验证了本地 Browser 的一个窄屏视口与指定交互。未验证真机、离线、完整媒体包或线上部署，未更改 Pages / R2。
