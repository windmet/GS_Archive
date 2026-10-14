# 舞台共用原版镜头采样

输入 HEAD：fd19eeba。人物、背景、新旧悬灯现在共用 nativeLightCameraAt 的镜头采样，采用原版正交尺寸插值、OutQuad、屏幕旋转方向与目标跟随时机。删除悬灯单独抵消旧镜头的接线；异步资源在暂停时加载完成也刷新镜头后重绘。

事实更正：当前 STAGE_BASE_ZOOM 已是 1，早在 cf9b991f 修改。此前两份灯光记录将 .82 写作当前值不准确，本批没有修改基础缩放或人物尺寸。此前差异是镜头插值、旋转和焦点接线。

已通过 camera-reset（保留原始视频的两组稳定平移见证）、placement-shadows --published-assets、architecture-cleanup 和 build:check。构建输出 .analysis/build-check，不复制 public。

5212 现有服务上，Edge/Playwright 实际加载验证 Drive 19s 的灯和五个人物根坐标、播放暂停与反向 seek、390×844、Growing/Moon 6s、Platinum MASK 112.9s、Study 镜头复位。24 个原始贴图 GPU 加色样本 RGB 最大误差 0；无页面错误。小型截图和回执位于 C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e/shared-native-camera-*。

另试验 Study 片头光学配准，相关性很低，不能作为新镜头缓动的视频验收。没有据此宣称完整视频、图层、后处理或真机一致；图层问题按 STAGE_LAYER_AUDIT_TODO_20261014.md 继续。
