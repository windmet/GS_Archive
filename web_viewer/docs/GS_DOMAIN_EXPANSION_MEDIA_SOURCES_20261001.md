# 摄影与藏品资源绑定：来源批次

输入 HEAD：`03275299acd166222cc1a724b6da76439b4645b4`。本批次为 P3/P4 的离线数据与本地 HTTP 资源入口，尚未接入摄影工作台。

## 来源与生成

`scripts/generate-domain-media.py` 读取已审核 PB 快照对应的 domains 数据、已配置 legacy source 的 `GS_Res/ALL_PHOTOS/assets/resources` PNG 和 `scripts/scenariodata` 的 49 份摄影脚本，生成 51 份绑定 JSON。候选位于 `E:/Web_build/GS_Archive_Domain_Work/domain-media-r3-03275299`。只将这些 JSON 按明确路径挂入 `public/data/masterdata/domains`，没有复制图片、模型或音频库。

主数据 SHA256：`25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1`。绑定来源使用独立版本 `gs-domain-media-v1`。readmodel 生产器检查快照、版本、相对媒体 URL、摘要与偶像/标签身份，再按旧有 release 描述符和页预算封装。

- 535 道具、1613 称号均对应精确命名 PNG；同名导出若摘要不同必须停留在歧义状态。
- 背景使用现有 `/assets/bg`，表情图标使用脚本指定模型下的现有 faces 导出；姿势图标、贴纸与边框明确区分缩略图、完整图片及两层边框。
- 共 3626 项图片引用核对文件存在、PNG 签名、尺寸、字节数和 SHA256。引用去重后约 430.6 MB，其中大量背景和表情已在 public，不是新增副本。藏品的外部图片去重后 32,439,186 字节。
- 949 个配置标签均在脚本中唯一命中 `jump_point`，对应实际 motion/face/neck 指令；49 套脚本指定模型的 atlas、骨架和所有 atlas 纹理存在并绑定摘要；245 条去重语音对应现有 M4A 文件。

`AnimationName` 是脚本标签，不是 Spine 动作名。例如 `3_4_001_1_02` 的实际动作是 `weight`。每个标签块独立读取，未记录的 face/motion 保持 null，不能从上一个标签或全局默认值继承。源指令索引、完整 Values 和脚本相对路径/摘要保留在绑定中。未支持的指令、跨偶像命令、重复标签会留在未解析状态。

## 来源条件与本地入口

藏品来源投影保留原始 groupId、dayCount、sumFanAmount 和 sourceDomain；活动登录奖励按 table 117 的 product group 接入已命名 campaign 的历史配置期。不能据此编造完整任务、兑换或实时可获得条件。

新增 `/assets/domain-images` 挂载只允许三个图片目录的 PNG，相对路径有根目录边界与目录白名单。Vite、standalone server 和生产代码 QA server 共用解析器。独立服务器的缺失图片返回 404，不落入 SPA HTML。默认根来源于本地 archive source 配置，可由 `SIDEM_DOMAIN_IMAGE_ROOT` 覆盖；公开 JSON 没有机器绝对路径。

此映射只证明本地服务可以提供文件。远程发布仍需供应相同路径的资源，本批次没有部署或完整媒体打包。

## 验证与边界

`python scripts/verify-domain-media.py`：7 项真实标签语义回归，覆盖动作名区别、neck、多次选择状态隔离、重复标签、跨偶像、未知指令与缺失模型。

实际生成：51 份 JSON 共 2,619,495 字节；3626 图片文件引用、949 脚本标签、49 模型依赖、245 语音全部完成本地文件核对；状态仍是 `verified-local-file` 或 `script-bound-runtime-pending`，runtimeVerified 仍为 false。

`node --test readmodels/tests/*.test.mjs`：45 项全部通过，日志位于外部 E 盘 `browser-qa-r1/readmodel-tests-media.log`。回归覆盖历史事件身份、复刻、藏品来源、登录天数和 campaign 配置期、绑定来源门禁、冬马真实动作/表情/模型/语音闭包。装配夹具使用当前 VALID_VIEWS.size，仍验证未完成切换时禁止输出；这是合成夹具，不是设备审核证据。

`node scripts/verify-archive-assets.mjs`：Vite 与 standalone 的 30 次实际 HTTP 夹具响应通过，包括新增道具 PNG 和原有媒体入口、根覆盖和路径拒绝。夹具直接加载本工程 Vite 插件并关闭无关的 @pixi/utils 预构建，解决了背景预构建竞争下的间歇流读取超时；没有变更应用预构建配置。

本批次不把文件存在当成渲染、动画存在、音频解码、CORS 导出或真实设备验收。称号 Prefab 效果、场景 effect 与背景分开；4 个原始 filter 仍缺 shader 数值。下一批接入目录预览与独立摄影画布，再用 Browser 验证实图、模型、切换取消、点击语音和有界 PNG 导出。
