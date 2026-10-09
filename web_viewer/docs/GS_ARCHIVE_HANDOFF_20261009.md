# GS Archive 交接 2026-10-09

上一窗口（10-08 至 10-09）的工作截止提交 `7b6dccde`，全部未推送。本文按优先级列出待办，每条写明现状、要做什么、验收办法。工作方式与坑见末节。

---

## 0. 上一窗口完成了什么（只作背景，勿重做）

| 主题 | 提交 | 要点 |
|---|---|---|
| 个人故事 / 生日章节 | 08156cf6 … d6418783 | 阅读器 EP 标签只进 manifest；生日两文件合成一话；small talk 范围标签 |
| UI 令牌债 | 454b6a9d、31876817、5a249b0f | 十六进制颜色 879 → 456；活动页剧情区改为故事家族版式 |
| 门户重排 | 5b7afac8 | 两份互相覆盖的样式合并为一份（portal-bento.css 已删）；手机全部栏目网格；担当区五入口用担当色 |
| 偶像主页三按钮 | 0400c47c | 名字即「查看资料」；返回是名字上方小链接；制作人设置收进场景设置面板首项 |
| 阅读器 | a4d41a62 | 行=阅读、图标=播放；电脑端活动整章连续阅读；手机每 EP 末尾「继续阅读」 |
| 称号 | 85b92f99 … 2249a9fc | 偶像页称号牌三组（羁绊 / FES / 活动排名）；称号页「所属偶像」反链；FES 标题可读化 |
| 活动出演 / 相关活动 | 6801819d、7b6dccde | 出演统一小头像；偶像页、卡面页相关活动显示横幅 |

预览：`SIDEM_READMODEL_CANDIDATE=/e/Web_build/GS_Archive_Domain_Work/idol-honors-readmodels-20261008d node node_modules/vite/bin/vite.js --configLoader native --host 127.0.0.1 --port 5177 --strictPort`（候选包从 `85b92f99` 构建；之后的提交只改页面，不需要重建即可预览）。

---

## 1. 巧克力称号补进偶像页（数据已查清，直接做）

**现状**：偶像页「活动排名」只有排名称号（`idol-ranking` 来源，每人 8 个）。每位偶像另有 10 个「VDCP の◯◯の渡したチョコ数 N 個達成」称号（HonorType 3），没有 entity_sources 记录，所以没被关联。

**编号规律（已用渡辺みのり验证，需全量核对）**：
- 2022：`30024001 + (偶像序号 − 1) × 5 + 档位`，档位 0–4 = 100 / 500 / 1000 / 5000 / 8000 个。
- 2023：同式，基数 `30024246`（= 30024001 + 49 × 5）。
- 例：渡辺みのり 序号 11 → 2022 为 30024051–055，2023 为 30024296–300。

**要做**：
1. 在 `src/presentation/HonorIdentity.mjs` 增加 `chocolateHonorIdentity(entry)` → `{ idolNumber, year, count }`。只对上述两段区间内、`honorType===3` 的条目生效。
2. 新增或扩展检查（可并入 `scripts/verify-idol-honor-identity.mjs`）：全部 490 个条目逐一解码，且名字里的偶像名（去空格）与解码出的偶像一致，名字里的数量与档位一致。名字里偶像名带空格（`渡辺 みのり`）。必须做反向验证（把规则改错，确认检查报错）。
3. `readmodels/lib/domain_expansion.mjs` 的 `idol.view.honors`：把巧克力称号以 `group:'ranking'`（或新 group `chocolate`）加入，带 `sources` 等价信息（年份 / 数量），并更新 `readmodels/tests/domain_expansion.test.mjs` 的计数（排名 8 → 8 + 10）。
4. 偶像页 `ArchiveIdolDetail.vue` 的 `honorGroups`：同一届活动下分两行，名次一行、巧克力一行（五块称号牌）；称号牌本身印有数量，不写说明文字，数量留在 aria-label。
5. 投影改动需要提交后重建 read-model 才能在预览里看到（见 §6）。

---

## 2. 语言收口：`<html lang>` 与页面标题（外部建议，已核实）

**现状（已核实）**：
- `index.html` 第 2 行 `<html lang="ja">`，第 7 行 `<title>SideM Story Viewer</title>`。
- 程序内部默认早已是中文：`uiLocale = 'zh-CN'`（`src/localization/ui/UiLocaleStore.js`），剧情默认译文。
- 全仓库没有任何代码把 UI 语言同步到 `document.documentElement.lang`。

结果是：界面中文、剧情中文，但浏览器、读屏、翻译工具看到的文档语言是日文。

**要做（完整的约定，不只改一行）**：
1. `index.html` 改为 `<html lang="zh-CN">`，作为首屏和无 JS 时的默认值。
2. 在 `UiLocaleStore.js` 里，`uiLocale` 每次变化（含启动时从本地设置读出）都写 `document.documentElement.lang`：中文 → `zh-CN`，日文 → `ja-JP`。用 `watch(uiLocale, …, { immediate: true })` 一类写法，接在现有 store 上，不另造定时器或状态。
3. 只按 UI 语言同步，不按剧情显示模式（原文、译文、双语）。正文里日文段落已经各自带 `lang="ja"`，这一点要保留。
4. 页面标题：不再叫 Story Viewer。建议 `GS Archive · SideM GROWING STARS 资料馆`，日文 UI 下可以不翻译（品牌名）。如果各视图已经有动态标题，检查它们的后缀统一。
5. 检查：新增一个小 verifier，断言 index.html 的 lang 为 `zh-CN`；切换 UI 语言后 `document.documentElement.lang` 跟随变化（可用 jsdom 风格的假 document 或现有 harness）。做反向验证。

---

## 3. 活动页、卡池页的道具与物品页联动

**现状**：
- 活动详情 `ArchiveEventDetail.vue` 的「活动兑换道具 / 奖励明细」：材料行（`event-materials`，约第 122 行）和奖励表 `open-entity` 都走 `openQuick()`，只弹出 `CollectionQuickView` 快速预览，进不了收藏 → 道具页。
- 卡池详情的「对应抽取道具」（`ArchiveGashaDetail.vue`）同样需要核对：点击后是否能到道具详情。

**要做**：
1. 快速预览保留（在活动页里看一眼很方便），但在 `CollectionQuickView` 里加「在道具页查看 ›」，跳到 `collection_catalog` 的对应条目。App 里已有 `openCollectionEntity(key)`，它会记录来源页，所以能正常返回。
2. 卡池「对应抽取道具」每行直接链接到道具详情（同一个 `openCollectionEntity`）。
3. 反方向：道具详情（`CollectionDetailPanel`）已有「对应卡池」。可以再加「出现在哪些活动」，数据来自 entity_sources 的活动链接，若已有就展示。
4. `App.vue` 由另一个会话频繁重构，改之前先 `git status src/App.vue`，确保它没有未提交改动；接线只加事件绑定，不重排。

---

## 4. 卡面类文本翻译批次（要求写给翻译窗口，本窗口不做）

**缺口**：已校对、已发布的译文只覆盖剧情。以下卡面文本从未进入翻译批次，此前只零星补过一小部分：
- 卡面台词：**普通**、**特训**（觉醒）两种状态各自的文本；
- **短文本**（卡面简介 / 一句话描述等）；
- **首页触摸语音**（偶像主页点立绘时的台词）；
- **演出**类文本（卡面相关的演出、Live 中的台词）。

**要求（比 strict v2 宽松，但不能乱）**：
1. **按卡、按偶像分批**：同一偶像的卡放在同一批，方便统一口吻。不需要 strict v2 那套逐行回执、分支审计；文本和人物是一一对应的，主要风险是称呼和口吻不一致。
2. **沿用已校对的称呼基准**：以 B001 为准（见记忆「Translation honorific preference」）。制作人称呼按偶像固定（「プロデューサーさん」与「P さん」等不要混用）；「さん」不随意删除（B002 的做法属于激进处理，已回滚）。
3. **保留 ●●●● 占位**：制作人名占位原样保留，由 `ProducerAddressingText` 替换。
4. **字节和来源绑定**：每条译文绑定原文与资源键（卡片 resource_id + 文本种类 + 序号）。原文变化时译文自动失效，不能静默套用。参照现有 `public/data/editorial/honor-bonds.json` 和卡片元数据草稿的做法（`sourceName` + `resourceId` 双重校验）。
5. **状态分级**：草稿（AI）/ 已校对。页面上草稿可以显示，但要能区分；可在翻译审计里单独列一组「卡面文本」。
6. **先盘点再翻**：先出一份清单，按种类统计条数和已有译文的覆盖率，标出之前零星补过的条目，确认没有遗漏的种类（比如还有没有生日、换装专属台词），再开批次。
7. 发布流程沿用剧情草稿发布后的步骤：重生成 titles、manifest、翻译审计、搜索本地化（见记忆）。

**同一波还要带上：拆分后的 10 篇生日 small talk（10-09 拆分，未翻译）**
`1_2_001_12_a/b/c`、`1_2_007_12_a/b`、`1_2_016_12_a/b/c`、`1_2_025_12_a/b`，共 59 行（含每篇的标题和简介）。它们走剧情的 Studio 批次流程（不是卡面文本流程），按用户决定与卡面文本放在同一波开工。原合并文档的草稿译文（B012 1 篇、B017 3 篇，共 59 条）已退役、未迁移，记录在 `translation/studio/retirements/2026-10-09-birthday-small-talk-split.json`；旧译文可作参考，但不能直接套用（换行和键名都变了）。

---

## 5. 其他未结项（上一窗口提到、未做）

| 项 | 说明 | 建议 |
|---|---|---|
| 组合页相关活动横幅 | `ArchiveUnitDetail` 的活动关联也用 `ArchiveRelationList`，但没有传 `imageUrl` | 照 `7b6dccde`：`imageUrl: eventBannerUrl(event)` |
| 4 个合并的生日 small talk | **10-09 已拆**：按其余 25 章的方式从 `_a/_b(/_c)` 重编，聚合文件 + `episodes/`，阅读文档 4 → 10 篇。旧草稿译文退役，新文档进入下一波翻译（见 §4） | 已完成 |
| 门户数据的生日立绘字段 | 界面已删除生日立绘切换；`ArchivePortalPresentation.js` 仍输出 `birthdayPortrait`，它参与 read-model 构建 | 下次重建 read-model 时一起删除，并删除相关断言 |
| `verify-portal-bento` | 候选包从旧提交构建，卡片属性数据的哈希对不上 | 正式重建 read-model 后再跑；不是代码问题 |
| 提交 `9507ec74` | 另一会话的翻译草稿提交，误带入了本窗口提前暂存的「删除 portal-bento.css」，单独检出这个提交时构建会失败；HEAD 正常 | 是否处理由用户决定；不要改写已有历史 |
| 令牌债剩余 | 颜色 456、字号 279、圆角 192、断点 51；深色横幅组件（状态页、偶像切换器、歌曲长预览）需要手工处理 | 随改随清，`verify-design-tokens --update` |

---

## 6. 发布前必须做

1. 推送前确认 `npm run build:check`、`verify:source-batch`（含新登记的 `verify-idol-honor-identity`）通过。
2. **重建 read-model**：称号（`85b92f99`）与将来的巧克力称号改动都在投影层，线上要重建才会生效：
   `node readmodels/tools/build_readmodels.mjs --repo /e/Web_build/SideM_Archived --out <dir> --data-revision 98825488c36c677bc849c6e02fcb1439dfb383bd89f26197233b5e36d7864aa4 --media-epoch voice64-gzip-all-20260924`，然后 `verify_artifacts.mjs`。
3. 发布与 release binding 按 `GS_ARCHIVE_RELEASE_CHECKLIST_20261007.md`，时机由用户决定。

---

## 7. 工作方式与坑

- **只用 `npm run build:check`**，不要直接 `vite build`（会把 8 GB 语料拷进 dist）。
- **另一个会话共用同一个检出和暂存区**：`git add` / `git rm` 只能和自己的 `git commit` 写在同一条命令里；提交前看 `git diff --cached --stat`。删除文件先用普通 `rm`。
- **检查与提交不要用分号串联**：上一窗口有一次检查失败后，提交仍然执行了（`acc473fe`，后由 `6801819d` 修正）。用 `&&`，或先看结果再提交。
- **Windows 文件锁**：写文件偶尔报 `OSError 22` 或 `EBUSY`，是另一个进程正在读写，重试即可（脚本里加 1.5 秒重试）。`build:check` 偶发失败、报 `translations/manifest.json` 打不开，也是另一个会话正在写翻译，重跑即可。
- **新 verifier 必须登记**到 `config/verifier-coverage.json`（批次或 localOnly），并做反向验证。
- **截图验收**：`scratchpad/shot.mjs`（CDP + 缓存 Chromium）。需要先用 `PREFS` 环境变量写入本地设置，跳过引导窗（`onboardingComplete:true`）。电脑、手机两种宽度都要截。
- **设计规范**：`docs/GS_UI_CONSTITUTION.md`。内容排在纸面上、不做盒中盒、用角色令牌、视口只用三档断点（760 / 1100）、组件内部用容器查询。外部工具建议的「卡片外框」「彩色胶囊」因此不采纳。
