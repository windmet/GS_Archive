# Penlight 命名事件与网格消费者（2026-10-15）

输入 HEAD `58248e68`，分支 `stage/20261014-native-fidelity`，本批前已用 merge 跟进 origin/master。工作目录 `E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer`。只在本机 5212 验收，未部署、未向 master 推送。

## 来源与接线

- 60 个 RAW bundle、118 个编排，导出 `Penlight` / `Penlight_unit` / `Penlight_unit_color` 共 6,697 条命名事件。新文件 `public/data/stage-penlight-commands.json` 为 1,658,083 bytes，SHA256 `68492a52865cb50ef0cd5db6de5d5035352f60f2986f5840c1c663d4ee8d1f24`。不重写共享 penlight/choreography 资源。导出前后检查 RAW、索引、模型和 masterdata 哈希。
- normal：value1 身份、2 prefab、3 动作族、4 变体、5 速度 /1000、6 HTML 色、7/8 坐标、9 缩放 /1000、10 排序。unit：6/7 坐标、8 缩放、9 排序、10 分色模式、11…17 调色板；unit_color 从 value11 以 `&` 拆分。短表头缺失的末尾色值保留为空，按命名列读取而非固定数组偏移。
- 对象身份为 prefab + id。原生 PlayEffect `0x22227dc`，PlayEffectUnitAndMain `0x22228c4`；Erase 只 ResetColor，保留对象、动作、位置、排序和调色板缓存。实际 RAW 没有 Penlight erase，复位行为由合成回归覆盖。
- SetAnimation `0x2222284` / cctor `0x22236d0`：Beat 三段、Wiper 四段、Yeah 三段；SafeGet/ToValidIndex 把动作族 0 钳到 Beat，变体 0 随机选一次供整组使用，每 actor 独立 0…0.1 初始归一化时间。支持 position/scale XYZ 和 Euler Z 三次曲线；真实资源 Euler X/Y 恒零，其他离面旋转拒绝绘制并隔离图层错误。
- 颜色取 IdolData 表 2 的 resourceId 字段 10 / PenlightColor 字段 39，共 49 色；歌曲 IdolType 取表 46 字段 13。没有用组合色替代偶像字段。`#IdolColor1…5` 从当前出演成员顺序解析。模式 1 打乱 actor 后循环分色；模式 2 按 X 分连续色块；相同调色板与模式跳过重复上色，复位不清除该缓存。
- 复用既有 native penlight 模型：82 + 1、29 + 1 个 actor/shadow renderer；Sprite 紧网格和 UV、序列化层级、原始颜色、Animator 状态与 streamed clips 直接消费。每个 renderer 单独进入共享舞台 camera 容器，命令深度只作用 actor，shadow 保留原始排序。纹理由 generation store 共享持有；mesh/material/geometry 私有释放，切歌及卸载释放，晚到纹理不得复活旧舞台。
- lite/full 均可显示应援棒，另有独立图层开关。可选数据加载不阻塞人物；哈希不一致、取消或资源失败不作为成功，渲染异常隔离在应援棒消费者。RAW 矩阵三类指令从 missing 改为 partial，来源统计补入事件数。

## 验收

- `python scripts/verify-chibi-penlight-commands.py`：重排/短表头、字段映射、同时间行序、类型、erase、field39 与 field13 protobuf 读取通过。
- `node scripts/verify-chibi-penlights.mjs --published-assets`：全部 6,697 条真实事件 / 118 编排，动作/相位/曲线有限值、分色缓存、复位、回跳稳定、UV、私有资源释放、部分分配失败清理、真实 loader 哈希与取消通过。
- `node scripts/verify-stage-command-coverage.mjs --published-assets` 与 `node scripts/verify-stage-resource-ownership.mjs` 通过。`npm run verify:source-batch` 为 135/135 通过；日志在 `.analysis/penlight-source-batch.log`。
- `npm run build:check` 通过（21 秒），输出仅 `.analysis/build-check`，`copyPublicDir:false`；现有大 chunk 提示保留。生成的资源/翻译审计元数据已恢复，不夹带提交。
- 实际 Browser，`http://127.0.0.1:5212/?maintainer=1&view=chibi_stage`，复用 PID 61564 的 Vite。勇敢なるキミへ 3/3 人就绪，1 组 / 83 renderer；开关 83 → 0 → 83；预载后播放时钟运行、暂停和回跳正常。切 DRIVE A LIVE 后 5/5 就绪，3 组 / 143 renderer，时间轴 0 → 26 秒 → 0 正常，原曲旧组未残留。
- 桌面 1440×900、手机模拟 390×844 已观察并保存截图：`C:/Users/windm/.codex/visualizations/2026/10/14/01a13b34-f8ad-7920-8ee0-22c322a422ee/stage-penlight-drive-desktop.png`、同目录 `stage-penlight-mobile.png`。首次真实回归发现缺 Euler 曲线导致人物加载报错，修复后重新加载/播放/切歌没有新增 app error；旧错误日志保留为诊断证据。既有 Spine warning 不作为本批等价证明。

## 保留边界

这批证明来源接线、浏览器绘制及基本控制，不证明原游戏视觉等价、真机帧率、长稳或发布包完整性。

Unity/System.Random 的运行种子未知，预览使用确定性随机流保证暂停和回跳稳定。模式 2 暂用序列化 world X 排序，尚未对齐命令执行瞬间的动画 world X；原生 Awake 的分组抖动和分色也需要原片核对。空调色板的原生 fallback 尚未完整恢复；本次真实 unit 事件全部有非空可解析 token。相机、透视以现有正交舞台接线为基础；透明排序、shader 色彩及密集绘制仍须原片/真机证据。矩阵保持 partial，不将这 6,697 行计为原版验收完成。
