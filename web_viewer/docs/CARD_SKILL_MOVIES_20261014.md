# 卡片技能演出（2026-10-14）

SSR 卡发动技能时播放的过场动画（游戏内叫 skill cut-in），现在显示在卡片页的「技能演出」区块里，点击后才加载。

## 来源

- `RAW/movie/skill_movie_<resource_id>.usm`，共 124 个，合计约 611 MB。CRI USM 格式，H.264，1200×640，30 fps，6–12.5 秒，无音轨。
- 加密密钥 `0002B875BC731A85`，与 HCA 和 `prepare-live-chibi-backmonitor.py` 的 `DEFAULT_CRI_KEY` 相同。
- 卡片对应关系来自 `public/data/usm_relation_catalog.json`（`mapping.masterdata_relation`）：CardData 的 `ResourceId` 与 `HasSkillCutinResource` 精确对应，每个 USM 对应一个 `resource_id`（教程用卡共用同一 resource）。

## 处理

`scripts/prepare-card-skill-movies.py`：

1. 校验 RAW 文件的 SHA-256 与 `usm_relation_catalog` 一致。
2. 用 WannaCRI 解密并分离视频流（沿用 backmonitor 脚本的 `demux_usm`；WannaCRI 位置用 `--wannacri-root` 或 `SIDEM_WANNACRI_ROOT` 指定）。
3. ffmpeg 转码：libx264、CRF 26、preset slow、原分辨率、无音轨、faststart。
4. 取结束前 0.4 秒的一帧作为海报（JPEG，q 5），这时卡面插画已经完整出现。
5. 输出到 `public/assets/card-skill-movies/<resource_id>.{mp4,jpg}`（被 gitignore，随媒体上传 R2），并写入受版本控制的索引 `public/data/card_skill_movies.json`，记录每个文件的字节数、SHA-256、尺寸、时长和源文件哈希。已有输出与源哈希都没变时会跳过；加 `--force` 才会全部重做。

体积：原 USM 共约 611 MB；转码后 124 个共 261.4 MB，单个 1.0–4.5 MB，中位数 1.9 MB（时长越长越大）。读者只在点击播放时下载单个文件。

## 读模型与页面

- `checkout_adapter.mjs` 读取索引，把 `skillMovie`（url、poster、bytes、width、height、durationMs）挂到对应卡的 `cardContext`；索引里出现未知卡或 URL 不规范时构建失败。
- 卡片页：在「能力与技能」之后显示海报和播放按钮，并注明时长和大小。点击后才创建 `<video>`（静音、内联播放、带控制条）；换卡片时回到海报。

## 未做

- 媒体还没上传 R2，也没有部署。
- 没有与游戏内实际播放速度逐帧对照（容器标的是 30 fps）。
