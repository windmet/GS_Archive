# AI Studio R3 controlled translation trial

R3 adds an explicit `projection_version: 3` to the existing two-column
`GS-STUDIO-MD-V1` result contract. V1 and V2 renderers remain available for
their original source-bound batches. The active trial recipe and nine voice
profiles are versioned under `translation/studio/policy`; they are editorial
choices for this experiment, **not** public or official name approvals. The
unselected null term template remains separate. An external alias table is
still only a hashed reference and is never used for global text replacement.

The request includes all effective instructions in one `input.md`: trial
renderings, source-backed actor Voice, exact-form mention hints, communication
Mode, known choice entry T IDs, and a rule that each T cell keeps its own
source meaning. Mentions do not change Speaker or source identity. There is no
guessing from a sprite, a previous line, or a branch's likely exit. Positive
voice requirements and prohibitions have separate fields. Source text, hashes,
Producer macro handling, RAW, compiled, Reader, and public translations stay
unchanged.

From a clean committed HEAD, create the full set and the seven-document pilot:

```powershell
npm run translation:studio:prepare -- --out .analysis/translation-studio/run-HEAD-pilot3
npm run translation:studio:pilot -- .analysis/translation-studio/run-HEAD-pilot3
```

The pilot is `P001-r3-seven-docs/input.md`: 179 target rows from seven **whole**
Reader documents, retaining parent B001 T IDs. Use it in a fresh AI Studio
session without showing the old Chinese output. Save the unaltered answer as
`P001-r3-seven-docs/output.md`; fill `run-record.template.json` with only
observed model, settings, session and time facts. Unknown values remain null.
The full `B001-main/input.md` has 993 rows for the later controlled comparison.
The pilot cannot be imported as a completed full batch.

```powershell
npm run translation:studio:check -- .analysis/translation-studio/run-HEAD-pilot3/P001-r3-seven-docs
```

Structure and source/policy binding must pass before language review. Kana and
trial-term warnings are review leads, not semantic proof or automatic public
blocking decisions. Inspect the P0 pairs T000058–059 and T000874–875 and the
mentioned-person T000912; then review the remaining pilot in story order.
The supplied R1/R2 output files are immutable comparison material, never
silently substituted for a new R3 result. The supplied 31-case/118-unit list
includes KEEP and editorial cases, so it is not a 118-error gold set.

For an existing complete result, quality repair is separate from missing-ID
`repair.md`:

```powershell
npm run translation:studio:quality-repair -- .analysis/translation-studio/run-HEAD-pilot3/P001-r3-seven-docs T000058
# Send quality-repair.md to the model; save only the requested T rows as quality-patch.md.
npm run translation:studio:quality-merge -- .analysis/translation-studio/run-HEAD-pilot3/P001-r3-seven-docs
```

The map binds the request to the parent output hash and old translation hashes.
The merger rejects missing, extra or duplicate target IDs and broken Producer
slots, then checks the complete merged candidate. It writes
`output.merged.md` without replacing `output.md`; both remain unreviewed.
Linked cross-ID targets are requested together. Human semantic review still
decides agency, negation, tense, additions, humor and naming. Only a complete
parent batch that passes the normal check is eligible for local draft import;
neither a pilot nor an automated pass is a public translation release.

The R3 guidance ZIP was verified against its manifest at the audited
`2deda2ca7a0c` baseline. Its R2 text audit reproduced 993 parsed rows, 45
unchanged Producer slots, and 54 kana-bearing rows versus R1's 43. These
figures describe supplied output, not the quality or outcome of a new R3 model
run. Browser/Player translation acceptance awaits an actual new result.
