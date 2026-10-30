# 季节企划与摄影回传审阅 · 2026-10-31

输入基线为 `i18n/20261031-coverage-audit` / `246f8fd9bc74c0a400598f438e08a41f6631d322`。承接[季节导出说明](TRANSLATION_SEASONAL_EXPORT_20261031.md)及[覆盖盘点](TRANSLATION_COVERAGE_AUDIT_20261031.md)。用户回填后要求按既有流程审阅；模型名称未注明，不推定具体模型或版本。

## 本轮收到与处理的范围

| 批次 | 文档 | 文本 | 合集 overlay | 定向修改 |
|---|---:|---:|---:|---:|
| B037 · 2022 情人节剩余 | 50 | 380 | 26 | 7 |
| B038 · 2022 白色情人节前半 | 51 | 401 | 26 | 4 |
| B039 · 2022 白色情人节后半 | 50 | 385 | 26 | 11 |
| B040 · 2023 情人节 | 52 | 538 | 52 | 9 |
| B041 · 2023 白色情人节 | 52 | 524 | 52 | 17 |
| 合计 | 255 | 2,228 | 182 | 48 |

五批完整输出均通过固定 HEAD、Reader / compiled / RAW 证据、RID 集合、原文哈希、上下文和保护槽检查，没有缺行、重号或阻断项。全部回填为 **draft / not_final**，没有升级 reviewed 或 final；没有覆盖原有 B001、B036 等已有合集，182 个目标文件原先均不存在。

另收到 `G-photos-20261031-001`：12 条均为 `bg…` 资源键，用 `[编号=]` 显式保留原文，已逐项核对并导入 General TM 为 draft / keep-source。这不是 12 条新翻译的日文场景说明。通信 12 批、语音 2 批尚无 output.md，本轮没有猜填或导入。

## 审阅深度与修改依据

本轮对 2,228 条执行完整机检；对 **529 条不同文本**做定向双语对照，选择范围包括每篇文档首条、276 条数字 / 否定 / 施受 / 回礼语义风险候选、特殊自称与歧义候选，并结合相关邻句。本次没有完成全量逐句人工审校，不能把草稿覆盖等同于质量审定。

48 处修改均绑定 RID、unit_id、source_hash 和原文，逐条 before / after / reason 见各批 `edits.json`：

- B038 T000015：`用意したつもりだ` 是已经准备后的自我判断；修正“打算准备”的未来时误译。
- B037/B039/B040/B041：去掉原文没有的“老子”“本大爷”“你小子”等。保留原文实际出现的 `オレ様`、`下僕` 和粗鲁命令；志狼、朱雀等人的普通 `オレ` 不套用漣的特殊口吻。
- B040/B041 的皮埃尔：`ボク` 按 R3.3 默认第一人称“我”处理，不无依据换成姓名自称；原文明确说姓名的地方不受影响。
- B039：去掉“无限 / 无穷力量”“一副开心的样子”等超过原文范围的扩写。
- B040 T000523 / T000524：还原父母收到慰劳品的施受关系，`スポンジ` 不无依据限定成戚风，并保留传闻语气。
- B041 T000300 / T000474：`手作り` 不限定为手写；递交礼物的 `こちらをどうぞ` 改为“请收下这个”。
- 对“你能喜欢我就很高兴”等句补足断句，避免把礼物喜好误读为人际表白；少量日语式语序作局部调整。

当前试用词表中的 `監督→监督` 等既有决定保持原范围，没有借本轮修改全局规范。模型的单次译法不自动成为项目规则。

机检原有 6 条提示均保留并记录处置：B037 的英文选项 `Amazing！` 有意保持英文；`ありがとさん` 是口语致谢；B041 三条 `ミサンガ` 是手链名称，并非人名加敬称。后两类是现有敬称启发式误报，不为消除提示而改译，不在本批扩大修改公共检测器。

## 可重放证据

每批目录保留逐字节用户原稿、编辑稿、原批次 map、48 条修改记录、前后机检报告和 receipt：

- [B037 receipt](../translation/studio/reviews/B037-seasonal-valentine-2022-rest-r33-edited-20261031/receipt.json)
- [B038 receipt](../translation/studio/reviews/B038-seasonal-white-day-2022-1-r33-edited-20261031/receipt.json)
- [B039 receipt](../translation/studio/reviews/B039-seasonal-white-day-2022-2-r33-edited-20261031/receipt.json)
- [B040 receipt](../translation/studio/reviews/B040-seasonal-valentine-2023-r33-edited-20261031/receipt.json)
- [B041 receipt](../translation/studio/reviews/B041-seasonal-white-day-2023-r33-edited-20261031/receipt.json)
- [摄影 keep-source receipt](../translation/studio/general/returns/G-photos-20261031-001/receipt.json)

`verify:b002-draft` 已纳入这五批，复核原稿 → 逐项 edits → 编辑稿 → 当前合集 overlay 的字节哈希、来源、宏还原和 draft 状态。原稿与 receipts 通过 `.gitattributes` 禁止换行改写，新增季节 overlay 固定 LF，避免 Windows/CI 哈希漂移。旧批次校验不变。

已执行官方 Story check / import 生成本地中间稿，再按 scenario_id 合并文档分段为 182 份合集；没有把 255 份分篇中间稿当作正式 overlay 发布。General 只导入摄影 12 条，未运行人工 review。

## 刷新后的总账

| 范围 | draft | reviewed | missing | stale |
|---|---:|---:|---:|---:|
| 全 Reader · 32,760 条 | 31,767 | 993 | 0 | 0 |
| 其中季节企划 · 2,639 条 | 2,639 | 0 | 0 | 0 |
| 通用资料 · 23,315 条 | 2,615 | 7,647 | 13,053 | 0 |

通用翻译记忆 7,659 条，orphan / invalid / unpublished 均为 0。已生成通用 overlay、翻译 release、审计和剧情搜索本地化；旧覆盖审计快照不改写。

本地翻译 release：`583c93ba4daa766a20747d36de87dcfee925b5938e015ff9dc28edf33b05b630`，1,665 个文件。它是源码消费包摘要，不是站点已部署的证明。

## 验证

以下通过：

```powershell
npm run verify:b002-draft
npm run verify:reviewed-b001
node scripts/verify-story-translations.mjs
node scripts/verify-entity-translations.mjs
node scripts/verify-speaker-label-dictionary.mjs
node scripts/general-translation-workflow.mjs verify
npm run verify:general-translation-workflow
npm run build:check
git diff --check
```

General verifier 的 isolated fixture 会故意写入错误条目以验证拒绝逻辑，因此出现的 `1 invalid entry skipped` 是测试夹具消息；实际记忆 strict verify 为 0 invalid。

build:check 完成 Vite 代码编译，输出复用 `.analysis/build-check`，没有复制 public 全库。仍有现有背景引用无法在构建时解析及大 chunk 警告；本批没有验证整库媒体。构建重生成的无关 `config/resource-audit.json` 已还原到运行前字节，未纳入提交。

### Browser 实际验收

使用统一 Browser 入口的 in-app browser；没有运行独立 Playwright 浏览器。初次工具发现没有列出独立 Browser namespace，经用户提醒后通过 `cua` 的 browser inventory 获取可用入口。服务为本工作树手动启动的 `http://127.0.0.1:5251/`，PID 由本次启动会话记录；其他项目服务未停用。

启动日志确认 read-model 候选为 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261030b`，缺失 public 资源回落主 checkout；译文来源为本工作树新生成的 public/translations。

| 旅程 | 视口 | 结果 |
|---|---|---|
| `?view=reader&reading=5_02_001_22_b` | 1440×900 | 显示“我也准备了回礼…”；选择另一中文分支后 selected/tab panel 状态更新；切双语可对照日文原句 |
| `?view=reader&reading=5_02_010_23_5_02_010_23` | 390×844 | 设置面板中由双语切译文并关闭；正确显示“我的心意 / 我住的酒店 / 我去预约”，人名牌仍为皮埃尔 |

两次 console error 均为空；无空白页或 Vite error overlay。窄屏 page scrollWidth=390，与视口相等，未见横向溢出；正文没有未还原的 `{{GS_ADDRESS:…}}` 或原始圆点宏。截图保存在 `E:/Web_build/GS_Archive_Domain_Work/translation-qa-20261031/reader-desktop.png` 与 `reader-mobile.png`，临时视口覆盖已 reset。

这是两个指定 Reader 旅程的 dev 服务证据，不代表 255 篇逐页 Browser 检查、Player 播放、物理手机、生产 bundle 媒体完整性或线上部署验收。没有 R2 上传、read-model 重新绑定或站点部署。
