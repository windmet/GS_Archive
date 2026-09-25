# Story catalog read-model cutover (2026-09-25)

The attached `GS_Architecture_Rebuild_20260925.zip` remains reference material. This batch follows the current checkout's selectors and the existing portal behavior.

## Product and route

- The producer projects the existing story selector's search, sort, availability and event presentation fields into bounded directory rows. It emits main, extra and birthday landing views as separate artifacts. Full story detail remains in its leaf.
- The catalog route loads the stories index, 22 directory pages and three landing artifacts. It uses the index's seasonal and work counts. Opening a selected ordinary story or event still loads its own detail route.
- Story collection back navigation now opens the read-model catalog while preserving the main, extra or birthday landing. Direct event detail back navigation also opens the catalog. The global search and its query survive ordinary story and event detail round trips.

## Verification

- Final local candidate: `E:\GS_readmodels_candidate_20260925_r15`, release `372fe3f2dc3153ff05e9fba2f81be781a25a2eeff4197f4b94b6f284dfbc4af7`. `verify_artifacts` verified 2,964 artifacts; the bootstrap is 11,509 bytes. Directory rows: 1,394 across 22 pages. The three landing artifacts are separately bounded.
- All 1,394 r15 directory rows were compared in source order against the current checkout selector for the 24 displayed/search/filter fields plus event code; mismatches: 0.
- The producer's 27 tests passed. Web viewer async-navigation and startup-route regressions and `npm run build:check` passed.
- Browser on local QA server `127.0.0.1:5176`: direct catalog showed 22 main stories and the existing gateway counts; main, extra and birthday landing URLs rendered their respective source-derived totals. Global search showed 1,394 entries and filtered `新たな夢` to one. The selected story and an activity opened their detail pages and returned to the prior catalog state. Chapter back returned to the main landing. Mobile and 1280×800 desktop layouts were inspected; no console warning or error was observed on the valid routes.
- The catalog's Browser resource inventory contained the index, 22 pages and three landings, with no legacy `/data` startup batch. A chapter journey also requested the reading manifest for its own feature.

This is source compilation and local Browser acceptance, without a full public-asset package, deployment, device run, or real-media acceptance. `readmodels/contracts/routes.json` remains unpromoted while other routes still use legacy data and the package-wide gates are incomplete.
