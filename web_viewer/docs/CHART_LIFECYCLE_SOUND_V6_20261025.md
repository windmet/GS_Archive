# 末尾清场、滑键箭头运动与通用打击音 V6

输入 `chart/20261024-autoplay-timeline` / `2edf2e2d`；工作目录 `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023/web_viewer`。本批按用户要求修复末尾音符残留、替换透视轨道的静态滑键方向提示，并将四套打击音作为任意曲目可选项。仅本地开发与分支提交，无部署、R2上传、master推送或PR合并。

## 修正结果

- **末尾音符**：Track将媒体tick上限锁在maxTick，而renderer用包含等号的窗口保留恰在该tick的音符。控制台时间继续走，但轨道永久留在最后一帧。移除Track的上限钳制，让尾奏时间继续推进；另传递显式ended状态，结束时清空音符、hold、middle与同刻连接，涵盖歌曲时长恰好落在最后一个判定点的情形。回退/seek会重置ended并恢复预览，手动暂停仍冻结当前帧。
- **箭头相对运动**：原来只用default-2 prefab的静态outline/fill。现在从已有来源fixture导出9个粒子系统的周期、预热、burst、寿命、Velocity/Color、层级TRS及贴图选择；三方向均消费outline/fill/blur，新增来源Texture876的blur第2格PNG。周期1秒，0/0.5秒各burst2个、寿命0.5秒；消费3.5×(1→-1)速度曲线的积分，箭头相对音符盘向划动方向移动再返回，随媒体时间暂停和seek。
- 速度曲线在粒子年龄0.25秒的位移绝对值为0.4375局部单位，0.5秒积分回到0。使用来源Hermite曲线，非手写正弦动画。沿用已验证的native effect root/投影。循环入场相位按音符读取窗口建立，box出生微偏移使用确定种子；这些仍为Web适配，未取得Unity池中实际相位、随机序列、billboard和GPU合成的逐帧输出。长轨图继续使用静态示意，不额外运行时钟。
- **通用打击音**：视图设置新增SE1/SE2/SE3/社长愚人节/关闭，以及独立音效音量。默认SE1，音量0.7；与歌曲音量、自动演示开关独立。社长套装不再限制歌曲或日期，这是用户明确要求的Web功能偏离。
- 新增15份小型Ogg资源（共511331字节），由前批审计的原生WAV转码，manifest保存输入WAV路径/SHA与输出SHA。三套常规各有独立Perfect、Great/Good、flick，共用空击/P打击资源；社长使用4份独立覆盖资源。预览不做评价，常规普通/LARGE按Perfect，社长套装LARGE按PSkillTap；middle不额外发声。Great/Good与空击资源保留合同，但不凭空模拟评价或触摸输入。
- WebAudio按既有媒体时间事件表提前120ms调度，一组同刻事件按声音类型去重。暂停、缓冲、seek、回退、倍速/套装切换及卸载取消旧source，跳过大段未播放区间时不补播。播放前解码所选套装；加载失败给出提示并允许歌曲继续播放。context在用户播放操作中创建/恢复，未新增媒体时钟、评分或触摸判定系统。

## 验证与证据

小型本地回执位于 `.analysis/chart-native/`，不作为发布包。

| 检查 | 回执 | 边界 |
| --- | --- | --- |
| 来源 | 新prepare脚本绑定已有native effects fixture/IPA data SHA；音效重提取核对manifest中的WAV SHA | 转码输出为Web衍生格式；原WAV不修改 |
| 全库source batch | **186/186**，`lifecycle-sound-source.log`，两项新专项纳入CI batch | 随后音频诊断/ready取消与LARGE分支修正另跑声音、motion、native-effects专项；未机械重复整批 |
| 声音专项 | 四套、输出hash、同刻去重、前瞻无重复、暂停/seek取消、大跳转抑制、off及LARGE分支通过 | 使用受控AudioContext验证调度，不称真实设备播放 |
| 动画专项 | 三方向6个活动粒子指令、来源积分检查点、blur消费、暂停/seek确定性通过；244档/689个消费者glyph检查通过 | 原生162组root执行回归保持，粒子内部仍是Web sampler |
| 最终构建 | `build:check` **3020 modules / 17.48s**，`lifecycle-sound-build-final.log` | copyPublicDir=false；既有>500kB chunk警告保留 |
| 浏览器解码 | 全15份HTTP、SHA、真实浏览器解码与OfflineAudioContext非静音输出通过，`lifecycle-sound-decode.json` | 离线波形不等同于人耳/设备扬声器听感 |
| 两首组件整曲 | cfprde816、remasq695事件；暂停/恢复、缓冲、seek、切视图/难度与ended清场通过；暂停恢复最大像素差≤1/255 | `lifecycle-component.json`；受控媒体/rAF，声音关闭，隔离视觉回归 |
| 正式App结束 | brndnf EX实际音频到 **130.650998秒、ended=true**，音符0、箭头0、声音active0；`lifecycle-real-ended.json/png` | 从中后段实播到结束，未声称本批从0秒连续实播整曲 |
| 正式App音效 | 同一brndnf EX实播切换SE1→SE2→SE3→社长，累计调度98→112→218→329；暂停active归0，off继续播放时累计保持329 | `lifecycle-sound-product.json`；SE2记录采到ended，按结束回执解释，不能标成仍playing。自动演示关闭时已可发声 |
| 箭头相对位移 | brndnf EX，tick127790→128000，同source881的箭头/按键横向间距除箭头宽度由-0.913424变-1.220628，882亦变化 | `lifecycle-flick-browser.json`；已排除整体下落/缩放导致的假运动，不是原录屏同帧对照 |
| 响应式 | 实际390×844，scrollWidth390，菜单在x12..378内，四套可选择；`lifecycle-sound-menu-narrow.png` | Browser模拟窄屏，非物理手机 |
| 真音频性能 | cfprde EX，Auto开启＋SE1，1280×720，12.503105→32.462675秒；20.0238秒内1190次轨道更新，CPU median/P95 **4.6/8.0ms**、max61.7ms；rAF间隔P95 10.4ms，2次>50ms、0次>250ms。无缓冲/焦点警告；89次音效调度，停止后active0 | `lifecycle-performance.json`；rAF101.38Hz不是GPU FPS，仍不宣称稳定60FPS或真机通过 |

新资源初次请求暴露Vite启动时public索引缓存：返回HTML而非Ogg，散列检查正确拒绝。已核对原服务PID68080后以同5231、同candidate `rm-release-20261022`、同主checkout public fallback重启为PID86020；最终HTTP为audio/ogg且全部hash通过。未换端口或候选数据。验证页最初缺head导致bootstrap注入错误，也已修正；正式App最终控制台无error/warn，不把历史失败日志写成零错误。

## 剩余交接

1. 本批接入的是可选打击音套装。共享hold循环、Special/loop、技能、断combo、观众、结果等ACB声音仍未接入；`app_special_999`准确调用点仍沿用[音效审计](CHART_SOUND_RESOURCE_AUDIT_20261025.md)缺口。不能把“15份解码”写成全部原生声音还原。
2. 同刻声音按种类去重及时间前瞻是Web调度适配，没有执行原生SupressSameTimingTapSE完整状态机；暂停取消尾音而非复刻native插件的暂停恢复。Safari编码支持、后台恢复/AudioContext被系统挂起、物理手机及设备听感尚未验收。
3. 箭头现有来源运动/blur消费与原机逐帧等价须分开。原生随机相位、Shape/billboard细节、材质/背景合成仍需绑定录屏连续帧。当前近似微偏移未完整复刻Shape旋转，不称完全原生粒子引擎。
4. `config/resource-audit.json` 保留已有及构建生成差异，不纳入提交；只提交本批显式源码、配置、脚本、fixture、小型衍生音频与一张blur贴图。无全量public副本。
