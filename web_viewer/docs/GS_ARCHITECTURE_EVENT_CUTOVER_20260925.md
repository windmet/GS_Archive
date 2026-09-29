# Event detail read-model cutover, 2026-09-25

The guidance archive was treated as a reference. The active checkout remains the source of truth. This batch moves `event_detail` to a per-event read model while leaving story catalog and other unmigrated routes on their existing paths.

## Projection and route

- The producer now includes `raw_character_image_promotions.json` in its validated, hashed inputs and uses the existing `buildEventIdolReference` selector for event cast art. The UI retains the query-controlled raw candidate fallback, before the promoted asset and idol icon.
- Each event leaf carries its event record, master rewards, decorated story, episode queue, related cards, idols, units, and cast references. Direct route restoration and links from Home, idol, unit, card, and story views load the selected leaf. Event links to cards, idols, and units capture the prior route and clear event context after capture.
- The r8 candidate at `E:\GS_readmodels_candidate_20260925_r8` has release `24ab60bfe959c4bb244a02b3e29b3a00a68c6acae0274c7fb3abef6175a7ab45`. Artifact verification passed for 2,961 files. Its 36 event leaves contain 396 episode entries, 109 master reward-card IDs, and eight promoted cast references. Total event-detail decoded bytes: 791,435; the selected leaf is requested on demand.

## Verification boundary

- `node --test readmodels/tests/*.test.mjs`: 27 passed. `node tools/verify_artifacts.mjs E:\GS_readmodels_candidate_20260925_r8`: 2,961 verified. `npm run build:check` compiled source without copying the public corpus.
- Startup, navigation state, async navigation (including event selection races/retry), presentation, portal navigation, and route checks passed.
- In-app Browser on the local QA server: direct event 410001 and 430018; reward card, idol, and unit links; returns; the 430018 reading entry and return. After scrolling the mobile viewport, all three promoted Jupiter cast images loaded. QA server requests for the direct event used `/_catalog/.../events` plus the separate reading manifest; reading opened one `/data/reading/...` document. No old full `/data` startup batch was observed on these paths.

This is source and local Browser evidence. Story catalog, the broader route checklist, real-device review, full package and deployment are still open. `contracts/routes.json` remains unpromoted, and no Pages candidate was assembled.
