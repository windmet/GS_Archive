# 属性图标（2026-10-14）

歌曲页、卡片页、门户卡片区和道具目录的 Physical / Intelli / Mental 标记原来用 8px 色点代替，现在换成游戏客户端自带的属性图标。

## 来源

- 客户端：iOS 包 `Payload/BNEI0395.app/Data/data.unity3d`，SHA-256 `fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a`。
- 下载的 RAW 资源包和 `GS_Res/ALL_PHOTOS` 里都没有这些图标；它们只在内置 `data.unity3d` 的 UI 图集里。
- 选用平涂、无描边的 `*_big` Sprite（带灰描边的 `__2`、`cardlist`、`plate` 等是叠在卡面上的变体，放在纸面上太重）。

| 文件 | Sprite | path_id | 原尺寸（裁边后） | SHA-256 |
| --- | --- | --- | --- | --- |
| `public/assets/attributes/icon_attribute_physical.png` | `icon_attribute_physical_big` | 305 | 126×155 | `681bc3dea0d277b8373b16c34963debbbcf4243210e4c2587d1ff9b2cf03a2d9` |
| `public/assets/attributes/icon_attribute_intelli.png` | `icon_attribute_intelli_big` | 40 | 183×183 | `21572c5c705d1e99f422c78788a1dde3e333786438fc0c51e92dd15e949a3c23` |
| `public/assets/attributes/icon_attribute_mental.png` | `icon_attribute_mental_big` | 210 | 137×137 | `0c403ae729847756246d453a0f65e13c777f35d5b07b2119a86ed8442c6c59ba` |
| `public/assets/attributes/icon_attribute_all.png` | `icon_attribute_all_big` | 201 | 246×175 | `03c2934c46113fb98a6347a3cd77eec579f54fffa3bb8413a36b91f2ddc773ad` |

处理：UnityPy 1.25 读取 Sprite → 按 alpha 裁边 → 居中补成正方形 → Lanczos 缩到 64×64 → PNG optimize。64px 足够 2 倍屏下 15–18px 的显示尺寸。

## 使用

- `GS_UI_TOKENS.css` 定义 `--gs-attr-icon-{physical,intelli,mental,all}`，各处用 `::before` 背景图显示，文字颜色仍用 `--gs-attr-*`。
- 歌曲页属性徽标、卡片页属性标记：18px。
- 门户卡片区「按属性探索」、道具目录觉醒材料的属性筛选：15px。道具格子本身只保留属性底色，不加图标。
- 卡片列表的属性下拉框是原生 `<option>`，放不进图片，保持纯文字。
- 属性未确认（歌曲「待确认」）时不显示图标。
