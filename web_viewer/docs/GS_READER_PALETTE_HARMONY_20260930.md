# 阅读器配色统一校准

输入 HEAD `c4b7a552`，分支 `codex/story-interaction-v2-before-b002`。
本批落实用户的新配色意见，替代[第一版阅读主题](GS_READER_THEMES_20260930.md)的色值。

同时落实用户追加的桌面头部优化：整话头部原本只有高度与边框，返回键贴边，
抬头按 inline 排列；单段头部则使用绝对定位返回键。两处改为共享 `ReaderPageHeader`，
沿用门户 `ArchivePageChrome` / `ArchiveBackAction`，以正常 flex 排列返回键与标题。
头部与正文使用相同 1000px 宽度和响应式内边距；桌面高度 76px，与门户一致，
移动端 64px 并保留 safe-area。取消绝对定位，返回键保持至少 44px 点击区。

## 行为与颜色

输入框、查找框、STORY 简介、场景框此前已经使用 Reader 变量；本次更新这些变量，
并让角色名、激活按钮、边线、焦点和返回按钮的强调色随主题变化。
暖纸改用复古森绿，夜间采用亮青底与深色按钮字；薄荷降低页面色彩浓度。

| 主题 | Page | Card | Border | 正文 | 辅助 | 强调色 | 强调块字色 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 极简白 | `#F8FAFC` | `#FFFFFF` | `#E2E8F0` | `#1E293B` | `#64748B` | `#1E7A70` | `#FFFFFF` |
| 护眼暖阳 | `#F3EFE6` | `#FAF7F0` | `#E4DCCE` | `#383129` | `#746B60` | `#4A6B5D` | `#FFFFFF` |
| 深夜暗色 | `#0F172A` | `#1E293B` | `#334155` | `#F1F5F9` | `#94A3B8` | `#2DD4BF` | `#0F172A` |
| 冰青冷调（事务所） | `#EDF5F5` | `#FFFFFF` | `#D3E4E4` | `#133036` | `#527279` | `#208075` | `#FFFFFF` |

指导中的暖色边框 `#E4DC CE` 修正为合法的 `#E4DCCE`。
暖纸辅助色从 `#7A7165` 小幅调深为 `#746B60`，薄荷辅助色从 `#57777E` 调深为 `#527279`；
薄荷角色名等文字强调色为 `#1E7A70`，按钮与细边线仍为 `#208075`。
按相对亮度公式计算主字、辅助字、强调文字在 Page/Card 上及激活按钮字的对比度：
四套最小值分别为 4.55、4.56、5.71、4.66，激活按钮分别为 5.16、5.91、9.59、4.77。
这是颜色对比核对，不是健康效果验证。

第四套主题规范 ID 改为 `mint`；读取旧 `sidem_reader_theme=game` 时映射为 `mint`，
不在初始化时覆盖存储。接受旧 setter 值 `game`，后续选择统一保存规范值。
受限存储回退、默认白色、四个按钮的辅助名称与键盘操作继续保留。

## 验收

- `npm run verify:reading`：来源、2801 阅读文档、视觉身份、导航、播放映射、
  Vue SSR、排版与主题偏好通过；新增旧 `game` 偏好兼容回归，单段/整话四套 SSR 通过。
- 头部改动后再次运行实际 Vue 渲染回归与 `verify:archive-presentation`，均通过。
- `npm run verify:reviewed-b001`：52 文档、42 catalogues、993 reviewed 单元身份保持。
- protected guard：6551 文件无变更、缺失或新增受保护文件。
- `npm run build:check`：完整代码编译，复用 `.analysis/build-check`，`copyPublicDir:false`。
  提交后重建并执行 `verify:build-audit` progress 检查，使编译证据绑定干净 HEAD。

实际 Browser 使用已有 `http://127.0.0.1:5197` 预览进程（PID 33888），未重启服务器。
预览由 build-check bundle、原 public 与外部模型映射组成，不复制完整媒体。
独立临时 QA 页核对四套 computed colors、薄荷刷新保持、单段继承、双语与真实选项保留。
1280×900 暖纸及 390×844 夜间实景通过；暖纸输入框/简介/场景框均为暖白，
夜间查找框和移动底部导航均为深蓝灰。页面非空，无横向溢出、无错误覆盖层，控制台无 warn/error。
头部改动后在 1280px、700px、390px 核对：整话头部与正文左右边界、宽度一致，
返回键与抬头均位于头部内且互不重叠。单段阅读同样对齐，返回动作回到第1章目录。
桌面暖纸头部截图为第5話《トリニティ・アタック！！！》。
EPISODE 01 的 `appeal` 标记继续不显示，来源 revision 保持
`sha256:90b8410a393383dda63fd71a8fa3e464f9a0bb70864cae7eab9bf42a2dbf963a`。

小型证据位于 `.analysis/reader-palette-v2/`：`browser-colors.json`、
`warm-desktop.png`、`dark-mobile.png`、`header-warm-desktop.png`、`header-layout.json` 与构建日志。
临时 viewport 恢复，临时单段 QA 页关闭；用户已继续使用的整话阅读页保留。
本批未部署、未完整媒体打包，也未进行真实设备验收。
