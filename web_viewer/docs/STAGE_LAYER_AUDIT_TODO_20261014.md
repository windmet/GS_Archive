# 舞台图层反查与后续待办

用户反馈：灯光较此前明显改善，但仍有尚不能准确描述的遗漏。先登记，后续结合明确时间点或原始链路处理；本轮不凭印象继续调光。

当前优先：反查图层排序、遮光层与人物的关系，以及灯光叠加与人物自身着色的边界。

- [x] 原版 LiveObjectIdol baseSortOrder + offsetSortOrder；聚光灯 Show 时目标 +250，换目标/Hide 时恢复，影子随人物排序 -10。
- [x] SpotlightBackground 共享脚本排序、聚光灯 depth+1、pinspotlight 掩模排序区间；保留脚本显式 0。
- [x] SpotlightBackground 共享颜色、visible 计数和渐变；已改为独立命令回放，保留 RAW 跨家族指令顺序，见 NATIVE_SHARED_BACKGROUND_BATCH_20261014.md。
- [x] 去除没有原版依据的整个人物环境染色，避免与遮光平面重复叠加、绕过 pinspotlight 掩模。
- [ ] Body_Color 材质替色及 Foot_Color 高度映射，不能把本批去重染色视作人物 shader 已完全还原。
- [ ] 反查 monitor、嵌套特效容器及透明材质的排序/深度状态；不将所有灯束一律移到人物后面。
- [x] 背屏 value7 错当 Logo 渐变时长：已反查确认其为 GrowSprite alpha，限定预览 Logo 改为原版固定500ms/显示alpha0.8。
- [ ] 后续处理用户暂无法描述的灯光差异，保留待办，不宣称全部灯光还原完成。

验证边界：反编译、源资源、浏览器合成各自提供证据；源码构建不代表原版视频或真机视觉一致。

第一批证据与验证见 [NATIVE_CHARACTER_LAYER_BATCH_20261014.md](NATIVE_CHARACTER_LAYER_BATCH_20261014.md)。背屏已定位到原版 value8 / SetSortOrder（0x2218938），分层偏移为 -5、+1、+5、+110；当前 Web 容器 -30000、图像 -10000/-9999，尚未恢复这些脚本层级。需先厘清解析字段与容器归属再改，不能只替换一个 zIndex。

背屏资源绑定与 Logo 原版透明度修正见 [NATIVE_BACKMONITOR_LAYER_TRACE_20261014.md](NATIVE_BACKMONITOR_LAYER_TRACE_20261014.md)。
