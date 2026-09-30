# Reader 选项表现标记修复

输入 HEAD：`25c44730`，分支 `codex/story-interaction-v2-before-b002`。

## 来源链路

`新たなる三つの輝きと共に！` EPISODE 01 的 RAW 提取文件为
`.analysis/raw-migration/1_4_001_01/extracted/scenarios/1_4_001_01/scenario_1_4_001_01_a.json`。
零起算第 146 条命令为 `text_select`，Values 开头是
`["a2001", "パーッション！！", "appeal"]`。

`data_pipeline/sidem_scenario/compiler.py` 的 `_select` 将第三槽位统一存入
`detail_source_text` / `detail_text_ref`，即便它是表现标记。公开 compiled episode
`public/data/compiled/episodes/1_4_001_01_a.json` 的 step 40 保留了这个槽位。
`shared/reading/ReadingDocument.js` 又将它投影成 `choice_detail` 行，公开 Reader 的
行 ID 为 `1_4_001_01_a:step-40:option-0-detail`。

B001 reviewed overlay 中该来源单元的译文也为 `appeal`；双语模板因此打印一次原文、
一次译文。播放器的 StageChoiceUI / MobileChoiceRail 只调用短选项解析，
没有呈现这条独立附文。并非两个真实选项，也并非正文漏译。

Reader 修订仍为
`sha256:90b8410a393383dda63fd71a8fa3e464f9a0bb70864cae7eab9bf42a2dbf963a`。
本次没有重写 RAW、compiled、Reader JSON、翻译 overlay 或审阅收据。

## 修复范围

`ReadingChoiceMetadata.js` 在 Reader 呈现、翻译解析、搜索和 fallback 统计之前，
识别带 `choice_detail` 来源字段、精确值 `appeal`、并能绑定到同一步真实选项的标记。
全库 2801 份 Reader 中有 12 处，包含主线、活动和互动来源；支持读取的页面共用此投影。
未绑定的记录保留，真正的长回复保留，台词或选项短文中的同名单词也保留。

旧附文锚点作为实际选项的别名保留。整话、单段定位会聚焦实际选项，
不制造空白“选项附文”行；单段定位在当前 Reader 根节点内查找，避免引用过渡中的旧节点。
原始行、选项目标、unit ID、source hash 和 branch evidence 仍保留在 canonical 数据里。

## 验证

- `npm run verify:reading`：通过；2801 份文档来源与锚点、12 处标记、真正附文、
  同名单词与未配对记录、两种阅读范围的三种语言 Vue 呈现、导航与播放回归。
- `npm run verify:reading-sources`：通过；2801 份公开 Reader 与生成器一致。
- `npm run verify:reviewed-b001`：通过；52 文档、42 catalogues、993 reviewed 单元。
- `npm run verify:player-qa` / `npm run verify:story-localization`：通过。
- protected guard：6551 个文件没有修改、缺失或新增。
- `npm run build:check` / `npm run verify:build-audit`：代码编译与 progress 指纹核对；
  复用 `.analysis/build-check`，`copyPublicDir:false`，没有复制媒体语料。

Browser 使用现有 `127.0.0.1:5197` preview，PID 33888；生产 bundle 来自 build-check，
公开 JSON 与外部模型仍按原映射提供。验收在独立 Browser 页完成，保留用户播放器。
检查默认窄窗口、1280×900 和 390×844：无横向溢出、无框架错误页，Reader 页控制台无 error/warn。
整话搜索 `appeal` 从两处命中降为零；真实文字搜索、原文/译文/双语切换正常。
真实选项仍为 `パーッション！！` / `PASSION！！`，下方直接继续社长台词；
整话和单段旧附文 URL 均可定位。临时 viewport 已恢复。

截图在 `.analysis/reader-choice-metadata/`：`before.png`、`after-default.png`、
`after-desktop.png`、`after-mobile.png`、`after-single.png`。
此结果是代码与本地 Browser 验证；没有执行媒体打包、部署或真实设备验收。
附文来源记录和 B001 中的历史标记译文继续保留，后续语料 schema 迁移须单独核对身份和收据。
