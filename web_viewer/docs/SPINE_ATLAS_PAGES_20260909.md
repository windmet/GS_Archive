# Spine atlas 页依赖与运行时加载

2026-09-09，基线 `b01b875`。

## 改动

`shared/story/SpineAtlasPages.js` 提供共用 Unity atlas 文本解码、页清单和纯依赖展开。
页边界与当前 @pixi-spine/base TextureAtlas 的空行语法一致；完整相对路径保留，
同名不同目录不会碰撞。空清单、重复页、绝对路径/父目录/查询字符串等拒绝解析。

`resolveSpineAtlasDependencies` 接收原计划、modelId、已解码文本、atlas bytes SHA 和
明确的 modelKind=spine，把所有 texture 页挂入 bundle，保留每页来源 hash 与 uses。
这是逻辑依赖展开，不代表网络下载成功。特殊 silhouette 模型不能冒充 Spine 进入。
函数不修改原计划；其他未解析资源仍使整个计划 dependenciesComplete=false。

实际 `spineSpawnPipeline` 现在并发载入全部 atlas 页，全部完成后才创建 TextureAtlas
和 skeleton/Spine。页面按照完整名字绑定；未知页面回调 null，任何下载失败拒绝创建，
不再通过粉色备用图继续构造。PixiStageManager 对该路径关闭 loadImageTexture 的 fallback。
单页保留既有 original-name→comu.png URL 兼容回退；多页关闭此回退，避免不同页误用同一图片。
纹理缓存的所有权未改变，未在局部失败时销毁其他消费者可能共享的纹理。

## 验收

- `verify:spine-atlas-pages`：两页且同 basename 不同目录、CRLF、非法/重复页、单页兼容、
  实际 loadAndCreateSpine 的第二页 404 与延迟完成、完整依赖展开/输入不变。
- 使用已安装 TextureAtlas parser 核对两页 grammar；多页 loader 绑定使用受控替身，
  本批没有提供真实多页 skel 的 GPU 渲染验收。
- `node scripts/verify-spine-atlas-pages.mjs --local-assets`：725 个本地 atlas 全部可解析，
  当前都是单页，不把此扫描称为真实多页演出通过。
- `verify-story-stage-loading.mjs`：场景替换、离开、过期失败、直接 spawn、时钟传递通过。
- `verify:story-asset-plan` 与 source-only Vite 构建通过；主包原有 500 kB 阈值警告保留。
- Browser 实际从 Reader 打开 `1_4_001_00_a`，推进到秀对白（显示 11/26），人物服装/纹理、
  背景和对白正常；无 error，有既存 Spine update/tint 弃用警告。截图保留在本机 visualization。

## 后续

共用解析器已用于运行时；纯计划的 atlas 展开 API 已实现，尚未接入网络预载器。
继续补齐特殊模型 adapter、效果 texture 与通信 UI 依赖，然后接入任务状态及分层执行。
整集资源就绪、进度百分比、失败 UI、buffering、版本缓存、正式长稳仍不能称为已完成。
