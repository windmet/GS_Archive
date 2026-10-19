# 背屏 Logo：移除曲目/视频白名单，消费原生 Sprite 选择

输入 HEAD `2698e693`，舞台工作树 `stage-native-fidelity-20261014`，5212/PID61564。接续 RotateSprite 几何修正；本批解决资源选择与漏显，旋转时钟仍明确 partial。

## 来源链

同一解密 IL2CPP 与 APK 来源重新核对：

- `PrepareEffect 0x2218308` 读取 value9，调用 `LoadLogoSpriteIfNeeded 0x2218530`；空名或已在字典则返回，否则按资源名异步加载。
- 加载完成回调 `0x1bbc76c` 把 Sprite 存入该名称对应的字典项。
- `PlayEffect 0x22186e0` 在启动 PlayMovie 之前调用 `SetLogoSpriteIfNeeded 0x2218a74`。空名、字典未命中或与当前 Sprite 同名均不修改；命中其它名称则调用 RotateSprite.SetSprite。
- PlayMovie 协程 `0x1bbcc0c` 在需要转场时等待一秒，再启动/切换电影并调用 FadeAlpha。未在此调用链中发现按歌曲或电影名限定 Logo 的规则。这里没有据“未发现重置调用”直接断言 Animator 起始时钟。

RAW 全部 118 编排中，Logo Show 分布为默认图63条、Passion显式请求3条，共44份编排。旧白名单只覆盖 DRIVE 普通版20份及Take两份，漏掉 Growing Smiles！21份和社长Passion一份。

## 两张真实资源

APK `resources.assets`：默认 Sprite1832→Texture463；Passion Sprite2797→Texture930。两者均为1200×800、pivot(.5,.5)、100PPU、TL/TR/BL/BR原始顶点±6/±4、相同三角形及uvTransform。Passion原图文字为「パッション！」，没有拿默认M图染色替代。

`prepare-chibi-backmonitor-logo-resources.py` 从APK重读上述几何、纹理像素、对象/ELF方法哈希，生成 `chibiBackmonitorLogoResources.json` 及两张来源身份哈希命名PNG。默认图以 RotateSprite 原始指针为依据；名称决定选择，没有曲目表。

新PNG合计464851 bytes，位于 `public/data/stage-backmonitor-logos/`。旧共享public语料没有重写。二进制策略为本批独立 owner_release `2026-10-19-native-backmonitor-logos-001`；最初误归既有10-17批次导致累计超过10MiB，已纠正归属并重新核对389 PNG /71092414 bytes。未放宽阈值、未新增例外。

## 消费行为

- `resolveBackmonitorLogo` 按原生命名字典规则从事件重建资源选择；空、未知、同名均保留。回拖到换图前恢复默认/先前合法资源，切歌从新曲事件重建。
- `sampleBackmonitorLogo` 不再读取 previewSongs/previewMovies。显示由 RAW value6 和现有FadeAlpha采样驱动；歌曲和视频身份不再作为放行条件。
- Viewer 按选中资源建立独立网格，预备已支持的两种纹理，旧异步请求沿原有generation保护退役；切换时先隐藏已有网格。
- 公开诊断新增实际 Logo 资源身份；coverage改为 `partial_native_selection_reference_clock`，没有把接入提升为全原生完成。
- 旧stage-effects模型内的preview字段属于历史数据，本批运行时不再读取它们。原生成器的历史预览模型尚未整体迁移，不将字段存在误当作仍有运行时白名单。

## 验证与5212

- 新提取器 `--write` 后不带 `--write` 重读ELF/APK/PNG，两个资源一致。
- Logo JS回归、backmonitor parser/controls、118编排coverage通过；新增空名、未知、同名保留、回拖、21份Growing Smiles！及Passion请求对照。
- 源码门禁147/147通过；补coverage状态断言后单独重跑coverage/controls/parser通过。
- build:check通过，24.07秒；固定.analysis/build-check、copyPublicDir:false。无关生成audit/translation变化已恢复；没有完整媒体包。
- 二进制inventory独立验证通过；git diff --check通过。

Browser插件在最终构建及恢复元数据后新建冷页，1280×720完整模式：

| 旅程 | 结果 |
| --- | --- |
| Growing Smiles！116.4s | 默认M图、alpha0.8、126°，此前白名单漏显处恢复 |
| 从116.4s实际播放 | 预载后播放到126.2s曲末并自动暂停 |
| 同页切Passion版 | 社长专用播放器，非普通多人时间轴；使用其实际控件暂停、回拖 |
| Passion16.6s | 实际资源为passion、alpha0.8；截图仍有白色转场，未当作可见字样的最终证据 |
| Passion18s | 转场后「パッション！」原图可见，36°、alpha0.8 |
| Passion18s，390×844 | scrollWidth=innerWidth=390，资源身份保持；完整手机截图 |
| 同页切Take01，110.1s | 恢复默认M图、alpha0.8，无Passion残留 |

最终console error空。切Passion后第一次仍用多人时间轴而未命中；读取新页面DOM后改用社长时间轴，未把失败操作算作成功。截图 `.analysis/logo-selection-growing-116400.png`、`logo-selection-passion-18000.png`、`logo-selection-passion-mobile.png`。这是Web接线验收，不是原片同帧或真机等价。

仍需追Animator随Prefab的启停、实际起始相位、电影异步完成时钟与转场导致的FadeAlpha调用时点。当前phase仍按旧参考模型重建；本批未把它伪装为已还原。Stretch非平面七系统、全库粒子/独立指令等原目标继续保留，未部署、未合主线。
