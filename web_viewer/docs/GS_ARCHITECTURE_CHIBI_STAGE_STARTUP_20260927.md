# 多人舞台直达入口（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `841d857`。指导包仅作参考，以当前仓库和 r22 Read Model 为准。

`chibi_stage` 直达不再调用 `loadArchiveData()`。舞台组件继续按需读取 live-chibi 自有索引与编排；页面从歌曲详情叶子读取当前歌曲的 `experimental` 音频配置，进入舞台、切换编排、刷新带 `song`/`stage` 的 URL 时均按歌曲身份更新。旧的全量 `song_experimental_audio.json` 不再传入舞台。返回目标歌曲时，已读取的歌曲详情可直接恢复。

验证：`verify:archive-startup-route`、`verify:song-stage-handoff`、`verify:archive-async-navigation`、`verify:stage-render-budget` 和 `build:check` 通过。构建输出复用 `.analysis/build-check`，未复制 public 媒体。异步导航测试环境补齐了已有的关闭状态资源开关。

Browser 使用 `127.0.0.1:5186` 的生产代码构建、public 与 r22 Read Model 映射，旧全量 `/data/` 来源返回 503。`?view=chibi_stage` 显示 118 首编排、DRIVE A LIVE 五人画面、编成声部实验开关；切换 Beyond The Dream 后 URL 更新为 `?view=chibi_stage&song=byndtd&stage=byndtd_live_effect`。定向直达使用相同映射的 `127.0.0.1:5187`，仅额外放行舞台自有 `/data/song_timelines/`；显示 Beyond The Dream 五人画面，点击“返回歌曲”恢复 `?view=song_detail&song=byndtd` 的歌曲详情。上述页面无 console error；先前 Spine/Pixi warn 堆栈仍存在。

舞台编排、时间轴清单仍来自功能本地的旧格式文件，因此路由账本把入口记为 migrated、数据与 parity 记为 partial。未做全编排/长音频、真实设备、完整 public 发布包验收。
