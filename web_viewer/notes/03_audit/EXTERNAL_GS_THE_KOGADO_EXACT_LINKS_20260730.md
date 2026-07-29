# THE 虎牙道 Episode 0 外部中文资源精确关系审计

Status: exact mapping verified
Date: 2026-07-30
Scope: SideM GROWING STARS / THE 虎牙道 Episode 0

Merge refresh:

- PR #18 merged as `7342f5a5bf3c6d3e2ea2eef35cfdfc95c530e44a`;
- PR final-head gate `30478115572`: PASS;
- master post-merge gate `30478199856`: PASS.

## 1. 结论

三条 Bilibili 中文资源均与一个本地 GS unit-story collection 的完整边界
一致，可以登记为：

```text
mapping state: exact-unit-story
translation coverage: complete-collection
subtitle kind: embedded
```

| BVID | 原视频 uploader | 本地 collection | 本地组成 |
| --- | --- | --- | ---: |
| `BV1LL411G7LD` | HaaNaaaP (`14496860`) | `1_1_013the_01_1_1_013_01` | 10 parts (`a`-`j`) |
| `BV1xA4y1S7Cb` | HaaNaaaP (`14496860`) | `1_1_013the_02_1_1_013_02` | 10 parts (`a`-`j`) |
| `BV16u4y187tH` | 死扛桑 (`8798195`) | `1_1_013the_03_1_1_013_03` | 10 parts (`a`-`j`) |

这三条关系不使用旧文档中的缩写 collection 名称。注册表写入的是
presentation index 中实际存在的完整 collection ID。

## 2. 外部身份

| BVID | 标题 | 发布日期 | 时长 |
| --- | --- | --- | ---: |
| `BV1LL411G7LD` | 【中字】偶像大师sideM GS Episode0剧情 THE虎牙道 第1话 | 2021-10-12 | 约 886 秒 |
| `BV1xA4y1S7Cb` | 【中字】偶像大师sideM GS Episode0剧情 THE虎牙道 第2话 | 2022-05-10 | 约 812 秒 |
| `BV16u4y187tH` | 【中字】【SMGS】THE 虎牙道 episode0剧情 第3话 | 2023-11-07 | 约 872 秒 |

身份和 uploader 通过 Bilibili 原视频元数据核对。收藏夹
`3689692756`、curator UID `313228356` 只保留为 discovery metadata，
不作为内容身份或翻译署名权威。

## 3. 边界证据

三条视频均检查了开头或标题卡，以及接近视频结束处的最后剧情对白：

- 第 1 话从拉面店场景开始；末尾对白与本地
  `1_1_013_01_j` 的最终对白一致：
  `アイツらの用事なんて、興味ねー。 ただ、今日は『こっち』に行きたい気分なだけだ。`
- 第 2 话标题卡为 `第2話 新しい闘いのステージへ`；末尾对白与本地
  `1_1_013_02_j` 的最终对白一致：
  `オレ様もアイドルになって、チビをぶっ倒してやる！ だから……そのオーディションに連れてけ！`
- 第 3 话从公园场景开始；末尾对白与本地
  `1_1_013_03_j` 的最终对白一致：
  `格闘家は試合に備えて己を鍛えるだろ？ それと同じように、自分とタケルと特訓しないか？`

本地三套 collection 的标题分别为：

- `第1話 漢たちの闘う理由`
- `第2話 新しい闘いのステージへ`
- `第3話 忘却の過去`

视频覆盖从各话开场延伸到对应 `j` part 的最终对白，支持
`complete-collection`，而不是 `partial-story` 或仅凭标题推断的
`candidate`。

## 4. 机器约束

`exact-unit-story` 记录必须满足：

- `event_id` 为 `null`；
- `story_resource_ids` 为空；
- `collection_ids` 至少一个；
- collection 存在于 story presentation index；
- collection ID 属于 `1_1_` unit-story 命名空间；
- presentation collection 实际包含 episode。

UI source gate 逐条断言三套 collection file stem 只解析到对应 BVID。
`ArchiveStoryCollection` 在每个展开的 chapter 内显示该 chapter 自己的
安全外链与 uploader；内部整话/分段播放按钮保持不变。

生产构建与预览验证：

- Vite build PASS：2,405 modules，约 2 分 24 秒；
- 生产预览中的第 1 话只显示 `BV1LL411G7LD / HaaNaaaP`；
- 展开第 2 话只显示 `BV1xA4y1S7Cb / HaaNaaaP`；
- 展开第 3 话只显示 `BV16u4y187tH / 死扛桑`；
- 外链均为 `_blank` 和 `noopener noreferrer external`；
- 三个内部整话播放按钮仍存在；
- 无远程图片、无横向溢出、无页面 console error。

长期运行的 5174 dev server 对一个既有已追踪 JSON 路径返回了 SPA
fallback，因此最终浏览器门禁改用最新 `dist` 的临时 5175 preview。
该 preview 正确返回 `application/json`，验证后已关闭；5174 未重启。

## 5. 非目标与清理

- 不镜像 Bilibili 视频；
- 不下载或提交远程封面、头像；
- 不把审计抽帧提交为本地资产；
- 不把第三方链接写入 publication ledger；
- 不把本批结果当作 Story Runtime 长稳验收。

审计所用临时视频片段、partial 文件和抽帧已在核对后删除。仓库只保留
结构化链接、精确关系、校验器和本审计证据。
