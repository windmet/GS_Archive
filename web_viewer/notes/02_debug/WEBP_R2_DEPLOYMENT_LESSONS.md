# WebP Lossless 与 R2 / Pages 部署心得
最后更新：2026-07-05

本文记录 SSR 动态卡面预览站迁移时得到的素材压缩、R2 存储、Cloudflare Pages 部署和前端加载优化经验。后续剧情浏览器如果需要把大量 PNG 贴图转为 WebP lossless，可以优先参考这份流程。

## 适用结论

- 对透明贴图、Spine atlas 贴图、UI 立绘等需要保留边缘质量的素材，优先试 `WebP lossless`。
- 对背景大图、非透明插图，可以单独评估有损 WebP / AVIF，但不要和透明角色贴图混用同一套质量判断。
- 转换前必须处理 alpha 周围的 RGB 脏色，否则会出现红光、白边、黑线、半透明边缘污染。
- R2 负责放大资源，Pages 只放网页代码和小型清单。
- 压缩体积只是第一步，加载速度还取决于缓存头、CDN 域名、清单大小、前端是否并行加载、是否重复销毁贴图缓存。

## 本次 SSR 卡面实测

SSR 动态卡面项目路径：

```text
E:\Web_build\SSR_Portraits
```

最终策略：

- PNG 原始贴图保留为本地归档。
- 网页部署只使用 WebP lossless。
- R2 桶里保留运行所需资源：`prefab/`、`image/` 中必要图标、`.skel`、`.atlas`、`.webp`。
- Cloudflare Pages 只部署 Vite 产物和瘦身后的 `data.master.json`。

压缩结果：

```text
卡面数量：123
WebP lossless 贴图：229
PNG 贴图总量：约 507.84 MiB
WebP lossless 总量：约 330.33 MiB
节省：约 177 MiB
比例：约 65%
```

部署清单瘦身结果：

```text
原 data.master.json：约 5.15 MB
部署用 data.master.json：约 272 KB
```

这个清单瘦身非常重要。图片变小以后，如果首屏仍然加载一个包含剧情预览、语音候选、prefab 原始转储、diff、source 的 5MB JSON，用户仍会感觉慢。

## 推荐目录分工

建议把“本地完整档案”和“线上运行资产”分开：

```text
local_archive/
  png_original/
  prefab_original/
  masterdata_raw/
  audit_notes/

web_runtime/
  data.runtime.json
  assets/
  prefab/
  image/
```

对于当前 SSR 项目，实际分工是：

```text
E:\Web_build\SSR_Portraits
  data.master.json          # 本地完整 masterdata 合并结果
  webp-variants.json        # WebP 转换 manifest
  prefab/                   # 原始/运行资源
  image/                    # 图标资源
  viewer/                   # 前端工程
  deploy_pages_lossless/    # 可拖拽到 Pages 的部署包
```

## WebP Lossless 转换原则

### 1. 不要直接无脑 PNG -> WebP

透明贴图的隐藏 RGB 很容易污染边缘。常见症状：

- lossless 版本出现红光、彩色块、透明区域漏色。
- 有损 WebP 出现白边、灰边、边缘发脏。
- Spine 人脸、头发、衣服边缘出现黑线。

原因通常不是 WebP 本身坏了，而是透明像素里有原始 PNG 的脏 RGB，或者前端 alpha 模式和导出格式不匹配。

### 2. 转换前清理完全透明像素 RGB

建议规则：

```text
如果 alpha = 0，则 RGB 置 0
如果 0 < alpha < 255，不要随意改 RGB
```

完全透明像素不会显示，但编码器和 GPU 采样边缘时可能读到它们的 RGB。把完全透明像素清成黑色或邻边扩展色，可以减少彩边。本次 SSR 项目采用“alpha=0 的 RGB 清零”。

### 3. Spine/Unity 导出的 PMA 要保持一致

本次卡面资源属于 Spine 3.8 / Unity 导出，前端需要按 premultiplied alpha 处理。

关键点：

- `.atlas` 不一定声明 `pma: true`。
- 前端仍需要显式设置 Pixi `alphaMode = PMA`。
- 不要随意改成非 PMA 解码，否则可能产生脸部黑线或边缘阴影。

本次踩坑：

```text
尝试改 alpha 解码后，整体彩边有所变化，但人脸出现黑线。
最终策略：保留 PMA，转换阶段清理 alpha=0 的 RGB。
```

## Atlas 路径改写

如果只把 PNG 换成 WebP，但 `.atlas` 里仍指向 PNG 文件名，Spine 运行时会找不到贴图或回退到旧资源。

推荐做法：

1. 为每张卡生成 lossless `.webp`。
2. 同步生成或改写 `.lossless.atlas`。
3. 用 manifest 记录原资源和 WebP 资源的对应关系。
4. 部署前统一把 `card.atlas`、`card.textures` 改成 WebP 版本。

当前 SSR 项目 manifest：

```text
E:\Web_build\SSR_Portraits\webp-variants.json
```

部署脚本：

```text
E:\Web_build\SSR_Portraits\viewer\scripts\prepare-lossless-deploy.mjs
```

## R2 与 Pages 的正确分工

### R2 放什么

R2 适合放：

- `.webp`
- `.skel`
- `.atlas`
- 卡面图标、角色图标
- 其他大体积静态素材

### Pages 放什么

Pages 适合放：

- `index.html`
- JS/CSS bundle
- 小型运行清单 JSON
- `_headers`

不要把所有图片也塞进 Pages。Pages 上传和部署会变慢，后续剧情资源也很容易失控。

## R2 URL 区分

Cloudflare R2 有几类 URL，不能混用。

### S3 API Endpoint

示例：

```text
https://427350d4abf74f4c20c3cb7c0c6046d0.r2.cloudflarestorage.com/smgs-ssr
```

这是给 S3 API、wrangler、rclone、脚本上传用的，不适合作为前端直接访问资源的 URL。

### Public Development URL

示例：

```text
https://pub-252f5f58254c4ce8b7c4753ecd084f0b.r2.dev
```

这是可以让网页直接访问的公开 URL。本次 SSR 部署使用的是这个。

注意：R2 dashboard 也提示 public development URL 不推荐生产长期使用，可能有速率限制，也不如自定义域名好做缓存和控制。

### 生产建议

长期建议给 R2 绑定自定义域名，例如：

```text
assets.example.com
```

然后用 Cloudflare Cache Rules 管控缓存，而不是长期依赖 `r2.dev`。

## 部署流程模板

SSR 项目当前流程：

```powershell
cd E:\Web_build\SSR_Portraits\viewer
npm run prepare:lossless -- https://pub-252f5f58254c4ce8b7c4753ecd084f0b.r2.dev
```

脚本会生成：

```text
E:\Web_build\SSR_Portraits\deploy_pages_lossless
```

然后在 Cloudflare Pages 网页端上传这个目录。注意拖拽目录时，根目录下必须直接有：

```text
index.html
assets/
data.master.json
data.json
_headers
```

不要多套一层 `deploy_pages_lossless/deploy_pages_lossless/`。

## 部署清单必须瘦身

本地 masterdata 可以很全，但线上运行清单应该只保留当前页面真正消费的字段。

SSR 预览当前保留：

```text
角色：
- id
- abbr
- idol_code
- name_ja
- display_name
- type
- chara_icon
- cards

卡面：
- ssr
- skel
- atlas
- textures
- options
- animations
- card_icon
- resource_id
- card_id
- rarity
- ordinal
- title
- title_full
- texts
```

SSR 预览当前剔除：

```text
- voice_base
- home_voice_cues
- scenario_entries
- voice_candidates
- legacy_options
- prefab_options
- option_delta
- prefab_config
- _source
- 其他调试字段
```

剧情浏览器也建议同理：

- 本地保留完整 raw / compiled / audit。
- 线上按模块生成 runtime manifest。
- 一个页面只加载它必需的最小索引。
- 大文本、音频、贴图按需加载，不要塞进首屏总清单。

## 缓存策略

### Pages `_headers`

Pages 部署包可写 `_headers`：

```text
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/data.master.json
  Cache-Control: public, max-age=3600
/data.json
  Cache-Control: public, max-age=3600
/webp-variants.json
  Cache-Control: public, max-age=3600
```

JS/CSS 文件名带 hash，适合一年缓存。JSON 清单可能更新，适合短缓存。

### R2 大资源缓存

本次检查 R2 资源时发现响应头没有 `Cache-Control`。这会导致“资源已经变小，但每张图仍然加载慢”。

建议对 R2 资源设置长期缓存：

```text
Cache-Control: public, max-age=31536000, immutable
```

适合设置长期缓存的资源：

```text
.webp
.skel
.atlas
.png 图标，如果文件名稳定且更新少
```

如果担心更新后用户看到旧资源，应采用版本化路径或文件名 hash，而不是频繁依赖清缓存。

## 前端加载优化

图片体积变小以后，仍需要检查前端加载逻辑。

本次 SSR 项目做了这些优化：

### 1. 线上不要强制 cache bust

开发时可以：

```js
data.master.json?t=Date.now()
```

线上不应该这样做，否则每次刷新都绕过缓存。

推荐：

```js
const IS_LOCAL_DEV = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const cacheBust = IS_LOCAL_DEV ? `?t=${Date.now()}` : '';
```

### 2. 同一卡多张纹理并行加载

不要逐张等待：

```text
下载 A -> 解码 A -> 下载 B -> 解码 B
```

推荐：

```text
同时下载 A/B -> 同时等待解码 -> 再创建 Spine
```

### 3. 切卡时不要销毁可复用贴图

如果每次切卡都销毁 texture/baseTexture，用户返回上一张卡时会重新下载或重新解码。

推荐只销毁显示对象，保留贴图缓存：

```js
oldSpine.destroy({
  children: true,
  textures: false,
  texture: false,
  baseTexture: false,
});
```

### 4. 后续可以做预加载

适合 SSR 卡面和剧情浏览器：

- 当前卡加载完成后，空闲时预取同角色下一张卡。
- 剧情播放器进入章节后，预取下一段背景、角色模型、语音。
- 预取只做 fetch / decode，不立刻创建复杂对象。
- 预取队列需要限制并发，避免把首屏带宽抢光。

## CORS 注意事项

如果前端直接从 R2 public URL 读取资源，建议给 R2 配 CORS：

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

SSR 项目本地留存文件：

```text
E:\Web_build\SSR_Portraits\viewer\r2-cors-smgs-ssr.json
```

如果本机 wrangler 登录不顺，可以直接在 Cloudflare dashboard 的 R2 bucket settings 里设置。

## 质量检查清单

每次大批量 PNG -> WebP 后，至少检查：

```text
1. 透明边缘是否出现白边、黑边、彩边。
2. 半透明高光是否出现块状污染。
3. 人脸、头发、手指、衣服边缘是否有异常线条。
4. Spine 动画过程中边缘是否闪烁。
5. atlas 是否全部指向新 WebP 文件名。
6. 浏览器 Network 是否返回 200，而不是隐蔽 404 fallback。
7. Content-Type 是否正确：image/webp。
8. Cache-Control 是否符合预期。
9. 第二次访问是否明显命中缓存。
```

## 体积优化优先级

推荐顺序：

```text
1. 清理线上 JSON，只保留运行字段。
2. PNG 透明贴图转 WebP lossless。
3. 给 R2 大资源设置长期缓存。
4. 前端并行加载、避免重复销毁资源。
5. 做按需加载和邻近预加载。
6. 评估图标、缩略图是否能做独立小尺寸版本。
7. 最后再考虑有损压缩或 AVIF。
```

不要一开始就追求最激进压缩。有损压缩在透明 Spine 贴图上很容易产生边缘问题，排查成本可能超过节省的空间。

## 剧情浏览器迁移建议

剧情浏览器资源更多，建议从一开始就拆成多层 manifest。

推荐结构：

```text
runtime/
  index.json                 # 章节/角色/活动轻索引
  scenario/{id}.json         # 单剧情编译结果
  assets/{group}.json        # 单资源组 manifest

r2/
  image_bg/
  image_chara/
  spine/
  audio/
  lipsync/
  webp_lossless/
```

加载策略：

```text
进入首页：只加载 index.json
进入章节：加载 scenario/{id}.json
播放当前 step：按需加载当前背景、角色、语音、lip
空闲时：预取未来 1-3 个 step 的资源
```

剧情浏览器尤其不要把所有剧情文本、所有语音候选、所有角色资源都塞进一个全局 JSON。

## 一句话经验

WebP lossless 能省空间，但真正让网页变快的是整条链路一起做：干净的 alpha、正确的 PMA、正确的 atlas、瘦身清单、R2 长缓存、Pages 小包、前端并行加载和按需预取。
