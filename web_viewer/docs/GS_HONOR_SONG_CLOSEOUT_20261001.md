# 称号与歌曲信息核实收口

日期：2026-10-01。输入 HEAD：`1f95750d`。用户要求将缺证据的称号暂记待办，并复核歌曲页遗漏信息后收口。

## 称号

本轮扩搜停止，215 项（214 个非活动分类未知链路、1 个冲突）已在固定生成队列标为待办。原有 22 个网页配对保持不变，其中 1 个仍冲突。详见 [第三轮记录](GS_HONOR_RESEARCH_ROUND3_20261001.md)；本地逐项清单是 `.analysis/honor-acquisition-web-v1/search_handoff.md`。

## 歌曲属性

发现并补齐的数据链路：PB table 46 的 `SongData.IdolType`（字段 13）→ 歌曲目录 `attribute` → `SongPresentation.attributeLabel` → 歌曲详情属性标签。该字段独立于演唱者字段 7，不能按组合或成员属性推算。

原生 `Growing.Models.Data.IdolType` 枚举由 metadata 原始 Int32 字节确认：1 Physical、2 Intelligence（页面简称 Intelli）、3 Mental、4 All。0 None 不当作 ALL；缺失/不支持的值在目录生成时拒绝，旧页面投影缺值显示“待确认”。

61 条歌曲记录（60 个常规作品、1 个特殊版本）均有属性：Physical 18、Intelli 16、Mental 18、ALL 9。同一资源的 99 条 PB 行没有属性冲突。逐项复核与枚举字节位置见 [歌曲属性证据](../config/song-attribute-audit.v1.json)。

[WikiWiki 曲目表](https://wikiwiki.jp/sidem-gstars/楽曲一覧)的 60 首常规曲目全部匹配，无属性冲突。只规范化 HTML 实体、全半角、空白、大小写与波浪号形式；特殊 `drv999` 未列于该表，已独立从 PB 确认 ALL，没有继承母曲属性。

## 其他遗漏与待办

| 信息 | 当前核实结果 | 收口状态 |
| --- | --- | --- |
| 曲名、读音、制作信息、专辑链接、封面 | 61/61 有数据，详情已有消费者 | 保留现有链路 |
| 歌曲属性 | 原始来源、目录与详情展示原先缺接线 | 本批补齐 |
| 难度及最大 Combo | 原生 `SongDifficultyData` 有 DifficultyType / Level / MaxCombo，详情尚未展示 | 待办：按 SongDifficultyGroupId 连接，保留重复行/版本边界，另行核实 |
| 解锁条件 | SongData 有 ReleaseConditions；详情尚未展示曲目取得条件 | 待办：区分初期、剧情、活动转常驻及特殊版本，不从标题推算 |
| 首次实装日期 | 页面使用 StoreOpenAt；41 条为初始哨兵、19 条实际时间、1 条禁用哨兵 | 待办：StoreOpenAt 不等于首次活动实装日，不能直接覆盖；Wiki日期仅作外部核实线索 |
| 歌曲称号 | 累计分模板有称号奖励，但本轮仍缺具体称号名对应证据 | 已纳入称号待办，不写入歌曲取得说明 |
| 歌词、BPM、时长等 | 本批没有逐曲核实这些项目 | 保留原有状态，不宣称歌曲信息全部完成 |

## 验证边界

- 称号证据回归 10 项通过；新增 32 次查询原文和身份校验通过，配对/模板/观察保持不变。
- 歌曲 masterdata 身份、属性及原生枚举校验、歌曲目录 schema/source-only 校验通过。
- 两个既有综合校验存在其他表面失败：`verify-song-domain-landing.mjs` 仍断言迁移前 `songCatalogData.value = data.songCatalog`；`verify-archive-presentation.mjs` 的歌曲投影和 61 个歌曲详情 SSR 已通过，随后在活动页“剧情暂未收录”的断言失败。不能将其报告成全套通过；本批未修改活动页或主页面迁移。
- 数据候选：`E:/Web_build/GS_Archive_Domain_Work/song-attribute-readmodels-20261001`，源提交 `6919f637`，release `d8c744d57396f790627a3fefc33eed67457eb5dca316e31c8ff78cf60c429934`。8,750 个模型文件约 75.9 MB，字节/descriptor 校验通过；bootstrap 14,344 字节。候选包含元数据，不是媒体包。
- 61 个歌曲详情 leaf 逐项核对：`song.attribute` 与 PB 已核实目录完全一致，`view.attributeLabel` 均为对应属性标签；`npm run verify:cutover-routes` 和独立工作区 `npm run verify:build-audit` 的 progress 门禁通过，仍明确报告全路由/设备验收未完成。
- 为保护正在使用主工作区 `.analysis/build-check` 的 5198 调试服务，在 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-qa-20261001/web_viewer` 独立工作区执行 `npm run build:check`。首次发现 route ledger 仍绑定旧 release，更新数据绑定后编译通过。固定输出是该工作区 `.analysis/build-check`，`copyPublicDir:false`，没有复制 public 语料。原有 5198 进程保持运行。
- 实际验收 URL：`http://127.0.0.1:5200/?view=song_catalog`。该服务挂载独立生产代码、新数据候选及主工作区已有 public 资源。Browser plugin not available，使用已捆绑 Playwright Chromium；没有安装浏览器依赖。

| 页面检查 | 结果 |
| --- | --- |
| 身份与非空页面 | 标题 SideM Story Viewer，歌曲列表 60 个常规作品 |
| 搜索 → 详情 → 返回 | 桌面 1440×1000：BRAND NEW FIELD / Intelli、バーニン・クールで輝いて / Physical、Café Parade! / Mental、DRIVE A LIVE / ALL；每次对应 song 参数正确 |
| 手机展示 | 390×844 的 Café Parade! 显示 Mental，属性标签边界在视口内，截图未见遮挡或溢出 |
| 框架覆盖层、控制台及请求 | 无覆盖层、pageerror、控制台 error/warn 或 HTTP ≥400 |

截图与机器记录保存在 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-browser-20261001`：`desktop-intelli.png`、`mobile-mental.png`、`browser-receipt.json`。编译、模型与日志均在 E 盘；未执行全量媒体打包。

同步 bootstrap 和 route ledger 的数据/源绑定，不把其他路由的历史 Browser 记录提升为本次验收。本批仅验收歌曲属性，未执行实际音频播放、全曲 Browser 逐页检查、真实设备或部署。
