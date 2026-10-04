# 资料馆桌面修整与制作人设置验收 · 2026-10-04

输入 HEAD：`e1a179eea97e12a67a0f4a04c933297c2ffc9339`。分支：`codex/portal-idol-controller-20261004`。

## 设计与实际改动

沿用 emil-design-eng 的克制层级、稳定布局和明确交互反馈原则，并使用 frontend-testing-debugging 的实际 Browser 验收。

| Before | After | Why |
| --- | --- | --- |
| 标题、双段视角、搜索、双语开关争夺同一行 | 资料馆 / 当前视角，紧凑语言下拉与图标工具；窄桌面搜索另起一行 | 保留明确状态并避免控件互相挤压 |
| 快捷搜索混入数据条 | 四项数据均分；相关搜索只出现在搜索浮层 | 数据与检索各有稳定空间 |
| 卡面便当被白色大壳包裹 | 左侧档案独立磨砂卡，右侧直接展示画作，小条融底 | 减少背景与边框套叠 |
| 49 人长列表 | 16 组合过滤、分组头像矩阵、永久担当及全站快捷操作 | 减少查找和滚动成本 |
| 壁纸竖向小缩略图及压图姓名 | 三列横幅画廊，姓名、组合、卡面版本放图下 | 按挑选背景的任务展示原画 |
| 第三章空占位和缩小主线横图 | 门户仅列两章可读主线，完整横幅，文本在下方；六分类与两章区域等高 | 保持资料事实与视觉基准一致 |
| 活动等分货架、重复回忆片段 | 连接日期节点的横向票根画卷，日期 YYYY.MM.DD，真实企划标签 | 不虚构周年、终章或编号 |
| 设置沿用首次启动窄表单与大壁纸 | 独立桌面事务手册：左侧 Producer Pass，右侧身份、启动、声音、备份面板 | 正式编辑集中管理，主页只展示身份 |

保留首次进入的 Welcome 流程与卡面 / Spine 主页；永久担当、默认首页人物、临时资料馆视角分别保存。门户默认视角为新增偏好，旧版本兼容默认为担当。显式 URL 视角优先。

## 备份边界

JSON 导出 / 导入版本 1，仅操作四个既有配置键：启动、主页、剧情播放器、资料馆壁纸。导入先校验版本、字段、枚举、范围与当前正式偶像身份，再展示恢复预览与确认。写入中途失败恢复原四键的原始字节。重置同样只覆盖这四个配置键，保留阅读进度、收藏、其他网站键与资源缓存；重置前有明确确认页。

不上传配置，不包含游戏资源，不声称账号或云端同步。配置包含剧情模式与播放器偏好，但不含阅读进度。

主音量接线覆盖剧情音频会话、主页语音会话、独立语音会话、歌曲单曲和谱面 HTML 播放器；没有扩展到 Chibi / 多轨混音 / Jukebox 的各自混音器。设置页文字明确目前覆盖范围。音频回归验证增益与会话生命周期，不作为完整媒体听感或设备播放验收。

## 验证

以下通过：

- `node scripts/verify-archive-settings-backup.mjs`：四键往返、默认恢复、未知字段 / 类型 / 范围 / 偶像身份拒绝、写入失败回滚、存储拒绝、音频增益。
- `node scripts/verify-archive-startup-preferences.mjs`
- `node scripts/verify-archive-startup-route.mjs`
- `node scripts/verify-portal-navigation.mjs`：新增默认全站及显式个人视角优先覆盖。
- `node scripts/verify-home-portal-visits.mjs`
- `node scripts/verify-archive-portal-presentation.mjs`：便携 fixture 边界。
- `node scripts/verify-archive-home.mjs`
- `node scripts/verify-home-experience.mjs`
- `node scripts/verify-story-audio-session.mjs`：100 次 BGM / Ambient 与生命周期等既有回归。
- `node scripts/verify-portal-bento.mjs E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004`：正式 49 人立绘 / 826 卡片 / 315 ALL STARS / 时间线来源及新增日期标签。
- `npm run build:check`：最终 Vite 编译 2820 modules，11.47s。固定 `.analysis/build-check`，`copyPublicDir:false`，无 public 语料复制。此前编译后按真实截图修正主线区域高度并重新编译。既有大 chunk 提示仍存在。
- `git diff --check`。

## Browser 旅程

通过 Codex Browser，独立 localhost:5209 进行可写测试，避免改动用户 localhost:5208 的本地偏好。生产代码来自上述 build-check，readmodels 及静态资源以已有路径映射，release `2a77a79a4a9b9cd850c48643941e0d492071a17830447e5ff136d3d670de0774`；无全量资源复制、部署或媒体发布。

实际验收：

- 1440×900：制作人姓名实时预览，主音量调节，首页人物 / 模式及默认视角保存，选择永久担当。
- 筛选 THE 虎牙道 / Beit 均显示 3 人；全组模式 49 人可访问，无显示更多分页。
- 个人 / 全站切换、从设置返回原资料馆视角；从主页进入正式设置，返回保留都筑圭、台词 `2_1_007_01_00_09`、服装 `007kei_002_00` 及原门户查询。
- 搜索 `K.now O.nly` 前后门户 width=1066、scrollHeight=1534、首屏 y=167.64366149902344 完全一致；结果浮层可收起，不推内容。
- 个人四指标宽度约 299.13px 均分；卡面外层背景 rgba(0,0,0,0)；渡边实相关歌曲全部 5 行。
- 壁纸 12 张首批、三列横幅、卡名与偶像名在图下；设置及重新打开后选中标记稳定。
- 门户主线仅两章；最终左主线与右分类区域均高 408.72px。五个运营节点显示真实日期及 SIGN@L / SELECTION 标签。
- 导入本地验收 JSON 显示恢复预览，确认后姓名“恢复验收”、担当渡边实、主音量 23% 实际呈现；重置确认后姓名与担当恢复默认；取消重置不改当前配置。
- 1024×768：工牌与右侧表单双栏；390×844：纵向排列。document scrollWidth 等于 viewport；390 时设置内部宽度与 scrollWidth 都为375，无横向溢出。
- 检查 Browser error / warn 日志为空。

导出触发标准 Blob 下载并显示“已请求下载配置文件”。内置 Browser 两次没有提供 download 事件 / 文件落盘路径；不能将按钮状态或 JSON 回归当作浏览器实际文件落盘证明。原生下载完成这项仍未验收，其余导入 / 恢复 / 重置已实际验收。

截图（小型证据，不含媒体包）：

- `C:/Users/windm/.codex/visualizations/2026/10/04/01a105b6-49c6-75d2-8eb1-1051da3588ac/producer-settings-desktop.png`
- 同目录 `portal-polish-desktop.png`、`portal-main-chapters-desktop.png`、`wallpaper-gallery-desktop.png`。

当前服务更新后仍使用5208；独立5209测试页及服务在验收后关闭。无关未追踪材料保留，显式 stage 本批源代码、回归与此记录。
