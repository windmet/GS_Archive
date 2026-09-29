# 故事路由组件按需加载验收（2026-09-27）

本批从 `8939427` 开始，沿用本地 r22 数据候选 release `23493f6b8994a51851cae7b8e0fd0b265a04c303e80d1e41ee86f85be638912c`。

## 改动

- Reader、故事目录、故事详情、故事合集、活动详情、季节企划、工作档案和个人故事组件改为显式动态导入。
- 直达和历史路由在读取数据前开始加载对应组件；页内切换在提交视图前启动加载。只请求目标路由的组件，不在启动时导入全部故事页面。

## 验证

- `npm run build:check` 通过。相同 r22 数据下，入口 JS 从本批前的 627.98 kB（gzip 193.28 kB）变为 535.67 kB（gzip 168.60 kB）；入口 CSS 从 197.06 kB（gzip 33.18 kB）变为 123.82 kB（gzip 22.25 kB）。Vite 输出了上述页面各自的 JS/CSS 块。构建未复制 public 语料。
- `npm run verify:archive-async-navigation`、`npm run verify:archive-navigation-state`、Reader/Portal 导航及启动路由回归通过。提取 App 函数的 VM 测试补上组件预取的隔离桩；启动路由测试也补齐了既有 mobile/alias 导航计数器。
- Codex Browser 在 `127.0.0.1:5182` 的 r22 静态映射服务上复查：Reader 与故事目录直达可呈现；故事详情、合集、活动详情、工作档案、个人故事的阅读入口可见；Happy Valentine 2023 企划页呈现。该服务将全站 Reading manifest 固定返回 503，故事页仍可使用。最终组件改动后再次复查合集，阅读入口可见。

## 边界

这是八个故事路由组件的切分。入口 JS 仍超过 Vite 的 500 kB 警告线，其他功能组件及旧全量数据 Repository 仍位于生产导入图；需要继续拆分与迁移。上述字节数是构建产物大小，不是实测网络传输量或真实设备启动指标。本地 Browser 验收不等于媒体打包或部署验收。
