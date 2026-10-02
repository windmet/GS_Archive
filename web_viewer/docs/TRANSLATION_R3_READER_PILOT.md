# R3 local Reader trial

This was the **local draft preview** of B001-main. The user approved all 993
rows as `reviewed` after reading the batch on 2026-09-29; the committed result
and receipt are described in [TRANSLATION_B001_REVIEW_20260929.md](TRANSLATION_B001_REVIEW_20260929.md).
The supplied R3 quality review contains 993 rows and a
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
python scripts/serve-studio-reader-preview.py --overlay .analysis/translation-preview/RUN --models E:/GS_ReadModels_QA/translation_strict_v2_20260929 --review-receipt translation/studio/reviews/B001-main-r3-20260929/receipt.json --port 5196
```

The server binds only to `127.0.0.1`, uses the reusable `build:check` code
output plus the existing `public` source tree. With `--review-receipt`, it
checks that every public reviewed entry matches the approved trial text and
serves the public overlays. Omit that option only to reproduce the old draft
trial. The `--models` directory must contain `bootstrap.inline.json` and
`pages/_catalog`, with a bootstrap identical to the current build. Other
scenario translations return 404 and use the app's source fallback.

The local server refreshes B001 reading-locator entries from the current
`public/data/reading/manifest.json` when the matching read-model candidate
contains older document hashes. It does not edit the candidate or public data.

Open a B001 Reader document, for example:

```text
http://127.0.0.1:5196/?view=reader&reading=1_4_001_00_a&reading_mode=translation
```

Switch among 原文、译文、双语 in the Reader. `build:check` is a code build without a full
public asset copy; this preview is not a deployable release package. Keep
Browser results and source/hash checks separate from content approval. A new
commit changes the batch HEAD guard, so regenerate and recheck before a new
preview export.
