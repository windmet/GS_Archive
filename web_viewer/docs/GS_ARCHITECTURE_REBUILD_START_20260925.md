# GS 门户架构重构：首批落地记录

2026-09-25；基线 `a6929d4`；工作分支 `codex/gs-architecture-rebuild`。
输入为用户提供的 `GS_Architecture_Rebuild_20260925.zip`，包内 45 个文件的
`MANIFEST.sha256` 已核对。将其作为设计与可执行支架使用；包内关于全量迁移、
真机与云端的陈述没有当作本地验收结果。

## 已完成

- 将可执行生成器、read-model 客户端、装配验证器、路由清单和测试纳入
  `readmodels/`。生成器只要求影响输出的受版本控制输入与生成器已提交；
  不相关的本地未跟踪证据不阻止运行。数据源、selector 与生成器在产出前后
  都有内容哈希核对。
- 只读审计确认启动注册表有 21 个本地可读取源，合计 32,115,751 B，
  本地 gzip 估算 2,095,250 B；这不是浏览器传输量或 R2 操作计数。
- 首次真实语料运行发现故事搜索单文件 819,448 B，触发 768 KiB 原始字节
  限额。改为有界搜索页后，24 项 Node 测试通过。
- 第二次真实语料生成并经 `verify_artifacts` 核对全部 2,961 个文件：
  release `fdbfbc927800cef97f15388b9962c53b5b9a836650cd8b72efdec789b219e2aa`；
  bootstrap 11,509 B；全部 read-model 解码字节 38,752,101 B。
  故事目录 1,394 项、22 个目录页、22 个搜索页。候选位于
  `E:\GS_readmodels_candidate_20260925_r2`，仓库外且未部署。

数据 revision 取自 `PRODUCTION_RELEASE_20260924.md` 记录的
`c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9`；
候选媒体 epoch 标签为 `voice64-gzip-all-20260924`。这两项是本地候选输入，
本批没有重新核实云端状态。

## 下一批切换顺序与验收边界

1. 将 Portal、welcome、idol picker 与 Home 从 App 的整批载入门禁中拆出，
   以此候选的内联 bootstrap、Home detail 与 cue 页接线。根入口和 Portal 的
   `/data` JSON 请求应为零；验证偏好、人物资格、返回与深链。
2. 迁移歌曲目录与单曲详情，再按 `readmodels/contracts/routes.json` 逐域推进。
   全局搜索消费者读取本域全部 `searchPages` 后计算完整结果数；不把首片
   数量显示为全集。
3. 补齐指导包列出的 landing、mobile/random talk、Reader locator、
   resources/evidence 和旧 groups/files 生产器；用真实语料做语义对照。
4. 消除生产入口的 `loadArchiveData()` 全量调用与静态重型 import，
   再执行 `npm run build:check`、真实浏览器旅程和受影响设备验收。
   只有路由清单、产物与设备证据齐备后才装配发布候选。

当前 `App.vue` 和发布链没有接入 read-model。首批没有改变页面渲染、
Functions 路由、R2 对象或正式部署；真实网页性能、语义一致性、
Android Edge 与 iPad Safari 均未验收。失败的首次产物保留在
`E:\GS_readmodels_candidate_20260925` 供诊断，没有清理其他本地文件。
