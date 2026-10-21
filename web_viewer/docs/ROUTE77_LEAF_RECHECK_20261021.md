# ROUTE77 落叶复核

2026-10-21；分支 `stage/20261020-native-followup`，输入 HEAD `d8c0cb042c78c8198ee1ee599c52bc8d14fed190`。本次未修改运行时代码或效果数据。

## 结论与链路

当前本地 5213 的完整加载已经显示落叶。ROUTE77 的 `rote77_live_effect` 引用共享资源 `fx_in_swyrlv_leaf`，来源 `song_swyrlv.unity3d`，不是以 rote77 命名的独立 leaf 资源。两个粒子系统已进入消费者，deferred 为空。

当前 consumer catalog 指向 `emitter-fx_in_swyrlv_leaf.b658a78044b2cf856204005fe788a1770b4f49b8ea7b51ca5cf6ea8aef329775.json`（10,450 bytes）。本次工作树另有未完成的樱花数据晋升；没有重新生成 consumer catalog，因此这次 Browser 观察对应既有 leaf 分片，不是樱花增量的验收。

编排的两段窗口：

| Show | Hide 开始 | Hide 时长 | 对象层移除 |
|---|---|---|---|
| 37,000 ms | 38,000 ms | 3,600 ms | 41,600 ms |
| 98,000 ms | 99,000 ms | 3,700 ms | 102,700 ms |

## Browser 实测

同一 5213 进程、read-model `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`，桌面 1280 × 720，完整加载：

| 时间 | leaf 在对象层中 | 对象粒子总数（含 meter/turbo） |
|---|---|---|
| 37,500 ms | 是，截图可见绿色叶片 | 85 |
| 40,000 ms | 是 | 80 |
| 41,600 ms | 否 | 66 |
| 98,500 ms | 是，截图可见绿色叶片 | 88 |
| 100,500 ms | 是 | 83 |
| 102,700 ms | 否 | 64 |
| 回拖 37,500 ms | 是 | 85 |
| 页面刷新后重新定位 37,500 ms | 是 | 85 |

两次出现时 `data-object-layer-unsupported`、`data-object-native-deferred` 均为空；控制台 error 为 0。首次载入存在 Pixi Spine tint/update 的 warn 堆栈，不据此宣称 warn 为 0。

截图保存在本机 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/route77-leaf-37500-desktop.png` 和同目录 `route77-leaf-98500-desktop.png`。

本次是当前本地完整加载的显示与窗口复核；未核对原片粒子密度、设备表现或正式站版本。没有发现需要补接的资源，未调整发射率、位置或时长。文档批次只做内容及 diff 检查，没有运行应用构建，也没有部署。
