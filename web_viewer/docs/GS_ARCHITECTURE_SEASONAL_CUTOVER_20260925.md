# Seasonal campaign read-model cutover, 2026-09-25

The attached guidance was used as a route checklist, not as authority over the checkout. This batch moves `seasonal_campaign` to its own four-row directory and one selected campaign leaf. The directory now includes `year` and `season` for the existing switch controls. The leaf retains introduction, participant episodes, playback metadata, and source table evidence for its technical panel.

The verified local r10 candidate is `E:\GS_readmodels_candidate_20260925_r10`, release `4a54fb773dfc74f8822f3156e2f4e29b1e987c88be261602074db4e1ee44e7a8`. Verification covered 2,961 artifacts. Its four campaigns contain 208 playback entities and 204 participant records. Their decoded leaf sizes are 47,077 to 94,877 bytes. `bootstrap.inline.json` remains 11,509 bytes.

Direct routes load the lightweight seasonal directory and selected detail without the old full `/data` startup batch. A missing or unknown `story_section` resolves to `valentine_2023` and normalizes the URL. Campaign switches use the selected read-model detail and reject superseded responses. Existing playback continues through the Player and returns to the selected campaign.

Verification: read-model unit tests 27/27, artifact verifier 2,961/2,961, `npm run build:check`, startup and navigation regressions, and the new async seasonal race/fallback test passed. In-app Browser at the local QA server confirmed direct default/unknown routes, 2022/2023 and Valentine/White Day switching, mobile layout, Player entry and return, and source table evidence visible in the technical panel. The direct route request log contained only the seasonal catalog and selected detail under `/_catalog`. Player showed one LipSync original-curve HTTP 404 warning; this short Browser path does not establish full media or device acceptance.

Story catalog still prepares legacy data, and full route cutover, dynamic feature imports, device review, package assembly, and deployment remain open. `contracts/routes.json` stays unpromoted.
