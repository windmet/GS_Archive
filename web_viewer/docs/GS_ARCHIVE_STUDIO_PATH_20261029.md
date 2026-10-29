# R3 摄影路径执行记录

日期：2026-10-29。输入 master `55d48771`（#133 卡池 / 图鉴、#134 摄影开始方式、#135 单一摄影布局均已合入）。分支 `portal/20261029-studio-path`，复用专用 LF worktree `E:/Web_build/GS_Archive_Domain_Work/deep-links-20261028/web_viewer`。主 checkout 未动。

## 地址与 D3 决定

摄影进入页保持 `/studio/`，工作台采用 `/studio/edit/`。旧 `?view=picture_studio` 自动规范到新路径；页面只拥有既有 `photo_idol` 和 typed `photo`，裁剪已知的其他页面筛选。来源仍走版本化 history，独立分享不带来源；不改变 history 版本、App、组件、加载器、模板或样式。

`photo_idol` 是摄影人物数值 ID，不是 idol_code；`photo` 保留 spots/scenes/faces/poses/stickers/frames/filters 七类既有初始选择。工作台编辑后的场景、图层和构图仍使用现有本地文档语义，URL 不承诺完整构图分享、自动保存或恢复。本批不改变本地草稿或退出确认。

用户已明确确认 D3：**图鉴和摄影实体保留目录＋query，暂不新增独立实体路径**。例如 `/items/?entity=item%3A101195&collection_page=4` 仍打开目录内抽屉。R3 的图鉴部分以此收束；不批量生成实体外壳。工作台共享标题表自动提供“摄影工作台 · GROWING STARS 资料馆”；新增一个静态 section 外壳，总计 1,523，canonical 不含初始选择 query。

## Browser P93–P101

直接 Codex In-app Browser，localhost:5240，PID8684，专用 worktree dev；候选 `rm-release-20261022`，bootstrap release `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`。主要旅程桌面1280×900与手机视口390×844，临时视口已恢复，未改变服务或绑定。

| 编号 | 实际观察 |
|---|---|
| P93 | 冷开 `/studio/`，实际出现“从一位偶像开始”和“从背景开始”，点击后者进入 `/studio/edit/`，标题正确；地点库、默认摄影棚背景与0人物加载 |
| P94 | 新路径冷刷新，选择“通常2”，真实画布背景切换，URL保持裸路径；这体现本地文档编辑不写入初始选择URL |
| P95 | 点击“返回来源页”回到 `/studio/` 并看到进入页内容 |
| P96 | `/photos/?photo_idol=1` 打开体育馆外观详情，切换白天2，地址为 `photo=scenes%3A199`；点击“在摄影工作台打开”进入 `/studio/edit/?photo_idol=1&photo=scenes%3A199` |
| P97 | 上述路径冷刷新后390px，体育馆白天背景和天濑冬马实际渲染，检查器人物层/表情/动作控件加载，截图已在对话中展示 |
| P98 | 关闭工作台，准确回到 `/photos/?photo_idol=1&photo=scenes%3A199`，体育馆外观详情已加载且白天2选中；不以加载中为返回成功 |
| P99 | 旧 `/?view=picture_studio&photo_idol=1&photo=scenes%3A199&rarity=SSR&q=old` 冷开后规范为同一初始选择路径，越权筛选消失，冬马加载；独立入口关闭回 `/studio/` |
| P100 | `/items/?collection_page=4` 点击“葛之叶雨彦的心意”，保持目录并增加 `entity=item%3A101195`；冷刷新详情内容实际加载。query分页为零基，画面显示5/8，不是第4页 |
| P101 | 七个变异恢复后，独立新标签冷开 `/studio/edit/`，摄影棚通常1背景、0人物、素材控件加载，标题正确；返回 `/studio/` 进入页。该标签 error/warn 均为空，临时标签已关闭 |

人物加载旅程捕获两条 Spine.update warning 调用栈（StudioCompositionStage.updateModel/setActorPose/addActor/sync/load）。所测旅程未见 error；没有直接证明基线同旅程的 warning 表现，因此不宣称全程控制台为空或已消除警告。

## 验证与边界

- 路径、schema、旧query裁剪、七类初始选择往返、独立分享无来源、history来源恢复、D3目录抽屉回归通过；标题与外壳合同通过。
- `verify-studio-work.mjs` 与 `verify-photo-catalog-navigation.mjs` 使用 `--experimental-vm-modules` 通过，后者执行真实App/SFC绑定；这些是组件回归，与Browser分开记录。初次遗漏vm参数报 SourceTextModule TypeError，正确命令复验通过，不是产品失败。
- `npm run build:check` 通过（16.02秒），复用 `.analysis/build-check`、不复制public；生成与检查1,523个head外壳通过。
- 七个生产代码变异全部被拒绝并恢复：路径字面量、强制schema、photo_idol、photo、分享来源、head description、标题section映射。独立UTF-8日志及汇总在 `.analysis/studio-path/`。
- 完整门禁首次114/116通过（source-only汇总207.8秒），最后编译与审计因本批先登记证据链接、文档尚未落盘而报ENOENT；补齐文档后，以 `npm run gate:source -- --from="Compile source"` 重跑末两项2/2通过（编译28.5秒、审计1.9秒）。合计116项均有通过结果，首次失败日志保留，不声称首次全绿。最终构建重新生成并检查1,523外壳。

本批只验收地址、初始选择与返回，不是完整构图分享、导出下载、本地草稿恢复、真机或生产bundle验收。没有R2上传、部署、语料晋升或read-model绑定变更。R4继续等待P7 Reader/Player及13个RAW核对文件、Valentine b段语音补抽等语料前置。


合入记录（2026-10-30）：PR #137，源码 `ade7fad1`，远端 CI `40906924145` 全部成功，merge commit `71012ebf`。专用 worktree 跟进合入后的 master，工作区干净；本记录的本地 dev 与构建边界不因合入而升级为部署验收。
