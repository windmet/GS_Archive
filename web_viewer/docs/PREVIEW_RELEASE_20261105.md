# 2026-11-05 Preview 发布

用户授权「着手先进行preview站部署」。仅部署 Pages 项目 `gs-archive-preview` 的 `gs-architecture-device-test` 分支。

- 源码：`9e468f217da678b4e90cd40e5a886f06cb2da883`，发布分支 `release/20261105-preview` 同步 master `a7b97598`，包含 #176 摄影修复、#177 编排入口和 #178 全屏播放。
- 固定部署：[4ee97bd4](https://4ee97bd4.gs-archive-preview.pages.dev/)。稳定入口：[preview.gs-archive.com](https://preview.gs-archive.com/)。
- read-model：`a15e642d20f5003730751d6227d95b5248f908e473e598bcce5c48a10e0cc160`；候选 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261031`。
- data revision：`d049f4fa79d4740bdef1f6dd53b59e20a41d030697c443ba2a082c58d7d5adee`；compiled revision：`4afb61ee02808965c8149f335b2f246f3afe543423f65fd8b9afa5de2c02fbed`。沿用上一版，无 R2 上传或删除。
- 包：本 worktree `.deploy/pkg-9e468f21`，8,874 文件 / 205,217,781 bytes；只包含代码、读模型、已提交译文和必要正文，无完整 public 媒体副本。打包前 E 盘空闲约 408 GB。
- `npm run build:check` 通过；`prepare-readmodel-preview.mjs` 的构建审计、读模型与节目册检查通过。Wrangler 上传 1,781 文件，复用 7,091 文件，Functions 编译和部署成功。
- 稳定入口 `preview-receipt.json` 已核对 source/release/data/compiled；`productionApproved=false`。首页、`/live/`、`/studio/` HTTP 200，保留 `noindex, nofollow`。
- 本轮浏览器验收未完成：in-app browser 打开超时；Windows computer-use 无法可靠识别浏览器 URL，工具中止 UI 操作。不能据 HTTP 结果宣称编排、播放、真机 iPhone 或全站渲染验收通过。
- 本次命令未部署 Production；既有自动构建与正式域名状态不由本记录推定。

日志：本 worktree `.analysis/preview-build.log`、`.analysis/preview-upload.log`、`.analysis/preview-translations-http.log`；生成包与日志不入库。
