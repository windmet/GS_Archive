# Development Status - 2026-07-08

## 2026-07-13 Card Art and Archive Verification

- Added full archive verification via `npm run verify:archive` and surfaced the report on the data status page.
- Canonical scenario JSON parses at 3,402 / 3,402; canonical dialogue voice references resolve at 22,547 / 26,912.
- Card home voice cues resolve at 2,564 / 2,564; card scenario links resolve at 313 / 313.
- Mounted `ALL_PHOTOS` portrait and SSR landscape resources through `SIDEM_CARD_ART_ROOT` without copying about 1.2 GiB into the web project.
- Canonicalized ten duplicate tutorial/official card resource IDs, leaving 826 unique archive cards.
- Added URL-persistent card resource filters and moved the Spine animation console helper out of `App.vue`.
- Classified 291 intentional single-state SR cards from independent portrait and voice evidence. Their lone trained asset is now the canonical card face, blank/internal normal text is hidden, and the `_01_09` cue is attached to the single card-text block.
- The five 49-idol shared SR series plus 46 `グローリーモノクローム` cards account for the complete single-state set; unexpected missing normal portraits/icons are now 0.
- Card detail now supports clean/framed portrait switching, full-screen original-image inspection, keyboard navigation, and previous/next card navigation with stable URLs.
- Portrait resources were verified as 640 x 800 (4:5). Preview containers now preserve that ratio with `object-fit: contain`, fixing cropped framed-card edges on desktop and mobile.
- Corrected the card relation model: release timestamp equality is not an event-story foreign key, so the inferred `release_event` relation and UI jump were removed.
- Direct card stories now come only from `scenario_entries` (177 canonical cards, 313 / 313 resources verified). Separately, 389 cards form 8 same-title/same-release common series, verified at 8 / 8.

## Current Architecture

- `App.vue` remains the entry and archive/navigation surface.
- `StoryViewer.vue` is the playback coordinator and now delegates voice, timeline, navigation, and step scene effects to composables.
- `SpineStage.vue` is still the main Vue-to-Pixi adapter. Its highest-risk area remains `applyState()` and state synchronization.
- `PixiStageManager.js` is now mostly a facade over `BackgroundManager`, `CameraController`, `SpineManager`, and `LipSyncController`.

## Confirmed Decisions

- `cameraflare` is archived and must stay disabled. An extracted particle/flare implementation exists, but the web result is poor and should not be enabled, including through URL flags.
- Neck animation remains disabled. Do not attempt a motion-system rewrite yet; keep the current no-op behavior until the broader body/neck transition model is ready to be revisited.
- Encoding-review files have been copied to `_encoding_review/garbled_files_20260708/`. After review, the remaining items are mostly Markdown notes and may be Japanese resource text or display-encoding artifacts rather than true source corruption.
- Old `PixiStageManager.js.bak-*` migration backups were confirmed safe to delete.

## Current Validation State

- `npm run build` passes.
- The production build still reports the expected large chunk warning for the Pixi/Spine-heavy bundle.

## Next Debugging Direction

1. Classify encoding-review files before repairing anything: display-only, resource-text, true-mojibake, or obsolete-note.
2. Keep regression focus on known story samples:
   - `1_1_013the_02_1_1_013_02`
   - `1_1_015leg_04_1_1_015_04`
   - `1_4_001_00`
   - `1_4_001_01`
3. Continue treating compiled JSON as the first source of truth before debugging Vue/Pixi rendering.
4. Do not expand visual effects work until `image_bg_view_type` and remaining text asset semantics are verified against samples.
5. Follow `NEXT_STEP_GUIDANCE_20260708.md` for the next stabilization pass.

## 2026-07-10 Update

- `1_4_001_01` no longer shows the stale top-left president icon.
- The president silhouette fallback is connected and remains stable across consecutive dialogue steps.
- Runtime sampling confirms the reported transition near displayed step 17 is a foreground camera reset; the background layer remains unchanged.
- Masterdata coverage is now sufficient to begin a staged archive UI/navigation refactor. Follow `04_refactor/MASTERDATA_UI_RECONSTRUCTION_GUIDANCE_20260710.md`; keep playback direction owned by compiled scenarios.
- The first archive foundation pass is implemented: centralized data loading/validation, normalized story/card selectors, URL-backed navigation, refresh restoration, browser history, and card voice preview deep links.
- Browser verification found and fixed duplicate card ids and duplicate home voice cues at the selector boundary.
- The next refactor boundary is presentational archive components; keep `StoryViewer` and the stage runtime unchanged.
- The first presentational split is complete: archive home, shared list header, card list, and card detail now live under `src/components/archive/`.
- Card asset fallback moved out of `App.vue`; the entry component is down from roughly 1509 to 1156 lines without changing player behavior.
- Desktop and 390px mobile checks show no horizontal overflow in card list/detail views.
- Idol, group, file, unit, and episode directory views are now presentational components under `src/components/archive/`.
- `App.vue` is approximately 939 lines after removing migrated templates and dead scoped styles.
- The visual-equivalence split is complete. The next UI phase is a persistent `ArchiveShell` and cross-domain navigation, followed by interaction/catalog pages backed by the existing masterdata repository.

## 2026-07-13 Archive Direction Update

- Product direction is now方案 A: a SideM archive/database viewer with an independent story player, using Sekai Viewer as an information-architecture reference rather than recreating the original game home screen.
- `ArchiveShell` now owns navigation, title, search, and back behavior across all archive pages. Desktop uses a persistent sidebar; mobile uses a five-domain bottom navigation. Player and Spine lab remain full screen.
- The archive home now reports real index totals instead of presenting a game-home mockup.
- Card browsing supports URL-backed idol/rarity/query filters plus a remembered compact/grid preference. Duplicate raw card references are normalized before display and statistics.
- Idol profiles now have stable `idol_detail` URLs and aggregate authoritative masterdata fields with links to personal stories, cards, chat, and phone records.
- Story file rows now expose compiled availability explicitly. Missing compiled files remain visible but disabled.
- Smoke production build passes. Desktop 1440×900 and mobile 390×844 archive checks show no horizontal overflow or app console errors.
- `npm run manifest` now generates `public/data/archive_manifest.json`; the home page reads its counts and data timestamp. The next data task is to extend it from inventory totals into coverage/missing-resource reports.
- Follow `04_refactor/SEKAI_VIEWER_DIRECTION_GUIDANCE_20260713.md` for the active roadmap.
- The generated manifest now includes availability ratios, missing normal-card icon IDs, and evidence-based idol-to-unit membership. All 49 idols resolve uniquely from unit-story character frequency; `unit_relation_candidate_f32` was confirmed to be idol-order data, not a unit key.
- Idol and card character directories support a URL-backed 16-unit filter. Idol detail shows the derived unit while leaving masterdata untouched.
- `ArchiveStatus.vue` makes manifest coverage visible from the resources navigation and keeps Spine lab as an independent full-screen tool.
- `StoryViewer` and `SpineViewer` are now async chunks. The archive entry chunk dropped from roughly 783 kB to 153 kB, and the source production build no longer emits a greater-than-500-kB chunk warning.
- Coverage and derivation details are recorded in `04_refactor/ARCHIVE_COVERAGE_AND_UNIT_EVIDENCE_20260713.md`.
- A cross-domain story catalog now deduplicates 2,838 master rows into 1,394 compiled story entities. Domain, availability, sort, and query state are URL-backed; incremental display and player return restoration are verified.
- Parent event/chapter/unit titles are part of story search, fixing event-name queries whose title is not stored on the compiled row.
- Card detail now displays per-card ordinary/awakened icon and large-image availability from the manifest instead of silently presenting fallback art as complete coverage.
- The 16-unit catalog and stable unit detail routes aggregate representative backgrounds, evidence-based members, descriptions, and deduplicated unit stories. Member and story round trips are verified.
- Query and UI behavior is recorded in `04_refactor/ARCHIVE_QUERY_AND_UNIT_UI_20260713.md`.
- Card media interaction and the 4:5 portrait correction are recorded in `04_refactor/CARD_DETAIL_MEDIA_INTERACTION_20260713.md`.
- Card/event/series evidence and relation boundaries are recorded in `04_refactor/CARD_RELATION_EVIDENCE_20260713.md`.
