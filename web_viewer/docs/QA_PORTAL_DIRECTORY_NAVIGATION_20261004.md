# 资料馆统计复用目录验收

- 输入 HEAD：`2f43fe0c1d816a79ffa582bc4f87901027337cba`。
- 分支：`codex/portal-idol-controller-20261004`。
- 统计数字、板块“查看全部”和便当盒图鉴/分类入口直接打开已有目录。移除门户的集合弹窗、重复列表和分页状态。
- 全站入口明确传递空偶像筛选；临时偶像视角使用当前浏览偶像，独立于已保存担当。
- 歌曲、故事、活动目录沿用原页面，补上 URL 中的 `idol` 筛选；目录可清除筛选。歌曲/活动摘要、故事分类数量与当前偶像一致。
- 卡片目录复用原偶像、稀有度工具栏，并承接已有便当盒属性快捷入口；属性来源绑定当前 release 与卡片 detail SHA-256，网址保留 `card_attribute`。

## 代码和数据验证

以下命令均通过：

```powershell
node scripts/verify-portal-directory-navigation.mjs E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004
node scripts/verify-card-filters.mjs
node scripts/verify-archive-routes.mjs
node scripts/verify-portal-navigation.mjs
node scripts/verify-archive-portal-presentation.mjs --read-model-root E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004
node scripts/verify-portal-bento.mjs E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004
npm run build:check
git diff --check
```

实际 read models：`2a77a79a4a9b9cd850c48643941e0d492071a17830447e5ff136d3d670de0774`。新增回归核对全部 49 位偶像的四类关联数量、全站路由、无效身份、刷新和详情返回、属性 release/hash 绑定、实际歌曲/活动目录打开函数。

Browser 首轮发现歌曲打开函数未写入偶像状态，修复后扩充实际函数回归；同时将目录摘要与分类计数改为当前偶像范围。完成修复后重新编译并重启已核对归属的 5208 服务。

## Browser 验收

Codex In-app Browser，实际生产代码 bundle，桌面默认 1280×720；窄屏 393×852，结束后恢复默认视口。没有修改用户的担当或本地设置。

| 旅程 | 结果 |
| --- | --- |
| 全站四个统计入口 | 卡片 826、歌曲 60、故事检索 1394、活动 59；URL 无 idol 筛选，未回落到保存担当 |
| 渡边实四个统计入口 | 现有目录分别显示 17、5、47、3；URL 为 `idol=011min` |
| 渡边实四个板块“查看全部”及便当盒完整图鉴 | 打开相同的已有目录，无统计集合弹窗 |
| 刷新角色目录 | 卡片、歌曲、故事、活动保留筛选；活动刷新后包含三场已关联活动 |
| 目录 → 卡片/歌曲/故事/活动详情 → 返回 | 保留当前偶像；再返回恢复原门户视角 |
| 清除歌曲/故事/活动偶像筛选 | 回到 60 首 / 1394 篇 / 59 场 |
| 全站便当盒属性、稀有度 | Physical 257 张、SSR 124 张，直接进入卡片目录；Physical 刷新仍保留 |
| 新建标签冷启动歌曲 URL | `?view=song_catalog&idol=011min` 显示 5 首及筛选条 |
| 窄屏歌曲目录 | 5 首均展示，筛选条可用；清除后 60 首；文档宽度 393，无横向溢出 |
| 控制台 | 两个验收标签无 error/warn |

截图目录：`C:/Users/windm/.codex/visualizations/2026/10/04/01a105b6-49c6-75d2-8eb1-1051da3588ac/`。

- `portal-scoped-song-directory.png`
- `portal-scoped-story-directory.png`
- `portal-scoped-song-mobile.png`

## 构建与资源边界

输出复用 `.analysis/build-check`，`copyPublicDir:false`，没有复制完整 public 语料、没有部署。5208 使用 `.analysis/ui-audit-20261003/serve-production.mjs` 固定代码快照并映射原 public 和外部 read models；代码记录位于 `E:/Web_build/GS_Archive_Domain_Work/qa-portal-directory-20261004/pinned-code.json`。原有大 chunk 提示仍存在，不是新增控制台错误。本次为导航/筛选验收，不包含音视频长稳或完整媒体发布验收。
