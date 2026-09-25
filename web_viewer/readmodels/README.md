# Read-model reconstruction, phase 1

This directory imports the executable core of the user-supplied
`GS_Architecture_Rebuild_20260925.zip` guidance package. It builds versioned, bounded catalog projections from the
checkout's existing pure selectors. The copied kit's synthetic tests cover the
artifact writer, client, assembler and optional media helpers.

`bootstrap.inline.json` is the verified local r6 candidate's 11,509-byte bootstrap.
Vite embeds it in HTML. Portal, welcome, the idol picker, Home, the idol directory, song and gasha routes
can open without the legacy 21-source `/data` startup batch. Home loads its
index, selected idol detail and cue pages; it keeps duplicate cue IDs in source
order. Song routes load their index, pages and selected detail. The idol directory
uses the 49 bootstrap identities; idol detail loads its pinned catalog and one
per-idol view with profile, statistics, songs and events. Unit catalog/detail
load compact unit summaries and one selected unit detail. Gasha catalog/detail
load searchable pickup summaries and one selected announcement. Outgoing links to
unmigrated domains still prepare legacy data. Other routes
still prepare legacy data on entry. The full route cutover and dynamic feature
imports remain open.
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
