# GS Archive Current Baseline

Status: **AUTHORITATIVE CURRENT-STATE ENTRY**
Updated: 2026-08-13

This is the stable recovery entry for current repository state. Read it before
dated audits or migration handoffs. Dated notes retain evidence and chronology;
they do not override this file.

## 1. Repository ownership

| Surface | Current evidence |
| --- | --- |
| current product baseline | `master@8d434051026f5deffffaa5591b1f35010022514d` |
| latest product merge | PR #38, Card item/skill semantic backfill |
| preceding publication merge | PR #37, Event strict-v2 publication plus bounded timing repair |
| open product PRs at capture | none |
| product-baseline `master` Source Gate | run `31624876473`, PASS |
| current-state governance | stable entry enforced by the source-only baseline verifier |

<!-- current-product-baseline merge=8d434051026f5deffffaa5591b1f35010022514d pr=38 -->
<!-- current-state-governance source-only-verifier -->

The archive baseline report was generated at commit `6a71578`; its recorded
metrics remain accepted only because the current source-only baseline verifier
recomputes the tracked/current sections and proves that commit is an ancestor
of `HEAD`. It is not the current repository HEAD.

## 2. Current quantified boundary

- 3,398 RAW logical story groups and 4,939 valid RAW parts have unique public
  representation.
- 26,890 / 26,902 Story voice references resolve; the remaining 12 are authored
  dangling references.
- `public/data/compiled` contains 10,329 JSON artifacts. Artifacts are not the
  same thing as logical stories.
- authoritative Story Runtime v2 contains 4 collections + 1 standalone / 30
  artifacts.
- the publication ledger contains 3 releases / 2 stable logical IDs.
- masterdata contains 836 Card rows and 826 unique resources; all 826 resources
  are RAW-matched and represented by portal entities.
- the Card semantic consumer resolves 5 limit-break items, 160 normal skills
  and 53 center skills through exact table 16/75/130 joins.
- 183 PNG files / 49,123,497 bytes are tracked under the documented binary
  boundary.
- the RAW USM catalog contains 260 identities: 12 exact client relations, 166
  exact masterdata relations, 77 BackMonitor relations and 5 unresolved.

<!-- authoritative-v2-summary collections=4 standalone=1 artifacts=30 -->
<!-- publication-ledger-summary releases=3 stable_logical_ids=2 -->

## 3. Consumer evidence

`consumer-verified`:

- Event `1_3_10001_01` displayed step 8 advances without the former stall;
- one bounded real-audio sample for that Event was heard and confirmed;
- Card table 16/75/130 semantics render on `038tak_sr01` at desktop and 390px,
  with the Lv.1 -> Lv.10 interaction, console and overflow checked;
- PR #37 and PR #38 latest-head and post-merge Source Gates passed.

`source-audited` is not automatically `consumer-verified`. Decoded tables, AST
references, candidate mappings, schemas and green source-only checks establish
only their stated contract.

`TODO consumer-check`:

- full-collection real-audio coverage;
- isolated directional-wipe evidence for steps 114/117;
- deployed, crawler, exporter and third-party consumer acceptance;
- every masterdata item still marked TODO in
  `notes/05_exploration/MASTERDATA_UNUSED_TABLES_AUDIT_20260802.md`.

<!-- consumer-todo full-collection-real-audio directional-wipe deployed-consumers masterdata-audit -->

## 4. Open gates and next authorized order

1. The timing-semantics regression matrix is implemented: missing/pending-fade
   targets fail open, visible delayed cues can extend a short stage, and the
   published 7.5s/6.0s choreography remains long.
2. Next, execute the P2-B 2–4 hour mixed Runtime soak with real audio, final-quarter
   resource-curve evidence and a quiet endpoint.
3. Only after those gates, select another representative strict-v2 collection.

P2-B is **NOT EXECUTED**. A source-only gate, a short browser sample or a
`noAudio` run must not be upgraded to Runtime `release-accepted` evidence.

<!-- next-authorized-batch p2-b-runtime-soak -->
<!-- p2-b-status NOT_EXECUTED -->

## 5. Verification entry

Run from `web_viewer`:

```powershell
npm run verify:archive-baseline:source-only
npm run verify:card-semantic-dictionaries
npm run verify:story-timing-semantics -- --source-only
npm run build
git diff --check
```

Mounted RAW/media, real browser behavior and long-soak acceptance require their
own evidence; these commands do not substitute for them.
