# Pavé Étoiles：环面发射器与地板面板接线

输入 `7ebfaf3c`，继续 `stage/20261022-particle-gaps`。接入 `fx_in_pavetl_panel` 全部三系统：两路 shape17 环面、一条已支持的球形发射器。未上传 R2、未部署。

## 原生形状与受控回放

实际 Unity 分派的 shape17、arcMode0 进入 `0x861c50`（调用点 `0x856a44`）。源参数为 radius≈1.4、donutRadius≈0.4、radiusThickness=1、arc=360°、spread=0、shape scale=(4,0.5,0.1)。Native 模块相应字段为 `+0x10/+0x54/+0x50/+0x68/+0x70`；没有把 shape17 当作圆或盒子，也没有用目测系数代替来源参数。

原生随机环面先生成主环角、截面角，再生成截面半径。其半径比例是 `q=inner+(1-inner)*u`，`inner=max(0.001,1-thickness)`；不是面积均匀分布的平方根采样。位置为主环半径加截面水平分量，Z 为截面竖直分量，最后应用来源 shape scale。

新 `prepare-chibi-torus-fixture.py` 使用同一 SHA 绑定的 Unity ELF，真实执行 worker 和 `0x8611d8` 辅助函数。6组参数（含实际来源、不同厚度/弧长、退化半径/管半径）×5组四通道 RNG 状态，共30批/120粒子；独立检查三次 xorshift128 更新与原生最终 RNG 状态一致。不是替换函数来生成期望值。

原生记录包含最终位置、进入助手前观察到的方向、助手输出向量。采样器与120粒子的位置/原始方向、控制矩阵下的助手向量比较通过，最大差约 `4.47e-6`，门槛 `2e-5`。只有这两路有来源绑定的零初速度环面准入；合成参数不扩张准入范围。

方向范围明确保留：当前注入矩阵会缩放助手输出方向，不能把未缩放的单位方向冒充原生世界速度。共享形状采样器仍返回原始方向约定；本批源速度分别为常量0和双常量0/0，无重力、速度/限速、Noise或方向对齐，也不是 Stretch，因此方向差异不会参与这两路的位置和四角。原生调用者的矩阵构造、速度初始化与运动环面需另行完整回放，未据本批放开。

## 来源准入

模型冻结 bundle SHA、精确 serialized file/字符串 PathID、参数树 SHA、父链和完整 ShapeModule。shape17 必须绑定 `native-random-torus-v1` 及证明文件 SHA，否则采样器拒绝；提取器同时限制随机常量 radius/arc、spread0、无额外随机方向/位置、无形状纹理、零平移/旋转、二维 Local billboard、统一尺寸和零初速度。

证明从第一版起写 LF，并在 `.gitattributes` 中固定精确字节合同；不重写前批两份证明或其公开引用。原105组模型和119份纹理描述逐项结构比较不变。

## 资源与门禁

- RAW 不写入重提取及像素比较通过：106资源/847系统/122纹理，deferred0；旧105个partial系统保持原标记。
- Native生成器不带`--write`重放：30批/120粒子通过；新增资源的普通生命周期、容量、回拖与停止后回收门禁通过。
- 新增三张PNG，共388,937 bytes；总428 PNG / 75,285,243 bytes。台账213 releases / 1,393 stable IDs。
- consumer目录72,665 bytes、common253,345 bytes、emitter3,396,958 bytes。完整磁盘发布闭包4目录+462分片，共466文件/33,558,305 bytes；来源/hash/大小校验通过。没有上传这个闭包。
- 无consumer缺口7→6资源、121→120事件、4→3编排；剩余为pcuslv四组Bloom、tktkkt电弧与bnckgy火焰。
- `npm run verify:source-batch`：167/167；`npm run build:check`：2,974 modules / 24.31秒，固定`.analysis/build-check`且不复制public。构建生成审计元数据已还原。

日志在本checkout的`.analysis/torus-source-20261022.log`、`.analysis/torus-build-20261022.log`，缺口报告`.analysis/torus-coverage-20261022.json`。

## Browser

Codex In-app Browser，本地主checkout5213 / PID73812、`rm-release-20261015`候选、完整模式。全部数据生成完成后才重启同端口服务；新common分片真实HTTP返回application/json。使用手工五人编队，不是原曲成员验收。

桌面1280×720；开场0秒负2秒激活已生效，总对象粒子112。10秒和60秒均包含panel且总对象粒子120，地板光斑可见；回拖10秒恢复120。实际从10秒播放，观测至109.8秒，随后曲末114.6秒自动停下；回拖后重新起播并在19.1秒手动暂停成功。一次暂停定位恰逢曲末按钮切换而未匹配，随后已按新DOM状态重做操作，不是暂停超时。

手机390×844，document/scrollWidth均390；截图保存在本机`C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`torus-pavetl-10s-desktop.png`、`torus-pavetl-10s-mobile.png`。冷重载后定位10秒恢复120；实际舞台内切至VIVA先清空旧对象/粒子为0，随后VIVA ready=true、876粒子，切歌后console error仍为0。

采样窗口ready=true、unsupported/deferred为空，console error=0，不宣称warn=0；页面身份/内容及截图正常，无框架错误覆盖层。这是来源几何与实际消费者验收，不是原生出生RNG、帧时钟、设备、投影/遮挡或原片整场景等价。
