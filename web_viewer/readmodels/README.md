# Read-model reconstruction, phase 1

This directory imports the executable core of the user-supplied
`GS_Architecture_Rebuild_20260925.zip` guidance package at the current
`a6929d4` baseline. It builds versioned, bounded catalog projections from the
checkout's existing pure selectors. The copied kit's synthetic tests cover the
artifact writer, client, assembler and optional media helpers.

This is producer and client infrastructure. `App.vue` still uses
`loadArchiveData()` at startup. No public route has cut over, no Pages candidate
has been assembled or deployed, and a successful generator run alone does not
establish semantic parity or device acceptance. The package's route checklist
in `contracts/routes.json` remains the cutover inventory.

Run `npm test` here. For a real candidate, run the generator from this directory
with `--repo` pointing to the GS repository root and `--out` pointing to a new
directory outside that repository. Supply the currently published 64-character
`ARCHIVE_DATA_REVISION` and a media epoch matching the current corpus. The
generator rejects uncommitted changes in its source and generator paths; it
hashes all data inputs and rechecks them before accepting an artifact. Use
`node tools/verify_artifacts.mjs <candidate>` to verify the output. The
assembler continues to reject cutover while routes and device review are
unfinished.

The first integration targets are Portal/welcome/picker and Home, followed by
song catalog/detail. Route consumers must be changed before using any output
for a release. Keep generated assets outside the checkout until packaging is
deliberately approved under `docs/BUILD_ACCEPTANCE_POLICY.md`.
