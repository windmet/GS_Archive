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

未完成边界：compiler 仍直接解析口型文件和背景配置，查询音频资源，保留
原有环境变量、默认路径和类缓存；这不是纯函数编译核心。后续应把资源查找
作为显式依赖迁移并以有/无资源样例验证。authoritative_scenario、RAW 提取、
masterdata 和发布脚本仍在包外，G 整体未完成。此批按职责移动既有实现，
没有引入新 IR/schema 或修改 RAW 语义。
