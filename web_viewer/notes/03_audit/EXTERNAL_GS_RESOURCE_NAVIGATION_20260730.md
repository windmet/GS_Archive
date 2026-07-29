# GS 社区中文剧情导航审计

Status: implementation verified; pending PR
Date: 2026-07-30
Branch: `codex/external-story-resource-navigation`
Base: `0fbcbbc844e98b562a637fb3748680b6ba68d3d0`

## 1. 决策

外部 GS 中文资源契约规定：只有形成有意义的精确关系集合后，才增加独立
“中文剧情导航”入口。PR #18 合并后已有：

```text
5 GS records
5 exact mappings
5 unique BVIDs

2 exact events
3 exact unit-story collections
```

因此本批建立独立 `external_story_resources` 路由和故事目录入口。页面只消费
exact mapping，不显示 `candidate`、`partial-story` 或 `unmapped`。

## 2. 页面行为

故事目录“更多故事”区域增加：

```text
社区中文剧情
5 条
```

独立页面每条记录显示：

- 本地 GS 标题与分类；
- 本地活动 banner 或 unit-story visual；
- 原视频 uploader；
- 覆盖范围；
- BVID；
- “在资料馆查看”内部动作；
- “前往观看”原始 Bilibili 链接。

页面明确说明本站不镜像视频、字幕、封面或头像。所有图片仍来自本地
GS Archive。

## 3. 内部深链

活动记录：

```text
external_story_resources
-> event_detail?event=<internal event_id>&parent=external_story_resources
-> 返回 external_story_resources
```

unit-story 记录：

```text
external_story_resources
-> story_collection
   &story_type=unit_story
   &story_section=<unit section>
   &story=<exact collection file>
   &parent=external_story_resources
-> 展开 exact chapter
-> 返回 external_story_resources
```

普通 story 记录使用相同 parent contract 进入 `story_detail`；该路径当前无
生产记录，但 verifier 已用 exact-story fixture 固定，避免后续 registry
扩展时静默丢失或返回错误入口。

现有 `story` 参数复用于目标 chapter identity，没有增加另一套平行路由字段。
整话/分段播放期间也保留 collection parent context。

## 4. 机器约束

`buildExternalStoryNavigationEntries`：

- 先过滤现有 exact mapping states；
- event ID 必须解析到本地 event relation；
- collection ID 必须解析到本地 collection chapter；
- story resource ID 必须解析到本地 story catalog entry；
- 未解析项不会以伪造标题或 fallback relation 显示；
- 一个 external record 对多个已证明 target 时按 target 展开。

`verify-external-story-resource-ui.mjs` 断言：

- 当前五条资源全部解析到正确内部 target；
- synthetic candidate 不进入独立导航；
- 页面使用 registry canonical URL；
- `_blank` 与 `noopener noreferrer external` 保持；
- uploader 与镜像边界可见；
- App、故事目录入口和 exact chapter prop 完整接线。

`verify-archive-routes.mjs` 断言：

- `external_story_resources` 是 stories section 的稳定路由；
- unit-story `story`/`parent` 参数可读写 round-trip；
- 新路由可作为 event 和 story collection 的 parent。

## 5. 本地验证

```text
verify:external-story-resource-ui: PASS
verify:routes: PASS
Vite production build: PASS
2,407 modules / 2m 22s
git diff --check: PASS
```

最新 `dist` 在临时 5175 preview 的浏览器验证：

- 故事目录入口显示 `社区中文剧情 5 条`；
- 独立页显示 2 个活动与 3 个 THE 虎牙道前传记录；
- 五个 BVID/uploader 与 registry 一致；
- `BV1xA4y1S7Cb` 内部动作准确展开第 2 话；
- 第 2 话 URL 包含 exact collection file 与
  `parent=external_story_resources`；
- 活动 `10008` 内部动作准确进入 event `410008`；
- event 与 collection 返回动作均回到独立导航；
- 390px viewport 无横向溢出；
- 无远程图片、无 console error。

临时 preview 验证后已关闭；长期运行的 5174 未重启或改动。

## 6. 边界

- 不增加第三方视频、字幕或图片副本；
- 不把外链写入 publication ledger；
- 不把 exact resource count 合并进本地翻译完成率；
- 不开放 candidate-only 社区资源页；
- 不执行已后置的 Runtime 2–4 小时长稳验收。
