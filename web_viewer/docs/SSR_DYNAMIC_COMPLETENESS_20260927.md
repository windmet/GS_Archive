# SSR 动态卡面漏收排查

日期：2026-09-27。GS 本地基线 `c6a6e19`；SSR_Portraits 本地基线 `a451ddd`，高于附件引用的 `41b9dd4`。本次只读调查 SSR 仓库和 RAW；没有修改动态站目录、上传资源或部署。

## 已确认的根因

`021jun_ssr02`（card_id `1421002`，冬美旬「魔法をみんなに」）存在动态 Spine 来源，属于收录遗漏。

证据链如下：

1. GS MasterData：127 条 SSR，去重后 124 个 resource_id。SSR authority 同为 124；动态 resources 只有 123，唯一差集为 `021jun_ssr02`，反向差集为空。
2. RAW 存在 `asset/card_021jun_ssr02.unity3d`，6,782,371 字节，SHA-256 `3c4350854cb67fc3fc6b9689b10fb26d55a9ea754b1079134aea875ad0491eae`。
3. bundle 的内部骨骼、Atlas、纹理名称写成 **`card_02jun_ssr02p`**。内部名称与规范角色代码 `021jun` 不同，不能拿文件名直接当身份。
4. 旧本地提取已经位于 `E:/Web_build/SSR_Portraits/prefab/02jun/ssr02`，含 skel、atlas、两张 PNG、config；`skel_files.txt` 也记录了这条非标准路径。
5. `SSR_Portraits/scan.js` 使用 `/^\d{3}[a-z]{3}$/` 过滤角色文件夹，不匹配即 `continue`。因此 `02jun` 被跳过。当前 `data.master.json` 和 resources 没有此 resource_id。
6. `tools/discover_ssr_layout.py` 从旧 `data.master.json` 枚举卡片，只验证已有记录。123/123 的证明没有覆盖第 124 张。

这是可复现的漏收路径。没有历史执行日志，不能声称已重建当年每一步操作；当前文件和代码足以证明该过滤规则会漏掉现存目录。

## 目标卡 Unity 内部引用

| 对象 | path_id / 说明 |
| --- | --- |
| SkeletonAnimation | `4192223276191238366` |
| SkeletonDataAsset | `-2481314003716958816` |
| skeletonJSON TextAsset | `7384825500677952864`，`card_02jun_ssr02p.skel`，1,076,287 B |
| SpineAtlasAsset | `-8515068984627592265` |
| atlasFile TextAsset | `7754343894644148035`，`card_02jun_ssr02p.atlas`，19,767 B |
| 纹理第一页 | `7262611572124857118`，2040×2040 |
| 纹理第二页 | `6530509187368699759`，1996×1996 |

两个材质的 `_MainTex` 均指向正确 Texture2D；Atlas 页名与材质顺序匹配，流式纹理 payload 可读取，两页均实际解码成功。旧提取 skel/atlas 与 RAW TextAsset 字节完全一致。纹理名称中的 `p` 不是用来认定卡片身份的依据。

旧 PNG 与 UnityPy 1.25.0 本次解码的 RGBA 不完全相等，简单上下翻转也不相等。本次未判定差异来自哪种历史转换；后续补录必须核对转换/PMA，不能直接宣称旧 PNG 无损等价。

## 全量结果

新增 MasterData-first 只读工具 `scripts/audit-ssr-dynamic-completeness.py`。它不从旧动态列表决定扫描范围，不按骨骼名称匹配身份；以权威 resource_id 的 bundle 为入口，按 Unity 指针与 MonoScript 类名验证引用。

| 范围 | 实测 |
| --- | ---: |
| MasterData SSR 行 | 127 |
| 唯一 SSR resource_id | 124 |
| 动态站资源索引 | 123 |
| RAW 动态引用链完整 | 124/124 |
| RAW 普通静态 icon 对象存在 | 124/124 |
| RAW 特训后静态 icon 对象存在 | 124/124 |
| 精确 skill_movie 文件存在 | 124/124 |

`source-chain-verified` 只表示源引用和纹理字节可解析，不代表骨骼已由浏览器运行时播放、相机布局已签收或已部署。静态统计只覆盖 icon 对象存在性，不扩大为全部 portrait/landscape 像素验收。skill_movie 统计为文件存在、大小与散列，不是视频播放验收。

缺失 bundle、外部指针或损坏链路一律 unresolved，不推断官方不存在。将来出现无 exact bundle 的卡，需要另做 reverse scan；本轮全部 exact bundle 存在，无需用反扫替代已闭合引用。

## 复现及产物

在 `web_viewer` 执行：

```powershell
python scripts/audit-ssr-dynamic-completeness.py --card-index public/data/masterdata/card_index.json --raw-root ../RAW --dynamic-resources E:/Web_build/SSR_Portraits/viewer/source/ssr-portrait-resources.v1.json --output .analysis/ssr-completeness/report.json
python scripts/verify-ssr-dynamic-completeness.py
```

- 全量执行通过，124 条 `source-chain-verified`；工具不是线上目录完整性 gate，仍明确报告唯一 inventory gap。
- fixture 回归通过：内部名称不同、流式纹理、断链、外部引用、Atlas 错页、空骨骼。
- 完整本地报告 `.analysis/ssr-completeness/report.json`；目标与旧资源比较 `.analysis/ssr-completeness/021jun_ssr02-local-comparison.json`。
- [提交的证据摘要](evidence/SSR_DYNAMIC_COMPLETENESS_20260927.json)保存输入散列、全量报告散列、计数、目标链路及逐文件比较。
- 本批为 Python 审计及文档，无前端变更，不运行 Vite，也不创建媒体包。

## 后续修复落点

应在 SSR_Portraits 的 resources 中以 **规范身份 `021jun_ssr02` → 原始路径 `prefab/02jun/ssr02/...`** 建立经 Unity 证明的映射，不改 RAW 内部命名、不合并到 `ssr01`、不将差异解释成普通/特训前后。

随后补齐布局/相机 provenance、核对纹理转换并生成 lossless WebP，重新生成 124 张目录，验收该卡加载/动画/释放及冬美旬两张卡的切换。只有完成这些工作后才能把网站的动态收录数从 123 改为 124。应把 MasterData→resources 的未处理差集作为后续源门禁输入，避免再次只验证旧清单。
