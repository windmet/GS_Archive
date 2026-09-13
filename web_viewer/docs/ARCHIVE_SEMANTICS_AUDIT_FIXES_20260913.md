# Archive 语义审计修复批次

以 `codex/p1-effect-texture-deps` 的 `5f3a1e3` 为输入 HEAD。仅处理 Archive presentation、relation 语义与 route identity；不改 Reader canonical、StoryAssetPlan 或播放器调度。日常代码验证只用本工程 `.analysis/build-check` 的 `build:check`，不复制 public；无关未跟踪 `docs/sidem_title_fx_css_rebuild_v9.html` 与仓库父级 `.analysis/` 保持原状。

## 01 · Mobile 偶像/组合身份不变量

个人聊天、电话、随机模式以 idol 为权威，通过 `archive_manifest.unit_membership_by_idol` 推导 unit；组合聊天允许用户独立选择 unit。无效 unit 不再静默取第一支组合 Jupiter；未知 idol/unit 呈明确空态。入口、人物选择、模式切换和 URL 恢复统一使用同一个 resolver。没有修改 master identity、Mobile 索引或历史语料。

验证：`verify-mobile-archive-identity` 覆盖真实 49 位偶像、16 支组合、三种 idol-owned 模式、过期 unit 与 Unit 独立选择；`verify:archive-navigation-state`、`build:check` PASS。5175 本工程 Vite / Playwright Chromium（Browser 插件未提供）1280×850、390×850：旧 URL `?view=mobile_archive&idol=038tak&unit=01jup&mobile_mode=personal` 规范化为 `unit=13the`；切组合聊天显示 THE 虎牙道，选 Jupiter 后切回个人聊天再次恢复 THE 虎牙道；无页面异常或横向溢出。截图在本轮仓库外 visualizations。未做真实设备/safe-area 或 Mobile 全语料验收。

## 02 · 剧情标签呈现

新增共享 `presentIdolEpisodeLabel`，优先接受明确 kind/ordinal；没有结构时仅匹配已知的「スモールトークN」「エピソードN」，投影成 `SMALL TALK 01` / `EPISODE 01`。个人故事、生日共享关系、Mobile 历史开放条件、剧情目录/详情及 Reader 顶部/分段下拉统一消费该展示函数。未改 `idol_episode_index.json`、ReadingDocument canonical 行、翻译 identity 或技术证据中的源名称。

验证：`verify-idol-episode-label-presentation` 覆盖 491 条真实标签、未知标签原样保留和 UI 接线；`verify:reading` 校验 2800 个真实阅读样本的 hash/锚点，`build:check` PASS。5175 / Playwright Chromium 1280×850、390×850：冬马个人故事显示 `EPISODE 01–05` 与 `SMALL TALK 01`；Reader `1_1_001_01_a` 顶部显示 `EPISODE 01`；生日共享关系显示 `SMALL TALK 01、02、03`，均无页面异常或横向溢出。截图仓库外；未逐页目视全部 491 条标签。

## 03 · 卡片资源适用性与衣装关系

审计建议在生成层增补 relation kind，但现有 `card_detail_index` 已有原始卡片字段来源 `slot`：`live_*` / `story_*` 与 `home_*` 可直接区分。展示层仅将前者合并为“关联衣装”，后者仍保留在卡片技术证据；不按衣装名称过滤，也不改索引数据。资源状态仅对 SSR 展示 SSR 横图行，SR/R/N 不把“不适用”误报成“未收录”。

验证：`verify-card-detail-semantics` 覆盖 709 张非 SSR/单卡面、127 张 SSR 及全量衣装 slot；`verify:archive-presentation`、`build:check` PASS。5175 / Playwright Chromium 1280×850、390×850：`038tak_sr01` / `001tom_r01` 没有 SSR 横图行与默认衣装，`001tom_r03` 保留卡片特定衣装，`001tom_ssr01` 保留两条 SSR 横图状态及专属衣装；无页面错误或横向溢出。截图仓库外；未逐卡人工确认衣装归属和真实游戏解锁关系。

## 04 · Work 场景名称证据

生成层先取 PictureStudio 主数据的资源 ID 直连名称；直连缺失时，仅在同一背景资源族（末尾两位变体序号以外的 ID 完全一致）所有已命名变体名称一致时继承，并将 `background_name_resolution=asset-family` 与证据资源 ID 写入索引。相互冲突或全无名称的资源保持未知，绝不由画面或资源英文 ID 猜中文/日文名称。637 条工作资源中的已命名条目由 444 增至 453，仅 9 条受益；`bg033_concerthallm_in_01` 因变体名称冲突仍未知。

验证：原始解码主数据和同一 compiled corpus 重生索引，`verify-masterdata-work.py` 全量基线、`verify-work-story-index.mjs`、`build:check` PASS。该映射是有证据的展示补全，不是新的主数据事实；其余 184 条仍显示“场景名称未收录”。
