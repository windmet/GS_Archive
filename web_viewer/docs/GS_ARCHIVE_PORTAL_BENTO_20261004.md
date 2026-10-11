# Desktop portal Bento acceptance — 2026-10-04

Input HEAD: `da713bc9`; branch: `codex/portal-idol-controller-20261004`.

## Delivered behavior

- Compact title, explicit global/idol segmented control, global search, language and settings share the desktop toolbar. Counts and contextual search chips share the second layer. Below 920px of available portal width, search gets its own row.
- The favorite badge belongs only to the saved favorite; temporary lenses are labeled as idol archives. The scope picker has an explicit favorite entry. Browsing another idol does not save them as the favorite.
- Idol identity and artwork have separate grid slots. Default portraits use the 49 original single-person story sprites, rendered at 222px height. Birthday art remains selectable, including the existing shared W birthday artwork and its positioning.
- The idol card shelf is a Bento composition: source landscape, second portrait, third compact card and complete-directory tile. Landscape art uses contain with a blurred source backdrop; source faces are not cropped to fill the tile.
- Related songs use one vertical list and display every related song. Minori's five songs remain five visible rows.
- Global navigation uses 16 official unit colors with permanently visible members. Global card exploration includes landscape art, a date-stable encounter with explicit redraw, and exact attribute/rarity filters.
- Global stories combine the main chapter index with the six shared story-catalog gateways. Chapter 3 is explicitly unimplemented. Gateway counts are 342 / 49 / 49 / 152 / 44 / 4, with their original units.
- Global songs have category navigation and a vertical list. All five configurable-formation representative songs display **315 ALL STARS**. Fixed unit/special lineups retain source performer names. This is a display label, not fabricated performer identities or a change to idol association.
- The global timeline samples actual event records and dates, including `410008` / K.now O.nly on 2022-04-30. It does not invent launch, anniversary or shutdown events.
- Full card/Spine Home and the compact mobile portal remain separate existing experiences.

## Source evidence and generated data

Portrait bundle: `../RAW/asset/image_chara_story_visuals.unity3d`, 4,526,646 bytes, SHA-256 `6dfb8922c40a729db0e803b80e6c2052900bc1316a4cec62e5b57b2fbbb069df`.

The bundle contains 49 matching Sprite/Texture pairs. All 49 promoted PNGs preserve native decoded artwork, total 10,054,263 bytes. Personal-story compiled filenames and master identity evidence bind each image to its formal idol. Registry source/PNG hashes, promotion checks, tracked binary policy and resource audit were refreshed. Binary owner release: `2026-10-04-portal-story-portraits-001`. No AI image generation or bitmap edits were used.

`scripts/promote-portal-story-portraits.mjs` prepares candidates and publishes batches of five through the existing bounded promotion gate. Already-published paths are protected by that gate; this is a promotion command, not a command to overwrite existing images on every build.

`scripts/generate-portal-card-facets.mjs READ_MODEL_ROOT` generates a small static attribute projection from 826 verified detail descriptors. It validates source bytes, SHA-256, resource identity and attribute ID/name. The browser binds each facet to both release and detail hash; stale facets cannot classify newer cards. Source release: `2a77a79a4a9b9cd850c48643941e0d492071a17830447e5ff136d3d670de0774`.

Actual counts: Physical 257, Intelligence 302, Mental 267; SSR 124, SR 505, R 148, N 49. Missing or stale attribute data disables classification rather than reporting false zeros.

The image relation catalog was regenerated against mounted RAW and the current tracked public set. This also refreshes previously stale candidate metadata for already-tracked resources; it does not modify those resource bytes.

## Code verification

Passed:

- `npm run build:check` — final Vite compilation in 18.66s; existing large-chunk warning remains.
- `node scripts/verify-portal-bento.mjs READ_MODEL_ROOT` — 49 identity/hash checks, exact 826 detail facets, stale release rejection, landscape capabilities, 16 official colors, deterministic encounter/redraw, shared gateway counts, timeline boundaries, five ALL STARS labels and unchanged Minori performers.
- `node scripts/verify-archive-portal-presentation.mjs --read-model-root READ_MODEL_ROOT`
- `node scripts/verify-raw-character-image-promotion.mjs`
- `node scripts/verify-raw-character-image-candidate.mjs`
- `node scripts/verify-image-bundle-relation-catalog.mjs`
- `node scripts/verify-tracked-binary-inventory.mjs`
- `node scripts/verify-story-readmodel-navigation.mjs`
- `npm run verify:portal-navigation`
- `node scripts/verify-home-portal-visits.mjs`
- `npm run verify:archive-startup-route`
- `npm run verify:archive-navigation-state`
- `npm run verify:home`
- `git diff --check`

`READ_MODEL_ROOT` is `E:/Web_build/GS_Archive_Domain_Work/ui-gallery-homeguard-readmodels-20261004`.

## Actual Browser acceptance

The in-app Browser used a separate temporary QA tab, leaving the user's original tab intact. `http://127.0.0.1:5208/` served the production code bundle from `.analysis/build-check`, existing public assets in place and the pinned external read models. The owned server was restarted after the final build. Final server PID was 46056.

| Coverage | Observed result |
| --- | --- |
| All 49 idol lenses | Every official story sprite loaded; rendered height approximately 222px; artwork/text slots did not overlap. |
| W | Default single-person portrait; birthday switch uses the shared pair; switching back restores the single sprite. |
| 1440×900 desktop | Compact toolbar, 8×2 unit matrix, source landscapes, permanent member portraits, full-width global story/music sections. |
| 1320×900 desktop | Single-row toolbar, approximately 50px tall; no horizontal overflow. |
| 1024×768 desktop | Four unit columns; two-row toolbar; Minori count denominators remain on one line; artwork is still 222px. |
| 1920×1080 desktop | Portal is capped at 1440px; eight unit columns; no horizontal overflow or broken portal images. |
| 390×844 mobile | Existing compact portal rendered; no desktop Bento or horizontal overflow; card shortcut opened the selected owner's catalog. This is browser viewport evidence, not a physical device test. |
| Global music | All five representative songs visibly carry 315 ALL STARS; Minori retains actual singer names and all five related rows. |
| Search open/close | Unit section top 167.64px and width 1226.36px stayed unchanged; portal height 2318px stayed unchanged. Overlay width 620px remained within the 1440px viewport. |
| Six story gateways | Each reached its existing domain/picker. Card gateway also retained the portal `from` after reload, and visible Back restored global lens plus search query. |
| Card / timeline details | Loaded source card and K.now O.nly event detail; visible Back restored lens/query. These return journeys were checked after detail content loaded. |
| Card filters | Physical reports 257; Physical + SSR reports 42, with two result pages. |
| Encounter | Same-day reload remained stable; explicit redraw changed from a Momohito card to a Toma card in the final bundle. |
| Console | No warning/error entries during the final bundle QA interval. |

Small screenshots and JSON observations are in `C:/Users/windm/.codex/visualizations/2026/10/04/01a105b6-49c6-75d2-8eb1-1051da3588ac/`: `portal-bento-minori-desktop.png`, `portal-bento-global-desktop.png`, `portal-bento-all-stars-songs.png`, `portal-bento-49-portraits.json`, `portal-bento-gateways.json`. Final build log: `E:/Web_build/GS_Archive_Domain_Work/portal-bento-build.log`.

The temporary QA tab was closed and viewport override reset. The user's own tab was not navigated back or closed.

## Acceptance boundary

This is production-code Browser QA with mapped assets, not a complete deployable media package or deployment. No `npm run build`, smoke/full public copy, or production publication was performed. No new claim is made about Spine long-session performance, audio playback, physical mobile devices or every existing archive detail. Unrelated untracked files and evidence are preserved.
