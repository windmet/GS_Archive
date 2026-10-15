# 切歌旧舞台清理与背屏链路核对

输入 HEAD `46d74ea6`，`stage/20261014-native-fidelity`，验收端口5212。用户要求修复 OUR SONG / HIGH JUMP NO LIMIT → JOYFUL HEART MAKER 残留，并反查背屏位置/缩放、清扫歌曲特例。

## 已确认并修正：旧静态舞台留存

Browser 实际同页操作先选择 OUR SONG，再选择 JOYFUL HEART MAKER。标题和 URL 已切换，但公开 DOM `data-stage-background-song` 仍是 `ossshd`，旧布景继续出现在画面。真实资源索引中 jfhtmk 没有静态条目，其舞台依靠 Image_layer 指令；旧 `syncStageBackground` 在 `if (!entry) return` 提前返回，跳过 release。

客户端 `LiveStage.Clear` RVA `0x1f2a710` 调用 `LiveObjectContainer.Clear` `0x221a72c`，后者 Destroy 旧对象并清理容器；`LiveStageNormalBackground.<Init>d__3.MoveNext` `0x22565fc` 对本次加载的每个 SpriteRenderer 重新绑定 Sprite，并按是否存在决定 SetActive。显示与清理均以本场资产为边界，没有跨歌曲保留旧背景的规则。`LiveObjectBackmonitorMovie.Stop` `0x2218d38` 停止电影并关闭 renderer；`Prepare` `0x2219044` 也先关闭 renderer。

网页修正：

- `handleSongChange` 在音频/演员异步准备前同步 release 静态背景、Image_layer、Object_layer、Backmonitor 并补绘空出的场景。各原有 release 保留 token/sequence 清退规则。
- `syncStageBackground` 遇到没有静态条目的歌曲时清理旧背景和 pending ownership。迟到的旧纹理仍销毁，不会复活。
- 没有 jfhtmk / ossshd / hgjmnl 名称判断；无静态条目的所有歌曲共用该规则。

验证：`verify-stage-resource-ownership.mjs` 15 项通过，新增真实 SFC 的无静态条目切换、旧纹理迟到销毁、异步准备前清退检查。`build:check` 21.94s 通过，仅固定 `.analysis/build-check` 代码输出，生成元数据已恢复。Browser 5212 实际验证两条切歌路径，JF 4s 的背景归属为空，旧静态舞台已清退；控制台无 error/warn。截图 `joyful-after-our-song-scene-cleared-4000.png` / `joyful-after-high-jump-scene-cleared-4000.png` 位于本任务 visualizations 目录。未部署或修改 master。

## 背屏位置和缩放：仍在核对，不能写成完成

当前 `chibiBackmonitorCoordinates.js` 仍有 Take 231、Possibilities 242、Change to Chance (-150.5,137) 的逐歌截图补偿，以及默认250、movie纹理倍数2。这些不是已恢复的原生矩阵，本批没有用一个新补偿替换旧补偿。

新取到的 RAW / APK 证据：

- `LiveObjectBackmonitor.PlayEffect` `0x22186e0` 读取 value3/4 → `ScriptPosToStagePos` → localPosition；value5AsFloat 设置 root XY scale。已重新逐条核对 AArch64 调用参数和返回 XYZ。
- `ScriptPosToStagePos` `0x2218894` 三轴减 BasePos 后乘 pixelToStagePos；`.cctor` `0x2219f74` 的常量 `0x32d4d78` 加显式Z=0为 `(0,360,0)`。该坐标链与现用250补偿不同。
- resources.assets GameObject23467 `LiveObjectBackmonitor`，Base7269 的 XY position=0、scale=1，仅Z=20。
- Movie prefab绑定 MonoBehaviour110859 → GameObject8836 `LiveObjectBackmonitorMoviePanel` → SpriteRenderer53127 → Sprite1734。RectTransform XY=0、scale=(16.25,8.4375)、SizeDelta=(1,1)，renderer初始order1000。Sprite1734 为32×32、PPU100、居中pivot，因此原始显示面为520×270 stage pixels（仍需串完 CRI controller 实际显示路径，不能仅凭该局部数值改最终布局）。
- Movie controller125252 是 CriWare.CriManaMovieController，target绑定53127；不是依据视频分辨率猜测Unity几何。现有MP4索引272×144不能直接证明应乘2得到正确原生显示面。
- LiveStageNormalBackground29146：Stage01/02/03 XY position=0、scale=1，orders1100/1300/1500。LiveObjectImage_layer31744 / _2 31750 root及SpriteRenderer子节点也为XY=0、scale=1；容器 Create/Preload 最后 Identify root transform。
- song_tkstp1 / song_jfhtmk 的 stage_01 Sprite rect1900×1060、PPU100、pivot(.5,.5)，实际mesh范围X[-9.5,9.5]、Y约[-5.3,5.3]。未发现可以直接解释逐歌补偿的 mesh 平移。

本轮小型 RAW probe 保留在 `.analysis/native-engine/backmonitor-prefabs-full.json` 等 E 盘本地文件，未修改共享 public/assets。下一步继续串联显示链，验证完整矩阵后移除歌曲特例；当前未宣称 JF 顶部穿帮已经修好。
