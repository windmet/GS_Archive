# Archive visual primitives cleanup

输入：`codex/p1-effect-texture-deps`、`8898902`。仅调整 Archive 展示，不改变目录导航语义、Mobile identity、Reader canonical、StoryAssetPlan 或资源生成层。日常验证使用 `build:check`（不复制 public）；截图和临时 QA 脚本在仓库外 visualizations。无关未跟踪文件保持原状。

## 01 · 共享人物头像与 49 人目录

新增纯视觉 `ArchiveIdolAvatar`：角色色 shell ring、独立圆形 clip、统一图片 scale、archive/mobile 变体和加载失败首字回退。路径直接调用已有 `AssetResolver.getCharaIconUrl` / `getMobileIconUrl`，并将 IdolReference 的候选地址也改为 resolver；不创建第二份路径规则。IdolReference 的 event story visual 仍保留非头像展示。Picker、人物资料、Work、Mobile、组合成员 stack 与卡片人物关系均复用头像 primitive。

偶像目录保持原有 49 人密度和三列窄屏网格；增加代表色、组合名次标签与人物色 hover/focus。目录标题改为“偶像档案”，不更改 `view=idols` 导航和筛选。颜色来自既有 idol 字典；组合归属仍由 manifest 关系给出。

验证：`build:check`、`verify:archive-presentation`、`verify:unit-page`、`verify:communication-assets` PASS。5175（本 checkout Vite）/ Playwright Chromium 1280×850 与 390×850：49 个目录头像和 49 个组合次标签完整，目录选人进入资料页；人物资料、Picker、Work、Mobile、组合成员、卡片关系头像无坏图或横向溢出；页面无 console/page error。Browser 插件未提供，使用现有 Playwright runtime。未逐一人工比对 49 张素材，也未做真实设备 safe-area 验收。

## 02 · Mobile Hero 固定媒体几何

归一化焦点由 `resolveMobileHeroMedia` 返回，目前取样素材统一使用源坐标 `(0.50, 0.26)`，没有未经取证的角色级 override。个人背景的模糊层与主图层改为 `<img>`，共享 `object-fit: cover` 和同一 `object-position`；组合模式只保留背景层。桌面/窄屏断点只改变媒体区高度、遮罩和内容布局，不再重写图像坐标。内容高度可增长，但媒体层自身固定为桌面 190px、窄屏 210px；素材地址调用既有 resolver。

验证：`verify:story-player-ui-pr2`、`verify-mobile-archive-identity.mjs`、`verify:communication-assets`、`build:check` PASS。5175 / Playwright Chromium 1280、761、760、390、320px：个人→组合切换资源和模式正确；两图层计算后焦点均为 `50% 26%`，图片加载成功，无页面错误或横向溢出。320px 长副标题 `020hay` 使 Hero 高至 228px，媒体仍固定 210px，焦点不漂移。截图仓库外。未逐人目视校准全部 49 张房间图，尚无真实设备/safe-area 或生产媒体包验收。
