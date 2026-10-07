# 本地语料检查体检（2026-10-07）

输入 HEAD：`1d5dc248`；主检出挂载现有语料。按 `config/verifier-coverage.json` 的 `localOnly.corpus` 执行全部 38 项，每项 90 秒上限，超时终止所属进程树。未运行完整资源构建，也未上传或部署。

## 结果与边界

- 首轮：31 项退出 0，6 项退出非零，1 项超时。
- 修正运行环境后：歌曲选择器使用 `--experimental-vm-modules` 通过；歌曲 gameplay 使用已安装 UnityPy 的 Python 3.14 正常 site 路径通过（首轮 `-S` 隐藏了此依赖，未安装新依赖）。
- 修复 terminal 本地化检查脚本后，42 个真实 SFC SSR 场景通过。共 **34 项通过，3 项数据/证据不一致，1 项超时未完成**。没有把退出码 0 的诊断报告当作资源零缺失证明。
- 所有日志及首轮逐项结果：`E:\Web_build\GS_Archive_engineering_20261007\corpus\results.json`。复测日志分别为 `verify-chibi-song-picker.vm.log`、`verify-song-gameplay.python-site.log`、`verify-terminal-idol-localization.fixed.log`；gameplay 复测限时结果为 `gameplay-rerun.json`。
- `verify-archive` 报告仍发现 canonical 对白语音可用 26849/26912、辅助对白语音 43433/43553；卡片首页语音 2564/2564。此检查本身退出 0，因此这些数字单独记录，不能称“全库语音齐全”。完整报告为上述目录的 `archive-verification.json`。

## 尚未通过的四项

| 检查 | 当前证据 | 分类与处理 |
| --- | --- | --- |
| `verify-episode-artifacts.mjs` | episode manifest 缺 `1_2_002_12_a.json`，文件本身存在 | 语料清单不一致；9 月 30 日修复记录已有相同首错。不补清单、不重建数据 |
| `verify-local-story-strict-schema.mjs` | 4939 个本地 RAW 候选中，5 个已标记 invalid-choice-target 的候选报缺 `target_kind`，旧脚本仅认可 minimum 错误 | 历史候选/当前 schema 与诊断约定不一致；4934 个 strict-v2 候选未报错。保留失败，不以放宽异常名单掩盖候选缺字段 |
| `verify-song-timelines.mjs` | manifest.source.indexSha256 为 `e3565c25167757077db4fca7e5314a0421bfdca3a6c64eaa7d6a3f019a8a645a`；当前 choreography/index.json 为 `76705ce7b7600d1f4fc0da6ec89ec340fe05486907dd984cccaaba4eef2960e8` | 派生数据与来源哈希不一致；未改哈希或重建 timeline |
| `verify-preview-assets.mjs` | 达到 90 秒限时，进程树已终止 | 未完成，不能视为通过或直接判定资源损坏；未擅自延长规定时限 |

上述数据/基线变更需按工程交接 4.7 另行审阅和授权，本批没有执行。

## 脚本修正

`verify-archive.mjs` 新增可选 `--output <path>`，本批把报告写到 E 盘审计目录，避免覆盖 `public/data/archive_verification.json`；无参数保留原行为。

`verify-terminal-idol-localization.mjs` 修复了以下过时的检查方式，未改组件、翻译或数据：

- 名字提取忽略嵌套装饰标签，但保留子节点文字，因此错误/重复名字仍被断言拦截。
- 普通读者模式断言没有原始 JSON；证据保真断言显式开启既有 maintainer 模式，并在结束后恢复测试全局状态。
- 活动证据按当前的 provenance/file/classification 容器逐字段比对。
- 卡片归属按当前单一身份入口检查文本、canonical focus id 和可访问名称，不再要求已移除的重复入口。

主检出 SSR 验证通过。隔离 LF 检出因缺少完整语料（先缺 compiled/index，补充 646 KiB 索引后仍缺 photo costume 证据）不能执行此 corpus 检查；未复制媒体库，不声称有干净检出通过记录。该限制与前述 105 项 source batch 通过是两套不同证据。
