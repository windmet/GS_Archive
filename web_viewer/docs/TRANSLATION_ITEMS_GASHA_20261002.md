# 物品译文回填与抽取道具关联卡池

输入 HEAD：`ff41188bb9a452bb5e0eb64ba0fba04b9ab419b5`。分支：`codex/costume-translation-20261002`。

## 译文与姓名

采用用户提供的 G-items-001～004，共 857 个独立字段（429 个名称、428 个说明），覆盖 1,070 个使用位置。状态为 `draft`、`not_final: true`；不扩展此前衣装批次的已校对确认，也不改动卡面标题等其他域。

原始来稿、有效回填稿及逐项调整位于 [returns/items-20261002](../translation/studio/general/returns/items-20261002/)。[adjustments.json](../translation/studio/general/returns/items-20261002/adjustments.json) 保留 26 处文本调整及 3 处编号格式调整：14 处姓名统一、12 处数字保护格式调整（如原文 `1年`、`2人1日`），另将 `[50]`～`[52]` 规范为三位编号。

依照 [偶像译名策略](../translation/studio/policy/idol-names.v1.json) 核对涉及的偶像，包括大河武、猫柳桐生、水岛咲、天濑冬马、阿斯兰·别西卜II世；简称说明中的“猛同款”“桐绪”同样修正。新增导入校验，以上旧写法会阻止物品译文导入。日文源身份、数字和来源哈希保持可核验。

## 卡池证据与审计

既有目录包含 61 条公告、57 条主卡池记录、336 条推定卡片关联。其名称整理包含 WikiWiki 来源，公告身份来自已有 PB 主数据；不将公告元数据等同于实际 `GashaListReply` 卡池内容。

从物品主数据及本次名称译文生成 [gasha-ticket-evidence.json](../public/data/editorial/gasha-ticket-evidence.json)：81 个独立名称、273 种抽取道具。与既有目录合并后为 82 条记录，新增 25 条“道具补录”。同名的两期 STAGE 公告解释了独立名称与记录数差异；8 种券均保留两条候选关联，按钮标明公告日期，未擅自选择一期。2 种未指明具体池名的选择券不建立抽取卡池关联。

保底稀有度、赠品和抽取次数保留在票券上；附带彩光碎片 SSR 的温泉券归入原温泉池。明确命名的印章池与普通池分开，只有一条经核对的名称别名配置。补录条目不推定开放日期、横幅或卡片范围。

页面支持卡池→票券→卡池的双向跳转、中文名称搜索和中日文切换。卡片及故事中的对应卡池标题复用同一译名。审计另计 81 个卡池名称，并保留物品批次、源哈希、关联位置和证据限制；原有通用语料统计不混入补录名称。

## 验证

通过：`verify-gasha-ticket-evidence.mjs`、`verify-gasha-catalog.mjs`、`verify-general-translation-workflow.mjs`、`verify-general-translation-markdown.mjs`、`verify-archive-general-texts.mjs`、`verify-archive-routes.mjs`、`verify-collection-readmodel-navigation.mjs`、`verify-collection-catalog-session.mjs`、`verify-archive-route-preparation.mjs`、`verify-archive-navigation-state.mjs`。票券回归核对完整生成结果、姓名拒绝规则、源哈希、273 条双向关联、STAGE 歧义、补录未知字段及既有衣装 496 字段的已校对状态。

`npm run build:check` 通过，最终编译 18.37 秒，输出复用 `.analysis/build-check`，`copyPublicDir:false`。存在既有 chunk 体积提示；没有全量素材复制或发布包验收。

真实 Browser 使用既有 `127.0.0.1:5213` 预览，桌面 1280×720、手机视口 390×844：确认 82/25 目录统计、幻影的 Masquerade 补录详情与双向跳转、语言切换、温泉赠品券归并、STAGE 两期候选、规范姓名“大河武”的名称与说明、审计名称搜索与批次追溯。验收发现候选日期误用字符串截取造成渲染错误，已按数字时间戳和东京时区修复，并增加回归断言；最终桌面/手机票券详情、两期日期与跳转均通过，没有新增控制台错误或警告。手机视口为浏览器模拟，不是实机验收。

小型证据位于 `.analysis/item-gasha-translation-20261002/`：`import-verification.json`、`build-check.log`、`gasha-ticket-desktop.png`、`gasha-ticket-mobile.png`、`gasha-stage-candidates.png`。无外部 Wiki 抓取、无部署；外部 readmodel 和既有 masterdata 原始目录不覆盖。
