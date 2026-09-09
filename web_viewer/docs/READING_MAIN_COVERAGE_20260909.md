# D：主线阅读覆盖扩展

起点 `7762aa3`，分支 `codex/archive-architecture-refactor`。
用户要求长稳继续后移；本批扩展现有阅读能力，不接管 renderer。

## 覆盖与限制

从 Story Catalog 的 main/101、main/102 正式章节关系枚举全部 204 个分段，
生成 183 个 ready、21 个 unsupported 阅读产物。原先五个样本仍包含在内；
未公开 main/103、活动、个人故事、卡片等其他域未在本批生成。

`config/reading-samples.v1.json` 显式指定两个集合；生成器从已发布分段读取原文，
沿用 authoritative registry 或 catalog compatibility 来源检查及 SHA 校验。
选择冲突或缺失章节报错；不扫描目录猜测归属，不生成新剧情、不补写译文。
21 个不支持分段保留诊断与原始锚点，章节页不开放阅读按钮；Reader 中选择它们
会显示未支持说明，不将互斥分支串成正文。

manifest 增加可选 title / episode_label 展示字段，并校验类型；分段选择器使用
标题与分段名称，保留原 document_id 作为值。正文仍按篇获取，不预载所有正文。
加载状态不再将资源代号作为副标题。现有来源、定位、返回与播放所有权保持不变。
选择器切换仍保留发起阅读时的返回来源；本批不改变该导航约定。

## 验证

- verify:reading：204 份实际产物的文本散列、定位、状态、manifest 精确范围，
  repository / navigation / playback / Vue rendering 通过。
- verify:reading-sources：全部 204 份产物与本机已发布 compiled 来源一致。
- verify-reading-playback --local-sources：既有真实来源往返验证通过。
- source-only Vite 构建通过；仍有既有 500 kB 分块提示，不等同媒体发布验收。
- Browser：第二章序章的エピソード2 从新增按钮打开，11 段正文正常；选择器
  204 项有标题与分段名。首句进入演出定位 3/37，返回同一行，canvas 归零；
  再返回 main/102 并保留原序章。正文刷新仍可读。
- 选择「不運もラッキー！ · エピソード9」显示不支持说明。390×844 正文无横向
  溢出；截图保存在仓库外 sidem-presentation/2026-09-09/reading-main-mobile.png。

浏览器只抽测新增分段与限制路径；不声称 183 份都逐句人工审阅或完成听感/长稳。
下一步继续 D 的实际入口和阅读体验、E1 shadow 覆盖；P2-B 仍后移，E2 未接管。
