# 舞台分支 PR 收口（2026-10-23）

按用户要求结束本轮，不再扩展调查；剩余缺口留到下一轮。本记录供用户提 PR，未代建 PR、未合并 master、未上传 R2 或部署。

## 分支与提交范围

- 分支：`stage/20261022-particle-gaps`，从 master `aa987f40`（#78）切出；普通 merge `d73d493a` 已同步 master `6048cb13`（#92），收口 fetch 后无新增 master 提交。
- 本次最后一批输入 HEAD：`9775ffe0`。最后提交包含来源参数 Smoke 预览、对应数据/两张纹理、回归及收口文档；本记录随该提交提交，最终 SHA 由 `git log -1` 取得。
- 保留工作区原有删除、未跟踪资料、terminal 数据与其他窗口文件；构建产生的资源/翻译审计元数据恢复输入 HEAD。仅显式 stage 本轮路径。
- 合入采用 merge commit，不 squash/rebase。合入不等于部署；后续开发从合入后的最新 master 新开舞台分支。

## 本分支交付范围

| 范围 | 结果与证据 |
|---|---|
| 倾斜父链、非等比面板、环面 | [倾斜 Local 父链](NATIVE_LOCAL_PARENT_PANELS_20261022.md)、[JFHTMK 面板](NATIVE_JFHTMK_PANEL_20261022.md)、[Pavé Étoiles 环面](NATIVE_PAVETL_TORUS_20261022.md)，后者含 120 个原生受控出生位置对照 |
| precious love Bloom | [四组 12 系统](NATIVE_PCUSLV_BLOOM_20261022.md)，接通原生限速与倾斜父链面板 |
| 強く尊き獣たち electric | [14 发射系统、3 禁用容器](NATIVE_TKTKKT_ELECTRIC_20261023.md)，双渐变与尺寸夹取受控对照 |
| bnckgy fire | [36 发射器、6 禁用容器](NATIVE_BNCKGY_FIRE_20261023.md)，Object_layer 粒子资源级无消费者缺口归零，仍保留 partial 系统 |
| FLASH LIGHT 逐瓣地面叠色 | [重新核对](FLASH_LIGHT_FLOOR_RECHECK_20261023.md)确认既有反编译修正有效，无需重做 |
| Center 额外嘴型 | [中心屏幕 3 号位映射修正](NATIVE_CENTER_MOUTH_TARGET_20261023.md)，2 曲 29 条命令；不混同 Unit_serif 的编成取人/音频链 |
| GO FOR IT!! 单人脚光 | [241 条命令](NATIVE_GOFRIT_FOOT_SOLO_20261023.md)，保留全员与单人擦除差异 |
| 独立 Smoke | [2 曲 5 条指令、2 组 6 系统](NATIVE_SMOKE_SOURCE_20261023.md)，已接入来源参数预览，含停止尾烟、负时间 Show、重启与倒退 seek；覆盖表为 partial |

以上原生受控证据各有输入、ABI 适配和范围限制，不能合并表述为完整原机还原。

## 最后批验收

- `python scripts/prepare-chibi-smoke.py`：无写入重放，6 系统、2 组、5 指令、2 纹理一致；跟踪输出共 122,487 bytes。
- `prepare-chibi-smoke-billboard-fixture.py --native-engine <libunity.so> --unicorn-path <runtime>`：无写入原生重放一致，包含新增 36 个消费角点用例；已有几何/Noise/父链证据继续通过。
- Smoke、object-emitter、stage-command 目标回归通过；`npm run verify:source-batch` 最终 167/167 通过（含新 Smoke 检查，随 object-emitter 入口执行）；日志 `.analysis/smoke-chain-20261023/source-batch-closeout.log`。
- `npm run build:check`：23.60s 通过，固定 `.analysis/build-check`，`copyPublicDir:false`；这是代码构建，未产生完整发布媒体包。
- 真实 Browser：主 checkout 5213 / Vite PID 64608，候选 `rm-release-20261015`，release `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。桌面 STARLIGHT CELEBRATE! 3000ms/7100ms/10000ms 为 4/7/0 粒子；换曲到手机 Tone's Destiny 18500ms/22000ms/121500ms 为 8/0/4，倒退及最终冷加载 0ms 为 6、状态 ready。390px 无横向溢出，无 console error；保留既有 Pixi Spine warning。截图和完整旅程见 Smoke 记录。
- 新数据与两张 PNG 的本地 HTTP 均为 200，MIME 正确，返回字节与工作区一致；JSON SHA 与静态绑定一致。
- 未宣称生产 bundle、原片逐帧、GPU 材质字节或真机验收；本轮编队不新增原曲站位证据。

## 延后待办（本轮不继续）

1. Underlight 四族 2,116 条命令：来源字段、资源、状态与消费者仍待串联。
2. After_Spappeal / Finish / Livechara_skill 等先区分舞台行为与游戏流程；Unit_serif 注册表仍标 missing，已有 2 曲 98 音频片段不等于该命令完整消费，需另轮梳理。
3. Object_layer 仍有 130 个 partial 系统：108 Noise、15 Stretch preview、7 Stretch omitted。来源资源级缺口为零不等于视觉等价。
4. Smoke 原机 RNG、出生/退休时钟、短间隔 Stop→Play、完整 UV 更新调度、移动父链/镜头投影、材质及组 2 实际歌曲 Browser 证据；当前 Web 固定时钟/种子预览不能取代它们。
5. 既有暂停响应、受控冷加载延迟比较，以及运动环面、mixed/CanvasGroup、内置分支、完整原片/设备覆盖继续保留。
6. 发布另开 release 线：本分支新增数据、纹理和分片尚未形成 R2 上传/部署验收，不在此轮追加。

## 可用 PR 描述草稿

标题：补齐舞台粒子、单人脚光与 Center 嘴型，并接入独立 Smoke 预览

接通 Bloom、电弧、火焰及独立 Smoke 的来源参数消费者，修正倾斜父链/面板几何、Center 台词的中心槽位映射和 GO FOR IT!! 单人脚光；复核 FLASH LIGHT 逐瓣叠色现有实现。Smoke 支持 Show、停止尾烟、重启、负时间历史和倒退 seek，加载校验来源及数据哈希，仍明确标记为来源参数预览。

相关原生受控回归、代码构建和桌面/手机 Browser 旅程通过，完整源码门禁 167/167 通过。保留 Noise/Stretch、Underlight、原机随机/时钟与完整设备视觉覆盖等后续项；本 PR 不包含 R2 上传或部署。
