# 2026-10-11 测试反馈修复发布记录

用户明确授权：开启测试端口、推送并部署。目标沿用现有 `gs-archive-preview` 项目的 `gs-architecture-device-test` 测试分支。

## 发布身份

- 发布源码：`2a12619c8684dcbdb114523768c6a19216e3de01`。
- Git 分支：`codex/portal-architecture-cleanup-20261004`，已推送至 `origin`。
- 固定测试地址：<https://4c04d442.gs-archive-preview.pages.dev>。
- 测试别名：<https://gs-architecture-device-test.gs-archive-preview.pages.dev>。
- 读取模型 release：`62e4b1018b3675a119d29dd6879f641523c46e3aa062f9ca2a9920c478eff133`。
- 沿用 R2 data revision：`854190ad908cc47df022dfb35181838fa4e0fd385a537e8fc8b611053b7b0bd4`。
- 沿用 media epoch：`voice64-gzip-all-20260924`；没有上传或修改 R2 素材。

本次发布替代前次只读交接的状态；排查历史见 [反馈交接](GS_ARCHIVE_TEST_FEEDBACK_HANDOFF_20261011.md)。

## 包含的修复与发布补齐

用户已完成的三笔提交：

| 提交 | 内容 |
| --- | --- |
| `5f80a50b` | 首页生成投影按 cue 去重；主要用户可见舞台名称改为「2D舞台」 |
| `bb532d14` | 当贴图小于 atlas 声明尺寸时，按声明尺寸生成适配贴图，处理北斗红叶衣装无法显示 |
| `51b34b15` | 工具页将谱面与2D舞台合为 LIVE 卡片，摄影工作台保留独立卡片 |

本轮补齐 `2a12619c`：新读取模型 bootstrap、route ledger release 绑定、首页回归计数及全量 cue 唯一性/完整性断言。

首页去重改在生成投影中，仅替换前端不能改变旧线上读取模型。因此本次重新生成并发布读取模型，没有沿用旧 `0d220947…` 首页列表。

LIVE 本次实现是统一分组入口；两边仍各自选曲。没有实现共享播放进度/编成的完整工作台，也没有改变门户顶层「工具」名称，不应将本次发布描述为所有导航重组方案均已实现。

## 验证结果

| 检查 | 结果与边界 |
| --- | --- |
| `verify-archive-home.mjs` | 通过：49 位偶像、2,356 条 cue；每位 cue 唯一，源中不同可播放 cue 无遗漏 |
| `verify-home-navigation.mjs` | 通过：导航、取消、缓存和返回恢复 |
| `verify-spine-atlas-pages.mjs` | 通过：atlas 页面与加载管线现有回归 |
| `node --test readmodels/tests/*.test.mjs` | 57 通过、0 失败 |
| 新读取模型 `verify_artifacts.mjs` | 6,276 个 artifact 通过；限定为数据、descriptor 与 envelope 检查 |
| `npm run build:check` | 通过，Vite 编译 17.97 秒；sourceDirty=false；不复制 public |
| 发布包清单 | 10,527 文件逐一复核 bytes/SHA-256；153,425,473 B，无 `assets/` 媒体文件 |
| 线上字节验收 | 固定地址 225 个文件（关键代码、HTML、回执、全部首页读取模型）与发布包哈希一致；别名回执 source/release 一致 |

原首页回归仍断言重复列表的 2,564 条，首次检查失败；更新为去重后的 2,356 条，并加入每位偶像唯一性与源 cue 完整性断言，随后通过。

## Browser 实际旅程

- 使用 Codex In-app Browser，未使用独立 Playwright 替代。
- 本地 1280×720：北斗普通红叶与突破红叶均显示；北斗首页总数 45，SSR01 显示 4 条不同语音。
- 本地工具页：LIVE 与摄影为两张卡片；「打开2D舞台」进入标题为「2D舞台」的页面，显示 5/5 人就绪；「打开谱面」进入选曲页，返回工具页后「打开摄影工作台」进入摄影画布。
- 线上桌面 1280×720：普通红叶人物实际显示。
- 线上手机视口 390×844：突破红叶人物实际显示；打开台词目录并筛选 SSR，SSR01 为第38–41句四条，SSR02为第42–45句四条，未见原成对重复。
- 线上工具页 DOM 确认 LIVE 卡片下有「打开谱面／打开2D舞台」，摄影工作台为独立卡片。
- 已访问页面有实际内容，未见框架错误覆盖层。线上日志读取没有 error，保留 Spine.update 与 tint 两条 warning 堆栈；不称零告警。
- 手机视口为桌面浏览器响应式检查，不等同于手机真机。未做全部偶像逐位渲染、舞台完整播放、摄影导出或长时间稳定性验收。

## 本地服务与产物

- 测试服务：<http://127.0.0.1:5210/>；启动 PID `28408`，Vite `--host 127.0.0.1 --port 5210 --strictPort`，本轮结束时保留。
- 服务挂载新读取模型：`E:\GS_ReadModels_QA\test-feedback-20261011-51b34b15`。
- 服务日志：`.analysis/test-feedback-vite-5210.log` 与 `.analysis/test-feedback-vite-5210.err.log`。
- 代码编译：`.analysis/build-check`，固定复用目录，无 public 副本。
- 发布包：`.deploy/test-pages-20261011`；完整清单 `preview-package.json`，线上可读 `preview-receipt.json`。
- 已检查 E 盘剩余约 481 GB；public 源语料 8,419,181,872 B，未复制该语料。旧 20261010 包未删除。
- 小型截图保存在 `C:\Users\windm\.codex\visualizations\2026\10\11\01a1295d-6dcc-7f02-9c74-1d4121779955`：`hokuto-fixed-normal-online.png`、`hokuto-fixed-awakened-online-mobile.png`、`hokuto-fixed-awakened-local.png`。

发布命令：

```text
npx --no-install wrangler pages deploy dist --project-name gs-archive-preview --branch gs-architecture-device-test --commit-hash 2a12619c8684dcbdb114523768c6a19216e3de01 --commit-dirty=false
```

Wrangler 提示工作区有未跟踪内容；编译回执 sourceDirty=false，发布包只包含显式组装内容。其他未跟踪文件未加入提交；Wrangler 本轮产生的本地状态目录同样不提交。
