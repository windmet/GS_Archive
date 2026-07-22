# 正式剧情重编差异审计：首个 group dry-run（2026-07-22）

## 结论

`1_4_001_01` 已完成首次隔离式 group 重编和差异审计。aggregate 与 a–j 十个 episode 的 scenario identity、step 数量/类型序列、episode boundary、Choice target、voice/lip、timeline/cue、来源文本和非文本演出字段全部保持一致。

本轮没有覆盖 `public/data/compiled`，候选产物只写入工作区外的临时目录。该结果证明当前 compiler 能为此 group 增加文本证据而不改变现有演出语义；它不代表正式 compiled 已发布，也不授权批量替换其他 group。

## 基线

- 分支：`codex/story-localization-contract`
- 审计基线 HEAD：`5fe0e64abd486734b083b89237e291c5509935b4`
- raw group：`scenariodata/1_4_001_01/scenario_1_4_001_01_a.json` 至 `scenario_1_4_001_01_j.json`
- 旧产物：`public/data/compiled/1_4_001_01.json` 与 `public/data/compiled/episodes/1_4_001_01_[a-j].json`
- 候选编译：a–j 共用一个 `ScenarioCompiler.compile_group()` state machine
- 语音重新链接：139/139，未解析 0

## 审计结果

| 产物 | Steps | 新增文本单元 | 非文本差异 | 结果 |
| --- | ---: | ---: | ---: | --- |
| aggregate | 432 | 209 | 0 | PASS |
| a | 42 | 25 | 0 | PASS |
| b | 70 | 29 | 0 | PASS |
| c | 30 | 14 | 0 | PASS |
| d | 48 | 27 | 0 | PASS |
| e | 64 | 33 | 0 | PASS |
| f | 44 | 16 | 0 | PASS |
| g | 24 | 12 | 0 | PASS |
| h | 33 | 17 | 0 | PASS |
| i | 36 | 21 | 0 | PASS |
| j | 41 | 15 | 0 | PASS |

每个产物均满足：

```text
scenario identity unchanged
step count unchanged
step identity/type sequence unchanged
episode boundaries unchanged
choice targets unchanged
dialogue voice/lip equivalent
cue profile unchanged
source text/speaker unchanged
non-text differences = 0
```

语音审计将现有短 cue、完整文件名和已知别名视为同一资源身份；例如 `_t01_` 别名折叠到同一实际 M4A 时不算演出差异。lip path 仍按结构精确比较。

## 可重复命令

候选目录必须位于 `web_viewer` 工作区之外，且开始时为空：

```powershell
npm run story:migration-candidate -- `
  --raw-group-dir "E:\BaiduNetdiskDownload\SideM\scripts\scenariodata\1_4_001_01" `
  --group-id "1_4_001_01" `
  --expected-parts "a-j" `
  --output-dir <空临时目录>
```

单个 episode 的门禁命令：

```powershell
node scripts/report-compiled-scenario-migration.mjs `
  --old public/data/compiled/episodes/1_4_001_01_d.json `
  --new <临时目录>/episodes/1_4_001_01_d.json `
  --json-out <临时目录>/audit-d.json `
  --summary-out <临时目录>/audit-d.txt `
  --check
```

工具自测：

```powershell
npm run verify:compiled-migration
python -m py_compile scripts/compile-story-migration-candidate.py
```

## 仍未完成

1. 还需各选择一话 Card、一话 Event 和一话无 Spine 的简单剧情执行同样审计。
2. 还没有把任何候选 compiled 替换为正式产物。
3. 正式替换前仍须运行 episode、voice、story text、presentation、collection 与 archive verifier。
4. 本机完整资源扫描仍发现 63 条标准 dialogue voice 缺失；这是媒体挂载差异，不能用本次 139/139 group voice relink 结果替代全库资源验收。
