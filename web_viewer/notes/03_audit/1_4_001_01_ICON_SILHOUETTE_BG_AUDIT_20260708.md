# 1_4_001_01 Icon / Silhouette / Background Audit - 2026-07-08

Scope:

- Scenario: `1_4_001_01`
- Compiled file: `public/data/compiled/1_4_001_01.json`
- Raw source checked: `E:\BaiduNetdiskDownload\SideM\scripts\scenariodata\1_4_001_01\scenario_1_4_001_01_a.json`
- User-visible report point: displayed `20 / 432`

## 2026-07-10 Resolution Addendum

This addendum supersedes the original current-status conclusions below.

- The compiled scenario now has `image_icon: null` through the affected region, and browser verification confirms that the floating top-left president icon is gone.
- `public/assets/silhouette/102sha_001_00.png` is now connected as the deliberate fallback for the missing president Spine model.
- The fallback is rendered at `1.2x` the first-pass scale and positioned at `baseY + 25`.
- The dialogue-step flicker was caused by fallback silhouettes not being recognized as existing character instances. Every new dialogue retried the missing Spine, removed the silhouette, then asynchronously recreated it.
- The fallback manager now reuses an existing or pending silhouette, updates its layout in place, and cancels stale image callbacks when the character leaves.
- Browser interaction from displayed steps `24 -> 25 -> 26 -> 27` kept `102sha` continuously present with identical layout values and no empty fallback frame.
- On 2026-07-23, `102sha_001_00` was promoted to an explicit audited silhouette-only asset contract. `SpineStage` now goes directly to the PNG fallback instead of first requesting known-missing `comu.atlas` / `comu.skel` files. The source verifier also requires the PNG to exist and the Spine rig to remain absent; if a real rig is added later, the exception must be deliberately removed.
- Background sampling around displayed `17 -> 18` showed unchanged `bgContainer` and `bgSprite` values. Raw command `camera_resetzoom` resets the foreground/spine container from `0.9` to `1`; the background itself does not move.
- Production build passed on 2026-07-10. The remaining bundle-size warning is unchanged and unrelated.

## Summary

The small president silhouette at the top-left is not the president stage portrait. It is the frontend's standalone `image_icon` overlay. In the aggregate compiled scenario, `image_icon: 102sha` is retained from displayed step `2 / 432` through `432 / 432`, so the overlay appears long after its useful range.

The president's real stage silhouette is a separate raw instruction path:

1. Raw declares `idol_model ["102sha", "102sha_001_00"]`.
2. Raw later calls `idol_fadein ["102sha", "0", "0.5"]`.
3. Compiled aggregate emits `spines: [{ id: "102sha", model: "102sha_001_00" }]` starting at displayed step `23 / 432`.
4. Current `public/assets/spines/` does not contain `102sha_001_00`, so the web player has no formal renderable Spine asset for the large silhouette.

The reported background shift from displayed step `19 / 432` to `20 / 432` is not supported by raw or compiled camera/background data. Both steps use the same background and camera state. Browser sampling also showed the stage container and canvas rect unchanged. The remaining likely causes are runtime replay/reset behavior or a perceived shift caused by character/dialogue changes.

## Evidence

### Frontend Overlay Path

`src/components/SpineStage.vue` renders:

```vue
<div v-if="sceneIcon" class="scene-icon">
  <img :src="sceneIcon.src" alt="" @error="$event.target.style.display = 'none'" />
</div>
```

`sceneIcon` reads:

```js
props.step?.state?.image_icon?.display_id || props.step?.state?.image_icon?.id
```

`src/utils/AssetResolver.js` maps this to:

```text
/assets/idols/icons/image_chara_icon_{id}.png
```

Runtime browser check at the user-reported screen showed:

```text
icon src: /assets/idols/icons/image_chara_icon_102sha.png
icon rect: top-left, about 76 x 76 px
canvas rect: unchanged, about 1280 x 720
console warnings/errors: none
```

This exactly explains the floating top-left icon.

### Compiled Step Evidence

Displayed step numbers are one-based. Array indices below are zero-based.

| Array index | Displayed step | Type | Background | Camera | `image_icon` | Spines |
|---:|---:|---|---|---|---|---|
| 18 | 19 / 432 | `stage` | `bg001_315pro_in_11` | `zoom=1, x=0, y=0, duration=0` | `102sha` | `101ken_001_00` fade in |
| 19 | 20 / 432 | `adv` | `bg001_315pro_in_11` | `zoom=1, x=0, y=0, duration=0` | `102sha` | `101ken_001_00` |
| 20 | 21 / 432 | `text_disable` | `bg001_315pro_in_11` | `zoom=1, x=0, y=0, duration=0` | `102sha` | `101ken_001_00` fade out |
| 21 | 22 / 432 | `stage` | `bg001_315pro_in_11` | `zoom=1, x=0, y=0, duration=0` | `102sha` | none |
| 22 | 23 / 432 | `stage` | `bg001_315pro_in_11` | `zoom=1, x=0, y=0, duration=0` | `102sha` | `102sha_001_00` fade in |
| 23 | 24 / 432 | `adv` | `bg001_315pro_in_11` | `zoom=1, x=0, y=0, duration=0` | `102sha` | `102sha_001_00` |

Aggregate compiled `image_icon: 102sha` range:

```text
displayed steps 2-432
```

This range is too broad and should be treated as state retention pollution unless raw proves `image_icon` is meant to remain permanently visible.

### Raw Command Evidence

Important raw commands in `scenario_1_4_001_01_a.json`:

```text
009 idol_model        ["102sha","102sha_001_00",...]
010 idol_position     ["102sha","0","0",...]
031 image_icon        ["101ken","",...]
032 image_icon        ["102sha","",...]
046 image_bg          ["bg001_315pro_in_11",...]
047 camera_zoom       ["0","0","0","0","0.9",...]
067 camera_zoom       ["0","0","0","0","0.9",...]
089 idol_fadein       ["101ken","0",...]
093 text              ["山村 賢","時間通りに出社して頂けましたね。\nそれでは社長、よろしくお願いします。","101ken","a1000",...]
095 idol_fadeout      ["101ken","0","0.2",...]
100 idol_fadein       ["102sha","0","0.5",...]
102 text              ["齋藤社長","諸君、おはよう！\n315プロダクション代表取締役社長、齋藤孝司だ。","102sha","a1001",...]
138 idol_fadein       ["102sha","0","0.5",...]
139 camera_zoom       ["5.5","0.2","0","20","1.2",...]
142 text              ["齋藤社長","むむっ、まだまだ！　もっと情熱を燃やして……\nパパパ、パーッション！！","102sha","a2000",...]
```

Two separate systems are present:

- `image_icon`: small UI/icon presentation.
- `idol_model` + `idol_fadein`: stage character/silhouette presentation.

Therefore the current top-left icon should not be used as a substitute for the large president silhouette.

## Background Shift Assessment

For displayed `19 / 432` to `20 / 432`:

- raw has no `image_bg` change between Yamamura fade-in and the Yamamura text.
- raw has no camera command between those two points.
- compiled keeps the same `bg001_315pro_in_11`.
- compiled keeps camera at `zoom=1`, `offset_x=0`, `offset_y=0`, `duration=0`.
- browser check showed canvas and stage DOM rects unchanged.

Current conclusion: no data-layer background move is present for this transition.

Next runtime checks if the shift remains visible:

1. Expose a temporary debug dump for Pixi background sprite/container: `bgContainer.x/y/scale`, `bgSprite.x/y/width/height`, `spineContainer.x/y/scale`.
2. Capture those values before and after displayed `19 -> 20`.
3. If values are identical, compare screenshots in a background-only area; likely visual perception from Yamamura fade/dialogue composition.
4. If values differ, inspect `CameraController.resetCameraZoom()` and repeated `applyStepSceneState()` calls. `applyStepSceneState()` currently resets camera whenever `state.camera_zoom` is missing and applies `setCameraZoom()` whenever present.

## Immediate Recommendations

Do not solve this by simply hiding `.scene-icon` globally. That would remove the symptom but would not restore the real president silhouette, and could break any scenes where `image_icon` is intentionally used.

Recommended next order:

1. Fix compiler/state retention for `image_icon`.
   - Determine whether raw has an explicit clear/end command or whether `image_icon` should be step-local.
   - Add a bounded lifetime rule so `image_icon: 102sha` does not persist across the whole aggregate file.
2. Add a formal missing-NPC visual strategy for `102sha_001_00`.
   - First search the source asset package for a full-body or Spine silhouette asset.
   - If no Spine exists, add a deliberate fallback renderer only after choosing the best source image.
   - Do not use `image_chara_icon_102sha.png` as the stage silhouette.
3. Add Pixi debug introspection for background/camera containers.
   - Keep it behind a debug URL flag or `window.dumpStage()` helper.
   - Record `19 -> 20` and `23 -> 24`, since the latter is where `102sha_001_00` should appear.

## Current Status

- Floating top-left icon: root cause found.
- President silhouette association: raw and compiled association found; render asset missing in current public assets.
- Displayed `19 -> 20` background shift: no raw/compiled cause found; runtime container values still need targeted Pixi dump if the visual shift is reproducible.
