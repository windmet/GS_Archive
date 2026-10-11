# Archive domain UI local acceptance

Source/data producer input: `8b291bc6`. The verified model candidate is `E:/Web_build/GS_Archive_Domain_Work/domain-readmodels-r1`, release `b7a1cb2f0ff92c5044b24f23919c9597dbaa690d4d7887f99d1d3432d04cb634`; 8607 artifacts and 14,344-byte inline bootstrap. All artifact hashes, envelopes and descriptor dependencies were verified. No media corpus was copied.

New routes: `event_catalog`, `collection_catalog`, `photo_catalog`. Entry components are dynamic. Catalog and selected-detail requests use the existing release-pinned client, bounded cache, cancellation and retry. Collection identity is encoded as `entity=item:<id>` or `entity=honor:<id>`; photographer selection uses `photo_idol=<id>`. Source returns preserve nested archive context. Existing story-event IDs and card reward sections remain intact.

The reference concept is `C:/Users/windm/.codex/generated_images/01a0f332-32b8-77a3-a80a-85c85c723da4/exec-90b796b5-62aa-49a4-aad9-fc8a3e7d2e6d.png`, inspected using `view_image`. Implementation follows its cool pale-blue background, white panels, navy text, mint selection, left directory/right detail and source table. Existing archive sidebar/header remain. Reference-only example names, dates, numbers and illustrations are not adopted. Real configuration names remain Japanese. Media binding is explicitly pending rather than replaced with invented game art.

## Browser acceptance

Flow: portal -> collections -> selected item/honor -> related event -> typed reward -> collection -> source return. Also: complete event directory -> reprint/original event -> preserved story chapters; photography -> idol -> faces/poses -> scene groups and initial grants. Direct URLs, retry and narrow viewport are included.

Browser/IAB production-code acceptance used `http://127.0.0.1:5198/`, `.analysis/build-check` with existing public/external resources mounted, and the verified model candidate above. The server process was verified against its command line and owning port. Its receipts are isolated in `E:/Web_build/GS_Archive_Domain_Work/browser-qa-r1` and contain release/PID, status, bytes and response hashes. The old 5197 process was preserved. No Playwright fallback was used.

Verified journeys:

- Portal -> item 10401 -> source event 410001 -> ranking -> honor 30017002 -> return to event -> reprint `event:10019`: identities remain distinct, all 11 story chapters and their Reader links are retained.
- Event catalog -> CARNIVAL filter: 17 records. First event is `event:20001`, with its own materials and explicit absence of available reward details.
- Photography -> studio spot: three group-linked scene configurations. Pose tab -> idol 49: eight idol-specific pose configurations and correctly bound cue names. These are configuration checks, not a claim of played photo media.
- Honor direct URL -> injected one-shot 502 -> visible retry -> correct detail. This is the sole recorded app-console error, matching the deliberate fault; retry succeeded without a reload.
- Item/honor tab switches update selected entity in the shared URL. Direct selected-honor load positions the selected directory page; its button has `aria-pressed=true`.
- Card `001tom_ssr03`: previously missing skill 323 renders ten levels. Lv.1 reads 27 percent and Lv.10 45 percent with recovery 2 and six-second duration; no unresolved dXY placeholders. No live gameplay simulation is claimed.

Desktop viewport: 1440 x 1000. Narrow viewport: 390 x 844. Screenshots `honor-desktop.png`, `honor-mobile.png`, `honor-retry.png` and `skill323-mobile.png` are in the external receipt directory. Actual page title, meaningful DOM, absence of a framework overlay and target interactions were checked. Narrow-screen rendered widths matched scroll widths (page 375 px, panel 349 px, table 317 px): no horizontal overflow. The directory has a bounded scroll area; selected items scroll to their details on narrow screens.

Concept-to-render comparison inspected six points: pale-blue canvas, white panel surfaces, navy typography, mint active selection, directory/detail proportions and reward/source table anatomy. Copy diff: reference-only names, dates, metrics and artwork were replaced with source data; Chinese task labels and original Japanese names are deliberate. Existing dark sidebar/header replace the concept's invented top navigation. Missing media remains a truthful status, not generated game art. These intentional deviations preserve the established archive design. The implemented layout and controls were checked against the accepted reference at native desktop and narrow sizes; no material layout mismatch remained after correcting overly long mobile lists and selected-row positioning.

The HTTP receipt sample contained 182 requests, one injected 502, no read-model 404 and no direct unversioned domain-source request. Largest consumed versioned read model: 167,218 decoded bytes. All versioned requests were bound to the same release.

Verification: `build:check` and startup-budget/build audit passed; domain URL/detail identity tests, 1792 legacy navigation cases, source return/view restoration, event concurrency/retry, B002 59 documents/999 rows and 49 speaker names passed. Build output contains compiled application code only, with no public corpus copy. Artifact integrity checks covered all 8607 files; full read-model regression passed before UI work, with the added packed-page test separately verified.

No physical-device, real-photo-renderer, download/export or deployment acceptance is implied. PictureStudio and media binding remain subsequent work. Known-source completeness (including login day/group presentation) will be expanded in the next producer batch; absent mission/exchange tables are not fabricated. These remaining requirements keep the overall domain-expansion goal active.
