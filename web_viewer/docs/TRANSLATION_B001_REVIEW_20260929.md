# B001 R3 reviewed text

The user confirmed on 2026-09-29 that they had read the complete local B001
trial and approved it as `reviewed` text. This approval applies to B001-main's
52 Reader documents, 42 runtime text catalogues, and 993 source-bound entries.
It does not mark other Studio batches, entity names, or Player text as reviewed,
and it does not grant `final` or deployment status.

The approved input is the R3 name-corrected Markdown with SHA-256
`bf69c8c9f613801c61bf8e26835c51d3a301333bf762ebe60c4f35faef37cc5e`.
The exact Markdown and machine-readable receipt are stored under
[`translation/studio/reviews/B001-main-r3-20260929`](../translation/studio/reviews/B001-main-r3-20260929).
The source batch was generated at `c6e52c1ff0f9b4dac98f7c50ff980e69c6467fbe`.
Promotion rechecked the current Reader, compiled and RAW identities against
all 52 batch documents, verified the trial file hashes and 993 unit hashes,
then wrote `status: reviewed` overlays to `public/translations/zh-CN/scenarios`.
The prior three draft entries in `1_4_001_01.json` had the same source hashes
but different wording; the approved B001 wording supersedes them. Their IDs
are listed in the receipt and the previous wording remains in Git history.

The Studio checker recorded 15 nonblocking language warnings. These include
unchanged source strings such as symbols, `appeal`, and Japanese quiz choices,
plus four lines with remaining kana. The user approved the whole rendered batch
after a read-through; the warnings remain visible in the receipt for later
editorial refinement. This is an editorial review record, not a claim that
each machine warning was separately annotated or that the translation is final.

Run `npm run verify:reviewed-b001` to check all 42 public files against the
receipt and current source identities. The local Reader server can show the
reviewed files on `127.0.0.1:5196` using the command in
[TRANSLATION_R3_READER_PILOT.md](TRANSLATION_R3_READER_PILOT.md).
