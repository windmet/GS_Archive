# 常驻称号网页证据合并与下一轮搜索缺口

后续复核：[称号聊天记录与17个显示／提及证据](GS_HONOR_CHAT_REVIEW_20261001.md)。22个具名条件配对不变；来源现有9个、回归10项，新增观察保持unknown并进入搜索清单。下文保留首批合并记录。

输入 HEAD：`985cb2d4`，分支 `codex/story-interaction-v2-before-b002`。用户提供 WikiWiki 搜索记录，授权补全获取链路并输出剩余缺口。本批读取并核对其中的网页配对，新增独立证据表、合并工具和搜索清单；同工作区的前端调试没有受到改动。

## 结果与证据边界

本地 1,613 个称号保持原身份。原来的 886 个 PB 已知来源全部保留，另接入 22 个明确的网页称号—条件配对：12 个 Producer Lv / Rank、8 个累计条件、2 个偶像 Lv100 实例。贴文结尾写“21个”，其表格实际有22个。

这22个中，21个为 `web-reported-source`，1个为 `web-conflict`。全库纯 unknown 从727降到705；这不意味着907个称号已经具有原始 PB 获取证明。PB 已知仍是886，网页来源分开标记。网页配对保留 URL、证据类别、章节定位与核对日期；`sourceId`、`product`、`rawEvidence` 均为 null，不制造官方 Mission ID 或编码 Product。

`315プロのカリスマ` 暂存 Producer Lv300：当前 [WikiWiki Mission 表](https://wikiwiki.jp/sidem-gstars/ミッション)与 [Gamerch 2022-04-15 更新记录](https://gamerch.com/sidem-gs/307004)一致；[WikiWiki 2022年前半公告](https://wikiwiki.jp/sidem-gstars/過去のお知らせ/2022年前半)写Lv315。Lv315 原样留在 conflicts，没有证据将其认定为笔误或版本变更，也不将暂存值当作无冲突定论。

8个累计配对在 [WikiWiki 2021-12-23 公告转录](https://wikiwiki.jp/sidem-gstars/過去のお知らせ/2021年)与 Gamerch 更新日志均能核对。冬马Lv100的具名称号实例来自 Gamerch 2022-09-28 更新记录；WikiWiki 同期简版公告只记上限提升，没有该具名实例，不能把贴文丢失的引用直接当作已核实 Wiki 出处。

辉Lv100配对来自[玩家文章](https://note.com/echo_howling/n/n07e07b93dc48)的明确文字，附近有称号图片。此次核对的是文章文字，没有声称完成图片OCR、任务窗口实机验收或验证作者游戏存档。Wiki Mission 表只支持通用偶像Lv100模板，在这条配对中专门标成 `condition-template-only`。

另录入24组条件模板，保留 Live、Full Combo、属性/总RP、分数、曲目累计分、工作、培养、信赖、收藏、服装、Talk、电话、摄影和出勤。不同阈值合在同一模板组内，因此24不是任务数。所有模板的 `honorIds` 都为空，不按名称含义、ID段或参数展开猜配对。信赖度100明确奖励 Talk 与称号；Wiki 总RP5000和出勤1000的奖励格为空，由2021公告补充，不假装这些奖励出自当前表格的具名行。

391条 `ReleasedByMission` 是 `MobileReleaseConditions` 的手机内容解锁引用，原PB没有任务参数，也没有到Honor的连接。网页模板可以帮助检索任务条件，但不能把这些391条解释为391个称号或已经证明的称号展开集合。

## 剩余缺口：给下一轮搜索用

活动先排除后，HonorType=1/2 的候选中仍有214个无语义来源，另有1个等级冲突需要核实。HonorType只定义本轮检索范围，不保证这些候选全部来自常驻 Normal Mission。

| 清单 | 数量 | 搜索重点 |
| --- | ---: | --- |
| 普通分类，具名候选 | 58 | 34个通用/故事相关名称，24个歌词形态名称；查具体任务与奖励同屏或同段 |
| 偶像分类，具名候选 | 96 | 49个「某某担当」和47个其他专属名称；查各自条件，勿自动套Lv100或信赖100 |
| 普通分类，日期/占位名称 | 36 | 缺正式显示名与实装状态，暂缓逐名搜索，不能据此认定未实装 |
| 偶像分类，FES内部条件标签 | 24 | 缺正式显示名与来源证明；本轮暂缓，不从标签制造常驻获取来源 |
| 条件冲突 | 1 | `315プロのカリスマ` 的300/315，优先找有日期/版本的任务截图或原公告 |

因此可优先交给网页反搜的是 **154个具名未知候选 + 1个冲突**。普通94 = 58 + 36，偶像120 = 96 + 24。另491个 unknown 的 HonorType=3 活动称号不进入本轮搜索队列，既有848条排名和38条活动积分PB来源保持原样。

建议先搜下面这批通用名称；分组仅用于缩小查询，不表示名称已经连接到某个模板：

| 检索分组 | 待查具体称号名 |
| --- | --- |
| 工作相关名称 | 仕事熱心、一流の仕事人、フィジカルワーカー、インテリワーカー、メンタルワーカー |
| 收藏与培养相关名称 | 思い出の紡ぎ手、理由あってアイドル！、輝きの向こう側へ、衣装コレクター、もうひとつの姿、異彩を放つラインナップ |
| 交流与摄影相关名称 | ムードメーカー、心のよりどころ、相談相手、頼れる存在、315プロ専属カメラマン、シャッター越しの煌き |
| 出勤/Live相关名称 | 継続は力なり、気鋭の興行師、熟練の興行師、ワールドエンターテイナー |
| Rank初始名称 | 見習いプロデューサー：当前具名任务表没有这条，不能自动填默认取得 |
| FC / RP / 分数相关名称 | テクニシャン、超絶技巧、無欠のオールラウンダー、情熱のフィジカルマスター、不敵のインテリマスター、愉楽のメンタルマスター、玄人級、名人級、ベストパフォーマンス、サイコーのステージ！ |
| 故事条件描述 | メインストーリー1章をすべて読もう、メインストーリー2章をすべて読もう：名称含条件，仍需奖励证据 |

本轮对 `仕事熱心`、`テクニシャン`、`玄人級`、`思い出の紡ぎ手` 各试了精确称号反搜，未得到相关 title-condition 结果；搜索失败只记录为一次未命中，不证明网络上没有材料。

提交给下一批证据时，最好同一页面或截图包含 **称号原名 + 明确条件/阈值 + 偶像或歌曲参数**，并附 URL、日期/版本。只写“奖励：称号”的任务表能够补模板，不能确定现有Honor ID。普通网页配对即可补语义层；只有需要官方任务ID、原始Product字段或完整服务端覆盖时，才继续要求Mission/API载荷。

## 可复现文件与验证

- 证据表：[honor-acquisition-web-evidence.v1.json](../config/honor-acquisition-web-evidence.v1.json)。记录5个实际可打开的源页面，未采用贴文中的失效内部引用标记。
- 合并工具：[merge-honor-web-evidence.py](../scripts/merge-honor-web-evidence.py)。每次先重跑原PB审计，再用同一PB重新生成Honor身份；唯一原名、ID和类型必须一致，异常或缺失证据拒绝合并。
- 回归：[verify-honor-web-evidence.py](../scripts/verify-honor-web-evidence.py)，6项行为门禁：原来源逐条不变、只有22个显式配对、无伪造Product/任务ID、等级冲突保留、事件排除/搜索缺口、错误身份/重复/缺来源/哈希漂移拒绝。既有Honor acquisition 8项回归亦通过。
- PB仍为 `25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1`；沿用原schema校验，每份JSON记录PB、schema、证据表和生成器哈希。
- 固定输出：[.analysis/honor-acquisition-web-v1/](../.analysis/honor-acquisition-web-v1/)，五个文件合计约4.6MB，不含媒体、未发布到public。

```powershell
python -X utf8 scripts/merge-honor-web-evidence.py
python -X utf8 scripts/verify-honor-web-evidence.py
python -X utf8 scripts/verify-honor-acquisition.py
```

`honor_acquisition_catalog.json` 是合并后的完整审计目录；`normal_mission_condition_templates.json` 是未绑定模板；`reverse_lookup_web_queue.json` 是215条含冲突的检索队列；`search_handoff.md` 是可阅读的全部原名/ID/查询词清单；`validation_report.json` 记录分层数量与边界。原 `.analysis/honor-acquisition-v1` 的PB审计保持独立。

依据 `BUILD_ACCEPTANCE_POLICY.md`，本批只做独立Python/离线数据逻辑回归和文档链接/差异检查，无前端依赖改变，不执行Vite构建或Browser验收。`publicationReady=false`，不声明完整称号获取库或部署验收。
