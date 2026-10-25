# 舞台服装共通逻辑（2026-10-25）

分支 `stage/20261025-costume-groups`，从最新 master `d0531dcc`（#99）切出。仅处理舞台换装，摄影／图鉴动态预览留待办。保留切分支前已有资源审计、翻译元数据及其他窗口的文件。

## 层次与来源

采用“适用范围 → 款式 → 版本 → 每人模型 → 当前出演位覆盖”的五层结构。**分类属于完整来源款式，当前编队只决定可用性**；一人出演不使个人服装变成全员套服，同一组合部分成员出演也不要求补齐休息位。

| 层 | 判定与消费 |
|---|---|
| 适用范围 | 全员／组合／属性／跨组合／个人；均为本站从原生关系整理的分类，不冒称原生服装分类开关 |
| 款式 | 以原文名称识别；组合款式标出所属组合。服装数码后缀、中文译名不作身份匹配 |
| 版本 | 普通与另一款保留独立原文名和成员集合；只有原生 IsAnother、同偶像唯一普通款、原文 + 后缀及歌曲关联一致时才归入同款 |
| 模型 | 每个版本保存 idolCode → costumeId 映射；不同成员允许使用不同编号，禁止跨人套用编号 |
| 可用性 | 对当前出演位生成纯计划，显示 N/M 人可用；无对应版本的成员保留原装，休息位不写入 |

[生成器](../scripts/prepare-stage-costume-families.py) 只读已解码 PB 的 table2/24/27，固定 SHA `25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1`。IdolData.IdolUnitId 取 field3，IdolType 取 field7；LiveCostumeData 的 IsAnother、NormalSongId、EventSongId 取 field8/9/10。field32 是排序，不用于组合归属。默认无写入重建比对，`--write` 才更新 [stageCostumeFamilies.json](../src/data/stageCostumeFamilies.json)。生成时逐项核对本地 Live manifest 的 549 个模型和原文名。

普通款的全体穿着者覆盖 49 人则属全员；恰好覆盖一固定组合全员则属组合；多名穿着者属性一致则属属性；其余多人设计属跨组合；其余属个人。另一款继承来源款式的范围，保留自身实际拥有成员，不宣称全组合都有该版本。当前共 549 模型／165 款式：全员 2、组合 31、属性 6、跨组合 2、个人 124；160 个另一款模型归族后仍保留独立成员映射。

## 舞台接线

[StageCostumeFamilies.js](../src/presentation/StageCostumeFamilies.js) 为独立展示／计划层。来源元数据 → 实际 manifest 标签与逐人 ID 验证 → 编队选择计划 → Viewer 原有 rebuildStage 加载路径。目录组合不符、重复 ID／重复原文名、缺资源不生成相应成员赋值。全员普通款仍要求正式 49 人全部验证成功。

个人衣装下拉按五类 optgroup 分组，原有 549 个 Live 衣装均保留。原“共通套服”两按钮改为“套服搭配”的范围／款式／版本选择；只提供当前至少一位成员有对应资源的选项。没有可用项时显示空状态。个人专属衣装仍从个人下拉选，既有“应用到出演成员”继续按精确原文名同步。套服应用和个人同步复用同一应用函数，启动／预载／成员加载期间禁止套服操作。

来源数据随 ChibiStageViewer 的懒加载模块打包，不引入摄影资产、全局服装字典或新的运行时语料请求。仍只使用已接入的 Live cos 纹理与舞台骨架，141 个 comu-only 模型不加入舞台舞蹈合同。

## 待办：摄影／图鉴预览（本轮不实现）

690 个图鉴模型的 comu 绑定已由摄影数据持有；其中 141 个不属于 Live，原包无 cos atlas/texture。后续在独立门户分支复用 StudioCompositionStage／spineSpawnPipeline 的按需加载，在服装图鉴详情补单模型预览、姿势与表情，并验证换装、关闭释放、异步过期和手机布局。本轮不改 PictureStudio、图鉴详情、摄影绑定或 R2 资源。

## 验收与边界

- 生成器默认无写入重建通过，549 个模型／原文名与本地 Live manifest 完全一致。
- 新增 `verify-stage-costume-families.mjs` 纳入 CI batch。它使用跟踪的原生投影重建 manifest 边界，不依赖忽略的媒体语料；覆盖 49 人／549 模型、165 款式、160 另一款模型、每件衣装只出现一次、不同编号同款、混编／休息位、缺资源／歧义 ID、原文名与正式组合守卫。实际 manifest 比对由生成器完成，不将测试边界重建冒充媒体渲染。
- 既有 `verify-chibi-panel-presentation.mjs` 本地实际目录回归通过；`verify:source-batch` 为179/179。最终 `build:check` 17.46s通过，固定 E 盘 `.analysis/build-check`，不复制 public。最后文案／预载禁用调整后复跑新旧目标回归与构建，Browser 使用最终代码。
- Browser 复用主 checkout 5213（PID64608），HTTP 确认返回当前 StageCostumeFamilies 模块和165款式 JSON；源码 bootstrap 为 `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`。该旧进程仍指定 `rm-release-20261015` 候选，本次未更换候选或重启服务；验收限于本地舞台 manifest／实际 Spine／本分支控件，不宣称门户候选或发布已更新。
- 桌面1280×720冷加载 Tone's Destiny：手动两人编队（翔太2号位、北斗3号位），组合范围只列 Jupiter 两款；普通款应用2/2，另一款应用1/2，翔太为104_01、北斗仍为104_00。seek22秒后截图可见两种衣装，播放继续推进至81秒以上；预载时新增套服控件禁用。
- 属性范围显示适用款式及1/2覆盖；原两人跨组合范围为空，显示明确空状态。将3号位替换为都筑圭，跨组合范围自动出现“苦涩碎心装点”，实际只替换圭，翔太保留原装。390×844下完成实际应用，页面clientWidth与scrollWidth均390；按钮可通过面板滚动／键盘到达。编队为验收配置，不作为原曲站位证据。
- Console error为空；已有 Pixi Spine tint/update warning保留。未做全549模型逐一GPU渲染、真机、原片对照或生产bundle验收。

截图保存在 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`stage-costume-families-desktop.png`、`stage-costume-families-mobile.png`。构建／源码门禁小日志保留于本 checkout `.analysis/costume-wiring-20261025/`。构建改写的三份资源／翻译元数据已逐字节恢复本轮输入快照，原有未提交改动仍保留。未上传资源、未部署、未创建PR。
