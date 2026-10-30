# A2 responsive fixtures — development only

These JSONs are QA copies. They are not read-model projections, publication data, or a production entry.

- `extremes.json`: 47 ranked consumer metrics, original values, candidate-relative source paths, JSON Pointers, source SHA256 and population sizes; 2,657 input file hashes. Python `len` measures Unicode code points, not typographic width. An array rank measures actual item count. Event media ranks bound URLs, not object keys.
- Domain files: complete real entities for each independent maximum (`extremeEntities`), not a fabricated entity combining unrelated records. Select one with `?metric=...`.
- `reading.json`: exact raw rows and source-hash-matched translation entries. Local corpus association is **not proof of release completeness**. Reader may show phone/SMS; ADV Player samples require `field_kind=dialogue` and no phone presentation. Player Dense is a single dialogue boundary, not continuous playback.
- `tools.json`: release-pinned photo material IDs and chart descriptors. 6 actors + 32 stickers are **SYNTHETIC compositions/positions using schema limits**, not a real saved composition.

## Entries

`http://127.0.0.1:5198/scripts/qa/responsive-domains.html?domain=events&mode=Worst`

`http://127.0.0.1:5198/scripts/qa/responsive-reading.html?domain=reader&mode=Worst&lang=BILINGUAL`

`http://127.0.0.1:5198/scripts/qa/responsive-tools.html?domain=studio&mode=Dense`

Domain lab: idols, units, cards, songs, events, gashas, items, honors, currencies, costumes, tool-picker, live. Reading lab: reader/player. Tool lab: studio/chart. All modules reject non-DEV execution, and no production entry imports them. App.vue's existing border-box reset is mirrored in the QA container; production overflow hiding is deliberately not inherited. Production collection/reader styles are imported directly.

## State boundaries

| State | Actual transformation / limits |
|---|---|
| Normal | First source entity or small real catalog selection; not a median-distribution claim |
| Worst | Longest named consumed field; independent relation maxima selected by metric URL |
| Empty | Empty catalogs; nullable collection detail; event/gasha preserve required identity and trim named relations; empty chart difficulties produces the production unavailable state |
| One | Trims named relation arrays, not every nested array; keeps required identifiers and schema objects |
| Dense | Full idol/card/unit catalog or largest real relation entity; no arbitrary repeated business rows. Shared picker badge count 6 is SYNTHETIC. Studio uses schema maximum layers |
| Missing | SYNTHETIC optional image/description fields; collection identity retained. Studio removes optional pose/face thumbnails only, preserves canvas backgrounds. Reader removes speaker/overlay. If a domain has no corresponding optional prop, this mode does not prove a missing-resource scenario |
| Delayed | Domain/reading labs delay fixture resolution 1800ms: QA boundary only. Tool lab delays a real photo/chart request through an isolated test adapter |
| Error | Domain/reading labs reject fixture resolution: QA boundary only. Tool lab rejects one real request, permitting retry. These are not real outages |

Every transformed state is SYNTHETIC. Real missing overlays are separately selected by the no-translation metric. No meaningless long strings are generated. No mandatory nested schema object is deleted merely to force an exception.

## Reproduce / evidence

Run the three `build-responsive-*-fixtures.py` generators, then `python scripts/verify-responsive-fixtures.py`. The primary generator accepts `--candidate`; reading/tool defaults are explicit local paths and must be reconfigured for another installation. Verify the release binding before changing them.

`node scripts/collect-responsive-stress-browser.mjs --extrema`

`node scripts/collect-responsive-stress-browser.mjs --reading --extrema`

`node scripts/collect-responsive-stress-browser.mjs --tools --retry`

`node scripts/collect-responsive-stress-browser.mjs --tools --only=chart --modes=Worst --long --export-guard --scroll-end`

Options: `--only`, `--windows=320x720,1440x900`, `--modes`, `--metric`, `--all-difficulties`, `--open-filter`, `--last-page`, `--lang=CN`, `--output`, `--base`. Each run creates a new E: evidence child with input hashes, browser environment, screenshots and SHA receipts. `--scroll-end` uses the real scroll axis. `REVIEW_REQUIRED` is a candidate collection state, never a product PASS. Expected fixture error is not an application error recovery PASS. Studio retry now records `STATE_MISMATCH` when the canvas is usable but the expected saved layers are absent; this does not mean the app displays a loading spinner.

Readiness covers fixture identity/state, a mounted subject, font state and runtime exceptions. Visible image completion and broken images are recorded separately. Generic geometry still produces expected art-crop, scroll and hidden-pane candidates. The collector does not certify overlap, accessibility, CLS, audio, GPU performance, device keyboards or safe areas.

The studio lab temporarily writes the composition key on its local origin, restores the previous value on pagehide, and uses the collector's isolated disposable profile. Do not use a personal production browser profile for synthetic composition testing.

`responsive-stress-results-20261030.json` selects named evidence runs and verifies screenshot hashes. The named-run summarizer is a dated evidence receipt, not a generic future regression gate. Earlier setup attempts remain on E: and are excluded.
