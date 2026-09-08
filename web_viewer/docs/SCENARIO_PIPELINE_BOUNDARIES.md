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

未完成边界：旧默认接口仍使用类缓存；配置来源还需与 archive_paths 进一步
统一。authoritative_scenario、RAW 提取、
masterdata 和发布脚本仍在包外，G 整体未完成。此批按职责移动既有实现，
没有引入新 IR/schema 或修改 RAW 语义。
