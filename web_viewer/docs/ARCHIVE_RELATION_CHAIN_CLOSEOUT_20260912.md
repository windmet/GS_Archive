# 门户验收前：关系边与多层返回修复

输入 HEAD：`d7bd143`，分支 `codex/p1-effect-texture-deps`。用户本轮指定本窗口完成导航链路逻辑，另一窗口接续验收与门户 UX。指导附件 `35fdb938-c3d1-4382-8d1c-cf5b12f361b5/pasted-text.txt` 用作审阅线索；以下结论来自本地代码和实际检查。

## 问题盘点

1. 来源 owner 只覆盖 Card/Event 和实验页。Song→Idol/Unit、Event→Idol/Unit、Card→Gasha 等入口没有可恢复来源，返回落入固定 Home/目录，或依赖仍未被覆盖的全局实体字段。
2. 原 `from` 主动删除内层 `from`。A→B→C 即便能回 B，也无法继续回 A；刷新后不能靠内存补救。既有 22 条 PASS 只证明各自记录的旅程，不能外推到整张关系图。
3. 部分包装函数先清掉 query/event，再调用下游 opener，导致即使下游补 capture，捕获的也已不是离开时的完整页面。
4. Card/Idol/Unit/Story/Interaction 等中转页需要同时保存自己的筛选和上游来源。只给详情页加 parent 仍会在列表中转处断链。
5. Reader 原本只保存 Event 的上游，其他 Reader 重建返回页时丢掉原来源、筛选和父页面。Player 也只允许携带 Card/Event 来源；默认 `return=files` 被省略后，不能误认为没有可恢复来源。
6. Shell 与嵌入组件的返回入口分散。统一 archive Back；Reader 和 Portal 先交回各自 close，再由普通档案页弹出来源。
7. Unit→查看卡片实际是成员选择网格，`view=idols&category=cards` 却被 URL 归一化为冬马卡片。修正为：没有显式 idol 就保留成员网格，组合筛选和“全部组合”均可刷新；旧链接带显式 idol 仍兼容 cards。没有改 `cards`/`idol_detail`/`mobile_archive` 的缺省人物，也未实施启动偏好。

## 实际关系边覆盖

按 App 模板的 open/select/navigate 事件及生产 handler 盘点；“覆盖”表示本轮逻辑接线，不等于每一实体都已做 Browser 全量验收。

| 起点 | 下游边 / 入口 | 来源策略 |
| --- | --- | --- |
| SongCatalog | openSong → Song | 捕获目录筛选 |
| Song | openSongIdol / openSongUnit / openSongRelatedStory → Idol / Unit / StoryCollection | 捕获歌曲及其上游，包装函数不先清来源 |
| Idol | openUnitFromIdol / openSong / openIdolEvent → Unit / Song / Event | 统一捕获 |
| Idol | openIdolDomain → Cards / IdolStory / Mobile | 中转页也是来源 owner；异步入口先确认 intent 有效 |
| UnitCatalog / Unit | openArchiveUnit / openUnitMember / openUnitCards / openUnitEvent / openSong | 统一捕获；成员卡片网格保留类别与筛选 |
| Unit | openUnitStory → Player | 保留 Unit 来源，关闭 Player 回 Unit，再弹出上游 |
| Event | openEventCard / openEventIdol / openEventUnit | 三类出演/报酬关系均携带来源 |
| Card | openCardEvent / openCardGasha / openRelatedCard | 关系边压入来源；上一张/下一张仍是选卡，不累积一层返回 |
| Gasha / Gashas / Seasonal / Extra集合 | openGasha / openGashaCard | 捕获原目录或关联实体，不再只有单一 gasha parent |
| StoryCatalog | openCatalogStory / browseStoryCollection / Seasonal / Work / IdolStory | 详情、集合和专题均保留入口 |
| StoryDetail | openStoryIdol / Reader / Player | 偶像关系及阅读、播放返回携带来源 |
| ExternalStoryResources | openExternalStoryInternal → Event / StoryDetail / Collection / IdolStory | 各目标共享同一来源合同 |
| IdolStory / Seasonal | openIdolBirthdayArchive / openBirthdayIdolStory / openStoryCommunication | Birthday / IdolStory / Mobile 双向中转携带来源 |
| Mobile | openMobileCard / openMobileIdolStory | 回原 mode、人物、话题/章节及上游 |
| 旧分类网格 / Groups / EpisodeZero | openIdol / openGroup / openUnit / openEpisodeFiles | 下钻捕获；Back 统一；Player 回原文件页后仍有来源 |
| Home | 偶像/卡片/聊天/活动关系入口 | 可返回显式 Home 人物/cue/服装上下文 |
| Reader | Reader切段 / Player / 关闭 | 切段不重复压栈；新 Reader 保存确切入口页，旧 Event Reader URL 仍按旧 parent 方式恢复 |
| Resource实验 | Spine↔Chibi / close | 保持实验切换共用来源，不把另一个实验页压入档案来源 |
| 全局分区 / 面包屑 / Portal | navigateArchiveSection / route link / portal close | 分区跳转清旧链；面包屑是规范归属导航；Portal 使用独立 portal_from |

没有新增 idolParentView/unitParentView 等平行状态；原 parent 字段保留用于旧链接和无来源时的规范回退。

## 有界 URL 合同

继续使用顶层 `from`。其中第一条是直接来源 query，`via` 是其余规范化 query 的 JSON 数组；这是平铺链，不把内层 `from` 反复百分号编码。最多保留最近 16 层，来源 query 最长 8192 字符，超限优先丢弃最老层；不是无限浏览器历史。耗尽后使用既有规范回退。

读入兼容旧单层及嵌套 from；逐条校验本地 query、合法档案 view，拒绝 player/scenario/file、门户及实验页来源。损坏尾部只保留有效前缀，非法第一条不写入来源。来源跟随 URL，刷新/浏览器历史不依赖新增 session 栈。列表位置仍使用现有 archiveViewRestoration 的 entry key / route key 恢复，未新增第二套 scroll 存储。

## 本轮验证

- `verify:archive-navigation-state`：原 47 refs / 1792 投影组合、列表 entry/route 恢复、16 个生产关系 handler、七页多层 URL 刷新逐层返回、播放 carrier、16 层截断及非法/旧来源用例通过。
- `verify-archive-routes`、`verify-archive-async-navigation`、`verify-archive-startup-route`、`verify-portal-navigation`、`verify-reading-navigation`、`verify-reading-playback` 通过。测试 harness 补上新共享依赖；列表 verifier 统一 CRLF/LF 后匹配，避免 Windows 换行造成假失败。
- `build:check` 完整编译 2511 modules，固定 `.analysis/build-check`，copyPublicDir:false。初次编译后追加“全部组合”归一化修复，故针对这次代码变化再次编译；不是每个工具/文档动作都构建。保留既有大 chunk 提示，不宣称完整资源发布包验收。
- Browser：本项目 dev 5175，进程 45024。歌曲筛选 BRAND→BRAND NEW FIELD→翔太→Jupiter→刷新→翔太→歌曲→原 BRAND 目录通过；歌曲直接→Jupiter→刷新→歌曲通过。
- Browser：Jupiter→查看卡片→成员网格刷新→翔太卡片→返回成员网格→Jupiter 通过。
- Browser：Jupiter→運命光年活动→episode2 Reader→刷新→活动→Jupiter 通过。独立后台 QA 页控制台 error/warn 为空，实际截图确认返回 Jupiter。没有执行新的长音频/长稳，也没有将合成播放合同测试冒充真实 Player 全旅程。

## 交给验收 / 门户窗口

1. N01/N23 已按当前代码在桌面与390px完成Portal刷新往返，旧导航基线现已冻结；证据见 `ARCHIVE_NAVIGATION_B2_INVENTORY_20260912.md` 文末。
2. 增补 N25（Song→Idol→Song）和 N26（Song→Unit→Song），本轮已做针对性 Browser；继续对照上表覆盖反向边、三层以上链、刷新和 Back/Forward、390px、滚动/焦点恢复，尤其 Card↔Gasha、Mobile↔IdolStory、非 Event Reader↔Player。
3. 之后才按 PORTAL_STARTUP_UX_PLAN 做 U0/U1/U2/U3。本轮不改 Welcome / 首页偏好 / 媒体启动 ownership。
4. 已再次通知执行窗口遵守 AGENTS.md 与 BUILD_ACCEPTANCE_POLICY。日常只用 build:check；不在 C 盘 / Codex QA 生成全量 public 副本；纯验收记录/文档不机械重建。实际 packaging 才按政策单独处理。
