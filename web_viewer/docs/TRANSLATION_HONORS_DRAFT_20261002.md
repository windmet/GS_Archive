# 称号五批回填与脚链用词修正

输入 HEAD：`19ff4262bcf2bdaf192f3ce9e83cd7c62aeea5f2`。分支：`codex/costume-translation-20261002`。

采用用户提供的 G-honors-001～005，共 1,616 个独立字段、3,226 个使用位置。001～004 各 400 条，005 为 16 条。最初的两份 002 附件 SHA256 相同，仅导入一次；003 采用用户随后补发的完整文本。所有批次均通过身份标记、来源哈希、编号完整性、数字和占位符校验，保持 `draft`、`not_final: true`。

依据 [偶像译名策略](../translation/studio/policy/idol-names.v1.json) 核对五批姓名，修正 95 处写法，包括大河猛→大河武、猫柳桐男→猫柳桐生、水嶋咲→水岛咲、天之濑冬马→天濑冬马、阿斯兰＝别西卜Ⅱ世→阿斯兰·别西卜II世。保留 [原始来稿与有效回填稿](../translation/studio/general/returns/honors-20261002/)，逐项差异见 [adjustments.json](../translation/studio/general/returns/honors-20261002/adjustments.json)。称号导入现在复用物品的姓名校验，并有拒绝错误译名的回归。

按照本次明确指示，将物品的 Physical、Intelli、Mental 三种名称和三条说明中的“脚炼”全部改为“脚链”，共 6 个字段。有效回填稿、revision、return 哈希及生成译文同步更新；原始来稿保留。[用词补丁记录](../translation/studio/general/returns/items-20261002/anklet-patch-20261002.json) 保存修改前后文字与回传哈希，原物品批次仍为 draft。

审计的称号记录全部绑定 G-honors-001～005，物品补丁同步入审计。通用资料计数、其他翻译域、衣装已校对状态、既有卡池名称及关联证据均未改变。本次不补充称号获取规则或提升校对状态。

验证通过：

- `node scripts/verify-general-translation-workflow.mjs`：来源身份、姓名校验、审计与既有批次状态。
- `node scripts/verify-general-translation-markdown.mjs`：紧凑回传格式及编号、来源、数字保护。
- `node scripts/verify-archive-general-texts.mjs`：生成译文、数字、回退与安全文本。
- `node scripts/verify-gasha-ticket-evidence.mjs`：原物品及卡池关联回归。
- `node scripts/verify-collection-catalog-session.mjs`：藏品目录与详情会话。
- `.analysis/honor-translation-20261002/verify-import.mjs`：核对 1,616 条 revision 与生成值，恰好 6 个物品字段仅变更脚链用词，其他域和卡池证据与输入 HEAD 一致；结果保存为 `import-verification.json`。
- `npm run build:check`：18.25 秒通过，复用 `.analysis/build-check`，`copyPublicDir:false`，有既有 chunk 体积提示，没有复制 public 素材语料。

真实 Browser 沿用 `127.0.0.1:5213` 预览：桌面 1280×720 检索“脚链”得到三种道具，打开 Intelli 确认名称及说明；称号检索“猫柳桐生担当”打开详情，核对日文原名和通用说明；手机视口 390×844 检查称号布局、切换日文原文再切回中文；审计中确认五个批次，猫柳桐生担当绑定第三批且仍待校对。页面有正常内容，无错误覆盖，控制台错误/警告查询为空。手机视口模拟不等于实机验收。

截图和小型日志位于 `.analysis/honor-translation-20261002/`：`honor-desktop.png`、`honor-mobile.png`、`anklet-desktop.png`、`build-check.log`。未创建发布素材包、未部署；无关未跟踪文件原样保留。
