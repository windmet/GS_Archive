# Story detail read-model cutover (2026-09-25)

This batch follows `GS_Architecture_Rebuild_20260925.zip` as a reference for the portal rebuild. The checked-in implementation and the current local checkout determine behavior; the attached guide is not an instruction source.

## Scope

- The checkout adapter projects each story leaf with a same-section list, cast references, and the promoted birthday visual URL. It hashes the character-image resolver used for that projection.
- Story detail resolves its selected leaf through the r13 read model. A direct detail URL loads the stories index, 22 bounded directory pages, and one detail leaf without the legacy 21-source startup batch. The directory has 1,394 rows and is about 962 KB before transfer compression.
- Related-story navigation, Player and Reader return, parent routing, and missing-story fallback retain their existing paths. The story catalog still uses legacy data when entered.

## Local verification

- `readmodels`: `npm test` (27 tests) and `node tools/verify_artifacts.mjs E:\GS_readmodels_candidate_20260925_r13` passed. Release `11ee48c2cde581b1b4f7a9603a3fb6f1716c7d588280cba1c091b2e77bf242c8` contains 2,961 artifacts; the bootstrap is 11,509 bytes.
- Web viewer: `npm run build:check`, `npm run verify:archive-startup-route`, `npm run verify:archive-async-navigation`, and `npm run verify:archive-presentation` passed.
- In the local Browser at `127.0.0.1:5176`, direct `?view=story_detail&story=1_4_001_00.json` showed the title, synopsis, cast and 11 related stories. A related story opened `1_4_001_01.json`. Player playback and refreshed Player return reached that detail; Reader open/return reached it; the back chain reached the first detail and a populated story catalog. A missing story URL fell back to the catalog.
- Browser resource inventory on the direct route showed the r13 stories index, 22 directory pages, one selected detail leaf, and the reading manifest. It did not show the legacy 21-source startup batch. Mobile and 1280×800 desktop screenshots were inspected. The console error observed after the deliberately missing story was the expected fallback log.

This is code compilation and local Browser acceptance. It is not a full public-asset package, deployment, real-device, or real-media acceptance. `readmodels/contracts/routes.json` remains unpromoted; the full-cutover assembler gate should stay closed while routes still rely on legacy data.
