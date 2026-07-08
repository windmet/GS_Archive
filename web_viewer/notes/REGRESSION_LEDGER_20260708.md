# Regression Ledger - 2026-07-08

This ledger anchors the next stabilization pass. It records what each scenario
is meant to protect, what compiled evidence currently exists, and what still
needs browser/visual confirmation.

## Verification Chain

Use the same chain for every finding:

1. Raw command or resource evidence.
2. Compiled JSON output.
3. Vue state consumption.
4. Pixi/Spine/Audio runtime behavior.
5. Rendered browser result.

Compiled JSON is necessary evidence, but it is not enough by itself for visual
completion.

## Direct Validation URL

Use the query entry point to open compiled files directly:

```text
http://127.0.0.1:5173/?scenario=1_1_013the_02_1_1_013_02.json&startStep=5
```

`scenario` may be either a bare compiled ID or a `.json` filename. `startStep`,
`stageOnly`, `hideUI`, and `noVoice` continue to be handled by `StoryViewer`.

## Anchor Samples

| Scenario | Compiled file | Steps | Why it is an anchor | Current evidence | Visual status |
|---|---|---:|---|---|---|
| `1_1_013the_02_1_1_013_02` | `public/data/compiled/1_1_013the_02_1_1_013_02.json` | 202 | silent stage intro, footsteps, two-character entrance, text_disable heart-voice transitions, camera zoom/reset | 32 `stage`, 36 `text_disable`, 9 `camera_zoom`, 103 multi-spine steps, 97 timeline-bearing steps | smoke pass: browser rendered ADV at 10/202 after direct open from `startStep=5`; canvas visible; no console errors |
| `1_1_015leg_04_1_1_015_04` | `public/data/compiled/1_1_015leg_04_1_1_015_04.json` | 252 | multi-character retention, continuous dialogue, transition-step back navigation, camera/background clamp samples | 77 `stage`, 25 `text_disable`, 38 `camera_zoom`, 91 multi-spine steps, 78 timeline-bearing steps | smoke pass: browser rendered multi-character ADV at 12/252; canvas visible; no console errors |
| `1_4_001_00` | `public/data/compiled/1_4_001_00.json` | 60 | official lip-sync comparison across `047shu`, `001tom`, `004ter`; camera zoom with three-character stage | 16 `stage`, 9 `text_disable`, 37 `camera_zoom`, 12 multi-spine steps, 8 timeline-bearing steps | smoke pass: browser rendered three-character ADV at 20/60; canvas visible; no console errors; lip motion still needs voice-on check |
| `1_4_001_01` | `public/data/compiled/1_4_001_01.json` | 432 | long branch/call/talk flow, repeated choice labels, phone route continuity, broader state replay, `102sha` icon/silhouette separation | 145 `stage`, 38 `text_disable`, 8 `choice`, 132 `camera_zoom`, 1 `screen_effects`, 74 multi-spine steps, choices at steps 37/40/107/180/186/247/387/430; `image_icon: 102sha` persists from displayed steps 2-432; `102sha_001_00` appears as a spine from displayed step 23 but has no current public Spine asset | fail: browser confirmed persistent top-left icon; raw/compiled confirm missing formal render asset for president silhouette; displayed 19->20 has no data-layer bg/camera move |

## Initial Step Evidence

### `1_1_013the_02_1_1_013_02`

- Steps 4-8 are silent `stage` steps before the first Ren dialogue.
- Step 5 introduces `038tak,039mcr`; steps 6-7 keep them through non-dialogue staging.
- Steps 14/16 carry `text_disable` transitions with retained `040ren`.
- The scenario has dense heart-voice/background transition coverage: 43 `bg_dof` steps and 147 `bg_color` steps.

Manual checks:

- Verify the intro does not jump directly to Ren dialogue.
- Verify footsteps and silent stage SE are audible.
- Verify `camera_resetzoom` returns over duration, not a hard snap.
- Verify heart-voice transitions hide the dialogue box and do not leave stale blur/color.

### `1_1_015leg_04_1_1_015_04`

- Step 11 has `045sor,046chr` together after staged entrance.
- Many early `stage` and `text_disable` steps preserve both visible characters.
- The scenario has 38 camera zoom-bearing steps, useful for background clamp regression.

Manual checks:

- Verify non-speaking characters remain on screen unless faded/deleted.
- Verify back navigation skips automatic transition steps and lands on meaningful dialogue.
- Verify camera zoom under 1.0 does not expose black borders.

### `1_4_001_00`

- Step 19 introduces `001tom,004ter,047shu` together under camera zoom `0.8`.
- Steps 20-24 keep all three characters through ADV dialogue.
- This is the core adult/child lip rig comparison sample.

Manual checks:

- Verify `047shu` lip-sync remains normal.
- Verify `001tom` and `004ter` mouth internals do not stretch outside the mouth.
- Verify tooth/tongue attachments are not manually scaled with the mouth opening.

### `1_4_001_01`

- Contains 8 choice steps, including known repeated label risk areas.
- Step 107 is a choice step; earlier notes identified this region as a phone route continuity check.
- Contains `call`, `talk`, `choice`, `stage`, `adv`, and `text_disable`, making it a good end-to-end navigation sample.
- Displayed `20 / 432` currently shows a floating top-left `102sha` icon because `state.image_icon` is rendered by `SpineStage.vue` and the aggregate keeps `image_icon: 102sha` from displayed steps 2-432.
- The president stage silhouette is a separate path: raw declares `idol_model 102sha_001_00` and later `idol_fadein 102sha`; aggregate compiled emits it from displayed step 23, but `public/assets/spines/102sha_001_00` is missing.
- Displayed `19 -> 20` keeps the same `bg001_315pro_in_11` and camera `zoom=1, offset_x=0, offset_y=0`; no raw/compiled background-shift command was found.

Manual checks:

- Verify repeated phone/talk labels resolve to the next matching label after the choice, not a later duplicate.
- Verify call/talk UI survives choice transitions.
- Verify fast forward/back does not replay stale screen effects or stale camera state.
- Add a targeted Pixi dump for background and camera containers before rechecking the reported displayed `19 -> 20` background shift.

## Browser Evidence - 2026-07-08

The app was checked through the local Vite page with direct scenario URLs. The
standard DOM snapshot helper was unavailable in the in-app browser, so evidence
came from browser evaluation, screenshots, and captured console logs.

| URL parameters | Observed result | Notes |
|---|---|---|
| `scenario=1_1_013the_02_1_1_013_02.json&startStep=5&noVoice=1` | Rendered `ADV` at `10 / 202`, speaker `牙崎 漣`, visible stage canvas, no app console errors. | Auto-advance moved past the requested start step, so this confirms direct loading and render health rather than a frozen step-5 state. |
| `scenario=1_4_001_00.json&startStep=19&noVoice=1` | Rendered `ADV` at `20 / 60`, three characters visible, no app console errors. | Useful visual anchor for the three-character lip rig sample; actual lip movement was not verified because voice was disabled. |
| `scenario=1_1_015leg_04_1_1_015_04.json&startStep=11&noVoice=1` | Rendered `ADV` at `12 / 252`, multi-character stage visible, no app console errors. | Confirms the scenario still reaches a nonblank rendered stage after the scene-state extraction. |

Remaining browser checks:

- Re-run `1_4_001_00` with voice enabled to confirm mouth internals and lip-sync
  behavior.
- Validate `1_4_001_01` choice/phone branches, especially repeated labels around
  steps 37, 40, 107, 180, 186, 247, 387, and 430.
- Add a slower/manual pass for `1_1_013the_02_1_1_013_02` intro audio because
  the smoke check intentionally disabled voice.

## Status Rules

- `pending`: compiled evidence exists, but visual/runtime proof has not been recorded.
- `pass`: browser/runtime proof confirms the expected behavior.
- `fail`: browser/runtime proof contradicts the expected behavior.
- `blocked`: the sample cannot be checked because a required asset or runtime dependency is missing.

Update this ledger whenever a sample is manually validated or a regression is found.
