# 藏品与摄影媒体目录：本地 Browser 验收

来源生产提交：`63676a105a7199ef54187caa3aec5f3d9ac3bfe0`。readmodel release：`3eeaee807ae526810c48daebc5331e094c30b89b933a9cad120d769d7a710df0`。原 PB 快照及 media epoch 不变。

## 产物与接线

生产器输出在 `E:/Web_build/GS_Archive_Domain_Work/domain-readmodels-r2`：8,607 个 artifact，72,252,417 decoded bytes，bootstrap 14,344 bytes。`verify_artifacts.mjs` 全部通过；没有复制媒体，bootstrap 仅描述当前数据 release。

目录通过共用 ReadModelClient/DomainRepository 读取相应页，展示绑定图片和来源条件。表情、动作详情展示从源脚本解析出的真实 face/motion/neck，图标不作为动画运行证据。各姿势语音按去重 cue 提供点击试听，使用组件自己的单一 audio，切换姿势、偶像、分类或离开时停止并释放来源。不自动播放、不把权重解释为概率。加载期间隐藏上一分类的目录，避免将称号短暂标为道具。

图片组件显示真实读取/失败状态并允许重试。原 Prefab、场景 effect 未实现时明确说明，原 filter shader 未解析时仅展示配置。移动端选择摄影资料会定位到详情，保留有界列表。

## 验证

日常编译仅 `npm run build:check`，复用本工程 `.analysis/build-check`，copyPublicDir:false。修复切换状态和窄屏定位后重新编译并运行 `verify:build-audit`，启动/动态组件边界通过，整体切换与物理设备门禁保持未完成。额外回归：domain navigation、55 scoped refs/1792 navigation cases、B002 59 篇/999 行均通过。上批来源/生产器的 45 项 readmodel 和 7 项脚本回归仍是来源批次证据。

实际 Browser 使用已有 IAB，目标为 `http://127.0.0.1:5198/`，生产 bundle 映射 r2 readmodel、现有 public 和受限外部图片目录。只替换经进程命令确认的本任务 5198 服务；另一窗口 5197 未关闭。QA 日志和截图位于 `E:/Web_build/GS_Archive_Domain_Work/browser-qa-r2`。

- 桌面 1440×1000：Not Alone 1位 显示实际称号 PNG，来源仍指向 GROWING SIGN@L -Not Alone-、排名 1–1、数量 1。
- 道具 ゴーゴーゼリー 显示实际图片和登录第 2/6 天；企划 11 的第 2/5/9 天、历史配置期 2022-06-29 至 2022-07-12 来自 named table 117/对应 campaign group。
- 摄影地点显示真实 bg058 背景，场景列表保留两个普通场景和クロマキー；冬马动作 10102 显示源脚本动作 weight，表情显示模型下的原始图标。
- 点击 `3_4_001_01`：浏览器 audio readyState 4、paused false、currentTime 0.187533、duration 1.060998 秒。切换姿势后 audio 元素移除；这是解码/播放状态证据，未进行人工听感评价。
- 另一偶像的 `3_4_049_05`：readyState 4、paused false、currentTime 0.172643、duration 0.758005 秒。离开动作分类后 audioCount 0。
- 注入一次贴纸缩略图 404：显示“图片暂时无法读取”和重试按钮，点击后恢复实际 Jupiter 图片。相框缩略图 218×126 正常；滤镜仍显示 shader 未解析边界。
- 窄屏 390×844：眉见锐心 joy 图标 100×100，选择后图片位于视口 top 309.36；资料页 clientWidth/scrollWidth 同为 375，无横向溢出。截图实际检查通过。

HTTP 样本 102 次：98×200、3×206、1×404（预期注入）；没有直接读取 `/data/masterdata/domains/`，最大单个 readmodel 响应 375,214 bytes，仍在既有预算内。Browser 本批次开始时间之后的 error 日志为空；更早批次的一次预期 502 未计入本批次结论。

## 设计对照与边界

沿用上一批 ImageGen 目录概念和本应用导航：冷色背景、白色双栏卡片、绿色选中态、浅色资料表、实图右侧展示、移动端单栏。实际检查 `honor-media-desktop.png` 与 `face-mobile.png`：真实称号保持原始宽高比，表情图标居中，标题/条件/来源信息层次一致。差异是以真实图片替换概念占位图，并保留来源编号与命名配置；不使用概念示例数据。

尚未运行摄影 Spine 模型、原始 shader、场景 effect 或称号 Prefab，也没有 PNG 导出、远程部署或物理设备验收。其余 3626 资源引用的文件核对不能代替逐项 Browser 渲染。下一阶段在同一 source-bound photo projection 上接入独立实验摄影工作台。
