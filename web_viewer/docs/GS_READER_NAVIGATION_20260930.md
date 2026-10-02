# 阅读器话内与跨话导航

输入 HEAD `c5c14e50`；分支 `codex/story-interaction-v2-before-b002`。

用户确认话内统一 EP 按钮，保留下拉形式用于切换不同正式话目。

## 改动

- 单段与整话阅读共用 `ReaderStoryNavigation.vue`，移除“选择其他分段”原生折叠控件。
  按钮展示 `EP 01` / `EP 02`，当前分段具有 `aria-current`；加载、缺失与错误状态仍保留。
  桌面十列，窄屏五列；配色使用既有阅读主题变量。
- 跨话下拉框展示正式标签与标题，例如“第2話 · 初めての仕事”。
  `ReaderChapterNavigation.js` 仅按当前 collection 的正式 episode/source_file 成员关系关联正文。
  排除 canonicalRelation 关系入口；当前成员歧义、请求话目不匹配时不解锁跨话导航。
  没有可读正文或目标来源歧义的话目禁用；入口选择该话首个可读分段。
- `App.vue` 在两个阅读范围内加载正式目录，受现有导航 intent 约束。
  单段正文可独立加载，目录缺失不阻断正文；迟到的目录不得覆盖新阅读页。
  跨话保留阅读范围、语言模式和主题，清除旧行定位与正文版本。
  若返回上下文属于同一故事目录，则同步更新话目，返回时展开新话目。
- 没有正式 collection 上下文的独立阅读页继续提供同身份 EP 导航，不推测跨话目录。

## 验证

- `verify:reading`：2801 文档及来源身份、视觉身份、导航、播放往返、Vue SSR、排版、主题、头像通过。
- 导航测试追加正式/关系入口区分、缺失和歧义排除、可选目录失败、迟到目录取消、
  单段/整话范围及语言保留、旧 anchor/revision 清除、返回目录话目更新。
- SSR 测试核对 EP 短标签、当前项、跨话选项、不可读禁用和旧控件移除。
- `node scripts/verify-story-interaction.mjs`、`verify:archive-async-navigation`、`verify:reviewed-b001` 通过。
  B001 仍为 52 文档、42 catalogues、993 来源绑定单元。
- protected guard：6551 受保护文件无修改、缺失或新增。
- `build:check` 使用 `.analysis/build-check`，完整代码编译且 `copyPublicDir:false`。
  提交后再绑定干净 HEAD，执行 `verify:build-audit`。

Browser 使用已有 5197 生产代码映射预览（PID 33888），静态数据由
`E:/Web_build/SideM_Player_QA_Models_20260930` 与本工程 public 映射，无媒体库副本。
实际旅程：

1. 单段第1話 EP 01 → EP 02，标题、选中项和 URL 一致。
2. 单段第1話 → 第2話，双语及暖色主题保留；刷新恢复第2話；返回目录展开第2話。
3. 从第2話目录进入整话，选择 EP 02 定位到对应段；切第3話保留整话范围，返回来源更新。
4. 连续切第4話、第5話，最终十段正文全部属于第5話，返回目录展开第5話。
5. 390×844 下单段 EP 10 正文与选中项一致；单段及整话均可切话，五列布局无横向溢出。
6. 1280×900 下十列布局正常；页面身份正确、有正文、无框架错误覆盖层，控制台无 warn/error。

截图：`E:/Web_build/SideM_Reader_Navigation_QA_20260930/desktop.png` 与 `mobile.png`。
小型构建/回归日志保存在 `.analysis/reader-navigation-*.log`。
临时验收页关闭，viewport 恢复，用户原单段阅读页刷新并保留原定位 URL。
本批未部署，未进行真实设备或全部故事域的逐页 Browser 验收。
