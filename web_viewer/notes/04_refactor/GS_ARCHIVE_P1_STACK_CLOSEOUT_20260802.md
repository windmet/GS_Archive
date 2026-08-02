# GS Archive P1 Stack Closeout

Date: 2026-08-02
Status: active merge-order contract
Stable base: `master@f82647ad7402b1f51dfdbd7674b1a15fb70abf35`

## Product direction

GS Archive is now a masterdata/RAW-evidenced archive portal. Story Runtime is
the deep interactive consumer, not the sole product surface. Story domains,
song metadata, community translations and mobile communication records are
first-class portal capabilities.

The immediate risk is the length of the stacked branch chain, not missing UI.
Do not add another feature batch on top of Mobile PR2 until the existing stack
has moved through review in order.

## Ordered closeout

1. **PR #32 / Story IA**
   - merge `codex/extra-official-taxonomy-p1` into `master` first;
   - required browser matrix and Extra image checks are executed and recorded;
   - the 14 Extra navigation images are `portal-asset` files;
   - inventory owner batches do not imply publication ledger transactions;
   - strict-v2 remains P2-A and the 2-4 hour soak remains P2-B NOT EXECUTED.
2. **Song archive/catalog**
   - rebase from the new master;
   - keep schema, 61 song identities, jackets, relation catalogs, catalog/detail
     pages and Idol/Unit cross-links in the archive PR;
   - move layered audio, mixer reconstruction, lineup sessions and custom singer
     slots to a separate experimental playback PR.
3. **Story Player UI PR1**
   - rebase after the Song archive PR;
   - retain only the desktop player shell, responsive ADV, light controls,
     Story Log and explicit debug gating;
   - preserve the documented bright-nameplate contrast exception and do not
     claim that visual exception as general accessibility compliance.
4. **Mobile UI PR2**
   - rebase after PR1;
   - include Talk/Call modules, choice continuity, Random Talk presentation
     index, Birthday/Idol Story canonical links and multi-viewport evidence;
   - do not move Runtime, timer, audio or browser-history ownership.

## Branch absorption rule

The following are intermediate construction branches, not independent merge
targets after their commits are present in the ordered stack:

- `story-community-action-p1`;
- `archive-breadcrumb-p1-ui`;
- `archive-breadcrumb-spa-p1`;
- `story-main-domain-landing-p1`;
- `story-extra-domain-landing-p1`;
- `story-birthday-domain-landing-p1`.

Do not delete a remote branch merely because a downstream branch contains it.
First verify its tip is reachable from a merged mainline commit, record it as
absorbed, then delete or archive it in a separate repository-maintenance step.

## Evidence boundary

- PR #32 browser acceptance is a short UI and route matrix, not Runtime soak.
- Source-only verifiers do not prove browser or real-audio acceptance.
- `noAudio` tests do not prove real-audio acceptance.
- P2-B 2-4 hour long stability remains **NOT EXECUTED**.
