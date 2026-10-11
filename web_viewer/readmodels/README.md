# Read-model reconstruction, phase 1

This directory imports the executable core of the user-supplied
`GS_Architecture_Rebuild_20260925.zip` guidance package. It builds versioned, bounded catalog projections from the
checkout's existing pure selectors. The copied kit's synthetic tests cover the
artifact writer, client, assembler and optional media helpers.

`bootstrap.inline.json` is the verified local 2026-10-02 song-discovery candidate's
14,344-byte bootstrap (release `d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`).
The candidate preserves the current checkout's Reader locators, song attributes and gameplay detail,
and adds confirmed unit names, performer scope and bounded idol identities to all 60 song directory rows.
These fields match the existing song-detail presentation; configurable formations do not acquire a guessed singer.
Its 8,750 model files were byte-verified locally;
this does not grant full current-build route parity or physical-device acceptance.
The bounded song Browser checks and remaining metadata todos are recorded in
[the closeout](../docs/GS_HONOR_SONG_CLOSEOUT_20261001.md).
Vite embeds it in HTML. Portal, welcome, the idol picker, Home, the idol directory, song, gasha, card, event detail, seasonal campaign, work archive, idol story, story collection, story detail, story catalog and resource status routes
can open without the legacy 21-source `/data` startup batch. Home loads its
index, selected idol detail and cue pages; it keeps duplicate cue IDs in source
order. Song routes load their index, pages and selected detail. The idol directory
uses the 49 bootstrap identities; idol detail loads its pinned catalog and one
per-idol view with profile, statistics, songs and events. Unit catalog/detail
load compact unit summaries and one selected unit detail. Gasha catalog/detail
load searchable pickup summaries and one selected announcement. Card catalog/detail
load bounded summary pages and one selected card detail. Event detail loads its bounded
directory and selected event leaf, including reward cards, cast references and
episode queue. Story collection loads an 80-entry directory and one selected chapter leaf,
including legacy section aliases. Story catalog loads the 1,394-entry bounded story directory
and three source-derived landing projections; other unmigrated routes still prepare legacy data on entry. Story detail loads the bounded story directory
and one selected leaf, including same-section links, cast references and a
promoted birthday visual. Resource status loads one compact source-derived leaf
only when that route opens. Seasonal campaign loads four switch summaries and one
selected detail, with its source evidence retained in the technical panel.
Work archive loads a 49-person switch directory and one selected idol, preserving
the separate story/line modes and source evidence for technical details.
Idol story loads a 49-person switch directory and one selected story page.
Mobile communication loads a 49-person switch directory, a 16-unit directory,
and the selected personal, phone, unit, and random-topic route leaves.
Legacy group, file and Episode Zero URLs use source-derived aliases. A directory
loads only its selected group or unit; a file route loads one group leaf with
ordered file metadata and missing-file states.
Reader document routes now resolve one pinned locator and its same-story segments; story, collection, event, work and idol-story detail leaves carry their own matching reading entries.
The current route ledger records each component's import mode. Unit/card internal
story actions, unit card ownership lists, and card voice refresh now use bounded
read models. Remaining feature imports and the full route cutover remain open.
No Pages candidate has been assembled or deployed. The package's route
checklist in `contracts/routes.json` remains the cutover inventory.

Catalog indexes expose bounded `pages` and `searchPages` descriptor arrays.
Global search consumers must load all search pages within their own feature;
they must not report the first page's count as the full result count.

Run `npm test` here. For a real candidate, run the generator from this directory
with `--repo` pointing to the GS repository root and `--out` pointing to a new
directory outside that repository. Supply the currently published 64-character
`ARCHIVE_DATA_REVISION` and a media epoch matching the current corpus. The
generator rejects uncommitted changes in its source and generator paths; it
hashes all data inputs and rechecks them before accepting an artifact. Use
`node tools/verify_artifacts.mjs <candidate>` to verify the output. The
assembler continues to reject cutover while routes and device review are
unfinished.

On the next data release, regenerate this checked-in bootstrap from the verified
model candidate. The assembler rejects a code bundle whose inline bootstrap differs
from the model candidate. Keep generated assets outside the checkout until
packaging is deliberately approved under `docs/BUILD_ACCEPTANCE_POLICY.md`.

## Current-build audit and cutover checks

From `web_viewer`, run `npm run verify:cutover-routes` to validate all 32 public
routes and their evidence references in progress mode. Entry, data, internal
actions, player return, component loading, parity and device evidence are separate
dimensions. Historical local Browser samples do not grant current-build parity
or physical-device acceptance.

`npm run build:check` writes code under `.analysis/build-check/_app` and generates
`audit/startup-budget.json` and `audit/readmodel-cutover.json`. The reports bind
the emitted static entry closure, final chunk hashes/gzip sizes, retained legacy
modules/calls, source fingerprint, HEAD, release and reviewed route ledger.
`npm run verify:build-audit` validates this proof in progress mode; it may pass
with explicitly listed migration blockers. Source CI runs both progress checks.

CI uses `npm run test:source --prefix readmodels`, which explicitly skips the four
`[local-corpus]` tests requiring ignored real data. `npm test --prefix readmodels`
still runs all tests locally; a source-only pass never grants real-corpus parity.

For final acceptance use `node scripts/verify-archive-build-audit.mjs --final`
and `node readmodels/tools/check_cutover_routes.mjs` (without `--progress`).
The assembler supports `--bundle <code-output> --models <candidate> --check-only`
for strict validation without creating a staging directory. It still rejects
dirty source, forbidden initial imports, global legacy loading, unfinished
routes or missing device acceptance. No command here deploys the site.

See [the repair plan](../docs/GS_ARCHITECTURE_REVIEW_REPAIR_PLAN_20260927.md).
