# Story Viewer 结构化双语 UI 验收（2026-07-22）

## 结论

P1 第一批结构化双语 UI 已完成：ADV、Choice、Backlog 不再通过 `display.text` 中的换行符推断双语层级，而是共同渲染 Resolver 提供的 `view.primary` 与 `view.secondary`。兼容字符串仍保留给未迁移组件，但共享组件不会拆分兼容字符串来猜测语言身份。

## 实现边界

- `LocalizedTextBlock.vue`：为 primary/secondary 建立独立 DOM、`lang`、文本来源与 text unit 属性。
- `LocalizedDisplay.js`：规范化 `{ text, view }` 和 legacy compatibility display；兼容文本始终只视为一个 primary block。
- `AdvUI.vue`：独立字号、颜色、行高和间距；双语时增加正文高度并避开播放控制条。
- `ChoiceUI.vue`：prompt 与 option 均使用结构化 block。
- `StoryBacklog.vue`：dialogue 与已选 option 均使用结构化 block；窄屏长文本不再把固定标题栏挤出可视区。
- 本批次不改 Runtime step、cue、voice、snapshot、choice target 或 compiled 数据。

## 自动验证

```text
npm run verify:story-localization
```

新增的 `verify-structured-bilingual-ui.mjs` 验证：

- structured display 保留 primary/secondary 的 locale、source 和 unit identity；
- compatibility 字符串即使含换行也不会被猜成双语；
- ADV、Choice、Backlog 均接入共享组件；
- 三处旧的拼接字符串模板路径不再存在。

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

第 4 步执行 `JP+CN → JP → 中文 → JP+CN` 时始终停留在同一剧情步；应用级 console error 为 0。自动化 sentinel 同时证明语言切换不改变 step、generation、cue、voice、snapshot、history 和 option identity。

## 后续范围

共享组件下一批可继续接入 Title、Synopsis、Mobile、Call；这不阻塞“ADV、Choice、Backlog 至少结构化渲染”的当前合并条件。正式 collection 的 text identity/overlay 发布、Runtime channel 唯一 owner 与完整 release matrix 仍是独立未完成项。

