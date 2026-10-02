# iPad 音频、长轨图与藏品浏览修复验收（2026-10-02）

输入 HEAD `6b474d47`，代码提交 `7c874511`。本轮最新用户指令覆盖此前的乐曲/谱面冻结：仅修复试听兼容、长轨显示和藏品浏览；没有改歌曲数据、声部编排、解锁来源或 RAW。

## 音频链路与兼容

旧测试页 `275e46ff.gs-archive-preview.pages.dev` 的 303 条已发布 AAC 音轨全部通过 Range 206、audio/mp4、字节长度与文件头校验。byndtd/drvalv/grwsml 的伴奏与冬马声部共六条完整 SHA-256 与本地相同。冬马原文件 ffmpeg mean -15.0 dB / max -0.0 dB，非空音频。没有因为本次故障重新编码或补传音频。

修复发现的兼容风险：播放手势内申请 `navigator.audioSession.type='playback'`，恢复 suspended 和 interrupted；舞台先恢复音频再等待动作资源。最后一个播放会话停止时恢复先前类型。不支持 Audio Session API 的浏览器继续使用原 Web Audio 播放。依据 [W3C Audio Session](https://www.w3.org/TR/audio-session/) 与 [WebKit 237322](https://bugs.webkit.org/show_bug.cgi?id=237322)；这解释了可能的 iOS 静音路径，尚未证明是用户真机的唯一根因。

真实 Browser：五槽加载 003hok,002sht,004ter,001tom,005kao，11.82 秒输出峰值 0.84878；冬马 Solo 26.59 秒峰值 0.71108。输出取共享音频总线的 analyser，证明数字信号非零，不等同于听到用户 iPad 扬声器。中断恢复、同步起播、导航中取消恢复由可控 AudioContext 行为回归覆盖。

## 长轨显示

保留整条 CSS 滚动长度，单栏仅挂载视口附近 768px SVG 段，横向排布只挂载邻近列。静态音符与移动判定线分开，视觉时钟限制为约 30Hz。触屏拖动不再直接 seek；手动滚轮/翻页暂停自动跟随，主动定位或重新开启跟随后恢复。尾奏继续显示播放时间，判定线和 tick 限制在谱面终点内。

244 张谱面、66,666 音符分段覆盖回归通过；原曲线、滑条端点、同时音符/BPM 不改。1180×820 Browser：单栏完整高度 12,785，初始 2 段；滚到中部 4 段且原生音符可见。专家谱面开启跟随后手动滚动，进度 7.03→43.41 秒，scrollTop 768.7355 保持；末尾只挂载 3 段。整图 SVG 导出 12,785px / 全部 362 原始音符对象，原图像内嵌；PNG 820×25,570，1,964,104 B。导出保留整图，PNG 在构建整图 DOM 前先检查预算。

Browser 的下载事件钩子等待超时，改为直接执行页面导出后读取实际 Downloads 文件；两个文件确实生成且内容检查通过。没有将工具等待超时写成产品导出失败。

## 藏品浏览

取消常驻侧栏和默认首条详情请求。道具 72 条/页、紧凑图标网格，用途 chips、源名称确认的三属性筛选。鼠标可悬浮看说明，点击按需详情；PC 居中弹窗，手机底部抽屉。称号 36 条/页、桌面双列/手机单列、49 偶像和 16 组合筛选，列表直接展示首条已知来源；完整多来源保留在详情。98 个用户补充羁绊来源显示担当 Lv.50 / 专属 Lv.100，无证据继续来源未知。内部 ID/资源键移入“原始资料”；删除“本地图片预览”。

`config/collection-browse.v1.json` 由已核验的外部 readmodel 生成，535 道具+1613 称号、582,819 B。生成器核对目录/分页/详情 binding 的 hash 和 bytes，以及名称/资源键/typed ID；显示端再约束 release/name/resource。只保存列表所需描述和首条来源，完整记录仍按需取详情。生成命令：`node scripts/generate-collection-browse.mjs --models E:/Web_build/GS_Archive_Domain_Work/song-gameplay-readmodels-20261001`。

Browser 已通过道具体能筛选三条、弹窗与 Escape 关闭、冬马两种羁绊等级、390×844 单列且 documentWidth=scrollWidth=390。早先旧 tab 的 viewport 设置没有实际应用，1280px 截图归为 desktop；后续在新活动 tab 实测 1180px 和 390px，不以设置请求代替实际尺寸。

## 验收与资源边界

通过：verify-ipad-collection-repair、verify-song-experimental-audio、verify-song-stage-handoff、verify-song-chart-presentation、verify-song-chart-timing、verify-song-chart-png、verify-collection-catalog-session（含真实 readmodel）、verify-collection-readmodel-navigation、diff check。旧音频 UI 文案断言更新为当前已发布控件，声部/编排/清理合同保留。历史 Reader/Player PR2 断言失败仍维持先前记录，不因本轮修复标成通过。

最终 committed build-check：2702 modules，9.86s，入口 gzip 130,547 B，sourceDirty=false，sourceDigest `506534094bcacf8a14a9cf89221c4ac1e70991f4007c6bdc133b3900e387d7fa`。不复制 public。藏品路由懒加载 chunk gzip 55.98 kB；Vite 对该未压缩 628.89 kB chunk 提示大 chunk warning，初始入口没有引入此索引。使用现有 public + 固定 release `17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907`。

证据目录 `.analysis/ipad-audio-collection-20261002`，包含截图、非零输出回执、音频 HTTP 回执、实际导出与容量核算。真实 iPad Safari/Chrome 的扬声器、静音开关、后台切换、旋转及长稳仍待用户设备复测；桌面 Browser 视口模拟没有升级为真机验收。

重新枚举账户：目标桶 107,290 对象 / 7,410,544,554 B；其他桶 656 对象 / 444,588,701 B。继续预留 880,000,000 B。此次 R2 增量为 0，目标仍严格低于 8,600,000,000 B；未删除远端文件。数据版本沿用 `879c3ea4e9a860fc5e819eece6c98c56c8f80b0640eb80df7ceacbfedea96436`，只发布测试 Pages。

## 测试部署与线上结果

新唯一测试地址：https://ad42c762.gs-archive-preview.pages.dev；固定分支别名：https://gs-architecture-device-test.gs-archive-preview.pages.dev。包目录 .deploy/ipad-collection-preview-7c874511，10,306 文件 / 121,659,755 B。九个关键代码/回执文件与包 manifest 的 size/hash 完全相同。Wrangler 4.146.0（npm registry）部署成功；只更新测试分支，没有 Production 发布。

新地址再次通过 303 音轨 Range/类型/长度/文件头与六条完整 hash。真实线上 Browser：五槽 21.25 秒 peak 0.58389，Solo 47.09 秒 peak 0.97836，均 ready=true，无 role=alert 错误。离开歌曲页后停止会话。1180px 线上道具页 535 件、72 条/页，无默认详情弹窗，紧凑图标实际载入；截图 online-items.png。此前旧部署的瞬时动态模块 fetch 失败不再复现，未把该网络故障视为音频解码根因。

最终提交对应本地 Browser 又验证尾奏 130.285737 秒，显示 tick 141120 / 141120。前面旧构建 Browser 暴露的尾奏 tick 145919 已修复；音频尾奏时间不截断。

证据：.deploy/ipad-collection-preview-7c874511/deployment-receipt.json；.analysis/ipad-audio-collection-20261002/music-http.json、online-audio.json、online-items.png、storage-budget.json。真实 iPad 设备复测仍独立待验；deviceReviewAccepted/productionApproved 仍为 false。
