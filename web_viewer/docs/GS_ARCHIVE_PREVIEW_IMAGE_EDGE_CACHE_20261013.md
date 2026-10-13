# 2026-10-13 图片边缘缓存实验

分支 `claude/preview-image-edge-cache-20261013`（`0bf461b2`），从 `claude/portal-static-route-20261012` 的 `12cd24db` 开出。只部署到测试分支（固定地址 <https://5e7266d6.gs-archive-preview.pages.dev>），正式站未动，R2 未动。

## 结论

1. **自定义域名上，图片本来就被边缘缓存了，而且缓存在 Function 前面。** `preview.gs-archive.com` 的请求先经过 `gs-archive.com` zone 的 CDN：png/webp/js 按默认可缓存扩展名直接 `cf-cache-status: HIT`，命中时不调用 Function、不读 R2。`*.pages.dev` 上没有这层（无 `cf-cache-status`）。
2. **自定义域名上仍然每次走 Function + R2 的是：m4a、`/data/*` JSON、Spine `.skel`/`.atlas`**（`cf-cache-status: DYNAMIC`，本机首字节 1.35–2.2 s，对比命中的图片约 0.8 s）。HTML 外壳与 `_catalog/bootstrap.json` 按设计不缓存。
3. **Function 内的 Cache API 在 `pages.dev` 上有效**（外部指导正确，我之前的推断错误）：同图第二次起 `X-GS-Edge-Cache: HIT`，首字节 0.8–1.0 s → 0.42–0.67 s；字节、ETag/304、Range 均正确。
4. **但对页面冷加载没有可测收益**：模拟手机下 A/B/A 三组差异落在噪声内。瓶颈是带宽（1.6 Mbps 下 Portal 拉 3.2 MB），不是单请求延迟。
5. **Portal 真正的大头是 3 张卡面立绘**：76 张图共 2,987 KiB，其中 `card-art/portrait` 3 张就占 1,589 KiB（原图 640×800 无损 WebP，显示 119×142～239×298，位于首屏以下 1184 px，却立即加载）。来源 `src/components/archive/PortalCardBento.vue`，5 个 `<img>` 都没有 `loading="lazy"`。

## 实现（实验，默认关闭）

- `functions/_shared/r2-resource.js`：`ARCHIVE_EDGE_CACHE=images` 时，`/assets/` 下 png/webp/jpg 的整对象 GET 进 `caches.default`，键为 `<origin>/__edge-cache/<ARCHIVE_DATA_REVISION>/<objectKey>`，存 24 h；浏览器仍 1 h。命中时跳过 R2 head/get，但 Function 仍执行。Range、音频、data、JSON、404 不进缓存。诊断头 `X-GS-Edge-Cache: HIT|MISS`。
- `functions/assets/[[path]].js` 传入 `waitUntil`；`prepare-readmodel-preview.mjs` 给 preview 包设 `ARCHIVE_EDGE_CACHE: 'images'`。正式打包路径不受影响。
- `scripts/verify-preview-edge-cache.mjs`（进 CI batch）：开关默认关、MISS→HIT 不读 R2、304/HEAD、按 revision 分键、Range/音频/data/404 绕过、无 `waitUntil` 不存。两处变异（去掉命中分支、键去掉 revision）都会使其失败。`verify:source-batch` 129/129。

## 测量

同一组 6 张图各请求 3 次（`--noproxy` 直连，本机到 Cloudflare）：

| 地址 | 结果 |
|---|---|
| `preview.gs-archive.com`（部署前） | 全部 zone `HIT`（`Age` 数千秒），首字节约 0.76–0.98 s |
| `gs-architecture-device-test…pages.dev`（部署后） | 第一次 `MISS` 0.78–1.01 s，之后 `HIT` 0.42–0.67 s |

冷加载（`measure-portal-cold-load.mjs --runs=5 --profile=mobile --pages=portal,idol --paths`，两个固定部署都在 `pages.dev` 上，代码相同、仅缓存开关不同）：

| 组 | 页面 | TTFB | FCP | 实体出现 | LCP |
|---|---|---:|---:|---:|---:|
| A 无缓存 `98921ebf` | portal / idol | 804 / 757 | 3076 / 2492 | 3465 / 3852 | 10472 / 3960 |
| B 缓存 `5e7266d6` | portal / idol | 355 / 343 | 2652 / 2292 | 2981 / 3264 | 10316 / 3340 |
| A2 无缓存（复测） | portal / idol | 479 / 440 | 2792 / 2380 | 3232 / 3337 | 10544 / 3440 |

TTFB 只取决于 HTML，与图片缓存无关，A 与 A2 却相差 300 ms，说明网络在漂移；B 相对 A2 的差（LCP −228 / −100 ms）与 TTFB 差同量级，不能算作缓存收益。数据：`.analysis/perf-baseline/edgecache-*`。

## 建议

1. **不把 Function 内 Cache API 推向正式站。** 正式站迁到 `gs-archive.com` 后，图片由 zone 缓存在 Function 之前处理，效果更好；本分支保留作记录，不合入。
2. **Portal 最大收益是少下载**：`PortalCardBento.vue` 首屏以下的卡面与歌曲封面加 `loading="lazy"`（桌面首屏内的主图保持立即加载）；中期给卡面缩略位提供小尺寸有损变体（显示 119 px 的槽位用不到 640×800 无损图）。
3. **音频 / Spine 数据 / JSON 的缓存**：迁到自定义域名后用 zone 的 Cache Rules 让 `/assets/voice/*`、`/assets/spines/*`、`/data/*` 可缓存（需要控制台或带 Zone 权限的 token）。注意这些 URL 不含数据版本，换 R2 快照时要清缓存或用短 Edge TTL；m4a 的 Range 行为需单独验收。
4. **zone 的 Browser Cache TTL**：preview 上图片返回 `max-age=14400`，而 Function 发的是 3600，说明 zone 默认浏览器 TTL（4 小时）覆盖了源站值。建议在控制台改为 “Respect Existing Headers”，否则换图后浏览器最多 4 小时看到旧图。
