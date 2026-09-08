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

未完成边界：旧默认接口仍使用类缓存和兼容盘符；authoritative_scenario、RAW 候选写出、
masterdata 和发布脚本仍在包外，G 整体未完成。此批按职责移动既有实现，
没有引入新 IR/schema 或修改 RAW 语义。
