# 2026-10-07 测试发布执行记录：构建门禁停止

按 [发布清单](GS_ARCHIVE_RELEASE_CHECKLIST_20261007.md) 执行。R2 上传、资源审计、read-model 重建与 inline bootstrap 同步已完成；第 4 步 `build:check` 失败，已停止，未打包、未部署 Pages，未执行线上验收。Production 未发布。

## 发布身份与已完成步骤

| 项目 | 实际结果 |
| --- | --- |
| 初始源码 HEAD | `84d0225e`；共享工作区中的其他窗口随后有提交，未回退或覆盖 |
| 构建尝试 HEAD | `7c0b1bbbc93317af79a7f45002803856ec696f42` |
| 新 dataRevision | `98825488c36c677bc849c6e02fcb1439dfb383bd89f26197233b5e36d7864aa4` |
| 新 read-model release | `c6e0c04c3307d61e652e616a78b7f23981b44d95efabcef060f966c46a8da99e` |
| read-model 目录 | `E:\Web_build\GS_Archive_release_20261007\rm-20261007`，仓库外、E 盘 |
| media epoch | `voice64-gzip-all-20260924` |
| 上传前桶总量 | 117,944 对象，7,320,107,118 B |
| 上传后桶总量 | 122,979 对象，7,471,979,718 B，严格小于 8,600,000,000 B |
| 实际新增 | 5,035 对象，151,872,600 B，与计划一致 |
| 其他桶总量 | 444,588,701 B；容量门禁按至少 880,000,000 B 预留，账户预计 8,351,979,718 B |
| 上传回执 | `.deploy/release-20261007/upload-receipt.json`，`mode: --upload`，完成于 2026-10-07 11:32:43（Asia/Shanghai） |
| 资源审计提交 | `228f18ea`，仅 `config/resource-audit.json` |
| inline bootstrap 提交 | `f0eac900`，仅 `readmodels/bootstrap.inline.json` |
| 翻译生成元数据提交 | `7c0b1bbb`，仅 `config/translation-release.json` 与 `public/translations/manifest.json` |
| 部署 hash 子域 | 无，未到部署步骤 |
| HTTP 回执 / 截图 | 无，未到线上核验步骤 |

源清单有 49 张签名图，增量批次恰为 49 张签名图和 4,986 个新版本 JSON 快照，没有其他选中对象。签名图全部通过 VP8L、尺寸、可见 RGBA 像素和透明 RGB 清理策略检查。新版本 JSON 目录只读进度查询最终计数为 4,986，总计 150,351,690 B；签名图总计 1,520,910 B。最终上传工具全桶核对通过。

源清单的 82 个缺失依赖与 10-06 清单逐项相同，没有新增缺失。背景分类提交 `7cc9e8c7` 和「电话」提交 `49c90f2d` 均通过对 `a0fa1aa6` 的祖先关系检查。清单中“只有两个数据文件改动”的表述还漏记了 `9f574186` 对 `public/data/archive_baseline_report.json` 的统计更新；它已包含在本次版本化 JSON 快照中。

第四层描述文件 `.analysis/release-20261007/overlay-20261007.json` 已生成。重新加载四层记录通过，共 103,969 个源对象；各层 manifest、receipt 与 source inventory 的 SHA-256 验证通过。

read-model 构建输入 HEAD 为 `228f18ea`。`verify_artifacts` 通过 8,834 个产物的字节、描述符和 schema 验证；这不是 Browser 或设备验收。候选与代码内 inline bootstrap 的 JSON 完全一致。翻译元数据刷新引用 112 个文件，逐项哈希、字节数及 release 哈希检查通过；文件实际内容均与 HEAD 一致（忽略 CRLF/LF 差异）。未改翻译正文。

## 停止原因

执行 `npm run build:check`，输出固定为 `.analysis/build-check`，`copyPublicDir:false`，未复制 public 语料。Vite 转换 2,838 个模块后，构建审计插件在 `generateBundle` 阶段失败：

```text
[archive-build-audit] Route ledger release differs from bootstrap
```

实际绑定：

| 输入 | release |
| --- | --- |
| `readmodels/contracts/routes.json` | `ce317169fc85ce52e2087fac36b46b65436af32515ff5619ee3f751047f1e0b1` |
| `readmodels/bootstrap.inline.json` | `c6e0c04c3307d61e652e616a78b7f23981b44d95efabcef060f966c46a8da99e` |
| 候选 read-model bootstrap | `c6e0c04c3307d61e652e616a78b7f23981b44d95efabcef060f966c46a8da99e` |

门禁位置为 `scripts/lib/archive-build-audit.mjs` 的 `ledger.release === boot.release` 断言。未修改路由账本、门禁或验证脚本。构建未成功，不能确认该次构建的 `sourceDirty=false`，也不能把残留输出用于打包。

继续发布前需要审查路由验收账本与新 read-model 的 release 绑定及对应证据，然后重新从清单第 4 步开始。现有路由状态、Browser 和设备验收结论不能自动提升。

## 清单 10 项线上验收状态

| # | 项目 | 结果 / 截图 |
| --- | --- | --- |
| 1 | 签名图在线 200 / WebP 与三张抽查 | 未执行；未部署，无截图 |
| 2 | 缺失资源探针 404 | 未执行；未部署，无截图 |
| 3 | preview receipt 身份 | 未执行；未部署，无截图 |
| 4 | 门户签名，桌面 / 390 手机 | 未执行；未部署，无截图 |
| 5 | jfhtmk 原曲顺序 / 缺站位提示 | 未执行；未部署，无截图 |
| 6 | 背景分类、桌面三列和缩略图 | 未执行；未部署，无截图 |
| 7 | 卡片通话「电话」标签 | 未执行；未部署，无截图 |
| 8 | 摄影台手机矮屏、旋转与吸附 | 未执行；未部署，无截图 |
| 9 | 小人舞台 H 模式顶部控制条 | 未执行；未部署，无截图 |
| 10 | 线上控制台 error | 未执行；未部署，无截图 |

## 保留的证据与工作区边界

计划回执：`.analysis/release-20261007/upload-plan.json`。源与远端清单：同目录 `source-inventory.json`、`remote-before.json`。本批 manifest、图片验证、容量回执、上传回执和对象暂存均在 `.deploy/release-20261007`。候选 read-model 保留在上述仓库外目录；没有全量 public 包、重复时间戳构建树或 C 盘媒体副本。

5175 服务未操作。无关未跟踪文件、其他窗口工作和 skills 的换行差异均保留；提交均显式暂存相关路径。文档检查使用 `git diff --check`，不再运行构建。
