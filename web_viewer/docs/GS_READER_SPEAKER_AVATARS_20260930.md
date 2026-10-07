# 阅读器非偶像角色头像

输入 HEAD `663c7d9e`，分支 `codex/story-interaction-v2-before-b002`。
用户要求核实 49 位偶像之外的头像，并在阅读器补齐。

## 资源核实

读取 `RAW/asset/image_chara_icons.unity3d` 的 Sprite 名单，并核对
`public/assets/idols/icons/` 已发布 PNG、`speaker_dictionary.json` 的 NPC 身份与现有角色映射。
共有 80 张已发布图标：49 位偶像、3 张偶像变体、25 个非偶像角色图标、3 张通用图标。
这是资源名称、已发布文件与图像内容核对；没有重新导出或替换 RAW / PNG。

| 代码 | 角色 |
| --- | --- |
| `101ken` | 山村 賢 |
| `102sha` | 齋藤社長（齋藤孝司），原图为剪影 |
| `103kur` | 黒井社長，原图为剪影 |
| `104omn` | アイドル業界の大物，原图为剪影 |
| `201sub` / `202sub` / `203sub` | 3 个 SP 图标 |
| `204sub` | あまね |
| `205sub` | 市川 白鶴 |
| `206sub` | 鷹城 恭一 |
| `207sub` | 直央の母 |
| `208sub` | 圭の友人 |
| `209sub` | 麗の姉 |
| `210sub` | 想楽の兄 |
| `211sub` | 店主 |
| `212sub` | 九郎の祖父 |
| `213sub` | 秀の親友 |
| `214sub` | 旬の父 |
| `215sub` | 翔太の姉（三女） |
| `216sub` | 隼人の兄 |
| `236sub` | 雨彦の父 |
| `238sub` | 薫の姉 |
| `240sub` | かのんの父 |
| `241sub` | にゃん喜威（角色映射与真实阅读行确认） |
| `246sub` | 漣の父 |

`100grp` 是 Producer 的事务所标志，`mob` / `group` 为路人/群体通用图标，
不作为具体人物头像。master 中另有部分角色代码没有本套已发布 icon，不猜测图像路径。

## 呈现规则

新增 `ReadingSpeakerAvatar.js` 的 25 代码注册表，在 `useReadingPresentation` 的共享链路调用。
整话与单段均复用既有 `ArchiveIdolAvatar`。对话必须有明确的已知角色代码及公开名称；
不从译名、模型或通用 `mob` 推断人物。旧 compiled 中 NPC 被标为 `idol` 的情况予以兼容。
`unknown` / `？？？` / Producer 不解锁 NPC 图标；原有偶像入口舞台、隐藏、离场与身份保密规则保留。
NPC 图标表示说话人身份，独立于舞台可见性；不改写 canonical visual / performance 证据。

用户最终选择：边框与内框恢复原样，仅将共享组件的内部图片缩放默认值
从 `1.06` 调到 `1.12`，头像整体尺寸不变。没有新增蓝色内环、白色内环或加粗边框。

## 验收与边界

- `verify:reading-speaker-avatars`：25 个资源存在、真实山村/社长/にゃん喜威行、
  通用/未知/无资源身份排除、偶像隐藏规则与 canonical 不变回归通过；纳入 `verify:reading`。
- `verify:reading`：2801 文档、来源 hash、视觉身份、导航、播放、实际 Vue SSR、排版与主题通过。
- Vue SSR 核对整话段落与单段在原文/译文/双语下都含 `101ken`、`102sha` 图标路径。
- `verify:archive-presentation`、`verify:reviewed-b001` 通过；B001 的 52 文档、42 catalogues、993 单元身份保持。
- protected guard：6551 文件无修改、缺失或新增。
- 现有 5197 映射预览服务：25 个 NPC PNG 的 HTTP 200 与已发布文件 SHA256 一致。
- `build:check` 仅完整编译代码，复用 `.analysis/build-check`，`copyPublicDir:false`；
  提交后重建并执行 `verify:build-audit`，证据绑定干净 HEAD。

Browser 实际核对主线第1話 EPISODE 01：整话/单段中山村头像和社长剪影均加载为 148px 原图。
译文切换继续保留头像；1280×900 与 390×844 下阅读布局无横向溢出，40px 占位保持，
控制台无 warn/error、无错误覆盖层。
另核对 `1_5_025suz_1_5_025_04`《動物バラエティ番組のお仕事》的 `241sub` 头像正常加载。
25 个注册图标全部有资源与 HTTP 验收，尚未在真实阅读场景中逐个验证其出场。

小型资源清单、图像预览、HTTP 核对、构建日志及最终截图保存在
`.analysis/reader-speaker-avatars/`；临时 viewport 恢复，用户在用阅读页保留。
本批未部署、未复制完整媒体库、未进行真实设备验收。

## 2026-10-07 规则放宽（用户决定）

原规则要求偶像必须在舞台上（或通话里）可见、NPC 必须带角色代码，因此语音留言、舞台外台词、附身发言都没有头像（例：主线第十话天道輝的留言，にゃん喜威骑在朱雀身上）。

现规则：原有判定拿不到头像时，说话人的**日文原名**（NFKC、去空白后）只要精确命中以下两张表之一，就显示对应头像：
- 49 位偶像的名字；
- `READING_NPC_SOURCE_NAMES`：取 `speaker_dictionary` 的 display_name，另加两个真实台词里出现的别名「齋藤社長」「にゃん喜威」。

以下情况仍然没有头像：
- 「SP」「店主」等共用或通用名字，只认角色代码；
- 角色代码和名字对不上的行；
- 「？？？」、unknown、Producer。

序章的保密规则不变。

全部 25,363 行台词中，有头像的从 19,293 行增至 20,805 行，原有的头像无一丢失或改换。
