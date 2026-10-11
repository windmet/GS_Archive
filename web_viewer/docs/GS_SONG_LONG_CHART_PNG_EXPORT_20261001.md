# 完整长轨 PNG 导出

2026-10-01，输入 HEAD `69b08655`，分支 `codex/story-interaction-v2-before-b002`。本批补齐歌曲谱面长轨全图的 PNG 保存；未部署，透视轨道 PNG 未增加。

## 用户操作

歌曲详情 → 打开长轨谱面预览 → 长轨图 → 选择难度、贴图及纵向缩放 → **保存长轨 PNG**。保存的是点击时的完整图，固定 2 倍 SVG 分辨率：宽 820 像素、高 `geometry.height × 2`；不跟随手机容器宽度或设备 DPR 改变，不自动降采样、不截断。原有 SVG 导出保留。导出期间按钮禁用、显示百分比；切换歌曲、难度或收起/卸载谱面会取消旧导出，避免保存过期内容。

超出浏览器预算或浏览器缺少 `CompressionStream` 时，保留完整 SVG，并提示使用离线导出。界面「浏览器无法保存 PNG？」中有操作说明：

```sh
# 在 web_viewer 目录；已有依赖时不必重复安装
npm ci
npm run export:song-chart-png -- input.svg output.png
```

默认与网页一致为 2 倍分辨率，第三个参数可明确指定整数倍率 1–4；不会在失败后偷偷改变倍率。输入使用网站下载的自包含 SVG；脚本拒绝外部图片、外部 URL、脚本及 foreignObject 等非归档内容。离线栅格器使用项目已有 devDependency `sharp`，未增加项目依赖。

## 实现

- `ArchiveSongChartPreview.vue`：新增 PNG 按钮及说明，沿用同一个 SVG 快照和 `embedSongChartImages`。PNG 前置预算检查发生在贴图内嵌前。没有修改谱面加载路径、SHA-256/字节数检查、类型验证、懒加载入口或原生音符映射。
- `SongChartPngExport.js`：最大 1024 行的栅格条带，上下各带 8 个输出像素重叠；只取中间有效行，保留穿越边界的长按、滑条、Flick、线条及贴图。每个临时 Canvas 不超过 2,097,152 像素，宽不超过 4096。图像 URL、临时图片及 Canvas 会释放。
- RGBA 行带 PNG filter 0，写入一条连续 zlib 流，再封装 PNG IHDR / IDAT / IEND 及 CRC。所得文件是一张完整 PNG，不是多张图或把独立 PNG 字节直接串接；不创建整图 Canvas。
- 浏览器另有 **67,108,864 总输出像素**和 **256 MiB 压缩结果**预算。单段小 Canvas 不能完全约束浏览器重复 SVG 解码产生的内存，因此必须同时限制总工作量；大于总像素预算时在开始前拒绝并走离线路径。没有改变目标尺寸。
- `export-song-chart-png.mjs`：相同坐标、倍率和条带重叠，逐段 `sharp` 栅格化，Node zlib 流式写磁盘；关闭 sharp 缓存、单线程运行。不受浏览器总像素/压缩 Blob 预算限制，也不构建全高位图。先写唯一临时文件，完整完成后改名；失败清理临时文件，不产生伪成功的最终 PNG。
- 长轨仍是原始 tick 纵轴；BPM 变化标记保留，未引入音频同步或原游戏运行时一致性的声明。

## 回归命令

```sh
node scripts/verify-song-chart-presentation.mjs
node scripts/verify-song-track-presentation.mjs
node scripts/verify-song-note-rendering.mjs
npm run verify:song-chart-png
npm run verify:song-chart-png:browser
# 检查离线图的所有行，不分配全图 RGBA 内存：
npm run verify:song-chart-png -- output.png 820 <实际高度>
npm run build:check
npm run verify:build-audit
npm run verify:cutover-routes
```

Browser 回归需要现有 Playwright QA 运行时；可用 `GS_PLAYWRIGHT_MODULE` 指向其模块、`GS_CHROMIUM_EXECUTABLE` 指向既有浏览器，`GS_PNG_QA_DIR` 指定小型 QA 产物目录。脚本启动本工程 Vite，仅挂载真实 `ArchiveSongChartPreview.vue` 和真实 catalog props；这是组件 Browser 旅程，未冒充全站导航或真实设备验收。它保存超长谱面的 SVG 并核实网页预算拒绝；超长离线 PNG 由上述 CLI 和逐行解码命令单独验证。

## 本次实际验收

- 244 档、66,666 个原始对象、3,839 滑条、1,585 Flick 尾端及 36 次 BPM 变化的既有几何回归通过；透视 732 个视野及原生贴图映射/哈希回归通过。
- PNG 独立 zlib 解码：40,001 行、首尾/1024 与 2048 分段边界像素、已知 IEND CRC、格式尺寸拒绝、条带及浏览器总像素预算均通过。
- Browser 普通长轨：BRAND NEW FIELD EASY `820 × 30,928`；Expert 同尺寸并含原生长按/Flick；Beyond The Dream Expert `820 × 28,508` 并含小数轨位滑条；Infinite Octave EASY `820 × 21,164` 并含 BPM 变化。均实际下载 PNG 与自包含 SVG，PNG 独立解码/尺寸核实通过。
- 相同浏览器单段参考图与分段导出前 4096 行对比，跨三个接缝；13,434,880 个 RGBA 通道中 254 个有细微抗锯齿差异，最大 12/255，低于回归门槛，无缺失音符或可见接缝。
- 贴图破坏触发 SHA-256/字节数拒绝；重试成功下载 PNG；切换难度取消旧导出；未知音符类型拒绝；打开预览前零谱面请求。100,002 行的窄幅合成图保留红色最后一行，验证超越常见 Canvas 单边尺寸限制后仍为完整 PNG。
- `tibeti` Expert 的原始 `maxTick=2,832,080` 在放大模式要求 `820 × 849,792`。早期仅限制单段 Canvas 的尝试使 QA Chromium 崩溃；加入总像素预检后，网页在栅格化前提示离线导出，SVG 下载仍成功。未据长度异常修改原始谱面。
- 常规离线：BRAND NEW FIELD Expert `820 × 30,928` 完整生成、逐行解码通过。
- 真实超长离线：`tibeti` Expert 放大 `820 × 849,792` 完整生成，18,499,126 字节；独立 zlib 全行解码确认 **849,792 行**、完整 IEND、无残留/截断行、首尾 RGBA 均为背景 `[19,33,46,255]`。编码及检查均未分配约 2.8 GB 的全图像素数组。
- 已实际查看下载 PNG 的原生贴图片段：绿色长按、跨轨滑条/中间节点、BRAND NEW FIELD Expert sourceIndex 110 的红色上划长按尾端，以及黄色左划/青色右划提示，确认导出中没有仅剩空轨道或丢失内嵌贴图。
- 最终 `build:check` 与两项 progress 审计通过；只复用 `.analysis/build-check`，`copyPublicDir:false`，未复制公共语料。保留两项既有背景路径编译警告和全局 partial / device pending。
- Browser 插件不存在；预置 Playwright 浏览器也不存在，官方安装包下载失败，改用临时 npm Chromium 的 CPU 栅格路径。桌面 1440×1000、窄屏 390×844；按钮实际响应、无横向溢出、无框架覆盖层、无应用运行错误。Vite HMR WebSocket 被 QA 环境本地网络检查阻止，单独记录为环境告警，不算作页面逻辑通过或失败。截图另装临时 CJK 字体以避免环境缺字，未修改产品字体或依赖。

## 验收边界

未部署；未进行 iOS/Safari、Android 真机或全站旅程验收。超长离线导出比普通图耗时明显更长，属于保持完整分辨率的路径，不是浏览器快速导出的保证。浏览器失败时仍可用保留的 SVG 和离线脚本输出相同尺寸；大图能否在某个图片查看器中一次打开，取决于该查看器自己的解码内存限制。未知类型保持 fail-closed，原游戏 Shader/UV/判定和音频同步待办仍保留。
