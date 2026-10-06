# GS Archive UI 交接（2026-10-07）

接替 `GS_ARCHIVE_UI_HANDOFF_20261006_PM.md`（留作历史）。新窗口先读本文件，再读 `docs/GS_UI_CONSTITUTION.md` 的「视觉语言」和 `docs/GS_GAME_UI_REFERENCE.md`。设计方向（「节目册」）已定，不要重新讨论。

本轮的 UI 待办（摄影台、工具页、手机资料馆、桌面延伸、小人舞台纯净模式）都做完了。下一阶段是**清工程债**：§2 是这次的新审计，§3 是建议顺序。

---

## 0. 当前状态

- 分支 `codex/portal-architecture-cleanup-20261004`。远端在 `78290821`（不是本窗口推的），之后 12 个提交（含本文件）**未推送**。用户没要求就不推。
- 工作区里两处修改**不是本窗口的提交内容**，别 `git checkout`：
  - `public/translations/zh-CN/archive-general/skills.json`：只有换行符差异，不管它。
  - `config/resource-audit.json`：17:10 重跑的审计，多出的 49 个文件就是新复制的签名图（`public/assets/idols/signs/`）。等签名传上 R2 后再一起提交。
- `.analysis/game-ui-reference/bug-reported/` 里只有一张截图（10-06 23:49 摄影台），反映的压扁和旋转钮问题已修（`f47297c5` `78290821`）。
- 画布 https://claude.ai/artifact/5aQWd8Htrprt7XEN34dNhb 上有本轮所有方案板（工具页 B/C/D、手机资料馆现在/方案、担当头图三种签名方案）。另一个会话也连着这块画布。

### 本轮完成并提交的（不要重做）

| 提交 | 内容 |
|---|---|
| `f9599a24` | 摄影台素材改为看图选择，左侧一列分类 |
| `05e07a87` `e77cb159` | 点画布空白取消选中；换背景时旧图留到新图加载完（不再闪白） |
| `949eb83a` `a0a5302c` `d137a5e1` | 工具页方案 D：三个等权工具各一张大图；首次下载量是实测值（谱面 3 MB / 舞台 12 MB / 摄影 2.5 MB） |
| `cd8672f1` | 大批量图片部署为 q90 有损 WebP（bg、活动横幅与角色、剧情、扭蛋、歌曲封面）；活动 logo 保持无损 |
| `7cc9e8c7` `a0fa1aa6` `da66e017` | 摄影页和首页背景选择用游戏自带 `_s` 缩略图；首页背景按摄影页的时段分类，桌面一行三张 |
| `69dac237` `c9fba534` `68dab0ef` `50e9dbeb` | 手机资料馆：页头与统计、图标入口、组合格（放不下才叠头像）、卡面 bento 画框贴图 |
| `af1dd3b7` `38d6bab5` | 手机担当头图（偶像浅色底、签名在立绘后、按人物重心居中）；故事章节卡片、故事类型与歌曲改为纯行、歌曲分类改横排标签 |
| `89f0aab9` | 以上设计延伸到桌面：头图、卡面探索（主图 15:8 原比例 + 两张竖卡）、故事行、歌曲两列 |
| `f47297c5` `78290821` `e35f309e` | 摄影台：矮屏手机不再压扁；手机上旋转钮可点；0°/90° 旋转吸附，设置里可关，按 Alt 临时关 |
| `c83e0cb1` `deb1b13c` | 小人舞台「原曲成员」按原曲站位排列（表 46 字段 30–34 的顺序，13 首有）；其余 48 首注明「原曲站位未收录」 |
| `2c506439` | 小人舞台纯净模式：控制收进顶部一条，指针在舞台上时隐藏，移到顶端出现（截图 / 全屏 / 显示控制 H）；触屏只留半透明「显示控制」 |
| `bbd901f9` | 修 `verify-photo-catalog-navigation`（跟上「场景并入地点」和原生缩略图，已做变异测试） |
| `54b63e1f` | `verify:idol-page`（CI 里跑的）被 `c83e0cb1` 的站位字段弄红了；现在把站位当附加元数据排除，原哈希不变，打乱成员顺序仍会失败 |
| `debfd891` | `useArchiveNamedText.js` / `useReaderTitles.js` 的 JSON 导入补 `with {type:'json'}`（Node 24 不带就拒绝加载，Vite 不在意） |

---

## 1. 需要用户决定或执行的对外动作

本窗口**没有**做任何上传或部署。以下内容在线上还看不到：

1. **签名图上 R2**：`public/assets/idols/signs/` 49 张（git 忽略）。线上担当头图的签名要等它。
2. **重建并发布 read-model**：
   - `music_catalog` / `song_catalog` 新增了站位字段；
   - `background_variants.json` 是首页背景分类用的；
   - 上一份交接遗留的「电话」标签也还没上线。
3. 以上完成后重新部署测试页。上传用 rclone，**先清代理环境变量**。

---

## 2. 新审计：本轮还没碰过的工程债

### 2.1 CI 覆盖：近一半检查脚本从没在 CI 里跑过

- `scripts/` 下有 371 个 `verify-*`，CI（`.github/workflows/web-viewer-source-gate.yml`，含 npm 脚本的嵌套展开）只跑了其中 214 个。**157 个从不进 CI**，其中 131 个是 Node 脚本（不含 http/browser 类）。
- 本窗口新增和改过的检查**全都不在 CI 里**：
  - `verify-studio-gestures` `verify-studio-background-swap` `verify-studio-canvas-aspect`
  - `verify-design-tokens` `verify-preview-transform` `verify-idol-stage-light` `verify-chibi-panel-presentation`
  - `generate-background-variants --check`
- 本地逐个跑这 131 个（每个 90 秒上限，跑完工作区无变化）：**110 个通过，20 个失败，1 个超时**（`verify-preview-assets`，要扫整个语料）。

20 个失败按原因分类：

| 原因 | 脚本 | 处理建议 |
|---|---|---|
| 需要传 read-model 根目录 | `verify-portal-bento` `verify-portal-directory-navigation` `verify-portal-projections` | 拿旧候选目录跑时，前两个因哈希/计数不符失败。要用**当前**输入重建 read-model 后再判定，现在还不能算回归 |
| 断言写死了 App.vue 源码片段，App.vue 改过后就失效 | `verify-archive-loading-copy` `verify-idol-communication-readiness` `verify-idol-navigation-ux` `verify-song-domain-landing` `verify-song-playback-audio` | 改成测行为（沙盒执行或测抽出的纯函数），别再匹配源码文本。这类正是 App.vue 拆分时会全部失效的检查 |
| 脚本自身有错 | `verify-event-view-consumer`（`navigation is not defined`） | 修脚本 |
| 依赖白名单过时（组件多了新 import） | `verify-event-catalog-navigation`（`ArchiveFilterSheet.vue`）、`verify-song-lyrics-presentation`（`ArchiveErrorNote.vue`）、`verify-card-costume-presentation`（`AttributeLabel.js`） | 按 `bbd901f9` 的做法：把真实模块喂进沙盒，不写镜像桩 |
| 写死的数据哈希过时 | `verify-extra-story-visuals` `verify-ipad-collection-repair` `verify-song-timelines` `verify-translation-strict-v2` | 先确认数据变化是有意的，再更新哈希；更好的做法是改成从生成器 `--check` 校验 |
| 需要语料或 schema 数据 | `verify-episode-artifacts` `verify-local-story-strict-schema` `verify-terminal-idol-localization` | 只能本地跑；在脚本开头写明并在缺语料时明确跳过 |

建议：

- 把 110 个通过的里面**不依赖语料**的那部分接进 CI。判定方法：在没有 `public/assets` 的干净检出里跑一遍。
- 剩下的按上表逐类修。这比拆 App.vue 优先，因为拆分需要这些检查兜底。

### 2.2 运行时边界（Archive Product → GS Player Presentation → Story Runtime Kernel）

目前实际的越界依赖：

- `src/core/StoryViewer.vue` 直接 import：
  - `components/archive/ArchiveLanguageSwitch.vue`（资料馆 UI 组件）；
  - `presentation/idolEpisodeLabel.js`、`presentation/PlayerLanguageStatus.js`。
- `src/core/useEpisodeQueue.js` import `presentation/idolEpisodeLabel.js`。

`src/core` 理应是播放器内核，现在却依赖资料馆的展示层。

第一刀建议：

1. 语言开关改为由宿主通过 slot 或 prop 注入，内核不认识资料馆组件。
2. 剧集标签改为宿主传入格式化函数。
3. 加一个 `verify-core-boundary`：`src/core/**` 不得 import `components/archive/**` 和 `presentation/**`。先加检查、豁免这三处，再逐个去掉豁免。

### 2.3 App.vue 编排（先不拆）

- 规模：5158 行，218 个顶层函数，179 个 `ref`/`computed`，18 个 `watch`，模板里挂了 42 种视图组件。
- 外部审计意见是**先不拆**，同意：§2.1 里有 5 个检查是匹配 App.vue 源码文本的，现在拆会让它们同时失效，等于没有护栏。
- 拆之前的准备：
  1. 先把这些文本匹配检查改成行为检查；
  2. 再按视图族抽 composable，顺序建议：歌曲/舞台 → 摄影 → 故事 → 门户。小人舞台的 `stagePerformanceMapping` / `stageOriginalSlotOrdered` 是本轮新加的，已经集中在一处，可以作为第一个抽出对象。
- 规则仍然有效：App.vue 只用 Read / Grep / Edit 改；新代码别插进 `archiveStats`…`idolPickerLabel` 那段（`verify-archive-home` 会沙盒执行）。

### 2.4 样式令牌

`verify-design-tokens` 当前计数：292 处写死字号（71 处小于 12px）、978 个十六进制颜色、225 处写死圆角、55 个不在档位上的断点。本轮没有新增。

十六进制颜色最多的文件：

| 文件 | 个数 |
|---|---|
| `styles/picture-studio.css` | 77 |
| `ArchiveEventDetail.vue` | 57 |
| `ArchiveIdolStory.vue` | 56 |
| `styles/archive-domains.css` | 51 |
| `ArchivePortalOverview.vue` | 50 |
| `ArchiveStoryDetail.vue` | 43 |
| `ArchiveStatus.vue` | 42 |
| `ChibiStageViewer.vue` | 36 |

建议顺带清，不单独开大改：改到哪个文件就清哪个文件，改完 `verify-design-tokens --update`。

`ArchivePortalOverview.vue` 和 `portal-bento.css` 里有三四层互相覆盖的历史规则（同一选择器在不同 `@container` 里重复定义）。本轮的手机和桌面新规则都放在 `portal-bento.css` 末尾才压得住。下次动门户时值得把旧层删掉重排。删之前用 `?view=portal` 在 390 / 820 / 1000 / 1280 四个宽度截图对比。

### 2.5 其他零散项

- **首页背景名称**：部分背景只有编号没有地点名，是数据缺口，不是前端问题。
- **工具页体量**：工具首屏请求或部署图片一变，就要重测 `ArchiveExperiments.vue` 里的三个数字。测量方法见记忆「Tool load measurement」：用 `node:https` 数原始字节，fetch 会自动解压，量出来偏大。
- **小人舞台全屏和纯净模式**：现在是两个独立开关（F / H）。全屏不隐藏界面，纯净模式不进全屏。用户如果想要「全屏即沉浸」，可以让 F 同时进入纯净模式。这是产品决定，没改。
- **`idolVisualFocus.json`**：由 `scripts/generate-idol-visual-focus.py` 生成，要语料，只能本地 `--check`。新增立绘后要重跑，否则新人物按 0.5 居中。

---

## 3. 建议顺序

1. 对外动作（§1），由用户决定时机。
2. 先让 CI 门变绿（§5.1 的 4 个），再做 CI 覆盖（§2.1）：接入不依赖语料的通过项，按表修复其余失败。
3. 内核边界检查加上并去掉三处豁免（§2.2）。
4. 把 App.vue 文本匹配检查改为行为检查，然后按视图族拆分（§2.3）。
5. 令牌债随改随清（§2.4）。

---

## 4. 工作方式（本轮新踩的坑）

- **不要直接 `npx vite build` / `npm run build`**：会把约 8 GB 的 public 语料拷进 `dist/`。本窗口犯过一次，已删除。编译检查只用 `npm run build:check`（见 `web_viewer/AGENTS.md`）。
- **5175 看不到新放进 public 的文件**：Vite 启动时索引 public，缺文件时返回 HTML 200，看起来像加载成功。要验证新文件，另起临时服务器：`SIDEM_READMODEL_CANDIDATE=<候选目录> node node_modules/vite/bin/vite.js --configLoader native --port 5177 --strictPort`，用完关掉。5175 别动。
- **重新生成 `music_catalog`** 后必须跑 `python web_viewer/scripts/normalize-music-performance-selectors.py`，否则会多出一大片无关差异。
- **Git Bash 会改写以 `/` 开头的参数**（`/assets/...` 会变成 Windows 路径）：传这类参数时加 `MSYS_NO_PATHCONV=1`。
- **从 Python 调 `bash`** 在这台机器上会调到 WSL：要写 Git Bash 的完整路径 `C:\Program Files\Git\usr\bin\bash.exe`。
- **门户截图**用 `/?view=portal`。担当视图的偏好写 `{"preferredIdol":"005kao","portalDefaultScope":"favorite"}`。
- **`portal-bento.css` 的层叠**：新规则放文件末尾，选择器要和旧规则同等具体（比如带 `.is-global-grid`），否则会被旧的 `@container` 规则盖掉。
- **令牌规则**：`--gs-ink` 只能用于文字；深色遮罩用 `color-mix(in srgb, var(--gs-chrome) 82%, transparent)`。检查结果别接 `| tail` 再提交，会把失败退出码吞掉。

---

## 5. CI 门与基线

### 5.1 CI 门本地结果（2026-10-07，HEAD `54b63e1f`）

按 workflow 的 113 个步骤逐个本地跑：**108 个通过，5 个失败**。

- 其中 `verify:idol-page` 是本轮 `c83e0cb1` 弄红的，已在 `54b63e1f` 修好。
- 剩下 4 个都在上一份交接的基线名单里：

```
python scripts/verify-chibi-costume-shader.py && node scripts/verify-chibi-foot-lighting.mjs
npm run verify:archive-startup-route
npm run verify:archive-baseline:source-only      （tracked_binaries / images drifted）
npm run verify:external-story-resources && npm run verify:external-story-resource-ui
```

也就是说远端的 CI 门本来就是红的，这 4 个应排进 §3 第 2 步。

复跑方法：

- 从 workflow 抽出每个 `run:`，交给 Git Bash 逐个执行：`C:\Program Files\Git\usr\bin\bash.exe -c "<命令>"`，工作目录 `web_viewer`。不要用裸 `bash`，那会调到 WSL。
- 跑完对比一次 `git status`：某一步会在 `web_viewer/` 留下一个名为 `-` 的空文件，删掉即可。

### 5.2 全量基线

上一份交接的 38 个全量失败里，`verify-photo-catalog-navigation` 已修。其余仍在，且都属于 §2.1 表里的那几类。只有不在名单里的新失败才算回归。
