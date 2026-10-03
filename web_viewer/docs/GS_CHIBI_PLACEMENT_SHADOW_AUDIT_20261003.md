# 独立站位轨道与原生脚下阴影

输入 HEAD：4bebf276，分支 codex/chibi-stage-reconstruction-20261002。

## 站位故障

∞ Possibilities 的 51400ms 动作 19019 将左侧 performerSlot 2 的 Y 写成 140、中央 performerSlot 1 的 Y 写成 270；独立 position 轨道始终是左侧 270、中央 140。旧消费者按最近事件时间选择坐标，动作行覆盖站位行，直到 53300ms 下一动作恢复。RAW 未修改。

统一消费者现以独立 position 的 XY/scale 为准；仅缺少独立轨道时采用动作坐标。350ms 站位/缩放插值保持。跨库检查发现 67 个编排、10479 个动作/独立站位 XY 差异；这证明优先级修复影响通用链路，不等于全部编排已对录屏验收。

## 阴影原生绑定

resources.assets：LiveObjectIdol1 MonoBehaviour 134600（SHA256 24149d65caae77652e559b0212d8724c93816fd76cc44762fe9e432f0ede3d92），raw offset 44 绑定 SpriteRenderer 54850，offset 92 绑定 BoneFollower 129109。二者同属 Shadow 对象 29300；BoneFollower 原字段为 `shadow`。Sprite 2799 对应 Texture 932 `tex_chara_shadow_2`，400×80，pivot=(0.5,0.5)，PPU=100。原生五种 SkeletonDataAsset scale≈1/300，因此转换系数为 3。

替换旧的服装图集中方形影子压扁方案。使用原生椭圆，原 alpha 保留；角色每次 Spine pose update 后读取 shadow 骨骼，同步位置、缩放、排序。缺资源或缺骨骼时抑制，销毁时释放 follower 包装；使用既有演出时钟。

## 验收

- Python 原生绑定/hash/PPU/纹理守卫通过。
- Node 实际 psblts、byndtd03alt、steqmg fixture 回归通过：51.4～53.3s、倒退、独立缩放插值、离场 5000 坐标、无轨道回退、骨骼位移、跟随更新及释放。
- published-assets 原生纹理/模型检查通过；既有 1178 个位置/118 编排投影及聚光目标回归通过。
- npm run verify:engineering 通过；npm run build:check 2785 modules，16.40s，通过。无 public 语料复制。
- 5198 既有 preview 服务映射该 build-check 和已有资源。Browser 1280×720 定位 52000ms：三人留在左右台和中央台；53300ms 和倒退 52000ms 落点一致。390×844 模拟窄屏：同一站位、阴影同比缩放、页面宽度 390 无横溢出。

截图位于 `.analysis/engineering-validation-20261002/possibilities-placement-shadow-52s.png`、`possibilities-placement-shadow-mobile.png`。不是实体设备、全曲逐帧或发布验收。背屏旧统一偏移、其余未实现灯光类型和 Take 315 标志仍另行处理。
