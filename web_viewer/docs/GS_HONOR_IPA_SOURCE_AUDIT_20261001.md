# 称号反查：原 IPA 直接读取与扩展检索

输入 HEAD `70a1cfc8`。用户询问是否读取 IPA 后，本轮直接读取 `E:/BaiduNetdiskDownload/SideM/サイスタ - 副本/サイスタ 2.6.10.ipa`，不再只依赖先前提取的 keyfiles。未完整解压媒体、未修改公开数据或前端。本轮新增的是证据和工作记录。

## 原包与已提取文件一致

IPA 为 245,748,051 字节，239 个 ZIP 条目，条目解压尺寸合计 294,877,168 字节。IPA SHA256：`b371ae8ddac7ed67a411880a972a4039a5c6c2127c4cbbaa62c1abbb74aacfaf`。

| 包内文件 | SHA256 | 本轮确认 |
| --- | --- | --- |
| `Data/Managed/Metadata/global-metadata.dat` | `658f966af11aef965b541e093889056cafa61a7f7fcd4bbf38e1ca2eab6d6e00` | 与 `.analysis/sidem_ios_keyfiles/global-metadata.dat` 逐字节相等；已有字段与枚举证据绑定到原 IPA |
| `Frameworks/UnityFramework.framework/UnityFramework` | `2e86fc201acdd5312cc3ced119d75e0bb78d8310e700388d040c44b4b522580c` | 与既有 keyfiles 逐字节相等；Mach-O encryption command `0x2c` 的 cryptid=1、cryptoff=16,384、cryptsize=64,503,808 |
| `Data/data.unity3d` | `fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a` | 直接从 ZIP 在内存读取，用本地 UnityPy 解析对象 |

元数据可读不等于 UnityFramework 方法体已解密。本轮没有 native 方法体还原结论。加密标记也不证明服务器任务数据藏在原包里。

## 内置数据检查

`data.unity3d` 有 29 个 TextAsset。记录全部名称、pathId、尺寸和内容哈希，并对内容检索 NormalMissions、TimeBoundMissions、ProductWithRoute、ProductRoutes、ProductRoute；未命中响应候选。

检查 32,868 个 MonoBehaviour 的脚本身份，相关命中是任务和称号 UI（例如 MissionTopView、MissionListCell、PanelMissionPanel、HonorDetailsPopupContent）。未命中 MissionData、HonorData、ProductRoute、Masterdata、Database 或 GameDb 名称的 MonoBehaviour 数据对象。这个结果只覆盖具名脚本身份，不证明所有二进制或 native 代码中都没有关联。

包中的 `Data/Managed/response.rsp` 内容为 Unity 编译参数，不是接口响应存档。两个 Unity Linker JSON 是构建引用信息，也未作为任务奖励载荷使用。

审计文件：`E:/Web_build/SideM_Archived/web_viewer/.analysis/honor-acquisition-v1/ipa_inspection_receipt.json`。原包只读，输出是小型 JSON；没有提取完整 IPA 或资源发布副本。

## 扩展本地响应检索

| 指定目录 | 实际枚举文件数 | 响应候选文件名命中 |
| --- | ---: | ---: |
| `D:/Files/Downloads` | 15,005 | 0 |
| `E:/BaiduNetdiskDownload/SideM` | 213,852 | 0 |
| `E:/Web_build/GS_Archive_Domain_Work` | 58,559 | 0 |

共 287,416 个文件名。检索 HAR/SAZ/PCAP/PCAPNG 扩展名及 Mission*Reply/List、ProductRoute、response ZIP 命名，排除 `.git`、node_modules、tool-cache、`__pycache__` 和符号链接。每个目录记录相对路径/尺寸清单的 SHA256；不输出整个无关文件清单。

在 growing stars/assets、story_viewer/extract_output、GS_Res/MonoBehaviour 下检查 46,168 个 JSON/TXT/BYTES 文件，其中 39,028 个可严格读取为 UTF-8，未命中上述任务列表或 ProductRoute 字段关键词。7,140 个 UTF-8 不可读文件的数量与 `.bytes` 总数相同；进一步核对所有 `.bytes` 的路径与首字节，7,135 个位于 livecharacter/animation，5 个位于 livecharacter/setup。这里只记录资源分类，没有把二进制资源当接口载荷或完全解码证明。

扩展检索 receipt：`.analysis/honor-acquisition-v1/broader_response_search_receipt.json`，SHA256 `ee654adcb0210d6e67009d4c09bdf4bcd177e774cade19543079fe0c561a2742`。该结论限于命名文件和指定文本关键词，不覆盖其他磁盘、未命名响应、未展开压缩包或加密载荷。现有 RAW 包说明将其归为 Unity/audio/movie 资源，说明文本不能替代逐文件响应证明。

## 结果与剩余缺口

已有模型、枚举、获取目录现在进一步核对到了原 IPA；仍未获得真实 `Mission*ListReply` 或 `ProductRouteReply` 响应。886 个已知来源、727 个 unknown 保持不变。391 个 ReleasedByMission 解锁引用仍不包含任务参数，未进入称号获取来源。

检查了 receipt 中的数量、候选为空、参数边界及当前文件哈希；文档内容/链接与 `git diff --check` 通过。这是证据和文档批次，不进行 Vite 构建或 Browser 验收。未把检索无命中解释为所有本地材料不存在响应，也未标记整个称号反查完成。

下一项必要输入仍是真实任务列表或 ProductRoute 响应存档的位置。此前的备份路径问题尚无答复；不重复请求权限，也不调用旧在线接口或读取用户凭据。
