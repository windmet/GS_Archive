# Masterdata Archive Roadmap

Last checked: 2026-07-03

This note records what the decoded `client_master_data` can reliably add to the story archive, and how it should guide the next navigation pass.

## Generated Data

Extractor:

- `../data_pipeline/masterdata_extract.py`

Public frontend data:

- `public/data/masterdata/card_index.json`
- `public/data/masterdata/story_master_index.json`
- `public/data/masterdata/masterdata_validation_report.json`

Analysis-only data:

- `.analysis/masterdata/archive_summary.json`
- `.analysis/masterdata/040ren_ssr03_probe.json`

The source masterdata is XOR decoded with the repeating ASCII key `DefaultPassPhrase`. The decoded payload behaves like a protobuf stream with top-level table ids.

## Coverage

Latest validation:

| Area | Matched | Total | Coverage |
| --- | ---: | ---: | ---: |
| Main episodes | 204 | 204 | 100% |
| Idol story episodes | 491 | 491 | 100% |
| Card scenarios | 342 | 342 | 100% |
| Work story resources | 637 | 637 | 100% |
| Birthday episodes | 181 | 181 | 100% |
| Extra story episodes | 47 | 47 | 100% |
| Card voice cue audio | 2564 | 2564 | 100% |

The earlier extra-story false negative came from resources like `5_03_000_22_a` and `5_03_000_22_b`: the compiled archive contains the aggregate `5_03_000_22.json`, so the extractor now normalizes those suffixes to the base compiled resource.

Card archive counts:

- 836 cards total.
- 49 characters with cards.
- Rarity split: 53 N, 149 R, 507 SR, 127 SSR.
- 836 cards have card text.
- 826 cards have home voice cues.
- 177 cards have associated scenario/phone entries.
- 826 cards have unmapped card-only voice candidates.

## Newly Useful Fields

Masterdata can now serve as an archive metadata authority for:

- Story titles, resource ids, release/unlock timestamps, and compiled file mappings.
- Main, idol, card, work, birthday, and extra story grouping.
- Card id, card resource id, rarity, ordinal, title, character id, and release timestamp.
- Card normal/awakened/extra display text.
- Card home-touch voice cue ids with verified audio presence.
- Card-associated phone/story resources.
- Same-base voice candidates that likely include card-art tap voices.

## Navigation Recommendation

Use masterdata as the semantic layer and keep compiled index as the playback/file fallback.

| Family | Primary Source | Recommended UI |
| --- | --- | --- |
| Main story | `story_master_index.main` | Chapter -> episode/title -> compiled playback. |
| Idol story | `story_master_index.idol_story` | Idol -> chapter/title -> compiled playback. |
| Work story | `story_master_index.work` | Idol/job grouping -> title/resource -> compiled playback. |
| Birthday | `story_master_index.birthday` | Idol/date/year -> title -> compiled playback. |
| Extra | `story_master_index.extra` | Group -> episode title -> compiled playback. |
| Card archive | `card_index.cards` | Idol -> card -> card text, home voice, phone/story, card-only voice candidates. |
| Debug fallback | `public/data/compiled/index.json` | Raw file-oriented navigation when masterdata classification is not enough. |

Current frontend state:

- A `卡片档案` category exists.
- Card detail pages show card text, home voice audio, associated phone/story entries, and unmapped card-only voice candidates.
- Scenario file lists now load `story_master_index` and display masterdata titles/resource ids when available.

## 8_1 / 8_2 / 9_2

Current sample checks for `040ren`:

| File | Step Types | Voice | Lipsync | Read |
| --- | --- | ---: | ---: | --- |
| `8_1_x_040ren_8_1_1_040.json` | fadeout, talk, choice | 0 | 0 | Unvoiced idol interaction/profile-style text. |
| `8_1_x_040ren_8_1_2_040.json` | fadeout, talk, choice | 0 | 0 | Unvoiced idol interaction/profile-style text. |
| `1_x_040ren_8_2_2_040.json` | fadeout, talk | 0 | 0 | Short unvoiced idol text. |
| `3_x_040ren_9_2_040.json` | fadeout, adv | 0 | 0 | Very short ADV display. |

So `8_1` should not be merged into the SSR card voice bundle. For SSR card relations, prefer `card_index.cards[].voice_base`, `home_voice_cues`, `scenario_entries`, and `voice_candidates.unmapped_card_only`.

## 040ren SSR03

Confirmed card:

- `resource_id`: `040ren_ssr03`
- `card_id`: `1440003`
- `title`: `薄闇が包む退屈`
- `rarity`: `SSR`
- `voice_base`: `2_4_040_03`

Confirmed associated phone/story entries:

- `2_4_040_03_09_b` -> `040ren_403_2_4_040_03_09_b.json`
- `2_4_040_03_09_a` -> `040ren_403_2_4_040_03_09_a.json`
- `2_4_040_03_09_c` -> `040ren_403_2_4_040_03_09_c.json`

Likely card-art tap voice candidates:

- `2_4_040_03_01_01`
- `2_4_040_03_01_09`
- `2_4_040_03_02_00`
- `2_4_040_03_03_01`
- `2_4_040_03_03_02`
- `2_4_040_03_03_03`
- `2_4_040_03_04_01`
- `2_4_040_03_04_02`
- `2_4_040_03_04_03`
- `2_4_040_03_04_04`

## Camera And Direction

Masterdata is strong for identity, grouping, titles, and resource matching. It is not the final source for detailed scene direction.

Use compiled scenario/raw direction data for:

- Camera changes.
- Spine model, face, animation, position, and visibility.
- Voice cue timing inside dialogue.
- Lipsync/adxlip path mapping.
- Screen fade/slide/effects.
- BGM, SE, environmental audio, ducking, and volume changes.

For camera polish, masterdata should answer "which story/card is this?" The compiled scenario should answer "how should this step play?"
