# GS Archive current workflow closeout — 2026-08-10

Status: **ACTIVE COORDINATION ENTRY**

This note is the single recovery point for the current development sequence.
It separates repository state, branch-complete work, consumer evidence, and
future gates so that dated audits are not mistaken for today's queue.

## 1. Verified repository topology

| Surface | Verified state |
| --- | --- |
| `master` | `09e1ec02b65a9717c3687a6daa5d98f4ec8d9a75`; PR #37 merged with a normal merge commit |
| PR #37 final evidence | head `1d4974c`; post-merge Source Gate run `31327297546` PASS |
| PR #37 initial publication | release `2026-08-03-story-1-3-10001-01-001` |
| PR #37 timing repair | release `2026-08-09-story-1-3-10001-01-002`; current stable owner |
| authoritative v2 surface on `master` | 4 collections + 1 standalone / 30 artifacts |
| publication ledger on `master` | 3 release records / 2 stable logical IDs |
| bounded playback evidence | displayed step 8 and one real-audio sample are consumer-verified |
| Card semantic PR | Draft PR #38, branch `codex/card-skill-semantic-backfill-p1`; original commits `8742e1e` + `327b87c`, refreshed from `master` by merge commit `811f316` |
| P2-B long soak | **NOT EXECUTED** |

<!-- authoritative-v2-summary collections=4 standalone=1 artifacts=30 -->
<!-- publication-ledger-summary releases=3 stable_logical_ids=2 -->

The pre-closeout PR #37 registry drift is closed. Release `002` is now the
registry and publication-manifest owner; PR-head run `31325277234` and
post-merge `master` run `31327297546` both passed the complete Source Gate.

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

### A. PR #37 closeout — complete

The registry owner, committed timing fixture, source gate, documentation and PR
body were synchronized at `1d4974c`. PR #37 was merged as `09e1ec0`; its two
parents are `17d8c1a` and `1d4974c`, and the publication commits remain
ancestors of `master`.

### B. Integrate Card semantic P1 separately

The branch has now been refreshed from the new `master` without rewriting its
two original commits. Before opening its separate P1 PR:

1. keep the table 16/75/130 joins bounded to the existing Card detail consumer;
2. run its dedicated verifier, source-only baseline, production build and
   `git diff --check`;
3. run renewed desktop and 390px browser checks on `038tak_sr01`, including the
   Lv.1 -> Lv.10 interaction, console and overflow;
4. put `verify:card-semantic-dictionaries` in the Source Gate so the committed
   projection cannot silently drift;
5. push and inspect the complete PR-head Source Gate before merge.

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

## 4. Current Card semantic integration gates

Run from `web_viewer` unless noted:

```powershell
npm run verify:card-semantic-dictionaries
npm run verify:archive-baseline:source-only
npm run build
git diff --check
gh pr checks 38 --watch
```

The full GitHub Source Gate remains the acceptance authority for the Card PR
head. Local individual commands and the 2026-08-03 browser record are diagnostic
evidence, not a substitute for renewed post-`master` browser and Actions proof.

## 5. Remaining consumer checks

- full-collection real-audio coverage: **TODO consumer-check**;
- directional-wipe steps 114/117 isolated visual evidence: **TODO
  consumer-check**;
- deployed/crawler/export/third-party consumers: **TODO consumer-check**;
- P2-B 2–4 hour Runtime soak: **NOT EXECUTED**;
- Card semantic P1: post-PR-#37 refresh, local machine gates and renewed
  desktop/390px browser verification are complete; the independent PR-head
  Source Gate remains pending.
