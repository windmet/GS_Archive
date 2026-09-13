# Archive visual primitives cleanup

输入：`codex/p1-effect-texture-deps`、`8898902`。仅调整 Archive 展示，不改变目录导航语义、Mobile identity、Reader canonical、StoryAssetPlan 或资源生成层。日常验证使用 `build:check`（不复制 public）；截图和临时 QA 脚本在仓库外 visualizations。无关未跟踪文件保持原状。

## 01 · 共享人物头像与 49 人目录

新增纯视觉 `ArchiveIdolAvatar`：角色色 shell ring、独立圆形 clip、统一图片 scale、archive/mobile 变体和加载失败首字回退。路径直接调用已有 `AssetResolver.getCharaIconUrl` / `getMobileIconUrl`，并将 IdolReference 的候选地址也改为 resolver；不创建第二份路径规则。IdolReference 的 event story visual 仍保留非头像展示。Picker、人物资料、Work、Mobile、组合成员 stack 与卡片人物关系均复用头像 primitive。

偶像目录保持原有 49 人密度和三列窄屏网格；增加代表色、组合名次标签与人物色 hover/focus。目录标题改为“偶像档案”，不更改 `view=idols` 导航和筛选。颜色来自既有 idol 字典；组合归属仍由 manifest 关系给出。

验证：`build:check`、`verify:archive-presentation`、`verify:unit-page`、`verify:communication-assets` PASS。5175（本 checkout Vite）/ Playwright Chromium 1280×850 与 390×850：49 个目录头像和 49 个组合次标签完整，目录选人进入资料页；人物资料、Picker、Work、Mobile、组合成员、卡片关系头像无坏图或横向溢出；页面无 console/page error。Browser 插件未提供，使用现有 Playwright runtime。未逐一人工比对 49 张素材，也未做真实设备 safe-area 验收。
