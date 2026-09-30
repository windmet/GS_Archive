# 摄影工作台本地验收

输入 HEAD：91e24802。本批为 P4 实验工作台，使用 63676a10 来源绑定与 r2 read models。

## 实现与边界

独立 Pixi 画布 1280×720；原摄影脚本指定模型与动作/表情/颈部动作，不推断服装。49 个实际 skeleton、949 条配置预设的动作名均已解析匹配。纹理与请求由工作台单独持有，取消切换与卸载不影响 ADV Player。

场景、贴纸使用已绑定原素材；相框两个 PNG 是素材片段，原 Prefab 排布未知，工作台明确使用网页角落排布。四种滤镜只作网页近似，原 shader 数值、场景效果、嘴型同步没有完成。收藏/所有权、实时取得和游戏原版摄影行为均不推断。

表情/姿势/素材有 typed photo URL；工作台返回资料页保留来源选项。缩放、横向位置和后续构图是临时工作台状态。导出读取独立 renderer 的固定 framebuffer，像素预算上限 2 MiPixels，不扩大到画布外角色范围。跨域或编码失败明确展示错误。

## 设计对照

概念参考：C:/Users/windm/.codex/generated_images/01a0f332-32b8-77a3-a80a-85c85c723da4/exec-6f877cd2-769d-4bbd-9669-a1dd8501ab01.png。仅用作构图/控件参照；人物、背景使用实际来源。保持资料馆原 11 个导航分区。语音显示真实编号，概念中的自我介绍标签缺乏来源，不采用。

## 验证进度

- `node scripts/verify-picture-studio.mjs`：49 个 skeleton / 949 个预设解析、导出预算、截断 wrapper、缺失动作、跨模型身份通过。
- 共享导航：56 个独立状态、1792 个既有组合和新增 typed photo/studio URL 通过。
- `npm run build:check` 最终代码编译 9.97 秒，固定 `.analysis/build-check`，未复制 public。`verify:build-audit` / `verify:cutover-routes --progress` 通过，36 routes；既有全站 parity/device 门禁继续 pending。
- readmodels 45 测试、既有导航恢复/关系与首开路由、Spine atlas/颈部 overlay/预载、图片生命周期均通过；B002 59 文档/999 行保护回归通过。
- 实际 IAB 生产代码 1440×1000 / 390×844：鋭心、冬馬、翔太→鋭心快速切换、百々人；真实模型、普通/joy/happy 表情、没有默认 face 的 wait_loop、冬馬 surprise + neck_question 全部载入。共用低层 parser，没有共用 ADV 播放实例。
- 场景组 1 通常1/通常2、组25（地点38）的豪雨背景可见；雨 EffectResourceId 未重建提示保留。Jupiter 贴纸、相框片段网页角落排布、单色和弱 sepia、动作播放/暂停、缩放/位置边界及重置通过。
- 点击原语音 3_4_001_01 后 HTML audio readyState=4、paused=false；切角色后 audio 数量0，画布始终1个。这是解码/播放状态，不是听感验收。
- 受控 `/assets/spines/048mom_001_00/comu.png` 一次404：显示失败、导出禁用；重试恢复实际模型。没有永久失败缓存。
- typed URL `photo=faces:14902049` 保留 joy；工作台刷新恢复，返回保留原资料来源（即使工作台内改过角色）。
- PNG 实际编码并作为可见预览重新解码：naturalWidth=1280、naturalHeight=720，包含角色、背景和装饰。更换预设/场景/构图/滤镜会清理旧预览，过期编码结果不发布。IAB 两种下载接口均未收到 blob 下载事件；文件落盘 **NOT TESTED**，不冒充浏览器下载成功。保存链接保留供普通浏览器使用。
- 窄屏 DOM clientWidth/scrollWidth 均390，画布内部1280×720、显示约317×178.5，无横向溢出；控件与语音改为单列/两列。
- 运行日志无新 error；安装的 Pixi Spine runtime 发出一次 `utils.rgb2hex` 上游弃用提示，非渲染失败。
- 小型证据 E:/Web_build/GS_Archive_Domain_Work/browser-qa-r2/：studio-mono-desktop.png、studio-export-preview.png、studio-mobile-top.png、studio-mobile-controls.png、studio-model-failure.png、studio-effect-boundary.png。已逐张用 view_image 检视桌面/窄屏/PNG预览。
- 设计 mismatch：语音被右侧长控件推低已修正，移到画布列下方；三张源表情缩略图已实现。实际源服装/背景替代概念示意人物；原相框排布未知因此保留明确网页排布边界。
- 不包含 public 全库构建或部署，不是物理 Android/iOS 验收。
