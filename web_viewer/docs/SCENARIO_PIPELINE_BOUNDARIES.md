# Scenario Python 管线边界

G1 将旧单文件拆到 `data_pipeline/sidem_scenario/`：

| 文件 | 职责 |
| --- | --- |
| `state.py` | 场景累积状态、角色状态更新、深拷贝 snapshot 与 episode transient reset |
| `compiler.py` | RAW 命令 dispatch、文本身份/来源、step 生成、分段合并与 authoritative adapter 调用 |
| `file_io.py` | load_json/save_json/compile_file 的既有文件接口，由编译器继承 |
| `cli.py` | 显式 CLI 参数处理及目录遍历；导入不执行编译 |
| `__init__.py` | ScenarioCompiler/ScenarioState 的包 API |

`data_pipeline/scenario_compiler.py` 保留旧导入和直接运行入口，重新导出的类与
包内类是同一对象，因此既有调用方设置资源根和类缓存仍作用于实际编译器。
现有脚本把 data_pipeline 加入 sys.path 的方式保留；也可在该目录运行
`python -m sidem_scenario.cli ...`。本批未把整个 data_pipeline 打包安装。

兼容 CLI 仍把单文件的第二参数当输出目录（旧 usage 文案写作 output.json，
本批没有悄悄改变已有行为）；目录批处理仍逐文件捕获错误并打印计数。
发布候选、ledger、promotion 与 public 产物不经过这个旧 CLI 自动更新。

验证入口为 `npm run verify:scenario-package`。冻结基线来自 `80cc005` 的实际旧
编译器，四份 RAW timing fixture 的两种输出契约及一次四份合并各自记录完整
JSON 的 canonical SHA-256，共 10 项；包含 text_ref、source、step、cue 和
episode 结构。资源根设为空临时目录，避免测试依赖某台机器的挂载资源。
测试也验证 API 类身份、文件读写、旧/新 CLI stdout 和缺参数退出码，以及
临时目录的单文件批处理输出。没有全库重编译或真实媒体/发布验收。

现有 story-text-evidence、source-only timing matrix、RAW→两种编译路径→
前端 Spine cue 集成回归通过。新验证已加入 CI。

## G2：资源接口

`resources.py` 拥有背景 JSON 解析、音频存在性与口型文件读取/索引。
ScenarioResources 协议提供 background_index/audio_exists/lip_info/lip_index；
构造编译器和 compile_group 均接受显式 resources，命令到资源路径的语义规则
仍归 compiler。compiler 不再直接 open/listdir/walk 或判断资源文件存在。

LocalScenarioResources 的资源根与缓存归实例，每个候选任务创建一次并在其
合并编译中复用。compile-story-migration-candidate 和 extract_raw_story_candidate
已接入；from_compiler_defaults 捕获既有根配置，不继承旧类缓存。
未传 resources 的旧 API 通过 LegacyCompilerResources 继续读取编译器类根和
缓存，保留旧脚本设置类属性的行为。环境默认路径及 file_io 兼容方法尚未删除，
不能将所有调用方式称为无文件系统副作用。

查找语义保留：背景接受 BOM、坏 JSON 跳过；ambient `_t` 可查无后缀文件；
口型先按命令推导路径，再按精确 basename 回退；损坏口型文件仍返回路径但
不附 frames。重复 basename 仍保留遍历中先遇到者，此批没有改变冲突策略。

`verify:scenario-resources` 在临时目录验证上述规则、资源存在时的编译结果、
旧类接口与独立 provider 一致、不同资源根缓存隔离；内存 provider 在禁止
builtins.open 下完成单份/合并编译。音频样例仅验证存在性，不是可解码媒体。
10 组冻结编译 hash、文本/时序回归与 migration-candidate 回归也通过；后者
覆盖 RAW hash、voice relink、episode rebasing 和 strict 输出，未发布任何候选。

## G3：候选资源来源统一

两个候选编译入口现在使用 `LocalScenarioResources.from_archive_sources`。
RAW 提取入口复用已加载的 ArchiveSources；migration-candidate 新增
`--sources-config`，由 archive_paths 按显式参数 → SIDEM_ARCHIVE_SOURCES_CONFIG
→ ignored 本地配置 → 仓库默认值加载。资源根再由 SIDEM_LIPSYNC_ROOT、
SIDEM_ADV_BACKGROUND_ROOT、SIDEM_AUDIO_ROOT 分别优先覆盖。

未覆盖的根按 legacy_root 下 scripts/lipsyncdata/adxlip、
scripts/advbackground/json、GS_Res/Audio 解析；legacy_root 未配置时用
archive_root/sources/legacy_curated。这与 JS serving 的口型/音频根规则一致。
候选入口不再回退到编译器类中的机器盘符。依赖旧盘符的使用者应提供配置或
资源环境变量；直接使用旧 ScenarioCompiler API 的兼容默认暂时保留。

`verify:scenario-source-config` 使用临时配置验证覆盖与默认根、Python/JS
路径一致，并运行真正的候选 CLI，确认配置的背景音频参与编译。显式配置
优先于环境配置；显式文件缺失时失败且不生成候选目录。资源存在性样例不是
真实音频。archive-sources、资源接口、冻结输出和 candidate 回归全部通过。
当前本地配置 legacy_root 与迁移前机器默认位置一致；没有重编译 public。

## G4：RAW transport 与身份规则

`data_pipeline/sidem_raw` 分离四种职责：unity_assets 读取 TextAsset 及原始字节、
container path/path_id；identity 仅从记录恢复语义分组；voice_links 仅依据
传入的 per-part cue 证据关联语音；audio_probe 封装 vgmstream 子进程。
UnityPy 只在实际打开 bundle 时导入，身份回归无需 Unity 环境或候选输出目录。
逻辑 container 路径用 PurePosixPath；Unity 读取端先把反斜杠规范化为斜杠。

两个 RAW 审计入口直接依赖 sidem_raw，不再导入候选 CLI。旧
extract_raw_story_candidate 模块仍重新导出原辅助函数，CLI 参数与写出逻辑
保留。分组不修改输入记录；voice relink 的原有就地更新语义保留，歧义及
缺失语音只统计、不猜测替换。

`verify:raw-evidence-boundaries` 包括原身份回归，以及不加载 UnityPy 的导入、
注入读取器的 transport、BOM/坏 JSON/坏字节、排序、重复语义 ID 和 per-part
语音歧义测试。候选/覆盖审计/语音审计三条 CLI 的 --help 均可用。
另与迁移前 `b46e3c7` 的旧实现逐值对照真实 bundle
`RAW/asset/scenario_1_3_10001_01.unity3d`：SHA-256
`45cdbee9a3196b2abb4f5c9f2125dc37a1e98e77a22f4f2a8c6bd883fe077e3e`，
11 个记录、一个语义组、无排除项，原始 bytes、解析结果与 provenance 完全一致。
此为单 bundle 读验，不是全库重新审计或候选发布。

## G5：Masterdata wire 边界

`data_pipeline/sidem_masterdata/wire.py` 拥有 XOR/decoded 输入选择、varint、
顶层记录、启发式字段解析、原始 length-delimited bytes 与 table rows 偏移。
该层不导入领域生成、文件写出或发布模块。旧 masterdata_extract 导出保留，
既支持原脚本路径导入，也支持 data_pipeline namespace 导入。
歌曲生成、歌曲映射验证、extra visuals 准备和 BGM selector 审计直接使用新 API。

没有把启发式解码器改成完整 protobuf schema/严格验证器：重复字段、可打印
文本识别、nested 一层解析、固定宽度 hex、截短长度容忍和不支持 wire 的行为
均保持。精确 bytes API 继续防止 table-80 等数字身份被可打印字符误解释。

`verify:masterdata-wire` 覆盖这些语义和导出身份。额外运行
`python scripts/verify-masterdata-wire.py --decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb`
对本地已解码输入全量验证：47,204 个顶层记录、158 张表，原始载荷/偏移与
两种解析模式的完整结果 hash 对照 `0f16def` 旧实现一致。冻结输入与结果
SHA-256 在 fixtures/masterdata-wire/decoded-baseline.json；不提交 decoded 数据。
任意载荷两种解析模式合计 83 次异常同样逐项一致，不将其计作领域提取失败，
也不将结果升级为全量领域产物验证。

已通过实际歌曲 masterdata 映射检查（99 行/61 首），以及 movie announce、
card skill movie、song movie 的 source-only 检查和 namespace 导入检查。
未运行 masterdata 全量写出、public 复制或重新发布。

## G6：Masterdata identity 领域

`sidem_masterdata/identities.py` 负责偶像/组合、speaker、衣装、表情字典，
`provenance.py` 负责 table/field/offset 引用。原入口重新导出函数；领域模块
不读取文件、不导入原入口、不写产物。文件资源列表作为 set/map 显式传入。
其余领域仍可复用 provenance，不形成依赖入口脚本的环。

保留既有语义：偶像 f32 只是 unit_relation_candidate，不能据此确认组合；
NPC 没有 code 时使用 npc:id；同模型先 table 28、后 table 27，后者覆盖显示
字段但 _sources 保留两表记录；资源索引为空时 availability 为 null，而非 false。

`verify:masterdata-identities` 覆盖上述规则、输入不变与旧导出身份；加上
`--decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb`
可重验本地全数据基线。与 `6798165` 的五组完整输出逐值比较一致，冻结 hash
在 fixtures/masterdata-wire/identity-baseline.json：49 偶像/16 组合、91 speaker、
690 衣装（表 27 的 549 行与表 28 的 714 行合并）及 5 表情。衣装分别使用空
资源索引与固定单模型索引，不能把该测试当作真实全资源存在性验收。
wire 回归与旧 CLI help 检查通过；不执行全量写出或 public 复制。

## G7：Masterdata music/movie 领域

`sidem_masterdata/music.py` 生成歌曲/明确 performer 与 BGM selector 关系；
`movies.py` 生成 MovieAnnounce、Card skill cutin、Song 3dmv/mvlive 资源身份。
这四个 builder 只依赖表行和 provenance，不读资源、不写产物。旧入口继续
导出；三条影像索引 verifier 直接依赖新领域模块与 wire 层。

保持原规则：歌曲多行合并 performers，组合映射冲突时报错；特殊 selector
保留 unresolved；table-133 同资源可有多个角色；同资源的多张卡/歌曲保留；
重复记录 ID 报错；MV-live 的 2100 年禁用 sentinel 不当作已开放内容。

`verify:masterdata-media` 覆盖这些规则和输入不变、旧导出身份。用
`--decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb`
对照 `91bb22e` 的四组完整输出，逐值相同，hash 冻结在 media-baseline.json：
61 歌曲/92 BGM/56 seasonal selector 行、30 MovieAnnounce、124 skill movie
资源（127 卡片行）、12 song movie 资源（13 歌曲行）。三个既有影像 verifier
也以 mounted 模式通过，与已提交索引相符；没有复制 public 或转码媒体。

## G8：Masterdata 剧情与互动领域

`sidem_masterdata/episodes.py` 拥有偶像 chapter/section/episode/product 关联；
`mobile.py` 拥有手机房间、关系、随机话题、home interaction 与 short profile；
`seasonal.py` 拥有季节通信和 campaign/participant/cycle 关系。
`story_resources.py` 集中现有资源归一化、文件名匹配、来源补充和条件投影。
这些模块只接收表行、身份字典与编译资源证据，不回调入口、不扫描目录。
原 masterdata_extract 保留同一函数导出，支持脚本和 namespace 两种导入。

保留精确资源优先、前缀匹配排序、缺失资源字段与 false 的区别、未知条件 raw、
静态手机数据不等于用户已读/实际解锁状态，以及季节 102 对应 president NPC 901
的身份规则。工作剧情仍读取编译文件，未混入本批纯领域拆分。

`verify:masterdata-interactions` 检查上述边界、关联、顺序、来源偏移和输入不变；
CI 执行无需本地数据的语义用例。额外以 `--decoded-masterdata
.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb` 验证本地完整相关表：
六组输出在空资源集及确定性模拟资源集两种情况下，与 `13cd46e` 逐值一致，
hash 存于 fixtures/masterdata-wire/interactions-baseline.json。
覆盖 49 chapter/78 section/491 episode、1,269 手机场景、1,515 home interactions、
1,421 profile、306 季节通信、4 campaign/2 cycle/208 playback entities。
模拟资源集只验证生成器，不证明 mounted 文件存在；没有重写公共索引或发布。

## G9：工作剧情编译输入边界

`sidem_masterdata/work.py` 根据表 53/54/55、身份、背景、编译摘要及显式 payload map
生成工作剧情索引，不读取文件。`work_story_files` 只选择有效工作条目引用的文件；
`compiled_inputs.py` 负责读取选定 JSON，同一次生成内去重读取，没有跨任务缓存。
旧 `masterdata_extract.build_work_story_index` 保留原参数，作为读取与投影的兼容编排。

缺失文件、IO/编码/JSON 解析失败继续产生无详情条目；成功解码但根形状错误的
JSON 不被静默当成缺失。背景名称仍来自 picture studio masterdata，未命名时保留
compiled_resource_only；对白只取 adv/talk/call，优先日文并保留 speaker 首次顺序。
资源匹配仍不等价于可读性：matched 但损坏的文件继续保留 compiled_exists=true，
与旧输出一致。没有在这次拆分中重新定义现有 availability 字段。

`verify:masterdata-work` 在 CI 验证纯投影、选择性读取、损坏/缺失证据、输入不变、
背景来源和兼容入口。使用本地 decoded masterdata 与 `public/data/compiled` 运行
`python scripts/verify-masterdata-work.py --decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb --compiled-dir public/data/compiled`
对照 `7992085`：49 偶像、441 scene line、196 short story 的完整输出逐值一致，
637 资源、444 个有名称背景；基线 hash 在 fixtures/masterdata-wire/work-baseline.json。
此为真实编译 JSON 的索引验收，不是音频播放或 P2-B 长时验收，未写公共产物。

## G10：故事表、生日关系与主目录投影

`sidem_masterdata/story_tables.py` 将 wire 记录映射到 19 组故事表，并保持 table-80
subject 的原始 little-endian bytes 解码，避免数字 45 被解释为可打印字符 `-`。
`birthday.py` 拥有 chapter/section/episode/subject/announcement 关联与诊断；
`story_index.py` 使用显式编译资源证据生成原 master index。三者均不读取文件，
旧入口继续重新导出。没有将旧原始字段目录改成新 schema，前端命名 catalog
仍由既有 story_catalog consumer 生成。

`verify:masterdata-story-domains` 覆盖数字身份、公告 image-reference 回退、显式
subject 优先、producer target、版次/日期、缺失关系与资源来源字段；输入不变。
额外用 `--decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb`
与 `c692860` 比较 19 组完整解码表、生日关系、两种编译证据下的主目录，逐值一致，
冻结 hash 在 fixtures/masterdata-wire/story-domains-baseline.json。
生日有 4 chapter、181 section/episode、78 公告；两个既有未分配 subject 的条目
51110001/52110002 保留诊断，不猜测具体偶像。前端生日语义、domain landing 和
story catalog 验证分别检查既有公共索引与消费者，不能替代生成器全数据对照。
没有写出公共产物或执行发布。

## G11：卡片数值、技能与衣装关系

`sidem_masterdata/card_gameplay.py` 拥有参数计算、技能等级/effect/category 关联、
描述模板替换和八种衣装 slot。它只接收表行与 reference maps，不读资源、不写产物，
原入口保留同一函数和属性名常量导出。主卡片索引仍通过旧导出调用这些规则。

`verify:masterdata-card-gameplay` 验证数值 0、无效/缺失参数、技能等级和 effect
顺序、未解析占位符保留、center category、live/story 同 ID 分离、未知衣装关系
及来源偏移，检查输入不变。使用 `--decoded-masterdata
.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb` 对照 `cad9777`：
836 条卡片的完整 gameplay 和 2,672 条衣装关系逐值一致，hash 在
fixtures/masterdata-wire/card-gameplay-baseline.json；无资源存在性或发布声明。

G11 时待处理（已由 G12 迁移主流程）：旧 `build_card_detail_index` 会 pop 输入
字段并在原索引上设置 detail_available；后续应将目录/详情拆分改为显式返回，
迁移调用端后再取消对隐式副作用的依赖。该问题不在本批纯数值领域中修补。

## G12：卡片目录与详情的显式拆分

`sidem_masterdata/cards.py` 拥有卡片组装与 canonical 选择；`card_voices.py` 拥有
操作语音分类和 masterdata/curated/audio-only 来源优先级。两者只消费显式输入。
`card_details.split_card_index` 返回 `(summary, details)`，在私有深拷贝上分离字段，
保留完整输入供重复使用；`masterdata_extract.main` 已接收两个结果再生成活动、
gasha 和最终输出，不再依赖详情函数修改输入。

旧 `build_card_detail_index` 仅作兼容委托到明确命名的
`extract_card_details_in_place`，保留原有 destructive 合约；仓库主流程没有调用。
共享 resource 的后记录覆盖、skill/center 去重、live/story 衣装域和 tutorial
canonical 优先级均未改变。以复制成本换取明确所有权，当前范围是一次离线生成。

`verify:masterdata-cards` 验证重复调用、输入/结果隔离、兼容输出、真实 writer 的
双结果绑定、语音来源优先级及 canonical 规则。加 `--decoded-masterdata
.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb` 对照 `02de25e`：
完整组装索引、拆分后的目录/详情、canonical 列表逐值一致，hash 在
fixtures/masterdata-wire/cards-baseline.json。836 卡片记录对应 826 资源详情，
160 skills、53 center skills、1,098 衣装资源；受控语音/编译证据用于触发映射分支，
不作为实际音频存在性验收。已有卡片字典与语音预览 consumer 检查另行通过。
公共产物未重写，未执行全量发布。

## G13：活动奖励与招募推导

`sidem_masterdata/events.py` 将限定表解码和活动奖励投影分开，纯 builder 接收表行；
主流程显式传入解码结果。旧 `build_event_index(records, ...)` 委托保留。
`gasha.py` 拥有公告抽取、curated 标题来源、精确时间匹配和逻辑组/复刻关系。
领域不读文件，也不导入入口脚本。

招募 pickup 关系仍是推导：要求整数 LimitbreakItemId、精确 start_at 且候选公告
唯一，不将相近时间或多个候选当作确认。logical_primary/reprint 只填 related
关系；缺失 GashaListReply 的事实继续保留。活动奖励区分 card/card_fragment，
积分与读剧情来源、archive/in_event_term 两种可用期及 table/offset 不变。

`verify:masterdata-events-gasha` 覆盖歧义拒绝、字段缺失、间接关系、来源与输入
不变；加 `--decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb`
使用当前卡片目录与 curated 标题对照 `af0ea47`，三组完整输出逐值一致：
59 活动（38 有积分奖励卡、30 有剧情奖励卡）、61 公告/57 逻辑招募组、336 条
推导卡片关联。输入 decoded、卡片目录、curated 内容均记录 hash，输出基线位于
fixtures/masterdata-wire/events-gasha-baseline.json。没有写公共数据或发布。

## G14：背景与编译资源输入层

`sidem_masterdata/resource_inputs.py` 集中 metadata JSON、spine/prefab 索引、编译
JSON stems/summaries、卡片预览、递归 M4A 和平面 PNG 扫描。它使用
`compiled_projection.py` 的纯摘要、base→file 选择及完整 preview step 投影；
`backgrounds.py` 只接受背景 stems 与表行。旧入口重新导出资源适配器，背景旧
目录参数保留薄包装；领域模块不回调入口。共享预览文件在一批中只读取一次。

保留原语义：摘要 title step 优先、否则跳过あらすじ取首个文本首行；坏文件
不生成摘要；JSON 根形状错误不会静默隐去；manifest/index/voice_index 排除；
编译文件只扫描一层、M4A 递归；预览 cue 需匹配 base 前缀，重复 cue 后 step
覆盖，preview_step 和 provenance 原样保留。背景空 stems 继续为 unknown，
不把空扫描误当负面存在性证据。

`verify:masterdata-resource-inputs` 覆盖纯投影无 IO、临时输入目录边界、损坏
JSON、来源/输入不变及预览规则。使用 `--decoded-masterdata
.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb --compiled-dir public/data/compiled`
与 `b259518` 比较全量本地输出：192 背景、3,402 compiled stems/摘要、2,356 个
语音预览逐值相同，基线 hash 在 fixtures/masterdata-wire/resource-inputs-baseline.json。
这是编译 JSON 与目录读取验证，不是音频解码或 P2-B 长时验收。公共产物未改写。

## G15：JSON 写出与公共输出选择

`sidem_masterdata/output_io.py` 集中九处重复 JSON 写出，主入口继续负责 decoded
二进制，writer 不会把它复制到公共目录。完整模式使用 `FULL_PUBLIC_OUTPUTS`
显式名单；专项模式仅写出各自生成的输出集合。编码、缩进、文件名和模式顺序
不变；不删除已有无关文件，也不替调用端扩大公共输出范围。

`verify:masterdata-output-io` 使用空 decoded wire 和临时目录跑 20 组真实 CLI
写出：完整/八种专项/冲突标志优先级 × 是否指定公共目录，与 `3cfee8b` 的文件
字节 hash、名单和 stdout 全部一致，冻结 output-io-baseline.json。另验 Unicode、
数值 0、无关文件保留和明确子集复制。完整模式原本不复制 birthday semantic
index，专项模式会复制；本批保留这一既有范围差异，未借去重改变发布合约。
这是传输/选择边界验证，领域数据完整性由 G5–G14 的独立全数据对照负责。
没有运行本地全量 masterdata 重建或复制当前 public。

## G16：Masterdata CLI 与生成编排

`masterdata_extract.py` 现在只保留历史 API 导出和 main 启动调用。
`sidem_masterdata/cli.py` 负责参数解析，`pipeline.run(args)` 负责生成编排；
`card_tables.py` 抽取原始卡片与 cue，`diagnostics.py` 生成扫描/覆盖/计数报告，
`adapters.py` 保留少数目录参数和原地详情 API 的兼容组合，`patterns.py` 拥有
启发式识别表达式。包内模块不反向导入旧入口。

从仓库根可运行 `python -m data_pipeline.sidem_masterdata`；原脚本路径继续可用。
curated 默认路径仍指向 data_pipeline/curated，而非迁移后的包目录。
模式优先级、decoded 写出和公共输出选择保持 G15 合约。

`verify:masterdata-entrypoint` 以两个真实子进程入口运行 help 与临时音乐模式，
检查相同文件字节、默认路径、卡片原始偏移、诊断 unknown/zero 区别和无入口反向
依赖。G15 的 20 组真实临时 CLI 输出基线继续通过；12 项 masterdata source
回归全部通过。10 个迁移 helper 的 AST 与 `8f7fcf4` 相同，没有改动其领域语义。
卡片 writer 检查已跟随实际 pipeline.run 迁移，继续要求显式接收目录/详情。

尚未完成：pipeline.run 仍集中完整/专项任务的数据准备与选择，需要继续形成
可独立调用的生成任务；没有宣称全量真实输入 CLI rebuild 或 public 发布验收。

## G17：独立生成任务与按需资源输入

`generation_jobs.py` 提供八个专项函数与 `generate_full`，接收 GenerationInputs，
返回文件名→数据的输出集合。它们不接收输出目录、不调用 writer；pipeline 仅
负责读 decoded 输入、按既有优先级选任务、写结果和打印兼容统计。
`generation_inputs.py` 固定本次任务的输入路径，compiled stems/摘要首次使用时
读取并在实例内复用，没有跨任务缓存。

歌曲、三种影像和生日语义任务不需要编译资源，现已跳过此前无条件的全目录
扫描；即使给出不可访问/损坏的无关编译目录，也不应影响这些独立任务。
需要资源的任务仍保留既有读取和错误语义。完整任务继续显式拆分卡片双输出。

`verify:masterdata-generation-jobs` 覆盖九个任务无写出、五种独立任务不扫描、
缓存一次读取和跨实例隔离。加 `--decoded-masterdata
.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb` 对照 `5fffae3`，八个
实际专项任务完整输出一致，冻结 generation-jobs-baseline.json；旧 JSON 写出
被截获，decoded 临时文件只落在临时目录，未运行全量真实生成/发布。
13 项 masterdata source 回归、20 组 CLI 输出及两个真实启动入口继续通过。

G16 所记任务选择与生成耦合已拆开；完整任务仍有较多数据准备步骤，尚未据此
宣称整个 G 结束，authoritative/发布层和 compiler 内部语义边界仍需继续处理。

## G18：编译工具与 Runtime 共用 normalization

`web_viewer/shared/story/ScenarioNormalizer.js` 现在拥有 legacy→compat-v2 和
v2 clone 的纯数据归一化。它不依赖浏览器、Vue、Pixi 或 Node 文件系统。
`src/core/story-runtime/ScenarioNormalizer.js` 保留同一函数导出的兼容入口；
`authoritative-scenario-compiler.mjs` 直接依赖 shared，不再反向导入前端 src。
这只是确定共享 owner，没有改变兼容投影语义，也没有移除 normalizer。

迁移实现与 `08e6956` 原文件（统一换行后）相同。新增
`verify:shared-scenario-normalizer` 以独立 data URL 导入证明它不依赖仓库路径，
检查 Runtime 函数身份、输入隔离、schema 错误和编译端无 src 依赖。
Runtime foundation、Spine cue 回归及全部 10,326 剧情的 Runtime shape 验证通过
（315,124 snapshots、175,600 cues）；publicDir:false 生产构建通过。

实际浏览器从故事目录进入 C.FIRST 前传，再打开
`episodes/1_1_016_01_a.json` 播放器（start=2/end=26），推进 2→3 并返回
story_collection/unit_story/16，集合上下文保留。此为短流程冒烟，不代表所有
舞台过渡、窄屏矩阵或真实音频 P2-B soak。未重编译、发布或改写公共剧情。

未完成边界：旧默认接口仍使用类缓存和兼容盘符；authoritative_scenario、RAW 候选写出、
masterdata 已入包，authoritative/发布脚本仍在包外，G 整体未完成。此批按职责移动既有实现，
没有引入新 IR/schema 或修改 RAW 语义。

## G19：纯文本身份规则独立

`sidem_scenario/text_identity.py` 拥有文本规范化/哈希、来源路径、token 检查和
说话人身份分类，不读取资源，不导入编译器或持有编译状态。ScenarioCompiler
保留历史方法名；两个 classmethod 包装仍尊重子类 TEXT_TOKEN_PATTERN 和
normalize_source_text 覆写。当前 command index、part、unit ID 及 text_ref 的
装配仍属于编译会话，未改变文本编号或来源证据。

verify:story-text 纳入独立文件导入测试：无 compiler 导入副作用，Unicode NFC/
BOM/换行哈希、非规范路径拒绝、说话人分类优先级、方法身份和子类派发通过。
既有文本 evidence/hash vectors/schema/overlay fixture 通过；scenario-package 的
10 组冻结完整输出/provenance 哈希、旧/新入口和临时 batch，以及 resources 的
无文件系统注入编译回归通过。没有重新生成 public、候选或发布产物；本批不改
浏览器源码，因此未重复浏览器验收或前端构建。

## G20：严格输出投影归入 scenario 包

从仓库根使用 data_pipeline.sidem_scenario 导入时，严格编译原先因绝对导入
顶层 authoritative_scenario 而抛 ModuleNotFoundError。投影实现现归属
sidem_scenario/authoritative.py；compiler 使用包内相对导入。原
 data_pipeline/authoritative_scenario.py 保留函数兼容导出，同时支持历史顶层
导入与仓库根包导入。包内部不再依赖旧入口；投影函数体与 55ed708 按换行
归一后一致，没有修改 strict-v2 语义。

verify:scenario-package 新增清除 PYTHONPATH 的真实子进程，从仓库根导入并
编译严格 fixture，完整结果与原入口一致，同时验证 shim 函数身份且未加载
顶层 authoritative_scenario。原 10 组冻结产物/provenance、双 CLI 和临时 batch
保持通过；story-text、scenario-resources、scenario-source-config（含实际候选
CLI 临时输出）通过。未修改 public/candidate 发布目录，不需要前端构建。

## G21：仓库根模块启动与历史 CLI 对齐

scenario_compiler.py 兼容层按 __package__ 选择相对/历史顶层导入，修复仓库根
`python -m data_pipeline.scenario_compiler` 的 ModuleNotFoundError。新增
sidem_scenario/__main__.py，允许 `python -m data_pipeline.sidem_scenario`；
二者与 sidem_scenario.cli 共用 main。帮助文本将原本误写的 output.json
改为 output_dir，与 compile_file 的实际目录写出行为一致。

verify:scenario-package 在不含 PYTHONPATH 的新进程测试三个仓库根模块入口：
stdout 完整 JSON、指定临时输出目录与无参数帮助。它们与原结果一致，旧脚本/
顶层模块入口、10 个冻结输出哈希、严格包导入及临时 batch 回归保持通过。
scenario-source-config（含实际临时候选 CLI）也通过。没有对真实输入全库
编译，没有更改公共产物和发布目录。本批仅为启动边界，无前端修改。

## G22：批量编译失败结果显式化

compile_directory 原先逐文件打印错误后返回 None，CLI 在部分失败时仍退出 0；
临时 broken.json + valid.json 已复现该问题。现在 API 返回 compiled 与 failures
（path/error）结果，CLI 有失败时退出 1，保留成功文件并继续处理其余输入。
不存在的输入目录抛 NotADirectoryError，os.walk 的读取错误也记录为失败。
错误前缀改为 ASCII [ERROR]，避免原叉号在 Windows GBK 输出下再次抛异常。

新增 verify-scenario-batch-errors 已纳入 scenario-package CI 命令，覆盖旧脚本/
包模块真实子进程的部分失败非零退出、成功文件保留、损坏文件不生成、缺失
输入目录、全成功退出 0，以及 API 结构化结果和受控遍历错误。原 10 组冻结
产物/入口回归通过。测试仅用临时小输入，没有批量编译真实档案。返回值是有意
新增的 API 结果；成功产物、处理顺序和已成功文件不回滚的行为不变。

## G19–G22 后的跨层回归（2026-09-09）

代码基线 af762e4；本轮未修改生产代码或公共产物。扩大到以下本地 CI 命令：

- verify:compiled-migration：文本证据增补允许，场景/voice/lip/cue/choice/episode
  漂移拒绝；Python 原生严格候选及临时目录发布/备份/拒绝用例通过。
- verify:raw-evidence-boundaries：RAW 延迟依赖、来源、分组/排序/碰撞、无效字节、
  part 级语音歧义和 Unity identity 通过。
- verify:story-spine-cues、verify:story-timing-semantics -- --source-only：编译路径
  对照、角色就绪/取消/恢复、neck/tint 时钟和已发布长编舞时序通过。
- verify:story-schema：严格 schema 与 15 个 ledger artifact 检查通过；运行时形状
  扫描 10,326 scenarios、315,124 snapshots、175,600 cues、48,073 lip records，
  1,214 snapshot shapes、488 nested shapes、37 action/payload shapes 通过。
- verify:story-catalog：1,394 目录与有/无 presentation 的完整属性对照及新增领域
  投影边界通过；verify:archive-data 的 26 产品、请求竞态、重试与卸载通过。

所有命令终态 exit 0。此为本地针对重构影响范围的跨层回归，并非完整 CI 任务，
更非 GitHub Actions 已运行。shape 扫描、临时发布测试不证明真实媒体呈现或正式
发布。没有扩大 strict-v2 promotion，P2-B 实音长稳仍未完成。
