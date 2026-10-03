# 舞台控制面板与两级选曲验收

界面开发输入 HEAD `7efd97e5`，提交基线 HEAD `a578331e`，分支 `codex/chibi-stage-reconstruction-20261002`。本批提交舞台/单人实验室界面、正式名称与演出编排选择。另一个窗口已在 `a578331e` 独立提交灯光、地板、背屏与工作流，本批保留该基线。

| Before | After | Why |
| --- | --- | --- |
| 118 个脚本混在一个曲目下拉框 | 60 首实际歌曲 → 每首的精确编排 ID | 歌曲与人数/站位解耦 |
| 展开曲库改变控制区重心 | 当前歌曲/编排固定在上，搜索与曲库常驻在下 | 搜索不移动当前设定，列表单独滚动 |
| 当前歌和列表都是同层白底 | 当前设定浅青底；白底曲库以“当前曲目”标记所选项 | 暂停时不误称“播放中” |
| 手机声部设置挤掉曲库 | 当前歌同行音源入口；完整开关/混音在独立弹窗 | 不丢功能，保留列表热区 |
| 外层页面与控制栏同时滚动 | 舞台独占视口，控制区按内容滚动 | 桌面默认一屏，手机操作时舞台可见 |
| 头像与纯文字站位重复；Solo 高度不同 | 一条可编辑头像栏，桌面休息卡等高 | 减少重复，麦克风随真实脚本声部切换 |
| 个人衣装与全员衣装重复下拉 | 个人衣装同步入口＋两套经全目录验证的共通套服 | 不把个人/组合专属衣装当作全员共有 |
| 技术日志与观看设置混排 | 画面 Tab 保留常用设置；检查器两列图层＋折叠日志 | 效果覆盖与来源统计位于最后 |
| 舞台黑边、单人实验室深色原文 | 桌面现有舞台图轻模糊衬底，Stage/Spine 正式中日名与亮色面板 | 不增加第二套实时 Canvas |

## 数据依据

118 个 authored 脚本 ID 全部保留，按 `songCode` 分为 60 首：5 首全员/自由编成、47 首组合、8 首特别编成。分类取正式 performance scope/archive status 与明确 vocal mode；不将缺证据记录补成属性曲、Another Vocal 或热门曲。`Take a StuMp! 01/02` 保留各自源身份。搜索当前支持曲名、读音与组合，不声称歌曲库支持全部成员拼音检索。

人数表示脚本有效舞台位置。Altessimo 是 2、3；Jupiter 是 2、3、4；High×Joker 是 1–5；Solo/Multi/Single 保留名称，实际一个中心槽位。休息位禁用且不进入角色选择。

全部 48 个 Unit 版本使用正式目录的 49 人成员与脚本映射。“原曲成员”按明确 performerSlot 顺序排列，是可调整的 UI 规则，不声称官方角色站位已逐帧核对。自由编成/特殊曲或不完整映射不制造阵容。

共通快捷栏只显示正式 49 人目录全覆盖且原名一致的“茁壮明彩 / グローイングブライティ”“初次成长 / ファーストグロース”。初次成长跨四种 local ID，逐人解析实际资源。同步当前衣装按参考偶像确切 ID 获取源名，再逐个匹配出演成员原名；相同 ID、相同中文译名或近似名称不代表同套。目标缺失/歧义保留原样，结构/参考歧义拒绝生成计划，休息位不修改。

## 代码与 Browser

- 最终 `npm run build:check` 15.54 秒通过；`copyPublicDir:false`，复用 `.analysis/build-check`。构建前后界面输入 SHA256 一致，没有全媒体复制。
- `verify-chibi-panel-presentation.mjs`：实际 48 Unit/49 人、两套全49衣装、Jupiter SSR 部分匹配、跨 ID、歧义、冻结输入与休息位保护通过；已发布 d30e read-model parity 通过。
- `verify-chibi-song-library.mjs`：60/118 精确身份、组合/原文搜索、真实槽位与来源类别通过。
- `node --experimental-vm-modules scripts/verify-chibi-song-picker.mjs`：编译真实 SFC 并内存渲染；常驻上下区、命名音源入口/兼容插槽、共享分类 state、当前版本/徽标、空结果、禁用、外来/未知身份、长标题通过。此为行为合同，不替代 Browser 几何。
- `verify-stage-intent.mjs` 35 场景、`verify-song-stage-handoff.mjs` 与 `node --experimental-vm-modules scripts/verify-engineering-lifecycle.mjs` 20/20 通过。
- 最终 Browser：320×740 根/滚动为320×740，按钮/select/input无横向越界；Solo 当前设定约106px、列表约51px，侧栏254/254，不再塌为0。手机“演唱”文字仍隐藏。
- 390×844 搜索 Jupiter 得6首；组合分类得3首；当前 DRIVE A LIVE 点击后仍是 Solo Multi 精确 ID；列表约116px，当前曲目徽标正确。
- 手机音源弹窗实际开启 Center 声部，ready=true；可展开声部/伴奏滑块并关闭，根尺寸不变。
- 320×568 极短竖屏：下半区一个 scroller，歌曲列表 overflow visible；可滚动点击 K.now O.nly，根仍320×568，没有嵌套列表滚动。
- 1280×720 根/滚动一致，曲目侧栏582/582，列表约209px；搜索前后 current/list 的 y、height 完全不变。1920×900 根/滚动一致，曲目侧栏761/761、列表约385px。
- Desktop Jupiter 与 Solo 五个卡片均约88.61px等高；时间轴 Home 时实际声部/麦克风为3，End时为2/3/4，二者一致。
- Actual Jupiter 原曲成员为2翔太/3冬马/4北斗。冬马“午夜行星”同步后提示仅1人匹配，翔太/北斗仍“茁壮明彩”；“初次成长”快捷后3人换装成功。换装后实际播放并暂停于0:31。
- 844×390 横屏根尺寸一致，舞台约336×189，控制栏约266×326，列表约58px。纯净模式舞台约694×390，Escape返回入口焦点。
- 检查器实际八个两列开关44px，运行时默认关闭、统计最后；关闭焦点恢复，根尺寸不变。
- 单人实验室实际1280×720与390×844亮色控制栏、正式中文名；初次成长可加载，切日文为正式原名，窄屏根宽/滚动宽均390。它保留实验工作区，不将其控制区称作舞台默认一屏。
- 最终舞台 Browser console error 为0；既有 bundle-size/Pixi deprecation 警告不作为视觉或复刻正确性证明。

验收服务 `127.0.0.1:5204` 使用 RAM 固定代码，最终 PID58144。根HTML SHA256 `76ebe81ceee366a2f63e454ccc164ec4480005dcc1e64bcf2e0c91d57f07c07b`；舞台JS SHA256 `8a93aa5d8bcf8a8c093385305a2c7afc6bf4a0ea41f4e488edf494a022faea15`。输入/manifest/日志/截图在 `.analysis/ui-chibi-panel-20261003/`，其他服务未停用。

截图：`desktop-stage-final.jpg`、`desktop-solo-final.jpg`、`desktop-partial-costume.jpg`、`mobile-320-final.jpg`、`mobile-390-fixed-library.jpg`。手机viewport最后已复原。

## 验证边界

Browser 编译共享工作区的灯光源码；最终以另一个窗口完成的 `a578331e` 为提交基线，复核剩余 Stage 差异仅为本批界面接线与布局。旧行号构造的暂存候选已弃用。未将其他窗口可见灯光当成本批复刻正确性证据。

PNG 使用现有 Pixi canvas 提取与持久 Blob链接。页面生成链接已验证；IAB文件落盘无有效结果，仍待实际浏览器下载验收。JPG是Browser验收截图。仅viewport测试，无实体手机、系统方向锁定/设备全屏、逐帧复刻或长期性能验收。

媒体沿用现有 public，资料使用本地 JSON 候选 `card-material-preview-readmodels-20261003`，release `0b0612426eeb7090b52aacc59a09fd6c580646827a5e5a194cf0e9c9d3b44c0b`。5204明确覆盖本地bootstrap；正式仓库bootstrap未改，本批尚未R2发布。
