# 箭头叠层、音符时机与 Combo 接线 V7

输入 `chart/20261024-autoplay-timeline` / `3a0b9cce`；工作目录 `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023/web_viewer`。本批继续用户截图验收，修复箭头白描边被覆盖，接入原作音符时机刻度和右上角普通 Combo 动画。仅开发分支提交；无部署或 master 推送。前批记录见 [V6](CHART_LIFECYCLE_SOUND_V6_20261025.md)。

## 箭头来源与根因

原 UV 选择并未串格：Texture cells 0/1 为右/上白描边，2/3 为右/上填色，左箭头使用相应方向变换。问题在消费者沿 prefab 遍历顺序画成 blur→outline→fill，填色覆盖了白边。重新读取三方向 ParticleSystemRenderer 的 `m_SortingOrder`：**fill=1、outline=2、blur=3**；prepare 输出按此排序，动态透视和静态长轨图均消费该排序。

混合参数取实际 Shader pass，而不是 Material 中未生效的默认属性：Shader951 `Mobile/Particles/Alpha Blended` 为 SrcAlpha(5)/OneMinusSrcAlpha(10)，Shader950 blur 为 SrcAlpha(5)/One(1)。配置保存 renderer、shader 的来源摘要和 blend；SVG 普通层使用 source-over，blur 使用 plus-lighter 并隔离组混合。另补消费 Shape box 的旋转、位置；沿用 V6 的来源速度积分和媒体时间，不新增动画时钟。

本批证据替代 V6 关于箭头叠层/Shape 未消费的结论；没有更改原贴图像素，也没有用 CSS 画箭头替代。Unity 粒子随机序列、对象池出生相位、billboard 和 GPU 逐帧合成仍未取得，不能将 Web sampler 认定为录屏逐帧相同。

## 原作音符时机

ARM64 ELF SHA `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`。反编译调用链：

- `LiveRhythmTimingSettingPanel.Init`（0x1c166ac）设置范围 −30..30；`LiveSettingsData.noteTiming` 字段偏移 +0x14，默认0。
- `LiveSettingsData.get_noteDelay`（0x1c1b3ac）：clamp 后转 float，乘 0x32cc6e4 的 float **16.666667938232422**，再加 `MachineUtility.noteDelay`，单位毫秒。
- `RhythmGameManager.get_noteDelay`（0x1afd000）乘 0x32cc6c0 的 double **0.001** 转秒；`get_delayedCurrentTime`（0x1afea4c）用媒体 currentTime **减** delay。

设置中新增“音符时机”，每档约16.67ms，总范围约±500ms；正值延后，负值提前，0为关闭/复位。配置与纯函数保留来源 float 舍入。Web 未套用未知的原设备 MachineUtility 校准值。

轨道位置、Auto 事件、打击音调度和 Combo 共同使用调整后的谱面时间。歌曲音频及时间轴秒数保持媒体时间；精确 tick 定位则加回该偏移后 seek。修改刻度取消旧音效排程、重建事件位置；不会补播已跳过的音符。该链路是静态反编译和常量核对，未声称执行了完整原生 delay 调用链或完成设备延迟校准。

## 普通 Combo HUD

从同一 IPA data（SHA `fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a`）提取 ComboPanel：GO12041、Mono133214、Animation46617、clip1078 `ComboNormal`，路径 `Content/Base`。12张来源 PNG 共 **54026字节**：数字0..9、COMBO字样、下划线；manifest 保存原对象和输出 SHA。

消费原 RectTransform、50×100 Grid、70×78数字框及数字 Image 的 preserveAspect=false；根位置对应1280×720坐标的(1120,116)。数字和字样按来源60Hz clip 采样 Hermite 缩放：0秒1倍、0.05秒1.2倍、0.1秒回1倍，下划线不参与弹跳。保留2 Combo起显、9999上限和原3帧重播门限；Web 门限换成名义60Hz的媒体时间。

“Combo 提示动画”默认开，可单独关闭整块提示，与 Auto 特效和打击音选择独立。暂停冻结、seek恢复计数但不补弹；左上角既有总量改称“最大 Combo”。计数来自自动演示事件，不是触摸判定/评分。315特殊闪光效果尚未接入，不把本批普通 Combo 接线写成完整原生 HUD。

## 验证回执

小型证据均在 `.analysis/chart-native/`，不作为发布包。

| 检查 | 结果与证据 | 边界 |
| --- | --- | --- |
| 来源 batch | **187/187**，`arrow-combo-timing-source.log` | batch 后补了静态长轨排序和数字 Image aspect；补丁均由最终专项及构建覆盖 |
| 最终专项 | `verify-song-flick-motion.mjs`、`verify-song-combo-timing.mjs`、native effects 与 sound verifier 均通过 | 排序/实际消费顺序、blend、±刻度/符号/舍入、Hermite、3帧门限、暂停/seek、12资源 SHA；保留162组 ARM64 root / 244谱面689 glyph 回归 |
| 最终编译 | `npm run build:check`，**3023 modules / 17.14s**，`arrow-combo-timing-build-final.log` | 复用 .analysis/build-check，不复制 public；既有大 chunk 警告 |
| 最终组件整曲 | cfprde816、remasq695事件均通过，`arrow-combo-timing-browser.json` | 受控媒体/rAF；真实 SVG Combo scale=1.0992000225、暂停恢复一致、±6时音频时钟12秒不变、Combo开关与原ended清场均通过；画布暂停恢复最大通道差1/255 |
| 正式 App | knwonl EX，已加载音频readyState4，duration131.077007，seek tick36700；±6时媒体均35.288461秒，Combo开关后节点0 | `arrow-combo-timing-real-media.json`；DOM tick变化另由受控回归验证，本正式回执未采到tick字段，不冒充该字段已采样 |
| 桌面图像 | 1280宽沉浸画面，白边上滑/侧滑、长条与Combo154可见，`arrow-combo-timing-desktop.png` | 用户截图录屏所属曲目/难度和相位未确定，非同帧像素比对 |
| 窄屏 | 390×844，scrollWidth390；菜单内可滚动并实际修改时机、关闭/开启Combo，`arrow-combo-timing-mobile.png` | Browser模拟，非实体手机 |
| 真音频开销 | cfprde，Auto+SE1+Combo，12.5→32.436421秒，20.0074秒/1180次轨道更新；CPU median/P95 **4.8/8.2ms**，max64.8ms；rAF间隔P95 10.4ms，3次>50ms、0次>250ms；89次音效排程，暂停active0，无媒体/焦点警告 | `arrow-combo-timing-performance.json`；rAF99.56Hz是回调频率，不是GPU呈现FPS，不认定稳定60FPS |

新 public PNG 初次请求需更新 Vite public 索引；已核对并停止原 PID86020，在同5231、同 `rm-release-20261022` candidate、同主checkout public fallback 重启为 PID77012。开发期先更新组件、后生成含 digitImage 的配置时，08:56:47 UTC 的热更新曾报 preserveAspect undefined；配置生成后恢复。最终另做09:07:06 UTC冷刷新并真实播放至40.279246秒，Combo179、音频readyState4、暂停正常，该次刷新后无新增error/warn，见 `arrow-combo-timing-cold.json`；性能页亦无error/warn，不把历史日志写成从未报错。原有 `config/resource-audit.json` 改动不属于本批，保留但不提交。

## 下一份审计优先项

1. 用明确歌曲、难度、配速、时间点的原录屏比对箭头出生相位和 blur 轨迹；目前证明来源格、排序、blend、速度积分正确，未证明 Unity 随机/池相位与浏览器相同。
2. 若要扩大 HUD 还原范围，另追315特殊效果及原生计分/判定事件；当前普通 Combo 仅表达自动演示事件数量。
3. 音符时机与机型音频输出延迟是两层问题；需实体设备校准和听感检查，不能从本批静态常量或浏览器性能数据推导。
