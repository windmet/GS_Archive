# Take 结尾背屏标志翻转接线

输入 HEAD：`961e02b6`；分支 `codex/chibi-stage-reconstruction-20261002`。

## 本批结果与来源

Take a StuMp! 01/02 的结尾背屏原先只播放星云视频，没有加载其独立 RotateSprite。现在使用原始蓝色 M 标志，接上原生两秒旋转曲线及带透视 UV 的独立网格；正面、侧面、背面共用同一原图，背面不剔除。网格位于电影之上、独立转场之下，并随舞台屏幕投影缩放。

Android 2.6.10 内置 `resources.assets` 的来源链：

| 对象 | 原生身份与参数 |
| --- | --- |
| RotateSprite MonoBehaviour | PathID 132450，80 字节；Sprite PPtr 1832，Material PPtr 104；默认 RGBA=(1,1,1,0)，rotation=0，perspectiveAngle=10 |
| Sprite / Texture | `live_backmonitor_movie_logo_m`，1832 / 463；1200×800，pivot=(0.5,0.5)，PPU=100 |
| Transform / Renderer | 44407 / 45611；原点位置、单位四元数、scale=(0.35,0.35,1)，sortingOrder=1005 |
| Shader | 961，`Growing/RotateSprite`；UV3 的 xy/z 采样，Cull Off |
| AnimationClip | 1077，`RotateSpriteAnim`；0..2 秒循环，streamed 单曲线 `_rotateAngle`：0→360，每秒 180° |

曲线 stream SHA-256：`64dbefb89937b0a942ccf43f6a759dacd8054c849cd3c75f2f199dd9319bddcb`。原生绑定、字段、几何、材质、曲线均有独立 fixture 与变更拒绝回归。生成 stage-effects schema 9，资源目录共 65 张贴图；生成目录属于已有 public corpus，不提交媒体包。

用户指出第一版左右漂移：为了保持透视外接框中心，第一版在每帧减去左右边界的平均值，这会移动贴图的真实 pivot。已删除该补偿，保留局部原点的固定旋转轴。回归用独立重心插值和 shader 的齐次除法还原屏幕原点的 UV，整圈每 15° 检查其始终为 (0.5,0.5)；侧面退化角另有有限数和零宽度检查。透视轮廓可以不对称，贴图中心不能随轮廓重新居中。

## 原片对照与边界

用户提供的 `E:/Program Files/yt-dlp/Media/1周年纪念新歌Take a StuMp! 每人不同音轨各种音色搭配大合集。包括全员合唱【偶像大师SideM GROWING STARS】.mp4`，SHA-256：`a20cc0a5cf1f0e090cf2670d9dec1f07e03cab3f93041242b135eaec5e5ede78`。沿用实际音轨对齐：Take01 约 49.455 秒，Take02 约 205.159 秒。Take01 原片 160.455 秒对应歌曲约 111 秒；159.455 秒起的两秒循环采样确认原片使用此蓝色 M，包含正面、侧面与翻面。

两曲的 Backmonitor 在 95850 毫秒将 rawValue6 设为 1。本批仅为这两曲、`trhorz_01` 电影、flag=1 且屏幕在场时启用预览；出现时刻作为相位起点。默认 alpha=0 由该受限预览显现。运行时 Sprite 替换、alpha 控制、RotateSprite/CalcRotatedMeshCenter 的 IL2CPP 方法体仍未恢复；透视几何和相位重置属于参考校准，不能称为原生导演方法体等价恢复，也没有按 flag 向所有曲目放行。

## 验证

复用 5198 / PID 62924 的 `serve-player-qa-preview.mjs`：生产 bundle 来自本 checkout `.analysis/build-check`，静态媒体来自已有 public 和 song-discovery readmodels；未重启服务。修正中心轴后重新运行 `npm run build:check`，2788 模块，19.16 秒完成；未复制 public 或制作完整发布包。

通过：

```powershell
python scripts/verify-chibi-backmonitor-logo.py
node scripts/verify-chibi-backmonitor-logo.mjs --published-assets
python scripts/verify-chibi-backmonitor-parser.py
node scripts/verify-chibi-backmonitor-controls.mjs --published-assets
node scripts/verify-chibi-backmonitor-registration.mjs
node scripts/verify-chibi-spotlight-sprites.mjs
git diff --check
```

实际 Browser：两曲结尾渲染标志、暂停与回退；95.8 秒出现前隐藏；背景屏幕开关隐藏/恢复；切到 Change to Chance 清空标志，原有镂空屏幕仍显示。中心轴修正后，Take02 在 110.1/110.4/110.7/111.0/111.3/111.6/111.9 秒分别检查 45/99/153/207/261/315/9°，分别保留 CSV 镜头和关闭镜头的截图，固定镜头排除镜头缩放对视觉中心的影响。Take01 修正后再检查 111 秒、390×844 窄画布；控制台 error 为空。临时 viewport 在结束时复原。

证据位于 `.analysis/engineering-validation-20261002/take-reference/`：`logo-runtime-111s.jpg`、`logo-runtime-cycle.jpg` 为原片；`take02-fixed-axis-*.png` 和 `take02-fixed-camera-axis-*.png` 为修正后整圈采样；`take01-fixed-axis-111s.png`、`take01-fixed-axis-mobile-111s.png` 为最终 Take01 验收。旧 `take-logo-mesh-*.png` 及 `take02-logo-mobile-111s.png` 是中心轴修正前的接线证据，不能用来证明本次漂移修正。

这些检查确认本批接线、固定中心轴与资源生命周期，不代表其它灯光控制或完整录屏逐帧验收。旧悬灯其它曲目推广、新悬灯旋转/颜色/渐变控制、剩余粒子 profile 仍需后续处理。
