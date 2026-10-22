# 仓库数据治理（2026-10-22）

结论：**不拆仓，不重写历史，不批量 `git rm --cached`**。仓库体积目前可控；需要守住的是“哪些东西还能进 Git”的边界，并让每次大批量数据提交都报出自己的增量。

## 实测（origin/master `bc991170`）

本地 pack 233 MiB（GitHub 显示约 202 MiB）。按目录统计历史上全部 blob 的**落盘**大小（delta 压缩后）：

| 目录 | 历史 blob | 落盘 | 说明 |
|---|---|---|---|
| `public/assets/songs` | 122 | 50.9 MiB | 61 张歌曲封面 PNG，当前只有 14 MiB；多次重新提交，每版都留在历史里 |
| `public/assets/stories` | 111 | 33.6 MiB | 112 张 PNG（生日 / 角色 / Extra） |
| `public/data/compiled` | 7485 | 28.5 MiB | 文本 delta 压缩率高 |
| `public/data/reading` | 10182 | 17.0 MiB | 同上 |
| `translation/studio/reviews` | 222 | 9.2 MiB | 人工审校，必须留 |
| `public/translations/zh-CN` | 3308 | 6.0 MiB | 人工译文，必须留 |

单次全量重编译（#78，`64e91828`）：6828 个新 blob，原始 412 MiB，**落盘仅 22.7 MiB**（compiled 14.0、reading 5.7、译文 1.6）。照这个速度，每次全量重编译约让仓库增长 10%，属于“可规划”而不是“必须马上拆”。

**最占体积的是 Git 里的二进制图片，不是 JSON。** PNG 已经压缩过，无法 delta，每次重新提交都是全额增长。

## 边界规则

| 数据 | Git | 说明 |
|---|---|---|
| 源码、Schema、数据管道、校验器 | 跟踪 | 与运行时同步演化 |
| `translation/`（tm、bible、术语、审校、supersession、回执）与 `public/translations/` | 跟踪 | 人工成果，不可重建；**绝不加入 ignore** |
| 发布账本 `public/data/publication/`、registry | 跟踪 | 外置数据的版本身份 |
| `public/data/compiled/` | 只跟踪**冻结的子集** | `.gitignore` 已忽略该目录，新文件进不来；当前 3485 个已跟踪，磁盘上有 4941 个。完整语料由 R2 加账本承载，Git 不是 compiled 的来源 |
| `public/data/reading/` | 跟踪 | 被审校回执钉住字节，见 `sidem_reading_doc_bytes_frozen` |
| **新增**图片、音频、视频 | **不进 Git** | 走 R2 / 派生目录，用清单（sha256 + 来源）进 Git 作为身份。参照 `config/derived_story_audio.json` |
| 已在 Git 的图片 | 保持不动 | 替换时优先改为 R2 引用，而不是提交新的 PNG |

## 本次做的

- `.gitattributes`：把 2245 行逐文件的 compiled 规则合成一条目录规则 `web_viewer/public/data/compiled/** text eol=lf linguist-generated=true`。原来有 600 个已跟踪的 compiled 漏标 `linguist-generated`，585 个漏标 `eol=lf`。所有已跟踪 blob 本来就是 LF，用临时 index 做 `git add --renormalize`，结果 0 个文件变化。发布账本要求 `eol=lf`，新规则只会让更多文件满足它。
- `scripts/report-git-data-growth.mjs <base>..<head>`：按目录列出一个提交范围新增的 blob 数、原始大小和落盘大小。**全量重编译或批量数据 PR 要在描述里附上这份输出。**

## 什么时候再考虑外置或拆仓

满足以下任一条件再立项：

- 单次全量重编译落盘超过 50 MiB；
- 干净 clone 或 CI checkout 明显变慢；
- 二进制媒体又开始进 Git。

前提是已经证明生成产物可以按发布清单锁定版本独立取回。即使到那时，也只把**生成数据**移出去：数据管道、运行时、Schema 和人工翻译留在同一个仓库。
