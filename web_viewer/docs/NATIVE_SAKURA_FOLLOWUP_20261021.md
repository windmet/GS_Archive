# 樱花资源接线续批

输入 HEAD `32ad3a16`，分支 `stage/20261020-native-followup`。本批接入原有编排引用、但缺少消费者的四个资源：`fx_in_ksktfg_sakura`、`fx_in_itowks_sakura_1/2/3`。未修改运行时求解器，也未添加逐曲视觉调参。

## 来源与范围

- `liveobjectobjectlayer_fx_in_ksktfg_sakura.unity3d`：SHA-256 `18ea39874b5c3ba3a1a380e706feb3555b573894accf98ef4933d5d378a66a9c`。
- `song_itowks.unity3d`：SHA-256 `c8c633970321c50cc5dd9987cdb98c7f22c967e87d44f4e1cff5daeb2262e27e`。
- 每资源 4 个系统，共 16 个；全部使用既有 `native-high-curl-v1`，保留 `noise_preview` 边界。来源 bundle、serialized file、PathID、参数树哈希冻结在 promotion fixture。
- 新增 4 张来源纹理，共 24,816 bytes。真实 Texture2D 名为 `fx_in_ksktfg_sakura` 和 `tap_shine`；64 位 PathID 保留为字符串。实际 RAW RGBA 比对通过。
- 旧 86 个模型与 97 份纹理描述和晋升前快照逐项结构比较相同。

总量为 **90 资源 / 748 系统 / 101 纹理 / 0 deferred**；56 个 partial 系统中 Noise 48、stretch omitted 7、stretch preview 1。完整晋升的 32 资源 / 166 系统不变。

编排覆盖 `drv999`、`hrkzbn`、`itowks`、`ksktfg`、`syksai`，共 23 个 Show/重启窗口。现有烟雾 32 个窗口仍覆盖，published-assets 检查合计 55 个，遍历全部引用编排。樱花闪光子系统有 1.5 秒来源启动延迟，粒子最长寿命 3.8 秒，因此激活/退役检查按各系统来源界限采样；原烟雾 26 秒清空断言保留。

消费 census：137 种被引用粒子中，缺消费者 **26→22**，事件 **369→336**，涉及编排 **16→11**；partial 资源 **17→21**；缺来源资源仍为 0。尚缺的 22 种及原片/设备/随机时钟边界继续开放。

## 分片与 Browser

消费者目录已重新生成，共 209 片（公共 1、Penlight 118、emitter 90）。完整发布闭包为 **4 目录 + 446 分片 = 450 文件 / 33,062,647 bytes**，实际路径、长度、SHA-256 校验通过。分片是本地派生资源，后续发布必须包含当前目录引用的全部文件。

新路径在旧 5213 进程返回 HTML；确认后只重启该 Vite 服务，端口、checkout、`rm-release-20261015` 候选保持一致。新 shard HTTP 返回 application/json。Browser 使用完整加载：

| 编排 / 时间 | 观察 |
|---|---|
| itowks 76s | 三路樱花可见，含抹茶的对象粒子总数 563 |
| itowks 82.4s | 樱花均退场，剩抹茶，总数 31 |
| itowks 89s | 三路樱花重启，总数 514（含当时其他对象） |
| itowks 回拖 / 刷新后 76s | 均恢复 563 |
| itowks 实际播放 | 从 76s 启播，90.5s 暂停 |
| ksktfg 92s | 樱花可见，162 粒子 |
| ksktfg 94.2s | 樱花退场，无对象粒子 |

两首在桌面 1280×720、手机尺寸 390×844 检查；手机 document width/scrollWidth 均 390。活动窗口 unsupported/deferred 均为空，两首控制台 error 为 0；不宣称 warn 为 0。截图位于本机 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`itowks-sakura-76s-desktop.png`、`itowks-sakura-76s-mobile.png`、`ksktfg-sakura-92s-desktop.png`、`ksktfg-sakura-92s-mobile.png`。

## 验证与发布边界

RAW generator 检查、emitter published-assets 回归、consumer 生成一致性、consumer guards、stage inventory 和实际完整闭包检查通过。publication ledger 205 releases / 1,372 stable IDs，PNG inventory 407 文件 / 72,783,304 bytes。历史 archive baseline 仅同步这两个 PNG 统计字段，没有重新宣称全语料验收。

`npm run build:check` 通过：2,979 modules，25.39 秒，入口 gzip 206,059 / 215,040 bytes。使用固定 `.analysis/build-check` 输出，没有复制 public 语料；构建重写的资源/翻译审计元数据已检查并还原。

`npm run verify:source-batch`：164/164 通过。提交前 diff 检查通过，未混入无关删除、未跟踪脚本或其他工作区文件。

本批 ledger `2026-10-21-native-sakura-followup-001` 记录本地来源晋升；没有 R2 上传、部署或生产回滚。Browser 仅证明所列本地样本，尚未证明原片粒子密度、原生随机轨迹、设备及正式站一致。
