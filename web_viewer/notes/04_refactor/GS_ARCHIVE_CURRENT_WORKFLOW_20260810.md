# GS Archive current workflow closeout — 2026-08-10

Status: **ACTIVE COORDINATION ENTRY**

This note is the single recovery point for the current development sequence.
It separates repository state, branch-complete work, consumer evidence, and
future gates so that dated audits are not mistaken for today's queue.

## 1. Verified repository topology

| Surface | Verified state |
| --- | --- |
| `master` | `17d8c1a88df3f3a0b0ebce127775473a903068b2`; PR #36 is the latest merge |
| PR #37 | Draft, branch `codex/story-strict-v2-compilation-p2a`; audited pre-closeout head `acff9be` |
| PR #37 initial publication | release `2026-08-03-story-1-3-10001-01-001` |
| PR #37 timing repair | release `2026-08-09-story-1-3-10001-01-002`; current stable owner |
| authoritative v2 surface on PR #37 | 4 collections + 1 standalone / 30 artifacts |
| publication ledger on PR #37 | 3 release records / 2 stable logical IDs |
| bounded playback evidence | displayed step 8 and one real-audio sample are consumer-verified |
| Card semantic branch | `codex/card-skill-semantic-backfill-p1@327b87c`; two commits above `master`, no open PR |
| P2-B long soak | **NOT EXECUTED** |

The pre-closeout PR #37 Source Gate run `31322649377` failed at
`verify:archive-baseline:source-only` because the authoritative registry still
named release `001` while the generated publication manifest correctly named
release `002`. This is a registry ownership drift, not a failed publication or
an artifact-hash mismatch.

## 2. Non-negotiable boundaries

1. Existing release JSON and annotation JSON are append-only evidence. Fix the
   mutable current-owner registry; do not rewrite prior release history.
2. PR #37 now includes both the initial strict-v2 publication and the bounded
   compiler/Runtime timing repair. Its description and checks must reflect that
   actual scope.
3. Merge PR #37 with a normal merge commit. Do not squash or rebase-merge:
   publication records name `ca514df`, `e0a1eb`, `6dd93b1`, and related commit
   identities that must remain ancestors of `master`.
4. A source-only pass does not establish mounted RAW/media, full-collection
   audio, deployed-consumer, visual-transient, or long-soak acceptance.
5. Keep evidence labels exact: `consumer-verified`, `source-audited`, and
   `TODO consumer-check` are not interchangeable.

## 3. Ordered execution

### A. Close PR #37 before new feature work

1. Point `story-collection:1_3_10001_01` registry ownership to release `002`
   and update its evidence text.
2. Add `verify:story-step9-timing` to the GitHub Source Gate beside the Runtime
   foundation check. The gate must use a committed minimal RAW-command fixture;
   the mounted full Event RAW is an additional local check, not a CI dependency.
3. Synchronize `PROJECT_MAP`, the current baseline, Agent entry, notes index,
   README entry point, and PR body with the initial publication plus repair.
4. Run the complete source-only gate locally, push, and inspect the new Actions
   run to completion. A fix to the first failing step does not prove later
   skipped steps pass.
5. When the latest head is green, move PR #37 out of Draft only when ready for
   review, then merge with a merge commit and verify the post-merge `master`
   workflow.

### B. Integrate Card semantic P1 separately

After PR #37 is merged, refresh `codex/card-skill-semantic-backfill-p1` from the
new `master`, preserve its two-commit boundary, resolve README/PROJECT_MAP
documentation overlap, repeat its machine and desktop/390px browser evidence,
and open a separate P1 PR. It must not be folded into PR #37.

### C. Rebuild the stable current-state entry

After both branches reach `master`, preserve
`CURRENT_ARCHIVE_BASELINE_20260728.md` as dated evidence and create a stable
`CURRENT_ARCHIVE_BASELINE.md` that contains only current branch/PR ownership,
current counts, current open gates, and the next authorized batch. Historical
PR chronology remains in dated notes.

### D. Strengthen semantics before the next strict-v2 collection

Do not authorize another representative collection solely because parity and
publication mechanics pass. First build a timing-semantics regression matrix
containing both:

- unavailable/pending-fade Spine targets that must not extend or block a stage;
- legitimate long stage performances whose delayed choreography must remain
  long.

Then execute the P2-B 2–4 hour mixed Runtime soak with real audio, final-quarter
resource-curve evidence, and a quiet endpoint. Only after those gates should a
new strict-v2 representative collection be selected.

## 4. PR #37 closeout gates

Run from `web_viewer` unless noted:

```powershell
npm run verify:archive-baseline:source-only
npm run verify:authoritative-story-publications -- --source-only
npm run verify:publication-ledger
npm run verify:story-step9-timing -- --source-only
# With the full Event RAW mounted, also run without --source-only.
npm run verify:story-runtime-foundation
npm run verify:compiled-migration
npm run verify:story-schema
npm run verify:story-authoritative-publish
npm run build
git diff --check
gh pr checks 37 --watch
```

The full GitHub Source Gate remains the acceptance authority for the PR head.
Local individual commands are diagnostic evidence, not a substitute for the
latest complete Actions run.

## 5. Remaining consumer checks

- full-collection real-audio coverage: **TODO consumer-check**;
- directional-wipe steps 114/117 isolated visual evidence: **TODO
  consumer-check**;
- deployed/crawler/export/third-party consumers: **TODO consumer-check**;
- P2-B 2–4 hour Runtime soak: **NOT EXECUTED**;
- Card semantic P1 on post-PR-#37 `master`: rebase/conflict and renewed browser
  verification pending.
