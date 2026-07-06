# Resource Catalog And Field Plan

Last checked: 2026-07-03

This is the working map for the local SideM Growing Stars archive resources found so far. Use it as the first stop when deciding which field/table/path should drive navigation, card pages, story playback, or future UI reconstruction.



---

# 2026-07-03 Addendum: Masterdata Field Authority And Agent Workflow

This addendum upgrades the roadmap from a resource list into an actionable field-recovery and asset-debug manual. The central rule is:

> **Do not infer identity from filenames first. Resolve identity from masterdata tables, then use filenames only as asset existence / playback fallbacks.**

The decoded masterdata is fully protobuf-readable after the `DefaultPassPhrase` XOR layer. The current audit found **47,204 top-level records across 158 top-level table ids**. Because the official `.proto` schema is not available, table/field names below are provisional but grounded by record counts, samples, and cross-resource matches.

## Confidence Notation

| Level | Meaning | Allowed Use |
| --- | --- | --- |
| High | Count, string samples, resource matches, and frontend validation agree. | Safe to generate public JSON and drive UI. |
| Medium | Strong resource/name pattern but still needs more cross-table validation. | Safe for debug panels and optional UI; keep raw table/field references. |
| Low | Numeric relation or nested bytes suspected but not decoded enough. | Do not drive UI yet; use only for probes. |

## Agent Ground Rules

When a local agent edits extractors, resolvers, or UI code, it must follow these rules:

1. **Never rename provisional fields as official schema names without keeping raw provenance.**  
   Good: `card_id_raw_f1`, `resource_id_f14`, `inferred_card_id`.  
   Bad: silently using `cardId` if the field has not been verified against multiple tables.

2. **Every generated semantic JSON should keep a `_source` object.**

   ```json
   {
     "resource_id": "040ren_ssr03",
     "title": "薄闇が包む退屈",
     "_source": { "table": 1, "fields": { "resource_id": 14, "title": 40 } }
   }
   ```

3. **Masterdata decides identity; compiled scenario decides playback direction.**  
   Masterdata: card/story/idol/unit/costume/title/release/resource identity.  
   Compiled scenario: camera, step order, dialogue timing, voice placement, lip path, BGM/SE/fade/effects, character positioning.

4. **Filename-derived mappings must be marked fallback unless masterdata confirms them.**  
   Example: `{chara_id}_002_00` can be a preview default model, but not proof that a card/home interaction uses that costume.

5. **Never merge `8_1`, `8_2`, or `9_2` into card SSR voice bundles just because the idol id matches.**  
   These are home/profile/short ADV interaction families unless a card relation table explicitly links them.

6. **For any newly decoded table, first add a small probe report before changing UI behavior.**  
   Recommended probe columns: `table`, `record_count`, `field`, `samples`, `matched_assets`, `candidate_meaning`, `confidence`.

## Masterdata Table Authority Map

Use this section as the first lookup table when deciding where a field should come from.

### Identity Dictionaries

| Table | Count | Inferred Role | Key Fields | Reliability | Recommended Output |
| ---: | ---: | --- | --- | --- | --- |
| 2 | 49 | Idol character profile dictionary | f1/f2/f3 numeric idol ids; f10 idol code like `001tom`; f12-f14 display names; f15 kana; f16/f17 age; f18 height; f19 weight; f20 birthplace; f21 CV; f23 hobby; f25 specialty; f26 color; f29 birthday; f30 zodiac; f31 former job; f32 likely unit/order; f33-f35 asset/id relations | High for strings and profile fields; Medium for numeric relation fields | `idol_unit_dictionary.json` |
| 24 | 16 | Unit master/profile | f1 unit id; f2 unit name; f3 unit code like `01jup`; f4 unit color; f7 kana; f8 description; f9 representative bg | High | `idol_unit_dictionary.json` |
| 29 | 13 | Special speaker/group labels | f2 labels like `315 ALLSTARS`, `プロデューサー`, `山村 賢` | Medium-high | `speaker_dictionary.json` |
| 100 | 30 | NPC/sub-character profile | f1/f3 NPC id; f2 name; f4 code like `101ken`; f5 category; f9 birthday if present | High for strings | `speaker_dictionary.json` |
| 101 | 2 | NPC profile text | f2 NPC id; f3 profile text; f4 nested code/name payload | Medium | `speaker_dictionary.json` |

### Card And Card-Voice Dictionaries

| Table | Count | Inferred Role | Key Fields | Reliability | Recommended Output |
| ---: | ---: | --- | --- | --- | --- |
| 1 | 836 | Card master / text / image resource | f1/f17 card id candidates; f2 character numeric id; f3 rarity enum candidate; f13 bracketed title; f14 card resource id like `040ren_ssr03`; f18 release timestamp; f19 normal text; f22 awakened/relationship text; f36 short quote/extra text; f40 title without brackets; f43 has voice flag candidate | High for resource/title/text/release; Medium for numeric enum meanings | `card_index.json`, `card_dictionary_raw.json` |
| 20 | 333 | Card skill master | f2 skill category; f3 internal name; other numeric effect fields | Medium | optional card skill tab |
| 23 | 61 | Leader skill master | f2 internal leader skill name; f3 display description | Medium | optional card skill tab |
| 43 | 342 | Card-associated phone/story relation | f1 relation id; f3 title; f4 resource id; f5 idol/story group numeric relation | High for resource/title relation | `card_index.cards[].scenario_entries` |
| 91 | 2564 | Card home-touch voice cue resources | f2 card id; f4 nested payload containing cue ids such as `2_4_040_03_00_01` | High after nested decode + audio existence | `card_index.cards[].home_voice_cues` |

Notes for `table 91`: field 4 is length-delimited nested bytes, not a plain string in the generic scanner. The existing extractor already decodes it well enough to produce 2564/2564 verified cue coverage. Keep the nested decoder isolated and tested.

### Story And Scenario Resource Tables

| Family | Tables | Count | Resource Fields | Reliability | UI Use |
| --- | --- | ---: | --- | --- | --- |
| Main story | 4 / 5 / 6 | 3 / 22 / 204 | table 6 f6 like `1_4_001_00_a` | High | Chapter -> section -> episode |
| Idol story | 7 / 8 / 9 | 49 / 78 / 491 | table 9 f6 like `1_2_001_01_a` | High | Idol -> chapter -> episode |
| Event story | 11 / 12 | 36 / 396 | table 12 f5 like `1_3_10001_01_a` | High | Event -> episode |
| Unit story | 13 / 14 / 15 | 16 / 64 / 540 | table 15 f6 like `1_1_001_01_a` | High | Unit -> chapter -> episode |
| Work story | 53 / 54 / 55 | 4 / 441 / 196 | table 54 f5 like `1_5_001_00_0`; table 55 f5 like `1_5_001_01` | Medium-high | Work/job archive; needs grouping pass |
| Birthday | 76 / 77 / 78 / 80 / 86 | 4 / 181 / 181 / 181 / 78 | table 78 f5 like `1_8_001_01` | High | Birthday archive |
| Extra | 143 / 144 / 145 / 175 | 10 / 47 / 47 / 30 | table 145 f5 like `5_03_000_22_a` | High, with suffix normalization | Extra archive |
| Valentine | 159 / 162 | 149 / 4 | f5 like `5_01_001_22_a`, `5_01_101_22_a`; f9 title | Medium-high | Separate seasonal communication group |
| White Day | 165 / 168 | 149 / 4 | f5 like `5_02_001_22_a`, `5_02_101_22_a`; f9 title | Medium-high | Separate seasonal communication group |

Important: `5_03_000_22_a/b` and similar suffixes may compile into aggregate files such as `5_03_000_22.json`. Keep the existing suffix-normalization function but log both original masterdata resource id and normalized compiled resource id.

### Home / Interaction / Profile Families

| Table | Count | Inferred Role | Key Fields | Reliability | Recommended Output |
| ---: | ---: | --- | --- | --- | --- |
| 32 | 830 | Idol interaction/job communication unlocks | f3 unlock condition text; f9 base resource like `8_1_1_001`; f10 concrete resource like `8_1_1_001_01_01` | High | `home_interaction_index.json` |
| 34 | 97 | Birthday communication unlocks | f3 title; f9 base like `8_2_2_003`; f10 concrete resource | High | `home_interaction_index.json` |
| 90 | 1421 | Short ADV/profile/audio cue group | f1/f2 ids; f3 nested payload containing `9_2_*` style ids | Medium; nested decode needed | `short_adv_profile_index.json` |
| 104 | 245 | Home/idol interaction time-slot resources | f3 base like `8_1_2_001`; f4 concrete resource like `8_1_2_001_1_01`; f5/f6 time strings; f7-f16 numeric weights/params | Medium-high | `home_interaction_index.json` |
| 105 | 343 | Home schedule/time-slot rows | f4 base like `8_1_2_001`; f5 concrete resource like `8_1_2_001_0_01`; f7/f8 time range | Medium-high | `home_interaction_index.json` |

Operational rule: `8_1`, `8_2`, and `9_2` should become a **Home/Profile/Interaction** route in the archive. They are not card tap voices unless a future table explicitly links a cue to a card id/resource id.

### Costume / Spine / Motion-Adjacent Tables

| Table | Count | Inferred Role | Key Fields | Reliability | Recommended Output |
| ---: | ---: | --- | --- | --- | --- |
| 27 | 549 | Idol costume release/display master | f1 costume/idol asset id; f2 idol numeric id; f3 costume name; f4 description; f5 model resource id like `001tom_005_00`; f6 release timestamp; f7 relation id; f8-f10 flags/order candidates | High for resource/name/release | `costume_dictionary.json` |
| 28 | 714 | Costume master / resource id superset | f1 costume id; f2 idol numeric id; f3 costume name; f4 description; f5 model resource id; f6 release timestamp; f7 relation id | High | `costume_dictionary.json` |
| 57 | 554 | Idol commu/voice expression-like rows | f7 resource like `3_4_001_2_01`; f11 base like `3_4_001`; f13 expression string like `default`, `joy`, `happy`, `angry` | Medium; promising for face labels but not card voice yet | `expression_probe.json` first |
| 58 | 395 | Idol commu/voice variant rows | f7 resource like `3_4_001_1_01`; f12 base like `3_4_001`; f15 sequence like `0001` | Medium | `expression_probe.json` first |
| 176 | 25 | Face expression/evolution mapping | f3 base face like `face_default`; f4 evolution face like `face_default_evolution` | High for face-name mapping | `face_dictionary.json` |

Important: `table 27/28` should be connected to `costume_prefab_meta.json`. The resolver should expose:

```text
model_resource_id -> idol_id -> idol_code -> costume_name -> description -> release_time -> prefab_meta -> spine asset existence
```

This prevents the debug UI from showing only a raw model id such as `016sei_002_00` without knowing whose costume it is and whether it is expected to exist.

### Background / Picture Studio / Visual Asset Catalogs

| Table | Count | Inferred Role | Key Fields | Reliability | Recommended Output |
| ---: | ---: | --- | --- | --- | --- |
| 107 | 133 | Picture studio spot/background catalog | f2 spot name; f5 bg resource like `bg058_photostudio_in_01`; f7 description | High | `background_catalog.json` |
| 108 | 186 | Picture studio scene/background/effect catalog | f3 scene variant; f6 bg resource; f7 optional ADV effect like `fx_adv_rain`; f8 description/related bg | Medium-high | `background_catalog.json`, `effect_catalog.json` |
| 110 | 48 | Background resource list | f2 background resource id | Medium | background existence probe |
| 111 | 26 | Picture studio frame catalog | f2 frame name; f5 frame id | High | optional picture studio UI |
| 60 | 4 | Picture studio filter catalog | f2 filter name; f5 filter code | Medium-high | optional picture studio UI |
| 61 | 184 | Picture studio sticker catalog | f2/f7 sticker name; f5 sticker id | Medium-high | optional picture studio UI |
| 173 | 131 | Home/event banner/announcement link data | f5 banner prefix like `image_home_announce_event_10001_`; f10 link label when present | Medium | home/event banner resolver |

### Song / BGM / Audio Catalogs

| Table | Count | Inferred Role | Key Fields | Reliability | Recommended Output |
| ---: | ---: | --- | --- | --- | --- |
| 46 | 99 | Song/live music master candidate | f4 song code like `drvalv`; f5 song title; f6 kana; f8 credits; f9/f10 links; f23/f29 timestamps | Medium-high | `music_catalog.json` |
| 112 | 59 | Event song/BGM master | f2 title; f14 BGM resource like `bgm_ntalon_inst` | High | `music_catalog.json` |
| 133 | 56 | Seasonal/system BGM switching | f3/f4/f5/f6 BGM resource variants, e.g. `bgm_system_christmas`, `bgm_main_vd` | Medium-high | `bgm_catalog.json` |

Use these catalogs to display readable song/BGM labels. They should not override scenario step audio timing.

### Other Useful But Lower-Priority Tables

| Table | Count | Inferred Role | Key Samples | Priority |
| ---: | ---: | --- | --- | --- |
| 16 | 535 | Item master | `stamina_001`, item names/descriptions | Low for archive playback; useful for UI reconstruction |
| 38 | 23 | Product/currency/item category | `product_paid_currency`, `product_money` | Low |
| 39 | 1613 | Honor/title master | `honor_normal_...` names/descriptions | Low-medium for profile UI |
| 46 | 99 | Song/live master | See above | Medium |
| 53 | 4 | Work category master | physical/intelli/mental work categories | Medium for work archive |
| 64 | 638 | Generic UI text/localized string master | common error/empty texts | Low-medium for UI reconstruction |
| 75 / 87 | 19 / 19 | Skill/effect category text | live skill labels/icons | Low unless card detail skill tab is added |
| 84 | 471 | Event/logo/UI relation candidate | strings like `logo`, `element_background` | Medium for event page polish |

## Recommended Generated JSON Files

Add these outputs to the extractor pipeline in stages. Keep generated files under `public/data/masterdata/` only when stable enough for frontend use; otherwise put them under `.analysis/masterdata/`.

| Output | Source Tables | Stability | Purpose |
| --- | --- | --- | --- |
| `idol_unit_dictionary.json` | 2, 24 | Stable | One authority for idol id/code/name/unit/color/profile. |
| `speaker_dictionary.json` | 2, 29, 100, 101 | Stable-ish | Resolve dialogue speaker names, producer/Yamamura/Saito/NPC labels. |
| `costume_dictionary.json` | 27, 28 | Stable | Resolve Spine/model resource ids to idol + costume names. |
| `background_catalog.json` | 107, 108, 110 | Stable-ish | Resolve background ids to display names and picture-studio categories. |
| `music_catalog.json` | 46, 112, 133 | Stable-ish | Resolve BGM/song ids to titles/credits where possible. |
| `home_interaction_index.json` | 32, 34, 104, 105 | Medium-high | Separate `8_1`/`8_2` home/profile/birthday interactions from cards. |
| `short_adv_profile_index.json` | 90 plus compiled fallback | Medium | Handle `9_2_*` resources without mixing them into cards. |
| `seasonal_communication_index.json` | 159, 162, 165, 168 | Medium-high | Valentine/White Day communication families. |
| `face_dictionary.json` | 176, optionally 57/58 probes | Medium-high | Face name aliases/evolution names. |
| `.analysis/masterdata/table_probe_*.json` | any unresolved table | Analysis only | Preserve samples and matched assets before frontend changes. |

## Resource Resolver Priority Order

When resolving any story/card/audio/model asset, use this priority order:

1. **Masterdata semantic index**  
   Example: card resource id from table 1 f14; story resource from table 6/9/12/15/78/145; costume resource from table 27/28 f5.

2. **Generated frontend semantic JSON**  
   `card_index.json`, `story_master_index.json`, future `costume_dictionary.json`, etc.

3. **Compiled scenario index**  
   Used to check actual playback file, voice/lip counts, and normalized resource id.

4. **Asset filesystem/index scan**  
   `public/assets/...`, `public/spines-index.json`, voice/lip existence checks.

5. **Filename heuristic fallback**  
   Allowed only after steps 1-4 fail. Mark as `fallback: true` in debug output.

## Debug Triage Playbooks

### Card Voice Is Missing Or Misclassified

1. Start from `card_index.cards[].card_id`, `resource_id`, and `voice_base`.
2. Check `home_voice_cues[]` from table 91. Confirm `/assets/voice/{cue}.m4a`.
3. Check `scenario_entries[]` from table 43 and compiled scenario summaries.
4. Check `voice_candidates.unmapped_card_only[]` for same-base leftovers.
5. Do **not** pull `8_1`, `8_2`, or `9_2` into the card unless a relation table explicitly links them.
6. For lip sync, prefer compiled `step.dialogue.lip.path`; for card preview fallback use `adxlip/{chara_id}/{voice_base}/{cue}.json` only after URL/existence check.

### Story File Appears Missing

1. Read masterdata resource id from the relevant story table.
2. Run normalization: suffix resources such as `_a/_b` may map to aggregate compiled json.
3. Search `compiled/index.json` by exact id, normalized id, and family prefix.
4. If compiled exists but UI says missing, debug the resolver path, not masterdata.
5. If compiled does not exist, keep the row visible as semantic metadata with `playback_available: false`.

### Character Or Unit Name Is Wrong

1. Never patch the displayed name in UI code directly.
2. Fix `idol_unit_dictionary.json` generation from table 2/24.
3. Check whether the caller is using numeric idol id, `001tom` style code, or display name.
4. Add aliases only in dictionary generation, not inside Vue components.

### Spine / Costume Preview Looks Wrong

1. Resolve model id through `costume_dictionary.json` table 27/28 f5.
2. Confirm model exists in `public/spines-index.json`.
3. Confirm prefab metadata exists in `costume_prefab_meta.json`.
4. If model exists but position is wrong, use prefab/compiled scenario debug fields, not masterdata.
5. If model does not exist, fallback to `{idol_code}_002_00` only for preview and mark as fallback.

### Face / Animation Does Not Match Voice

1. Treat current `wait_loop + face_default` preview as a proof-of-association only.
2. Check compiled scenario steps if the voice belongs to story/phone.
3. Check table 176 for face alias/evolution mapping.
4. Probe table 57/58 for `3_4_*` resources and face-like strings.
5. Do not hardcode `_01/_02/_03/_04` cue suffix to a face/anim until a table or UI asset confirms it.

### Background Or BGM Label Is Missing

1. For background name: check table 107/108/110.
2. For BGM/song title: check table 112 first, then table 46 and table 133.
3. Do not use picture-studio display order as story playback order.
4. Scenario step still controls which bgm/bg appears at what time.

## Known Open Questions

| Question | Current Best Lead | Next Probe |
| --- | --- | --- |
| What exactly do card voice suffix groups `_00`, `_01`, `_02`, `_03`, `_04`, `_09` mean? | `_00` is verified home touch; `_09_*` is phone/story when table 43/compiled confirms; `_01-_04` are likely card-art/state voices. | Decode nested table 91 payload and compare all same-base audio names against UI screenshots or original home/card asset bundles. |
| Which table maps card voice cues to face/anim/model? | Not solved. Table 57/58 have expression-like strings; table 176 maps face aliases. | Search/probe for `2_4_040_03`, `face_`, `wait_loop`, `motion`, `home` in all decoded strings/nested payloads. |
| Where are lip JSONs physically sourced when dev URL works but public scan is 0? | Dev middleware/static resolver. | Trace Vite middleware, alias config, and extraction source. Document actual source root before finalizing path. |
| Are Valentine/White Day resources already included in `extra`? | Tables 159/162/165/168 show separate `5_01`/`5_02` communication resources, not identical to table 143-145 extra groups. | Build `seasonal_communication_index.json` and compare against compiled index coverage. |
| What are table 90 nested payload fields? | Likely profile/short ADV/cue grouping containing `9_2_*`. | Add a nested decoder and produce samples with decoded string fields. |
| What do table 27 vs 28 differences mean? | 28 is a larger costume resource superset; 27 is display/release/idol costume subset. | Diff resource ids and fields; label missing 28-only rows. |

## Extractor Implementation Checklist

Use this as an agent task list. Each item should be committed separately or at least isolated in a clear patch.

1. **Add raw table dump helper**
   - Input: decoded pb path, table id list.
   - Output: `.analysis/masterdata/table_{id}_sample.json`.
   - Must include field numbers, decoded strings, numbers, nested bytes hex, record index.

2. **Add `idol_unit_dictionary.json`**
   - Source: table 2 and 24.
   - Join by unit numeric id only after verifying against all 49 idols.
   - Preserve raw fields.

3. **Add `speaker_dictionary.json`**
   - Source: table 2, 29, 100, 101.
   - Resolve `idol_code`, NPC code, display name, category.
   - Allow compiled scenario speaker fallback.

4. **Add `costume_dictionary.json`**
   - Source: table 27 and 28.
   - Key by `model_resource_id` / `costume_resource_id` f5.
   - Attach idol info from table 2 by numeric id and/or prefix.
   - Add `spine_exists`, `prefab_meta_exists`, `source_table`.

5. **Add `home_interaction_index.json`**
   - Source: table 32, 34, 104, 105.
   - Group by idol and resource family.
   - Add compiled availability and voice/lip counts if compiled resources exist.

6. **Add `seasonal_communication_index.json`**
   - Source: 159, 162, 165, 168.
   - Group `5_01` as Valentine, `5_02` as White Day until proven otherwise.
   - Keep NPC/support rows separate from idol rows.

7. **Add `background_catalog.json` and `music_catalog.json`**
   - Source: 46, 107, 108, 110, 112, 133.
   - Use for labels only; never override scenario timing.

8. **Add frontend raw-field debug panels**
   - Card detail: show source tables/fields for card id/resource/title/voices.
   - Story detail: show masterdata id, normalized compiled id, voice/lip count.
   - Costume preview: show costume dictionary row + prefab metadata row.

## Frontend Integration Policy

| Feature | Safe Now | Needs Probe First | Do Not Do Yet |
| --- | --- | --- | --- |
| Card list/detail text/images/home voices | Yes | — | — |
| Card phone/story links | Yes | — | — |
| Card tap voice candidate tab | Yes, as candidate | Exact suffix labels | Hardcode face/anim |
| Home/profile interaction category | Base route yes | Exact schedule/conditions UI | Merge with cards |
| Costume names in Spine debug | Yes after `costume_dictionary.json` | 27-vs-28 distinction | Assume missing model means bad masterdata |
| Background/BGM display labels | Yes as labels | Full asset coverage | Override scenario playback |
| Picture studio reconstruction | Partial asset browser | Layout/compositing rules | Treat as story stage rules |
| Full home screen clone | Shell only | Touch motion/face/mood logic | Pretend preview is faithful |

## Minimal Agent Prompt For Future Field Work

Use this prompt when asking a local coding agent to extend extraction without guesswork:

```text
You are extending the SideM Growing Stars archive masterdata extractor. Follow RESOURCE_CATALOG_AND_FIELD_PLAN.md strictly.

Task:
- Decode only the requested masterdata tables.
- Preserve raw table/field provenance in every output row.
- Do not invent official field names; use provisional names plus `_source` metadata.
- Masterdata may drive identity/grouping/title/resource ids only. Compiled scenario remains authoritative for playback direction.
- Before frontend changes, generate `.analysis/masterdata/<topic>_probe.json` showing samples, matched assets, and confidence.
- Do not classify 8_1, 8_2, or 9_2 as card voice resources unless a relation table explicitly links them to a card id/resource id.
```

## Immediate Next Patch Recommendation

The highest-value non-risky patch is:

1. Generate `idol_unit_dictionary.json` from tables 2 and 24.
2. Generate `costume_dictionary.json` from tables 27 and 28.
3. Add a Spine debug overlay line:

   ```text
   model=016sei_002_00 / idol=信玄 誠司 / costume=ベーシックウェア / source=table28.f5 / prefabMeta=yes
   ```

This directly addresses the current debug pain point: the viewer should stop showing anonymous resource ids and should explain what each model/costume is before coordinate debugging begins.


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
