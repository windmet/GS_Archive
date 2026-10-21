# 舞台冷加载测量入口（2026-10-20）

分支 `stage/20261020-native-followup`，输入 `0ebb77e1`。本批扩展既有 `measure-portal-cold-load.mjs`；没有执行限速冷缓存测量，也没有产出新旧性能收益结论。

## 指标与判定

新增可选页面 `stage-drive`、`stage-hnd`、`stage-tbt`、`stage-flash`，分别绑定真实编排 `drvalv`、`hndmkh`、`tibeti`、`flslgt`。默认门户页面集合保留；指定stage页面时默认超时120秒，门户仍45秒，均可用 `--timeout-ms` 覆盖。

舞台entity为**场景就绪DOM合同**：指定歌曲一致、`data-stage-ready=true`、活动/已载入站位集合一致且非空、canvas尺寸非零，并且object/lighting/beam开关符合指定full/lite模式。它不代表全部动作预载、媒体下载、音频解码或已经开播，也不是GPU首帧呈现时间。保留FCP/LCP，不能拿它们代替这个阶段。

测量前通过舞台现有 `gs-stage-viewing` 保存格式固定quality、auto帧率及remember，防止手机默认lite和桌面full混比；观察器监听舞台就绪/站位/模式及canvas尺寸属性，能捕捉只改变attribute的就绪时刻。

CDP统计按重定向hop记录请求；`Network.loadingFailed`即使status=0也算失败。dataReceived的encoded字节随事件时间累计，loadingFinished补入最终总量差额；用CDP单调时钟与wallTime的偏移，将事件与DOM的timeOrigin+entity对应，得到**截至entity标记的CDP已观察字节**及已发起请求数。不是原始JSON体积、TCP全成本或实际屏幕首帧前精确字节；HTTP完成时才知道的额外字节不会倒填到较早的entity时刻。

超时、未就绪/内容丢失、资源失败、运行时异常及指定release不匹配的样本保留在report.results，但不进中位数；有失败返回非零。summary列出有效/尝试数、无效原因、超时与资源错误；零有效样本的字节值保持null。仅浏览器启动未暴露page target时重试一次并记录次数，页面命令超时不再悄悄重测。

report保存profile配置、quality、timeout、read-model release、生产入口chunk文件名及每次结果。有效样本若混入不同release或入口chunk，全部标为mixed-build-or-release并排除；没有生产入口chunk或release时buildConsistent为false，不能当作同一生产构建证明。启动参数请求SwiftShader，尚未验证实际GPU后端，不能作为真机GPU表现。

## 后续受控对比用法（本批未运行）

```powershell
node scripts/measure-portal-cold-load.mjs stage-before --base=https://<已授权的基线preview> --pages=stage-drive,stage-hnd,stage-tbt,stage-flash --profile=mobile --runs=5 --stage-quality=full --expected-release=<read-model-release-sha256>
```

另以新label测候选preview；两次保持release、模式、viewport、网络/CPU配置及每次新profile一致，分别核对实际入口chunk。输出为本checkout `.analysis/perf-baseline/<label>/report.{json,md}`。baseline与candidate代码预期不同，但各自内部不能混构建；发布资源/HTTP须先验收。本批没有部署、启动独立headless测量浏览器或产生对比报告。

## 验证

- `node scripts/verify-cold-load-metrics.mjs`通过：真实目录中的4个编排身份与路由；full/lite正反例、错曲目、未齐站位、零canvas、属性单独变化、内容丢失恢复；重定向/失败/部分传输及较晚字节不倒填；无效样本不进中位数、空样本null、混构建拒绝、错误CLI参数在启动浏览器前拒绝。
- `node --check scripts/measure-portal-cold-load.mjs`及`verify-verifier-coverage.mjs`通过；coverage登记459份脚本，源码批次160项，登记数量不冒充本批全套运行。
- Browser实际用Codex In-app Browser / cua_repl，复用5213当前checkout：Time Before Time full判定true，错DRIVE及错lite判定false；界面改lite后lite=true/full=false，恢复full后再次反转。活动/载入站位均2/3/4、ready=true；当前URL与目标query一致。返回 `/songs/knwonl/?maintainer=1`，Combo表实际载入，捕获无error/warning。
- 浏览器检查只执行DOM读取与正常UI操作，未注入计时observer或清空缓存/限速；它证明选择器与模式合同，不是冷加载测量。完整模式已恢复。截图 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/stage-cold-predicate-full.png`，同目录 `stage-cold-predicate-console.json`。

本批仅修改Node测量工具与回归，不改前端，未重复Vite构建。下一步仍是候选资源上线后，在受控环境执行实际基准，再根据结果优化阶段/缓存与GPU；目前不设置缺乏实测依据的预算数值。
