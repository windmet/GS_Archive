# R4 Reader / Player 地址层执行记录

输入 master `1907fc43`（#138）。分支 `portal/20261030-reader-player-routes`，专用 LF worktree `E:/Web_build/GS_Archive_Domain_Work/deep-links-20261028/web_viewer`。主检出与其他门户窗口未动。

## 前置纠正与选择

此前 CURRENT_STATE 的“13个RAW、Valentine补抽未完成”是过时状态。`64e91828` 已在当前主干祖先中，#78 晋升记录 [STORY_RECOMPILE_PROMOTION_20261021.md](STORY_RECOMPILE_PROMOTION_20261021.md) 明确列出13个RAW核对、51条补抽及102处错接修复，3113篇阅读文档重生和译文换键。尚未完成的是带这些产物的后续R2/站点发布，不阻挡地址层代码。此前 #138 沿用了旧结论，本批纠正。

P7 的236常驻目录属于界面工作，不是方案丙的逻辑前置。本批继续 D4 丙：Reader / Player 保持query，不新增 `/read/<id>/` 或稳定话序号路径，不修改 ReaderWorkspaceControls、App、播放或资源加载器。甲/乙可在既有晋升基础上另评估，但不在本批替换用户已选的丙。

## 合同与实现

- Player增加13类实际调用方的明确schema：reader、event_detail、mobile_archive、story_catalog、story_collection、seasonal_campaign、work_archive、idol_story_archive、unit_detail、card_detail、idol_detail、unused_archive、score_archive；另有无返回的通用player合同。播放范围、at_step、voice与play_mode均保留，目标页只携带其所属参数，Player进入强制schema。
- Reader进入强制schema；保留reading/row/mode/revision/scope以及剧情类型、章节、所选story、idol、event、episode、work_mode。后几项仍用于目录身份和跨话导航，不能误作来源删除。只把parent/category/unit与来源链移入既有v1 history，事件与非事件Reader规则一致，旧query仍读，下一次写回规范化，分享不继承当前history。
- ArchiveStoryCollection只改script内的公开href生成，使用buildPublicArchiveUrl并输出根路径，避免从实体路径复制的阅读链接带来源。普通点击仍走原有Reader导航，不改模板、样式或交互。
- 审计工具扩展为列出全部13种Player返回；其余旧的非实际调用返回值保留目的页已有schema兼容，不把它们写成已做完整媒体验收。

## 回归与 Browser

`verify-route-schema`新增13组真实导航状态＋真实播放控制器进入/关闭＋冷query返回的目标参数往返；包括Reader版本/行/范围、事件父卡片、通信模式、目录筛选、所选章节、工作lines、偶像episode及两个音频书架。运行SFC实际readingHref函数检查独立链接；每个注册路径都测试scenario查询优先。`verify-archive-routes`覆盖事件与非事件Reader历史、replace、独立链接和旧query。既有1176导航状态投影和ReadingPlayback真实App回归通过。

Browser使用Codex In-app Browser、localhost:5240/PID8684、同一worktree dev、候选rm-release-20261022；bootstrap release仍为 `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`。桌面1280×900、手机390×844。以下仅是实际访问旅程，13种目标的全覆盖是源码/控制器回归，不能当作13种全量Browser媒体验收。

| 编号 | 实际观察 |
|---|---|
| P102 | 主线101 → 序章EP01 Reader，规范query保留story_type/main、101与story；桌面正文、标题、EP01/02及下一话控件实际加载 |
| P103 | Reader冷刷新，正文及下一话控件加载；关闭后原101合集与阅读按钮加载 |
| P104 | 独立新标签打开最终Reader分享链接，390px标题、正文、下一话均正常，无来源query；截图已展示 |
| P105 | 从该Reader播放本段，实际Player进度与播放控件出现；冷刷新后返回Reader再回101合集。手机Reader沿用既有单EP策略，reading_scope在返回时由ReaderViewport移除，没有把它写成范围丢失缺陷 |
| P106 | 卡片路径附scenario与return=unit_detail，冷开实际Player；地址规范至根query，仅保留unit/播放范围/return，无rarity/q；返回Jupiter且天濑冬马内容实际加载 |
| P107 | 摄影工作台路径附scenario与return=score_archive&sound=se，实际Player加载，裁剪idol/rarity，返回 `/scores/?sound=se`，SE条目及播放按钮实际加载 |

| P108 | 活动410018 → 阅读序章，地址保留event、无parent/category/unit；冷刷新正文加载，关闭回到同一活动，活动标题与“阅读序章”按钮加载 |

| P109 | 23个变异恢复后，新标签从工作档案路径附scenario与return=mobile_archive&idol=001tom&mobile_mode=phone冷开Player；关闭后 `/mobile/001tom/?unit=01jup&mobile_mode=phone`，冬马人物与“电话通信9”选中、9通电话内容加载，error/warn为空；临时标签关闭 |

开发中曾把Reader全部目录身份也移入history；独立分享因此缺目录标题/跨话控件，已在最终实现前纠正。保留此失败发现，最终版本只移动来源放置字段。

所测Browser旅程error/warn均未见记录；未播放SE条目，不将SE返回成功写成音效音源验收。完整门禁首次114/116通过（汇总226.7秒）；末两项被台账审计拒绝：本批先移除唯一returnView遗留项，但四个实现维度还保留旧partial，审计要求给出具体未完原因。依据13类返回合同、真实控制器回归与既有/新增Browser证据，entry/data/actions/player迁移维度现更新为migrated，parity仍partial、device仍pending；不把实现迁移等同完整媒体/原生等价验收。首次重跑编译通过，但启动JS为215,069字节，超210KiB门槛29字节，审计拒绝。将Player合同改为复用对应页面字段表（不改语义、不提高预算）后，最终末两项2/2通过：编译31.6秒、审计1.9秒，初始JS为214,964字节；汇总114项和最终2项合计均有通过结果，不声称首次全绿。23个生产代码变异均被拒绝并恢复：13类返回注册逐一删除、Reader/Player强制schema、mobile_mode、at_step、voice、Reader revision、非事件Reader历史、两类公开分享清理和组件href。日志/汇总在 `.analysis/r4-routes/`。最终路径/schema/1176导航投影/ReadingPlayback回归再次通过，1,523个外壳生成和dist检查通过。一次附加审计命令误加重复--progress被拒绝，按package原命令重跑通过。未改语料、read-model绑定、R2或站点；本记录不证明51条新语音已上传，不是真机/生产bundle/全部Player媒体兼容性验收。
