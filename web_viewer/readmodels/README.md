# Read-model reconstruction, phase 1

This directory imports the executable core of the user-supplied
`GS_Architecture_Rebuild_20260925.zip` guidance package at the current
`a6929d4` baseline. It builds versioned, bounded catalog projections from the
checkout's existing pure selectors. The copied kit's synthetic tests cover the
artifact writer, client, assembler and optional media helpers.

`bootstrap.inline.json` is the verified local candidate's 11,509-byte bootstrap.
Vite embeds it in HTML. Portal, welcome and the idol picker can render without
the legacy `/data` startup batch. Other routes still call `loadArchiveData()`
when entered; the full route cutover and dynamic feature imports remain open.
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

The next integration targets are Home and song catalog/detail. On the next
data release, regenerate this checked-in bootstrap from the verified model
candidate. The assembler rejects a code bundle whose inline bootstrap differs
from the model candidate. Keep generated assets outside the checkout until
packaging is deliberately approved under `docs/BUILD_ACCEPTANCE_POLICY.md`.
