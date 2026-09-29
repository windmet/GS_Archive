# 已迁移入口的旧资料门禁移除（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `ecfad48`。偶像选择器通向 Home、工作、个人故事、Mobile；Portal 的“我的偶像”快捷入口通向卡片、工作、个人故事、Mobile。这些目标已有按路由的 Read Model 消费者，但三个入口函数仍在旧资料未就绪时先启动 `loadArchiveData()`。本批移除 `chooseImmersiveIdol`、`openPreferredDestination` 和 Home 通信入口的旧整批资料门禁；目标页面仍使用其自身的加载与错误处理。

## 验证

- `npm run verify:archive-startup-route`、`npm run verify:archive-async-navigation`、`npm run verify:archive-navigation-state`：通过。
- `npm run build:check`：通过；仅编译生产代码到复用的 `.analysis/build-check`，不复制 `public` 语料。
- Browser：本机 `127.0.0.1:5184` 映射该编译结果、当前 `public` 与 `E:\GS_readmodels_candidate_20260927_r22\pages`。服务让 Reading manifest 和除 `/data/reading/`、`/data/compiled/episodes/` 外的旧 `/data/` 请求返回 503。修改前，从 `?view=idol_picker&pick=story` 选择天ヶ瀬 冬馬，虽然页面最终打开，控制台记录旧资料源的 503。修改后以新 Browser 标签复走，个人故事、工作档案、Mobile 选择器均打开对应页面且无控制台错误。Portal 临时设置“我的偶像”为天ヶ瀬 冬馬后，快捷入口 Work 与卡片也打开对应页面且无控制台错误；随后恢复原先的“暂不设置”，Portal 再次不显示“我的偶像”栏。

Home 通信入口本次改动只经代码审查和相关导航回归，未完成该按钮的 Browser 实走；不把其他 Mobile 入口等同于它。其他未迁移入口仍可能请求旧资料。未执行完整媒体打包、真机或部署验收。
