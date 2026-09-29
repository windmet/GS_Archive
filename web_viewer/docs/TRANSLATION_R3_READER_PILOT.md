# R3 local Reader trial

This is a **local, unreviewed draft preview** of B001-main, not a public
translation release. The supplied R3 quality review contains 993 rows and a
name-only correction of ten タケル mentions to 武. Its 29 selected review groups
include unresolved semantic problems; the corrected file is therefore still a
draft. The active trial policy is now `trial-policy.v2.json`, recording 武 as a
source-form-specific trial rendering. V1 remains unchanged for provenance.

The local pipeline uses the ordinary source-bound Studio check and draft
import. Because 52 Reader documents map to 42 runtime text catalogues, the
preview exporter merges same-catalogue draft entries only when their RAW hashes
agree and unit IDs do not collide. It writes under `.analysis/translation-preview`.
No files under `public/translations`, RAW, compiled, or Reader are edited.

After generating a batch at the current committed HEAD and saving the raw
corrected output to `B001-main/output.md`:

```powershell
npm run translation:studio:check -- .analysis/translation-studio/RUN/B001-main
npm run translation:studio:import -- .analysis/translation-studio/RUN/B001-main
npm run translation:studio:reader-preview -- .analysis/translation-studio/RUN/B001-main --out .analysis/translation-preview/RUN
npm run build:check
python scripts/serve-studio-reader-preview.py --overlay .analysis/translation-preview/RUN --port 5196
```

The server binds only to `127.0.0.1`, uses the reusable `build:check` code
output plus the existing `public` source tree, and serves trial scenario JSON
from `.analysis`. It marks the page “R3 本地未审试译 · 仅 B001”. Other scenario
translations return 404 and use the app's source fallback. Open a B001 Reader
document, for example:

```text
http://127.0.0.1:5196/?view=reader&reading=1_4_001_00_a&reading_mode=translation
```

Switch among 原文、译文、双语 in the Reader. The preview server does not turn any
draft status into reviewed/final. `build:check` is a code build without a full
public asset copy; this preview is not a deployable release package. Keep
Browser results and source/hash checks separate from content approval. A new
commit changes the batch HEAD guard, so regenerate and recheck before a new
preview export.
