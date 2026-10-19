# 其他语音存档、事务所演出、剧情衣装与歌曲页 Center 台词：2026-10-15

分支：`portal/20261015-song-voice-slot`（接在 `cab0dda3` 舞台 Center 台词槽之后）。

## 其他语音存档（原“未使用语音”）

- 9_1 系列是登录时偶像念出的游戏标题「アイドルマスター SideM GROWING STARS」，9_9 系列是各偶像喊「バンダイナムコ」（均为试听核对；9_9 的具体播放时机未在客户端核实）。两者不是未使用资源，改为“标题呼号”，归入“有用途”。
- 页面与路由文案统一为“其他语音 / 其他语音存档”（`archiveRoute`、文档标题、entity head shell、资源/翻译审计）。路径仍是 `/unused/`，不改 URL。
- 导航分两组：“有用途”（事务所 · 山村、登录标题呼号、万代南梦宫呼号）与“未使用 / 用途未确认”。

## 事务所语音：移出首页，带 ADV 演出

- 山村贤的 11 句系统语音（`scenario_4_1_101_00/01`）是普通 ADV 脚本：模型 `101ken_001_00`、`bg001_315pro_in_01`、表情/动作与 adxlip 嘴型。`scripts/build-office-voice-previews.py` 用共享编译器编出每句的一步场景，写 `src/data/officeVoicePreviews.json`（编译器对这类脚本给出的 voice 名不对，按 lip 路径改回实际 cue）。
- 其他语音页“事务所 · 山村”每句有试听和“演出预览”，后者走卡面语音同一套 `playbackController.preview`。预览 URL `?view=player&voice=4_1_101_0N_aNNNN&return=unused_archive` 可刷新恢复（`archiveRoute` 对这类 cue 不再要求 card）。
- 首页的事务所对话框删除；原胶囊改为跳转资料馆“其他语音”。

## 剧情衣装

- 客户端未命名、但有 spine 的模型共 92 个，全部给了站内称呼（`src/presentation/costumeSeries.js`）：
  - 系列号按偶像各自编排，只有 003/004 能按规则：34 个 `_004_` 都是运动服（冬马另有 `001tom_004_01` 第二套，标“运动服 2”），25 个 `_003_` 都是秋冬便服。
  - 其余 33 个逐个看贴图与模型定名，例如 `010pie_001_00` 青蛙玩偶装、Café Parade 的咖啡店制服、S.E.M 的教师装、`005kao_001_00` 白大褂。`*_005_01` 与 `010pie_002_01` 贴图与有名的本体一致（005_01 多一枚徽章），沿用“茁壮明彩 / 基础常服”。
  - 资料馆显示“名称（未命名）”，首页显示“名称（剧情）”；详情页脚注说明名称为站内整理。
- 首页服装选择：`buildCostumesByIdol` 收入这 92 个。现有 read model 的首页 profile 是旧数据，客户端用 `src/data/storyCostumes.json`（`scripts/build-story-costumes.mjs` 生成）经 `withStoryCostumes` 补入；默认服装不变（仍是基础常服 / 场景默认，`047shu_002_00` 保留“场景默认”地位，只是有了名字）。
- 客户端表里双子的运动服行互相指错：costume 1012002（悠介）→ `013kys_004_00`，1013001（享介）→ `012yus_004_00`。模型画的是 ID 前缀那位，首页按模型前缀归属，`storyCostumes.json` 记录 `tableIdolCode`。资料馆的归属仍来自 `costume_catalog.json`，未改。
- 缩略图：客户端没有其中 30 个模型的 `image_costume_icon`（包括青蛙装），`image_costume_icon_037jir_108_00` 画的是另一套（黄色外套，模型是灰色毛衣）。`scripts/render-costume-thumbnails.mjs` 在首页 spine 舞台上暂停动作，各在黑、白底上截一次，由差值得到准确 alpha；用描在 neck/hip 骨骼上的标记点定位，按游戏图标的胸像构图裁 148 px，青蛙装整只缩进画面。PNG 写到 `public/assets/costume-renders/`（被忽略的媒体，共 31 张），哈希记录在 `src/data/costumeRenderThumbs.json`；资料馆列表与详情在没有图标或图标不符时使用。

## 歌曲页 Center 台词

- `ArchiveSongSinglePlayer` 在歌曲播放下方加“Center 台词”选择：默认原曲 Center（FLASH LIGHT 为花园百々人）/ 任选 49 人 / 关闭。按 audio 元素逐帧驱动同一 `useStageOneshotVoice`：播放越过触发点即播，台词中途 seek 带偏移续播，暂停/seek 停止，音量跟随播放器。
- 现有 read model 预构的歌曲 view 没有 `centerLine`，`resolveSongCenterLine` 从 view 里的目录行与 idol 条目推出同样结果。形式标签“Center 台词”仍要等下次 read model 发布才显示（当前候选 `rm-release-20261015` 仍是“演出语音”）。

## 验证

- `npm run build:check` 通过（随后恢复生成器改写的 translation-audit、translation-release、translations manifest，resource-audit 只保留本次 5 行）。
- `verify:story-costumes`（新增，已加入 source gate）、`verify-archive-home`（`--experimental-vm-modules`，含旧 profile 补入路径与双子归属）、`verify-archive-routes`（office cue 无 card 也可进 player）、`verify-character-line-text`、`verify-song-oneshot-voices`、`verify-song-detail-presentation`、`verify-card-voice-preview`、`verify:routes`、`verify:route-schema`、`verify-portal-navigation`、`verify-home-system-voice`、`verify-resource-audit`、`verify-entity-head-shells` 通过。
- Browser（5177，Edge headless）：
  - 其他语音页分组与 11 句事务所语音；演出预览载入 voice、adxlip 与翻译（均 200），刷新预览 URL 可恢复。
  - 首页胶囊跳到 `/unused/`。
  - 首页服装：信玄运动服、冬马秋冬便服 / 运动服 2、皮埃尔青蛙玩偶装均载入对应 spine；不带参数时默认服装不变。
  - 资料馆服装：青蛙装列表与详情用渲染缩略图，`037jir_108_00` 用渲染图替代不符的图标并显示脚注，请求与控制台无错误。
  - 歌曲页 FLASH LIGHT：默认百々人在 35.55 s 触发；台词中途 seek 续播；改选冬马播放 `001tom`；控制台无错误。

## 边界与后续

- 上线前需按增量流程上传 R2：`public/assets/costume-renders/`（31 张 PNG）与上一批的 oneshot m4a。
- 下次 read model 发布后，歌曲形式标签、首页 profile 的剧情衣装会直接来自 read model，客户端补入逻辑保持幂等。
- 衣装名称是站内按外观整理的称呼，不是官方名称。
