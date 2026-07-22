# Story Viewer 结构化双语 UI 验收（2026-07-22）

## 结论

P1 结构化双语 UI 已完成：ADV、Choice、Backlog、Title、Synopsis、Mobile、Call 不再通过 `display.text` 中的换行符推断双语层级，而是共同渲染 Resolver 提供的 `view.primary` 与 `view.secondary`。兼容字符串仍保留给外部调用和迁移期输入，但这七个玩家展示入口不会拆分兼容字符串来猜测语言身份。

## 实现边界

- `LocalizedTextBlock.vue`：为 primary/secondary 建立独立 DOM、`lang`、文本来源与 text unit 属性。
- `LocalizedDisplay.js`：规范化 `{ text, view }` 和 legacy compatibility display；兼容文本始终只视为一个 primary block。
- `AdvUI.vue`：独立字号、颜色、行高和间距；双语时增加正文高度并避开播放控制条。
- `ChoiceUI.vue`：prompt 与 option 均使用结构化 block。
- `StoryBacklog.vue`：dialogue 与已选 option 均使用结构化 block；窄屏长文本不再把固定标题栏挤出可视区。
- `StoryLocalizationContext.js`：为 `speaker_text_ref` 暴露结构化 `speakerView`，Title 不再只能接收拼接后的标题字符串。
- `TitleUI.vue`、`SynopsisUI.vue`：标题、badge 与正文均使用结构化 block；`StoryViewer` 现已实际挂载 authored synopsis step。
- `MobileUI.vue`：历史消息和 Producer choice 使用结构化 block；primary/secondary 插槽分别保留 inline emoji 解析。
- `CallUI.vue`：通话正文与通话内选项均使用结构化 block。
- 本批次不改 Runtime step、cue、voice、snapshot、choice target 或 compiled 数据。

## 自动验证

```text
npm run verify:story-localization
```

新增的 `verify-structured-bilingual-ui.mjs` 验证：

- structured display 保留 primary/secondary 的 locale、source 和 unit identity；
- compatibility 字符串即使含换行也不会被猜成双语；
- ADV、Choice、Backlog、Title、Synopsis、Mobile、Call 均接入共享组件；
- 七处旧的拼接字符串模板路径不再存在；
- StoryViewer 必须挂载 SynopsisUI；
- `speaker_text_ref` 必须保留结构化 locale/source/view，而不只是拼接字符串。

生产构建通过：

```text
npm run build
```

## 浏览器证据

场景：

```text
http://127.0.0.1:5174/?view=player&scenario=fixtures%2Fstory_localization_stress.json&start_step=1&end_step=10
```

| Viewport | 区域 | 实际 DOM | 结果 |
| --- | --- | --- | --- |
| 390×844 | ADV 第 4 步 | 1 个 `.localized-primary[lang="ja-JP"]` + 1 个 `.localized-secondary[lang="zh-CN"]` | PASS |
| 390×844 | Choice 第 8 步 | option 内 primary/secondary 各 1 个 | PASS |
| 390×844 | Backlog 第 4 步 | dialogue primary/secondary 各 1 个，标题栏保持可见 | PASS |
| 390×844 | Backlog 第 9 步 | selected choice primary/secondary 各 1 个 | PASS |
| 1280×720 | ADV 第 4 步 | primary/secondary 各 1 个，长中文无需侵占控制条 | PASS |
| 桌面 | Title 第 1 步 | `ja-JP` primary + `zh-CN` secondary，来自 `speakerView` | PASS |
| 桌面 | Synopsis 第 2 步 | 日文/中文正文独立 DOM，SynopsisUI 实际挂载 | PASS |
| 桌面 | Mobile 第 6 步 | 日文/中文消息独立 DOM | PASS |
| 桌面 | Call 第 7 步 | 日文/中文通话正文独立 DOM | PASS |
| 390×844 | Title/Synopsis/Mobile/Call | 四类均保留 primary/secondary，`scrollWidth=390` | PASS |

第 4 步执行 `JP+CN → JP → 中文 → JP+CN` 时始终停留在同一剧情步；应用级 console error 为 0。自动化 sentinel 同时证明语言切换不改变 step、generation、cue、voice、snapshot、history 和 option identity。

## 后续范围

玩家内七类文本入口的结构化迁移已完成。后续 UI 工作只剩长 speaker 名的更多正式数据样本、missing/stale debug badge 的非侵入式展示和视觉微调；不再存在 Title/Synopsis/Mobile/Call 的兼容拼接阻塞项。更多正式 collection overlay、实体翻译覆盖、音频统一与长时间 release acceptance 仍是独立范围。
