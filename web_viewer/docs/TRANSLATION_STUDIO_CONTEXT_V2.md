# AI Studio translation context V2 trial

The V2 projector reads the already validated Reader rows and the published idol
dictionary. It gives the translator the **visible** Speaker, internal actor
Voice when independently resolved, and source-backed channel Mode. Hidden
Speaker labels remain `？？？` in the prompt and in Player presentation. An
internal Voice ID is guidance for tone, never permission to reveal a name in
the translated sentence. Conflicts and unresolved actors get no Voice ID. Choice
context includes known entry targets only; exits and reconvergence are unknown.

`GS-STUDIO-MD-V1` remains the two-column `ID | Chinese` answer contract.
`projection_version: 2` selects the contextual renderer. A batch without that
field still uses the original V1 renderer. Prepare records Reader/compiled/RAW
evidence, per-row context, context and policy hashes, and exact input hash.
Check recomputes those from current sources and policies before parsing output.
The 9 voice profiles in `translation/studio/policy` are explicitly proposed for
trial, and every Chinese term choice is pending. The external alias JSON is
versioned for provenance but is never used for global name matching.

From a clean committed HEAD, prepare a new local run:

```powershell
npm run translation:studio:prepare -- --out .analysis/translation-studio/run-HEAD-pilot2
```

Use that run's `B001-main/input.md` in a fresh AI Studio session and save the
unaltered result as `B001-main/output.md`. Record the actual displayed model,
settings and time separately; unknown settings stay unknown. Then run:

```powershell
npm run translation:studio:check -- .analysis/translation-studio/run-HEAD-pilot2/B001-main
```

The check writes `check-report.json` and `repair.md`. Structural failure blocks
draft import. Language warnings require review; `human_status: unreviewed` is
not changed by an automatic pass. Repair includes only missing T IDs as output
targets and labels C rows as read-only context. Import writes only under
`.analysis/translation-studio`, never to public translations. Human review and
publication are separate steps. A rebase or policy edit changes HEAD/digests
and requires a fresh batch; do not alter an old batch's commit or hashes.

The supplied `output-original.md` was retained byte-for-byte as first-round
evidence. On the a08f82e baseline it parsed 993/993 rows with zero structural
errors and 45/45 Producer slots. Automated review found 43 genuine kana rows
and 12 unchanged rows; 11 additional V1 kana warnings were false positives
from the middle dot in `ARROW・B`. These counts do not establish translation
quality. B001 stays 52 documents/993 rows in the controlled V2 comparison.
