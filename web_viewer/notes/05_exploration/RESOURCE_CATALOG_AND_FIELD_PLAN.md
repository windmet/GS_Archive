# Resource Catalog And Field Plan

Last checked: 2026-07-03

This is the working map for the local SideM Growing Stars archive resources found so far. Use it as the first stop when deciding which field/table/path should drive navigation, card pages, story playback, or future UI reconstruction.

## Authoritative Indexes

| Resource | Local Path | Current Use | Notes |
| --- | --- | --- | --- |
| Decoded masterdata extractor | `../data_pipeline/masterdata_extract.py` | Produces story/card semantic indexes. | Source `client_master_data` is XOR decoded with `DefaultPassPhrase`. |
| Story master index | `public/data/masterdata/story_master_index.json` | Story title/resource/compiled mapping. | 100% matched for main, idol, card scenarios, work, birthday, extra. |
| Card index | `public/data/masterdata/card_index.json` | Card archive, card text, card voices, card scenarios. | 836 cards, 49 characters, 127 SSR. |
| Validation report | `public/data/masterdata/masterdata_validation_report.json` | Coverage gate. | Current story and card voice cue coverage are 100%. |
| Compiled index | `public/data/compiled/index.json` | Legacy/file fallback navigation. | Still useful for raw groups and debugging. |

## Story Resource Families

| Family | Resource Pattern | Masterdata Source | Compiled Source | Current Finding |
| --- | --- | --- | --- | --- |
| Main story | `1_4_*` | `story_master_index.main` | `public/data/compiled/*.json` | 204/204 matched. Some episode suffixes normalize to aggregate files. |
| Idol story | `1_2_*`, related `1_7`, `1_8`, `8_1`, `8_2` | `story_master_index.idol_story` plus compiled fallback | `public/data/compiled` | `8_1` and `8_2` samples are unvoiced idol/profile-style text, not SSR card bundles. |
| Card phone/story | `2_3_*`, `2_4_*`, especially `_09_*` | `card_index.cards[].scenario_entries` | `public/data/compiled` | Should be organized under cards when a card relation exists. |
| Work story | `1_5_*` | `story_master_index.work` | `public/data/compiled` | `1_5_040_02` has 6 voices and 6 lip curves in compiled data; not raw-missing. |
| Birthday | `1_8_*` | `story_master_index.birthday` | `public/data/compiled` | 181/181 matched. |
| Extra/seasonal | `5_*` | `story_master_index.extra` | `public/data/compiled` | Suffixes like `5_03_000_22_a/b` normalize to aggregate `5_03_000_22.json`. |
| Short ADV/profile | `9_2_*` | Mostly compiled fallback currently | `public/data/compiled` | `3_x_040ren_9_2_040` sample is short unvoiced ADV display. Do not treat as card phone voice. |

## Card Resources

### Masterdata Fields

| Field/Group | Meaning | Reliability |
| --- | --- | --- |
| `resource_id` | Card key, e.g. `040ren_ssr03`. | High. Also maps to card image names. |
| `card_id` | Numeric card id, e.g. `1440003`. | High. Used to connect card voice cue rows. |
| `character_id` | Idol key, e.g. `040ren`. | High. |
| `rarity`, `ordinal` | Rarity and per-rarity card number. | High. |
| `title`, `title_full` | Card title. | High. |
| `texts.normal`, `texts.awakened`, `texts.extra` | Card text fields. | High. Screenshot text for `040ren_ssr03` matched. |
| `voice_base` | Base voice folder/id, e.g. `2_4_040_03`. | High when home cues or scenarios exist. |
| `home_voice_cues[]` | Home touch voice cue ids. | High. 2564/2564 audio coverage. |
| `scenario_entries[]` | Card-associated phone/story records. | High. Includes compiled summaries with voice/lip counts. |
| `voice_candidates.unmapped_card_only[]` | Same-base voice files not mapped to home or phone/story. | Medium-high. Best current candidates for card-art tap voices. |

### 040ren SSR03 Anchor

| Item | Value |
| --- | --- |
| Card | `040ren_ssr03` |
| Title | `薄闇が包む退屈` |
| Voice base | `2_4_040_03` |
| Home voices | `2_4_040_03_00_01`, `_00_02`, `_00_03`, `_00_09` |
| Phone/story | `2_4_040_03_09_a`, `_09_b`, `_09_c` |
| Card-art tap candidates | `_01_01`, `_01_09`, `_02_00`, `_03_01`, `_03_02`, `_03_03`, `_04_01`, `_04_02`, `_04_03`, `_04_04` |

## Audio And Lip Sync

| Resource | Path/Rule | Current Count/Status | Notes |
| --- | --- | ---: | --- |
| Voice audio | `public/assets/voice/{cue}.m4a` | 32421 files locally | Card voice cue coverage from masterdata is 2564/2564. |
| Story dialogue voice | `step.dialogue.voice` | In compiled scenarios | Player reads this field. |
| Lip path | `step.dialogue.lip.path` | In compiled scenarios | Player reads this before trying derived paths. |
| Card lip path rule | `adxlip/{chara_id}/{voice_base}/{cue}.json` | Verified by URL for `040ren_ssr03` | Example `/assets/lipsync/adxlip/040ren/2_4_040_03/2_4_040_03_01_01.json` returns 200 in dev server. |
| Lip local source | `/assets/lipsync/...` | URL works, public directory scan found 0 | Need trace dev middleware/static source. Treat as a field-path rule already validated, but source location still needs cataloging. |

## Spine And Animation

| Resource | Path/Rule | Current Status | Use |
| --- | --- | --- | --- |
| Spine models | `public/assets/spines/{model}/comu.skel|atlas|png` | 2175 core files counted | Story playback and card voice preview. |
| Model list | `public/spines-index.json` | Includes e.g. `040ren_002_00`, `040ren_101_00`, etc. | Good starting point for model selection. |
| Current card voice preview | Synthetic one-step scenario | Uses `{chara_id}_002_00`, `face_default`, `wait_loop` | Works as first association of card voice + lip + spine. |
| Animation mapping | Not solved yet | Need map cue type to face/anim. | Future work: infer from home UI or card-related motion tables/assets. |

## Card Images

External source:

`E:\BaiduNetdiskDownload\SideM\GS_Res\ALL_PHOTOS\assets\resources\image\image_card`

| Type | Source Subdir | Naming Rule | Coverage/Size | Current Use |
| --- | --- | --- | --- | --- |
| Icon | `image_card_icon` | `image_card_icon_{resource_id}.png`, `...{resource_id}p.png` | 1361 files, about 41.5 MB. All 836 cards have `p`; 545 have normal. | List thumbnail and fallback detail image. |
| Portrait | `image_card_portrait` | `image_card_portrait_show_{resource_id}.png`, `...p.png`, plus `hide` variants | 2722 files, about 1.3 GB. All cards have at least one. | Optional detail large art. |
| Landscape | `image_card_landscape` | `image_card_landscape_{resource_id}.png`, `...p.png` | 248 files, about 561.7 MB. Covers 127 SSR. | Optional SSR wide art. |
| Local synced icons | `public/assets/cards/icons` | Same icon filenames | 1361 files locally, ignored by git. | Required for card thumbnails. |
| Local synced large | `public/assets/cards/large` | Source filenames preserved | Currently sample `040ren_ssr03`, ignored by git. | Detail page tries portrait large first. |

Sync helper:

```powershell
python ..\data_pipeline\sync_card_icons.py
python ..\data_pipeline\sync_card_icons.py --skip-copy
python ..\data_pipeline\sync_card_icons.py --resource-id 040ren_ssr03 --portrait --landscape
python ..\data_pipeline\sync_card_icons.py --rarity SSR --landscape
```

## UI And Other Visual Assets

| Resource | Local Path | Current Use |
| --- | --- | --- |
| Backgrounds | `public/assets/bg` | Story stage backgrounds. 400 PNG files counted. |
| Idol icons/mobile icons | `public/assets/idols` | Idol grid and mobile/call UI. 187 files counted. |
| Event logos | `public/assets/events` | Event list cards. 47 files counted. |
| Emoji/stamps | `public/assets/emojis`, `public/assets/stamps` | Chat/talk UI assets. |
| Units | `public/assets/units` | Unit display assets. |
| SFX/BGM/ambient | `public/assets/audio/...` plus resolver/middleware | Story playback. Needs separate complete catalog if rebuilding full UI. |

## Current Frontend State

Implemented:

- Masterdata-backed card archive category.
- Card list by idol with rarity filter.
- Card icon thumbnails and detail image fallback.
- Card text display.
- Home touch voice audio controls.
- Card-associated phone/story links with voice/lip summaries.
- Unmapped card-only voice candidates.
- Card voice preview using spine + voice + lip via synthetic StoryViewer scenario.
- Story file list enriched with masterdata titles/resource ids and voice/lip counts.

Important caveat:

- Card voice preview is not yet a faithful home-screen touch animation. It uses default model/face/`wait_loop`. It proves voice/lip/spine association, but the animation-expression mapping remains open.

## Field Investigation Priorities

1. Card voice type mapping:
   - Determine what `_00`, `_01`, `_02`, `_03`, `_04`, `_09` suffix groups mean.
   - Current guess: `_00` home touch, `_09_*` phone/story, `_01/_02/_03/_04` card-art or card-state voices.

2. Card voice animation/face mapping:
   - Find tables or assets that map card voice cues to `face`, `anim`, model costume, background, or UI state.
   - Search masterdata scan tables for card resource ids plus motion/face-like strings.

3. Home UI reconstruction:
   - Identify home screen background selection, idol placement, menu badges, stamina/currency state, and touch response logic.
   - The screenshot-style UI is feasible, but should be rebuilt as a resource-driven shell rather than hardcoded art.

4. Large card art policy:
   - Keep icons fully synced.
   - Sync portrait/landscape on demand by card or rarity to avoid committing or copying 1-2 GB by default.

5. Lip source catalog:
   - Dev URLs for lip JSON work, but local source directory is not yet cataloged in `public/assets/lipsync`.
   - Trace server/middleware/static source before documenting as final asset layout.

6. Story camera/effect fidelity:
   - Masterdata gives identity and grouping.
   - Compiled scenario state remains authoritative for camera, spine placement, face/anim, screen effects, audio, and lip timing.

## Suggested Build Strategy

Short term:

- Make archive navigation masterdata-first.
- Continue adding preview affordances where data is already linked.
- Add field-audit screens for selected card/story rows.

Mid term:

- Build a home-screen replica shell using existing bg/spine/menu assets.
- Drive character touch voices from `card_index` and/or home voice tables.
- Add card detail tabs: art, home voice, card tap voice, phone/story, raw fields.

Long term:

- Rebuild broader game UI modules only where archive value is high: home, cards, story, phone, chat, work.
- Keep data-driven resource resolvers so UI can survive naming fixes and newly found tables.
