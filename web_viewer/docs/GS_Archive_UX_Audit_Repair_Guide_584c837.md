# UX 审计修复验收更新（2026-10-02）

## 最新：中日资料切换、校对批次与当前审计

最新测试页：[fc8c1bb0 · 当前审计](https://fc8c1bb0.gs-archive-preview.pages.dev/?view=archive_status)，代码 `c6e4ec35`，已推送。线上资源状态已验；此前同批测试页完成剧情统计和日文道具/中文搜索，最终补修 Player 按钮可访问名称并完成实际菜单切换验收。只更新测试分支，早先地址与结论保留为历史证据。

保持高密道具网格，补两行名称及 SP/DX/稀有度/次数角标；全馆接入同一资料语言开关，Reader 标题跟随，剧情正文模式独立。通用翻译导出 60 个 Gemini 校对批次，原文/哈希/来源绑定，回传导入为草稿，确切人工批准才提升 reviewed。资源页展示分域翻译进度、日中对照、缺译与校对清单；初译不能当作已校对。

当前目录和素材审计已取代 7 月顶栏结论：每次构建前自动重算，旧覆盖/可播放“通过”收进折叠历史。当前 58,222 本地文件、248 谱面源文件完整；R2 独立核对为 7,410,544,554 B，本轮媒体新增 0。全馆统计明确排除未挂载 RAW、图片文字、歌词和需上下文细翻的首页对话。390px 和 320px 可见交互已验，真机边界不变。[本轮完整记录](GS_ARCHIVE_LOCALE_TRANSLATION_AUDIT_20261002.md)及[Gemini 校对操作](GS_ARCHIVE_GENERAL_TRANSLATION_WORKFLOW.md)。下文为先前批次证据。

## 2026-10-02 后续：iPad 音频 / 长轨 / 藏品修复

最新用户指令允许继续修复乐曲与谱面，覆盖此前冻结。代码提交 7c874511：五槽和 Solo 使用播放类音频会话、恢复 interrupted，并在舞台动作等待前解锁；303 线上音轨链路通过，六条完整 hash 一致。新测试页 Browser 五槽与 Solo 均有非零音频信号，但真实 iPad 扬声器与静音/后台切换仍待真机复测。

长轨保留完整滚动长度，按视口分段绘制；手动滚动暂停自动跟随，避免回跳。244 谱面 / 66,666 音符覆盖通过，整图 SVG/PNG 实际导出完整。尾奏判定线限制在谱面终点，保留音频尾奏时间。

藏品页取消常驻详情栏，紧凑道具网格、称号双列/手机单列，新增用途/属性及偶像/组合筛选。ID 收入“原始资料”，列表显示已知来源和 98 个羁绊等级，其他保持来源未知；未照抄外部建议中没有证据的解锁条件。

新测试页：[打开测试页](https://ad42c762.gs-archive-preview.pages.dev)。桶容量 7,410,544,554 B，本次 R2 新增为 0；没有生产发布。[完整修复与验收证据](GS_ARCHIVE_IPAD_COLLECTION_REPAIR_20261002.md)。下文先前批次的构建、部署及冻结描述为历史记录。


本更新以 `35d551dd` 为本批输入 HEAD，覆盖后续用户调整。下附 584c837 指导原文是历史参考；与最新用户要求冲突时，以本更新为准。

## 当前结论

| 指导项 | 当前实现和证据 | 状态 |
| --- | --- | --- |
| P0-A 普通流程开发语言 | Reader 入口为「播放完整剧情」；摄影动作/表情有源码标记对应中文键和可视缩略图；普通摄影目录隐藏资源键，展开来源保留。歌曲已于前批收纳并完成验收。 | 已修复；Chibi 衣装编号清理按用户音乐冻结范围保留待办 |
| P0-B 日期和 stamina | 使用源数据 sentinelCandidate；道具说明安全展示体力图标和中文描述，未知 token 不猜。实测截图 41。 | 已验收 |
| P0-C 首页与资料馆身份 | 手机底栏为首页/资料馆；首次启动显式选择页面、偶像和 P 名字，保存偏好后刷新不重复引导；P 名字复用 Reader 的替换逻辑。 | 已验收 |
| P1-A Reader → Player | 仅在播放交接时把 Reader 的日/中/双模式写入 PlayerPreferencesRepository；不让 Reader 切语言 tab 改全局。真实中文、双语、日文三次交接均通过。缺译文电话显示「中文 · 本段原文」或「中*」。 | 已验收 |
| P1-B 摄影方向和退出 | 竖屏默认不自动 CSS 旋转；全屏为显式动作；图层删除、恢复、锁定、隐藏、重排、缩放/旋转/吸附及保存链路见摄影批记录。 | 已验收；浏览器不替代真机方向锁 |
| P1-C 页面切换反馈 | 保留数据预备与导航 supersession；增加组件加载待机覆盖，延续到 nextTick；pending 位于内容中心，有轻背景，保留 140ms 延迟。门户→活动实际有加载状态和完整页面。 | 源码/相关回归及普通 Browser 导航通过；未完成清缓存性能测量 |
| P1-D 手机选择确认 | 固定空间的列表独立滚动，确认栏始终可见；390×844 搜索 C.FIRST、选择锐心后仍等待点击「打开通信档案」，点击后进入锐心通信页。 | 已验收，不再叠加第二套 sticky |
| P1-E 320px 语言入口 | 语言不再随 compact 隐藏；小屏显示日/中/双和缺译文星标，完整说明在 aria-label/title。进度在第二行，返回、语言、菜单互不遮挡。 | 320×740 实际验收 |
| P2 卡片全部偶像 | 选项与 App 空字符串校验同步修复；390×844 单人→全部、中文/原文搜索和打开详情均通过。 | 已验收 |
| P2 门户工具按钮 | 首页、壁纸、设置有常驻短文字和可访问说明。 | 已验收 |
| P2 共用标签漏接 | 壁纸选择器和门户署名接入同一卡名分片；首页背景名及差分按精确字段翻译后组合，中文/原文搜索均可用。 | 桌面、390×844、选择及刷新恢复已验收；未知原键保持原值 |

用户明确要求移除人物首页的「打开资料馆」文字 CTA，本轮遵从。下附原指导的新增 CTA 建议已被用户覆盖，不得重新加回。启动时有明确选择页，普通首页仍通过既有电脑导航和手机底栏进入资料馆。

## 本批测试

`npm run build:check`：2697 modules，10.96s，入口 gzip 约 130.22 kB；不复制 public。生产 bundle 在 5213，绑定当前本地 public 与 `song-gameplay-readmodels-20261001` 的 release `17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907`。

通过：archive-routes、portal-navigation、story-localization-runtime、archive-async-navigation、reading-navigation、archive-navigation-state、event-readmodel-navigation、archive-startup-preferences、story-presentation、archive-general-texts。语言回归同时验证缺译文/失效 source_hash 保持原文，以及语言交接不覆盖 P 名字、自动播放和音量。

更新两个已过期路由断言：活动详情返回活动目录，活动域 section 为 events；门户当前已有 12 个正式入口，不再断言旧的 8 个。真实路由和分类未为满足旧断言而回退。

扩大运行 `verify-story-player-ui-pr2.mjs` 时仍遇到既有失败：第 93 行期望没有 RAW group-thread 证据的 unit-coded speaker 使用 Jupiter 主题，而当前已提交通信投影把无群聊证据的个人通信主题设为 null。继续核对还发现旧的电话背景 CSS source assertion 不匹配。该脚本未记为通过，也未更改通信分类或美术适配来迎合旧断言；需单独核对该历史验证脚本与现在的 RAW thread 合同。当前批的语言交接和缺译文实测已通过。

截图 `.analysis/ux-productization-20261001/55`～`59`：桌面 Reader→Player 中文、320px 语言入口、390px 缺译文电话、手机确认栏、门户文字按钮。未建立 clean-cache 环境，未报告 FCP/LCP 性能；没有声称本地 Browser 是真机或线上发布验收。

## 资源与上线边界

2026-10-02 实时 R2 清单：98917 对象，6633752018 B，含现存旧对象；清单保存在 `.analysis/archive-general-localization/r2-live-inventory.json`。这只是当前值，尚不是新增资源后总量。新增图片必须使用既有 lossless WebP + 透明像素 RGB 清理，不改逻辑 PNG 请求路径。全部新增、覆盖差额与版本化数据计入后，实际预计桶大小必须严格 `< 8600000000 B`，才能按用户授权上传及部署测试页。不能用旧 manifest 大小代替实时清单，不能删旧对象以获得未经批准的空间。

本轮 R2 上传与 Pages 测试部署已完成，最终回执见下方。音乐/谱面源码按用户最新要求冻结。

## 后续补验与打包

`271e5dd1` 补齐壁纸中文署名和搜索；`523efe3a` 补齐首页背景差分。来源索引新增 39 个差分，共 5584 条草稿绑定；中文「电器街」和原文「電気街」均匹配昼/夕场景，390px 无横向溢出，选择傍晚后刷新仍保持相同 id。测试后恢复原背景偏好。截图 61～65。

已对 2511 个原始 PNG 的 WebP 结果逐项核验原尺寸及 RGBA，可见像素一致，部分透明像素保留；883 个壁纸衍生图通过无损格式检查。原始图片未覆盖。目标桶实际旧量 6633752018 B，本批净新增 776792536 B，上传前两次实时容量检查均通过。北京时间 03:56:56 上传完成，实际桶总量 **7410544554 B**，严格小于 8600000000 B。没有 sync/delete，旧对象仍计入总量。

固定测试分支的代码包以 `e0999ef1` 为来源：10306 文件、121066841 B，包含代码/readmodel、112 个跟踪的翻译 JSON、637 份既有工作文本回填；无全库媒体复制。最终 build-check 为 2697 modules / 11.59 s，sourceDirty=false。更多专名疑义、原名保留依据及来源边界见 `GS_ARCHIVE_METADATA_COMPLETE_20261002.md`；资源批次核算见 `GS_ARCHIVE_PRODUCTIZATION_RELEASE_20261002.md`。

## 线上测试结果

测试页：[275e46ff 固定版本](https://275e46ff.gs-archive-preview.pages.dev)，来源 `e0999ef1`，分支 `gs-architecture-device-test`。未部署 Production。

HTTP 字节、无损 WebP 类型、ETag/304、版本化 JSON/HEAD、gzip 解压来源 hash/406、语音 Range/206/416、翻译 JSON、404/405 全部通过。语音比较基准已改为此前部署的 voice64 实际文件和 hash，本轮没有改动语音。上传与 HTTP 回执保存在 `.deploy/productization-assets-lossless-20261002`。

真实 Browser：首次引导设置 windmet；随后再次打开根入口、刷新直接进入门户，名字保留。手机 390×844 中文/原文壁纸搜索均找到同两张卡面，实际缩略图可见、无横向溢出；选择后桌面刷新保留壁纸与中文署名。摄影中文地点→工作台，默认冬马删除与撤销、锁定和隐藏均生效，恢复后立绘及背景完整可见；动作秒、表情秒、语音试听均无入口，说明收纳在角落。截图 66～68 和 `online-browser-acceptance.json` 见 `.analysis/ux-productization-20261001`。

线上未捕获 error，保留一条 Spine 更新调用栈 warning。完整卡片/称号/Reader/Player 验证为前述本地 Browser 证据，不冒称已经逐页线上重复；真机方向锁、冷缓存性能、Chibi 冻结待办及历史 PR2 断言核对仍保留。98 项羁绊称号来源为用户补充，已明确担当 49 项 Lv.50、专属 49 项 Lv.100；其他未知称号继续来源未知。

---

# 历史修复指导原文

# GS Archive UX/UI 审计修复指导包

## 基线

- 分支：`codex/story-interaction-v2-before-b002`
- 本次核对 HEAD：`584c837b1d5bf5567b28bebc7b91c7df70ab1c71`
- 目标：修复黑盒审计 UX-01～UX-08；不重复重构已经完成的 Event readmodel 与 Picture Studio composition 架构。

执行前：

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
```

如果 HEAD 已更新，不要 reset；按本文语义重新定位。

## 先确认：不要重做的部分

1. Picture Studio 已经不是单人物/单贴纸 PoC。`StudioDocument.mjs` v2 有 `actors[]`、`stickers[]`，上限 6 人 / 32 贴纸，具备 x/y/scale/rotation 与数组前后层级；`StudioCompositionStage.js` 已有独立 actor/sticker instance、命中测试、拖动、缩放、旋转与分层；`useStudioComposition.js` 已支持保存/恢复/导入/导出构图。
2. Event Detail 已切换到单一 `view`：`App.vue` 传 `:view="currentEventProjection"`，`ArchiveEventDetail.vue` 消费 `view.identity / view.period / view.media`。不要恢复旧的 `event + masterEvent + supplement` 多真相源。

---

# P0-A：清理普通流程里的开发语言

## 歌曲试听

文件：`web_viewer/src/components/archive/ArchiveSongExperimentalPlayer.vue`

- `演唱试听（实验）` → `演唱试听`
- 保留“分轨试听与原游戏混音可能不同”，这是用户需要知道的资料边界。
- `实验音频尚未准备` → `当前试听资源尚未准备，暂时无法播放。`
- `请先运行实验音频准备脚本` 绝不能出现在普通用户页面，改成 `当前试听资源暂时不可用，请稍后重试。`
- `试听技术信息` 折叠项保留。

## Reader

文件：`web_viewer/src/components/archive/ArchiveStoryReader.vue`

- `播放完整剧情（实验）` → `播放完整剧情`
- 真正的资源缺失/加载失败继续通过状态和错误反馈表达，不用“实验”替代真实状态。

## 摄影动作、表情

文件：`web_viewer/src/components/archive/PictureStudio.vue`

当前 `poseName()` 把 Spine `motion + neck` 直接显示给普通用户，表情 select 显示 `face.iconResourceId`。

不要编造“开心挥手”等语义。PB 没有用户可读名称时，用中性编号：

```js
function numberedSourceLabel(rows, row, noun) {
  const sorted = [...(rows || [])].sort((a, b) =>
    (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id))
  const index = sorted.findIndex(candidate => candidate.id === row.id)
  return `${noun} ${String(Math.max(0, index) + 1).padStart(2, '0')}`
}
function poseName(view, row) {
  return numberedSourceLabel(view.actor.poses, row, '动作')
}
function faceName(view, row) {
  return numberedSourceLabel(view.actor.faces, row, '表情')
}
```

主选择器显示“动作 01 / 表情 01”；`modelId / preset.label / motion / face / neck` 继续留在已有的“预设来源” details 中。

## 摄影资料目录

文件：`web_viewer/src/components/archive/ArchivePhotoCatalog.vue`

当前列表副标题直接显示 `resourceId || iconResourceId`，详情主区显示资源名、脚本资源、脚本动作/表情/颈部动作。

改造：
- 列表副标题：`地点 · #12`、`场景 · #37`、`动作 · #...` 等。
- 普通详情保留：名称、描述、缩略/实图、初始配置、关联数量等。
- 将配置编号、resourceId、animationName、scenarioResourceId、motion/face/neck 全部移入 `ArchiveTechnicalDetails` 的“来源与技术信息”。

## Chibi 舞台服装编号

根在 producer，不要前端 regex 去尾巴。

文件：`web_viewer/scripts/prepare-live-chibi-assets.py`

当前：

```py
"label": f"{label} · {costume_id}",
```

改为：

```py
"label": label,
"sourceCostumeId": costume_id,
"sourceModelId": model_id,
```

如 source 字段无需发布，只放 diagnostics/inventory。重新生成 live-chibi manifest 并跑已有兼容性验收。

---

# P0-B：道具占位日期与 `[stamina]`

## sentinel 日期

文件：
- `web_viewer/src/components/archive/DomainPresentation.mjs`
- `web_viewer/src/components/archive/CollectionEntryDetails.vue`

数据本身已有 `termInfo.open/close.sentinelCandidate`，不要在 UI 再靠年份猜。

新增：

```js
export function historicalPeriod(entry) {
  const term = entry?.term
  const info = entry?.termInfo
  if (!term || !info) return null
  const openReal = info.open && info.open.sentinelCandidate !== true
  const closeReal = info.close && info.close.sentinelCandidate !== true
  if (!openReal && !closeReal) return null
  if (openReal && closeReal) return `${historicalDate(term.openAt)} — ${historicalDate(term.closeAt)}`
  if (openReal) return `${historicalDate(term.openAt)} 起`
  return `至 ${historicalDate(term.closeAt)}`
}
```

`CollectionEntryDetails.vue` 只有 `period` 非空才显示“历史配置期”。不要再让普通用户看到“配置占位日期 — 配置占位日期”。sentinel 原值保留在技术证据中。

## `<emoji>stamina</emoji>`

根因：`data_pipeline/sidem_masterdata/domain_common.py::text()` 把 `<emoji>stamina</emoji>` 变成 `[stamina]` 作为 `plain`。

不要在 Vue 里硬编码 replace。

先做 corpus 扫描，统计所有 Item `emojiKeys`，每个 distinct token 都必须进入 reviewed registry。然后让 `text()` 额外生成安全 parts：

```json
{"parts":[
  {"type":"text","text":"..."},
  {"type":"token","key":"stamina"}
]}
```

新增 `DomainInlineText.vue`，只渲染白名单 token；`stamina` 显示为“体力”或来源绑定的图标 + 可访问文本。禁止 `v-html`。未知 token 显示可读 fallback 并产生验证警告。

---

# P0-C：首页与资料馆身份

文件：
- `src/components/archive/ArchiveShell.vue`
- `src/components/archive/ArchiveImmersiveHome.vue`
- `src/App.vue`

1. 移动底栏 `门户` → `资料馆`。route id 仍可叫 portal。
2. 首页增加明确 CTA：`打开资料馆`，在 `ArchiveImmersiveHome` emit `open-portal`，App 接 `@open-portal="openRootPortal"`。
3. 可加一次性提示：`这里是互动首页；故事、歌曲、卡片、活动等资料可在「资料馆」中浏览。` 若可关闭，用 sessionStorage，不要为此升级用户偏好 schema。
4. Portal 顶部 icon-only 的首页/壁纸/设置属于 P2；正常移动宽度建议增加可见短文字，不能只依赖 title。

---

# P1-A：Reader → Player 语言状态

## 1. 播放入口继承 Reader 模式

根因：Reader 用 route-local `readingMode`；Player 用持久化 `storyLanguagePreferences`。`updateReadingMode()` 只改 Reader，`openReaderPlayback()` 没有桥接。

在 `App.vue::openReaderPlayback()` 调 `playbackController.load()` 前：

```js
function playbackPreferencesForReadingMode(mode) {
  return {
    story_content_mode: mode === 'translation' ? 'translation'
      : mode === 'bilingual' ? 'bilingual' : 'original',
    bilingual_primary: mode === 'translation' ? 'translation' : 'original',
  }
}
```

用现有 `PlayerPreferencesRepository` 保存 patch，再 `setStoryLanguagePreferences(saved)`。

不要让 Reader 每次切 tab 都强制改全局 Player 偏好；“从 Reader 点击播放”才是语义交接点。

## 2. “中文”不能掩盖当前行 fallback 为日文

`StoryTextResolver.js` 已经给出：

```js
view.translation.available
view.translation.fallbackUsed
```

缺的是展示。

`StoryViewer.vue` 保留 localization 实例：

```js
const storyLocalization = createStoryLocalization(...)
provideStoryLocalization(storyLocalization)
```

对当前 dialogue 计算 fallback；传给 `PlayerTopBar`。

建议显示：
- 正常译文：`中文`
- 中文模式但本段无可用译文：`中文 · 本段原文`
- compact：`中*`，aria-label=`中文模式，本段暂无可用译文，当前显示原文`

电话和聊天继续用同一个 localization context，禁止另写一套判断。

---

# P1-B：摄影自动旋转 / 退出语义

文件：
- `src/components/archive/PictureStudio.vue`
- `src/styles/picture-studio.css`
- 复用 `src/composables/usePlayerImmersiveMode.js`

当前根因：

```js
const focused = ref(compact.value)
const rotated = computed(() => focused.value && portrait.value && compact.value)
```

且 resize 时在用户未做选择的情况下再次 `focused = compact`；CSS `.studio-page.is-rotated` 将整页 rotate(90deg)。

修复：

```diff
- const focused = ref(compact.value)
+ const focused = ref(false)
```

删除 resize 自动进入 focus。竖屏默认保持正常竖屏编辑。

进入 focus 时给显式选择：
- `横屏全屏编辑`
- `继续竖屏编辑`

优先用现有 `usePlayerImmersiveMode()` 的 fullscreen + orientation lock。orientation lock 不可用时保持竖屏可用并提示用户自行旋转；不要强制 CSS 旋转整个 DOM。

文案：
- `全屏工作台` → `进入全屏`
- `退出工作台` → `退出全屏`（它实际只退出 focused/fullscreen）

真正离开摄影页仍用资料馆返回动作。

若保留 CSS rotation 作为兼容 fallback，只能由用户显式选择，不能自动触发。

---

# P1-C：页面切换空白

已有架构不要推翻：`prepareArchiveRoute()` 已并行加载组件+数据，`ArchiveShell` 有 pending layer。

问题是 pending 现在太弱，且部分页面有 `v-if="view === ... && presentation"`，中间可能看起来空白。

修复建议：
1. central pending 在 120~150ms 后显示，避免闪烁；
2. pending 居中在 content cell，用轻微透明面而非右下角小 badge；
3. 文案与目标匹配：`正在打开歌曲详情…` / `正在打开阅读器…`；
4. superseded navigation 不得发布旧 pending；
5. `song_detail` 已 commit 但 `currentSongPresentation` 仍空时，要么继续保留 pending/skeleton，要么禁止清 pending，不能裸空白；
6. Reader 已有正文 loading skeleton，重点补 route/component mount 前的间隙。

---

# P1-D：移动互动角色选择确认按钮

文件：
- `src/components/archive/ArchiveWelcome.vue`
- `src/styles/archive-terminal.css`

当前结构是长角色列表后才有 `.terminal-picker-actions`。

移动 `selection-only` 模式让 action bar sticky bottom：

```css
@media (max-width: 900px) {
  .selection-only .terminal-picker-actions {
    position: sticky;
    bottom: 0;
    z-index: 4;
    margin-inline: -18px;
    padding: 10px 18px max(10px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--terminal-line);
    background: rgb(255 255 255 / 96%);
    backdrop-filter: blur(10px);
  }
}
```

sticky 区明确显示 `已选：冬马` + destination-aware 主按钮 `打开通信档案`。不要自动点偶像就直接跳转，因为 picker 还复用于首页/资料/工作等目的。

---

# P1-E：320px Player 语言入口

文件：`src/components/player/PlayerTopBar.vue`

当前 `v-if="!compact"` 同时隐藏进度和语言。语言是主状态，不应该消失。

- language button 永远渲染。
- compact 使用 `日 / 中 / 双 / 中*`，完整说明放 title/aria-label。
- <=360 时先缩短/隐藏 episode badge，再压 progress；必要时 progress 第二行。不要先移除 language。
- 回退、语言、菜单始终可直接点击。

验收 390×844、320×740、短横屏。

---

# P2：卡片目录空白“偶像”筛选

文件：
- `src/components/archive/ArchiveIdolSwitcher.vue`
- `src/components/archive/ArchiveCardList.vue`
- `src/App.vue`

给 switcher 增：

```js
allowAll: Boolean,
allLabel: { type: String, default: '全部偶像' }
```

```vue
<option v-if="allowAll" value="">{{ allLabel }}</option>
```

CardList 传 `allow-all`。

App 当前 `selectCardIdol('')` 会被校验拒绝，必须改成：

```js
if (idolCode !== '' && !archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
currentCharacterId.value = idolCode
```

空字符串就是“全部”，不能自动改成第一位偶像。

---

# 验收矩阵

## 单元/合同

- sentinel 两端都是占位：普通详情不显示配置期。
- 单边真实时间：显示“起/至”。
- item corpus 所有 emoji token 都已 review；普通详情不再出现 `[stamina]`。
- Reader 译文/原文/双语三种模式进 Player 保持一致。
- translation fallback 明确反馈但不篡改原文。
- Picture Studio 390 竖屏不自动旋转；全屏需用户点击。
- 2 人 + 5 贴纸、层级、拖动、保存/恢复、PNG 1280×720 不回归。
- 320 px Player 回退/语言/菜单都存在。
- 49 人 picker 选首屏角色后无需滚到列表末尾即可确认。
- Card 全部状态明确显示“全部偶像”。
- route supersession 不留下旧 loading。

## 既有 gate

以当前 `package.json` 为准，至少：

```powershell
cd web_viewer
npm run build:check
npm run verify:build-audit
```

并运行已有相关：archive navigation/history、readmodels、story localization、Reader、Player、Picture Studio/document、live chibi、collection/domain presentation 验证。

## 黑盒

1440×900：
- 歌曲/Reader 不见普通流程“实验”。
- 道具无占位日期和 `[stamina]`。
- 摄影目录普通视图无 raw resource 名；技术折叠仍有证据。

390×844：
- 底栏：首页 / 资料馆。
- 首页能直接理解并进入资料馆。
- 通信 picker 确认按钮可见。
- Studio 不自动旋转；用户主动选全屏/横屏。
- Reader 中文进入 Player 后保持中文；若本段无译文，明确显示当前为原文 fallback。

320×740：
- Player 回退/语言/菜单都可见可点。
- 无横向溢出。

## 冷加载

本次审计没有建立清缓存冷加载条件。修完后若要验收性能，另开 clean browser profile 或明确 disable cache，记录 FCP/LCP/请求数/最大资源与 pending 反馈；不要把审计里的普通刷新截图时间当冷加载基线。

---

# 给本地 Agent 的完成定义

1. UX-01～UX-08 每项都有实际代码修复，或在更新后的 HEAD 上有“已不可复现”的证据。
2. 普通流程不再暴露开发标签、内部动作/资源名、占位日期/未替换 token。
3. 技术证据没有被删除，只移动到高级/details 区。
4. 不破坏 StudioDocument v2 / 多人物多贴纸 / Event detail 单一 view。
5. 既有回归通过；桌面、390、320 三档黑盒有截图/日志。
6. 冷加载只有真的使用 clean-cache 条件后才能标记已验证。
