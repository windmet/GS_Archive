# 卡片详情兜底改为单卡叶子（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `2e84f77`。卡片正常进入、直达、Player 与 voice 深链已有单卡 Read Model 恢复路径。本批将 `card_detail` 的兼容监听从整张旧 `card_detail_index` 改为按当前 `cardId` 读取单卡叶子；响应必须仍属于当前导航、页面和卡片才能发布。详情显示也只接受身份匹配的叶子，不再用旧表拼装卡片。旧全量仓库本身仍在生产依赖中。

`verify:archive-async-navigation` 中的生产函数测试覆盖卡片选择、旧响应失效、失败重试、voice 深链；新增监听测试覆盖缺叶子补取与离开后失效响应。`verify:card-voice-preview`、`verify:archive-startup-route` 和 `build:check` 通过，构建输出复用 `.analysis/build-check`，未复制 public 媒体。

Browser 使用 `127.0.0.1:5186` 的生产代码构建、public 和 r22 Read Model 映射，旧全量 `/data/` 来源返回 503。直达 `?view=card_detail&card=001tom_n01` 显示“スタートライン”及卡片资料，点击“下一张：GROWING STARS”更新到 `001tom_r01` 并显示新详情；检查时无 console error。Browser 实际旅程验证正常单卡路径，监听兜底由生产函数回归覆盖。未做全部卡片、真实设备或发布包验收。
