# 生日 Small Talk 场景与 RAW 链路审计（2026-09-13）

输入 HEAD：`016396e`，分支 `codex/p1-effect-texture-deps`。本批按用户报告反查タケル「誰がための誕生日パーティ」Small Talk 2，并扫描同域入口。

## 根因与修复

- `scenariodata/1_x_038tak_2/scenario_1_2_038_12_b.json` 明确指定 `image_bg = bg001_315pro_in_51`；开场重新声明 `038tak`（x=200）与 `039mcr`（x=-200）。官方截图一致，开场不含 `040ren`。
- 旧的 `1_x_038tak_2_1_2_038_12.json` 使用 lounge 背景，b/c 保留前段多余演员。入口从旧合并快照按 stage 推测边界；这是旧编译产物问题，不是 CSS 坐标问题。当前 Python 编译器正确应用 RAW 背景与分段开场 cast 声明，本批未添加人物/坐标特判。
- 按现有编译器重建 25 组旧生日 Small Talk，生成 91 个明确的独立 episode 文件，保留兼容 aggregate 身份。voice relink 全部成功；每个重新声明 cast 的开场都与独立 RAW 编译对照后才写出。产物记录原文件路径及 SHA-256。
- 重建 presentation 与 reading 投影。修正生成器对单一无 part 元数据误当完整分段，以及 synopsis 的空 speaker identity 吞掉标题的问题，避免生成时破坏既有冬马 Small Talk 入口。
- Player 深链接/刷新时先加载返回域的 lazy communication 数据，避免恢复后返回空的个人故事页；保留原导航 intent 取消机制。

## 可复现扫描与防回归

本机 extracted RAW 根：`E:/BaiduNetdiskDownload/SideM/scripts/scenariodata`。这里使用的是已解出的原始 Command JSON；本批没有重新解包 Unity bundle。背景/演员与用户原片截图相符，不能据此声称全部 91 段逐帧原片一致。

```powershell
python scripts/audit-idol-episode-scenes.py --raw-root E:/BaiduNetdiskDownload/SideM/scripts/scenariodata --report .analysis/birthday-audit-after.json --check-legacy
npm run verify:story-presentation
```

扫描 107 组、490 个有独立开场 cast 声明的入口；修复后旧格式场景差异为 0。73 个原有错误入口的独立 RAW 预期存于 `scripts/fixtures/birthday-entry-scenes.json`，由 presentation 回归检查背景、可见人物、坐标与独立文件接线。该扫描只比较首个对白场景，不覆盖中段相机、表情、隐藏时序或无 cast 声明的连续场景。

工具默认只读。`--repair` 只处理明确指定文件；`--repair-legacy` 只处理扫描证实有差异且没有显式边界的旧文件。拒绝将 Runtime v2 降级为 compatibility。写出后必须重建 presentation/reading 并做 Browser 验收，不能直接调用旧 merge_scenarios 清理变体。

## 尚待单独核实的两项

1. `1_x_001tom_2_1_2_001_12.json`：已是 authoritative Runtime v2，b/c 仍显示 lounge_01 和额外演员；独立 extracted RAW 指向 lounge_12 与两人 cast。应沿 authoritative publication 的 Unity 源及转换链另开批次核对，不能直接以 compatibility 覆盖。未计为本批修复。
2. `1_2_029ass_02_1_2_029_02.json` 的 b：背景相同，但首对白演员显隐与独立编译不同。属于已有显式分段的普通个人剧情；需要核实完整命令/遮蔽时序或原片，不按多余演员残留强行处理。

## 验证与边界

- `verify:story-presentation` 通过（含 73 个 RAW 错误入口回归及タケル三个 Small Talk）。
- `verify:reading` 的 catalog / progress / documents / visual identity / repository / navigation / playback 全通过。最后 Vue SSR render 首次 Vite transport 超时，单独重跑 `node scripts/verify-reading-render.mjs` 通过。
- `verify:reading-sources` 通过：2800 份文档、315 unsupported / 2485 ready，源 hash 匹配。
- `verify-archive-async-navigation.mjs` 与 `verify-archive-startup-route.mjs` 通过。
- `build:check` 通过；固定 `.analysis/build-check`，`copyPublicDir:false`，没有创建 C 盘媒体包。第一次数据修复构建后因补充 App 恢复逻辑再构建一次。
- Browser 使用归属本工程的 `127.0.0.1:5175`（核实时 PID 45024）。实际个人故事页 → Small Talk 2 跳转为 `episodes/1_2_038_12_b.json`；桌面 1280×720 与窄屏 479×958 观察生日办公室、道流左/タケル右、无漣。下一段显示道流下一句。控制台无 error；存在 Pixi Spine update/tint warning，未出现资源失败遮罩。
- 全库部分是 RAW 首对白与产物回归，只有目标剧情做实际 Browser 抽验，不写成全库 Browser/音频长稳/正式发布验收。

## 本批重建范围

- `1_x_002sht_2_1_2_002_12.json`
- `1_x_003hok_2_1_2_003_12.json`
- `1_x_004ter_2_1_2_004_12.json`
- `1_x_009kyj_2_1_2_009_12.json`
- `1_x_011min_2_1_2_011_12.json`
- `1_x_014hid_2_1_2_014_12.json`
- `1_x_017kir_2_1_2_017_12.json`
- `1_x_020hay_2_1_2_020_12.json`
- `1_x_021jun_2_1_2_021_12.json`
- `1_x_023har_2_1_2_023_12.json`
- `1_x_024shk_2_1_2_024_12.json`
- `1_x_027yuk_2_1_2_027_12.json`
- `1_x_028soi_2_1_2_028_12.json`
- `1_x_029ass_2_1_2_029_12.json`
- `1_x_030mak_2_1_2_030_12.json`
- `1_x_032nao_2_1_2_032_12.json`
- `1_x_033shr_2_1_2_033_12.json`
- `1_x_034kan_2_1_2_034_12.json`
- `1_x_035mco_2_1_2_035_12.json`
- `1_x_038tak_2_1_2_038_12.json`
- `1_x_043kaz_2_1_2_043_12.json`
- `1_x_044ame_2_1_2_044_12.json`
- `1_x_045sor_2_1_2_045_12.json`
- `1_x_046chr_2_1_2_046_12.json`
- `1_x_047shu_2_1_2_047_12.json`

最终 Browser 复核：刷新仍进入 Small Talk 2 首对白；点击返回后显示完整タケル个人故事页（2 话、13 分段），不再为空壳。
