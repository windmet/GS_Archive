# RAW + Master Data Resource Migration

Date: 2026-07-26

## Decision

The migration source of truth is now split by responsibility:

- master data defines semantic identity and relations;
- `RAW/asset`, `RAW/audio`, and `RAW/movie` provide the original physical resources;
- organizer-created exports such as `ALL_PHOTOS` and grouped audio folders remain regression references, not identity authorities;
- published paths under `public/` stay unchanged until an isolated candidate passes comparison and 5174 browser verification.

`RAW/` is extracted at the repository root and ignored by Git. The verified
archive contains 13,000 files: 8,639 asset bundles, 4,098 audio files, 260 movie
files, and 3 source URL text files. Archive-to-disk verification found no
missing, extra, or size-different members.

## Source-contract first slice

The first supply-chain consolidation slice is now implemented:

- `data_pipeline/archive_paths.py` resolves explicit, environment, ignored
  local, and repository-default source paths;
- `web_viewer/config/archive_sources.example.json` is committed;
- `archive_sources.local.json` is ignored and records this machine's verified
  RAW, XOR masterdata, and decoded masterdata paths;
- `raw_source_manifest.py` preserves explicit CLI overrides, refuses to write
  inside RAW, and emits a schema-v2 summary;
- source records now carry `raw-authoritative` or `archive-metadata` status;
- summary evidence includes section bytes, full manifest hash, portable
  content identity, duplicate-path detection, unexpected-file detection, and
  masterdata hash validation;
- `masterdata_extract.py --input-state xor|decoded` prevents decoded PB from
  being XORed a second time;
- `verify:archive-sources` is part of the GitHub Source Gate.

The real rebuild preserved all 13,000 prior path/size/hash identities:

```text
manifest_sha256 =
b1bcccfd89b31cf06e255ab8f65be7029ff114502b9a492e56a98cd904f60a1c

content_identity_sha256 =
911de151d6ced2259c8065047da3ea20d9f5795c2f5a09bb109174a30d256e24

case-insensitive duplicates = 0
unexpected files = 0
RAW WAV = 0
```

The external XOR masterdata and ignored decoded PB also pass configured hash
checks. Isolated `xor` and `decoded` CLI runs generated identical decoded PB
and base music-catalog hashes.

### Configured image-domain tools

The next bounded source-contract slice moved the card, ADV-background, and
character-image audit/candidate pairs onto `archive_paths.py`. Explicit
`--raw-root`, masterdata, public, inventory, and output arguments remain final
overrides.

Real no-argument runs preserved:

- card coverage: 836 rows and 826/826 unique resources;
- background coverage: catalog 192/192 and story IDs 356/356;
- character-image coverage: 57 bundles and 485 unique paths;
- `001tom_r01`: 8 textures, 8 sprites and 8 resolved assets;
- `bg001_315pro_in_01`: resolved hash
  `a2ae5b2637082928b30da11c824c2259623aec3f07bbc4c590632b311f340d65`;
- `002sht`: `475x783`, hash
  `a83344e535e4292a8f0b1dac5d3c3b9951d0a05c32c5fc225dc5eea501fc0631`.

The card and character reports match their pre-change semantic payloads.
Background coverage and identity sets also match; the only difference from
the 2026-07-26 report is a later compiled-corpus reference-count increase for
`bg091_315prolounge_in_01` (`6,730 -> 6,768`).

### Configured Vite legacy paths

Commit `1aab133` added a JavaScript reader for the same ignored source config.
Vite's lipsync/audio/legacy-voice/card-art proxies and the archive manifest
generator no longer contain developer drive paths. They derive from
`legacy_root`, while per-domain environment variables remain final overrides.

This is a location-contract change only. The organizer directories remain
browser-format or regression dependencies, not RAW identity authorities. A
null legacy root resolves to an unconfigured repository placeholder, so clean
CI builds cannot silently inherit a developer path.

## Current candidate gates

### Story sample: `1_4_001_01`

The RAW-only candidate resolves:

- 10 scenario parts;
- 13 lipsync containers, including `t01`, `t02`, and `t03`;
- 13 ACB containers;
- 432 compiled steps and 10 episode boundaries;
- 139 of 139 voice references by exact cue membership.

The authoritative candidate is semantically equal to the current published
scenario when provenance-only fields are ignored. It is served only at:

`/data/compiled/candidate/1_4_001_01.json`

5174 verification reached the title, background transition, two Spine
characters, and ADV dialogue without changing `/data/compiled/1_4_001_01.json`.

### Card sample: `001tom_r01`

Master data identifies the sample as:

- `card_id`: `1201001`;
- `resource_id`: `001tom_r01`;
- rarity: `R`;
- title: `GROWING STARS`.

RAW contains the directly named source bundle:

`asset/card_001tom_r01.unity3d`

The bundle exports eight `Texture2D` and eight `Sprite` objects: two icons, four
portraits, one piece icon, and one cut-in. The candidate keeps three explicit
layers:

- `textures/`: complete Texture2D exports;
- `sprites/`: Unity Sprite Rect exports;
- `resolved/`: Sprite-preferred runtime candidates.

This resolves the cut-in correctly to `667x900` from its `680x1108` source
texture. The rarity matrix also proves that the organizer package did not use
one consistent rule: some cut-ins and piece icons were exported as full
textures, while others were exported as cropped sprites. The organizer output
therefore remains comparison evidence, not the crop authority.

The card candidate is served only at:

- `/assets/card-candidate/001tom_r01/<texture>.png`;
- `/data/card-candidate/001tom_r01.json`.

The existing card detail page opts into the candidate only with:

`raw_card_candidate=001tom_r01`

Both clean and framed modes loaded their normal and awakened RAW portraits at
`640x800`. Without the query parameter, the resolver keeps using the published
card paths.

### Full card bundle coverage

`card_index.json` contains 836 master-data rows but only 826 unique
`resource_id` values. Ten tutorial rows deliberately reuse an existing normal,
R, SR, or SSR resource ID. RAW contains exactly 826
`card_<resource_id>.unity3d` bundles:

- matched unique resource IDs: 826;
- missing RAW bundles: 0;
- extra RAW card bundles: 0;
- unique-resource coverage: 100%.

The coverage report is generated at the ignored path
`.analysis/raw-migration/card/coverage.json`. It preserves the ten duplicate
master-data resource groups so a later pipeline does not incorrectly demand one
physical bundle per master-data row.

### Card rarity matrix

The isolated candidate was expanded to:

- N: `002sht_n01`;
- R: `001tom_r01`;
- SR: `001tom_sr01`;
- SSR: `001tom_ssr02`.

5174 loaded normal and awakened `640x800` portraits for all four resources.
The SSR sample also loaded both RAW `1800x960` landscape images. Every displayed
image used `/assets/card-candidate/`; the normal card route remained on
`/assets/card-art/`.

### Background sample and full coverage

The EP10 portion of `1_4_001_01` references `bg001_315pro_in_01` in 16 compiled
steps. RAW contains the exact physical bundle:

`asset/adv_background_bg001_315pro_in_01.unity3d`

It contains a full `1800x960` Sprite/Texture2D and a `300x160` thumbnail. The
candidate is served at `/assets/bg-candidate/bg001_315pro_in_01.png` only when
the route includes `raw_bg_candidate=bg001_315pro_in_01`. 5174 verified the
candidate in the bounded EP10 playback range with three Spine characters and
ADV dialogue.

The full background audit scanned all 3,405 compiled JSON files:

- 394 RAW ADV background bundles;
- 192/192 background-catalog IDs have exact RAW bundles;
- 356/356 compiled-story background IDs have exact RAW bundles;
- all 394 RAW backgrounds already have a public PNG;
- six additional public PNGs are legacy/non-RAW aliases.

This proves the current ADV background library can be regenerated directly from
RAW without using the organizer directory for identity.

### Audio candidate matrix

RAW contains 4,055 ACB and 43 AWB files. All 43 AWBs have a same-stem ACB;
these are external-wave-bank pairs rather than organizer exports. For example,
`usual_day.acb` has no directly decodable subsong, while `usual_day.awb`
contains the exact `usual_day` HCA stream and loop points.

The first isolated matrix keeps all AAC/M4A derivatives below ignored
`.analysis/raw-migration/audio/`:

- song `song3_drvalv`: `song3_drvalv.acb`, selection 17, 130.285 seconds;
- BGM `usual_day`: `usual_day.awb`, selection 1, 80.512 seconds;
- ambient `ambi_room`: `ambi_room.acb`, selection 1, 5.454 seconds;
- SE `step_walk_come_lino_boot`: `se_commu.acb`, selection 228, 1.849 seconds.

Each candidate has a `candidate.json` containing its RAW path and SHA-256,
stream selection and aliases, original CRI HCA metadata, output probe, and
output SHA-256. The 5174-only routes are:

- `/assets/audio-candidate/<kind>/<cue>.m4a`;
- `/data/audio-candidate/<kind>/<cue>.json`.

As of commit `8f94e64`, the audio coverage audit, resumable cue index,
ambiguity comparison, single-waveform candidate, ACB sequence candidate, and
master-BGM selector audit all resolve their defaults through
`archive_paths.py`. Machine-specific decoder paths live only in the ignored
local source configuration. Explicit CLI paths remain supported as final
overrides. This changes path ownership, not the candidate route or promotion
policy.

Runtime selection is opt-in through repeatable or comma-separated
`raw_audio_candidate=<kind>:<cue>` values. Without the parameter, story and
live-stage audio continue to use their current published/proxy paths.

Browser verification used actual application audio paths rather than only HTTP
checks:

- the story `001tom_201_2_2_001_01_00` decoded and registered RAW-derived
  `usual_day` and `ambi_room` as loop sources;
- after a pointer gesture the shared AudioContext changed from `suspended` to
  `running`, and both source ages advanced;
- main-story step 27 registered `step_walk_come_lino_boot` as a one-shot source
  and populated the SE decode cache;
- the multi-character stage loaded `DRIVE A LIVE`, reported its audio clock as
  ready, and advanced from 0:00 to 0:19 while choreography and singer positions
  changed.

The first global audit found:

- all 61 master-data song codes have exact `song3_<code>.acb` containers;
- all 105 BGM IDs referenced by compiled stories have same-stem RAW containers;
- all 83 non-sentinel ambient cues referenced by compiled stories have
  same-stem RAW containers;
- compiled stories reference 435 unique SE cues, which require a real
  cue-to-multi-bank membership index rather than filename guessing.

The 92 master-data BGM records include 53 selector-level switch/seasonal names
without an exact waveform cue match. Those are not missing audio conclusions:
they must be resolved from cue metadata or switch relations in the next
inventory pass.

### Full cue index and second SE batch

The resumable index now covers all 4,055 logical ACB banks:

- 33,651 streams;
- 33,754 unique cue aliases;
- 435/435 story SE cues classified;
- 433 cues with decodable audio;
- two `se_commu_action.acb` volume controls with no waveform;
- 13 same-name ambiguities.

Decoded WAV hashing proves twelve ordinary/telephone duplicate groups are
byte-identical. `waribashi` is the only distinct same-name group. ACB sequence
metadata proves its 0.529- and 0.505-second streams are two authored tracks:
the second starts after a 529 ms delay, producing one approximately
1.033-second composite cue. The organizer packages each retained a different
half, so neither package is authoritative on its own.

The second candidate batch was resolved automatically from `cue_index.json`:

- `flash_in` -> `se_commu_2022.acb`, selection 62;
- `phone_rusuden_start` -> `se_telephone.acb`, selection 12;
- `2_4_003_02_09_c1900_t` -> story-specific ACB, selection 1.

All three decoded in their actual 5174 story steps. The 22.302-second
story-specific cue entered the SE cache, registered as a one-shot source, and
advanced beyond two seconds after AudioContext unlock.

The full audit and remaining-domain matrix are maintained in:

`notes/03_audit/RAW_MASTERDATA_FULL_AUDIT_20260726.md`

### Full RAW story inventory batch

All 1,435 `scenario_*.unity3d` bundles have now been inspected through their
Unity container paths rather than TextAsset names alone. The 4,939 valid
scenario JSON assets form 3,398 semantic story groups, and all 3,398 compile
without error. Every group has one unique current public match.

This container-path rule is essential because eleven bundles contain
same-name, different-payload TextAssets under different semantic directories.
The directory under `assets/resources/scenariodata/` supplies the public
namespace; these are different stories, not duplicate revisions.

Across the full compilation, 26,890/26,902 voice references resolve to RAW cue
metadata. All 3,234 unique resolved voice banks have matching RAW lipsync
bundles. A separate gap audit proves the remaining twelve references are
authored dangling references rather than recoverable aliases:

- their surrounding RAW ACB banks exist, but the exact cues do not;
- their surrounding RAW lipsync bundles exist, but the exact TextAssets do not;
- neither current public M4A nor organizer-era OGG contains an exact copy;
- the superficially similar `2_4_013_02_09_a1000` belongs to a different story
  and is explicitly rejected as a substitute for the `2_3` phone dialogue.

The runtime now skips network requests only for those exact twelve
`scenario_id + voice` pairs, preserves the dialogue, and emits an informational
diagnostic. Browser checks on 5174 covered a missing cat voice, a missing
Kyosuke phone voice, and a normal control voice. Both missing lines displayed
without a prepare failure; the normal control still registered
`1_2_001_12_a1000.m4a` as a dialogue source.

The isolated `1_x_001tom_2_1_2_001_12` candidate proves the standalone case:
20 steps, three voice banks, three lipsync banks, 15/15 voice references, and
real browser playback on 5174.

As of commit `33d84b7`, the full coverage audit, voice-gap classifier, and
isolated candidate extractor resolve their default RAW, source manifest, cue
index, public compiled/voice, and inventory roots through `archive_paths.py`.
The rebuilt coverage report is byte-for-byte identical to the earlier report.
The organizer-era voice directory remains an explicit optional comparison
input and is not consulted by default.

### Costume, Spine, idol-setting, and character-image batch

The new repeatable character audit scans every relevant Unity object instead
of inferring content from filenames:

- 690/690 master costume model IDs have RAW bundles;
- all 728 RAW costume bundle IDs exactly equal the public Spine-directory set;
- 725 are complete communication Spine rigs, three are silhouette-only, and
  none are ambiguous;
- all 1,450 RAW serialized atlas/skel TextAssets equal the public files;
- the `001tom_002_00` representative texture is pixel-identical;
- all 257 RAW idol-setting JSON assets are semantically equal to their current
  public projections;
- the 57 `image_chara*` bundles contain 485 unique image paths, of which 187
  have public exact-basename representatives and all remaining 298 are now
  mapped to six original/current consumer families.

The three RAW-proven silhouette-only models (`104omn_001_00`,
`231sub_001_00`, and `242sub_001_00`) are now explicit direct-fallback models.
Their existing public PNGs are retained because they match RAW Sprite
dimensions but not pixels. Asset identity and image replacement are therefore
kept as two independently reviewable steps.

The bounded 5174 route for real story `1_4_002_00` rendered the `104omn`
silhouette at ADV step 7. Runtime diagnostics showed zero Spine instances, one
settled silhouette, no pending silhouette, and no console warning/error.

### First birthday-visual candidate

The 298 non-public-basename paths are no longer an undifferentiated gap:
birthday, event-story, Mobile bust-up, name-plate, sign, and idol-story
categories each cover all 49 master idols. Birthday visuals were selected as
the first candidate because birthday story detail already had a visual slot
with a fallback.

The isolated `birthday_visual:001tom` candidate comes from the exact RAW
Sprite, is `801×875`, matches the source-manifest bundle hash, and is tied to
four birthday rows owned by compiled filenames beginning `1_x_001tom_`.
The shared `012yus-013kys` Sprite was also extracted through both idol
identities; both manifests retain their own three birthday rows and resolve to
the same `1109×826` output hash.
The candidate route remains opt-in through
`raw_character_candidate=birthday_visual:001tom`. The first stable publication
described below supplied the no-query path for `001tom`; at that stage all
other idols remained on the existing fallback.

5174 rendered the candidate at its natural dimensions and loaded no fallback;
the control loaded no candidate image and retained the fallback. Both pages
also reproduced the same existing audio decode error even with `noAudio=1`,
so that issue is recorded separately rather than attributed to this image
candidate.

### First stable birthday-visual promotion

A character-image-specific publisher now promotes one registry entry and one
PNG as a recoverable pair. It verifies the candidate manifest, current RAW
bundle hash, PNG hash/dimensions, birthday master ownership, exact Sprite
container, exact decimal-string Unity PathID, explicit confirmation, bounded
paths, and an absent unregistered stable target. Shared/multi-idol Sprite
identities are rejected by this first-batch gate.

The first entry is `birthday_visual:001tom`:

- stable URL:
  `/assets/stories/birthday/image_chara_birthday_visual_001tom.png`;
- exact PathID: `1704761937170686496`;
- RAW SHA-256:
  `2590eb0feefa7cc23aa5ab7f16b965a42fb84103d5aff12e001621fc4ab6f6f0`;
- PNG `801×875`, SHA-256
  `a572186d263b52c2d70f9f2598304b2c89530f491595cc6561094ad4cf20ef2a`;
- final registry SHA-256
  `758bfe9d1668b602e39bf032e5e190c3fc6f72513cb7dabca7547f00681413df`.

The actual stable publication was explicitly rolled back before the final
republish. Rollback restored the empty registry SHA-256
`406e9052d7c5782d0e70febbe2a12d5a9e72046854bdac2684c4c7909900ddc3`,
deleted the additive PNG, and restored the old browser fallback. The final
republish then restored the stable image.

5174 verified three bounded states: no-query `001tom` selected the stable URL;
the explicit candidate query still selected the ignored candidate URL; and
unpromoted `002sht` still selected no image and retained the fallback. Both
loaded `001tom` images were complete at natural `801×875`, and the stable image
fit the existing detail layout.

The final rollback evidence is ignored at:

`.analysis/raw-migration/character-image-candidate/birthday_visual/001tom/stable-backup-20260727-final-v2/`

### Second stable birthday visual

`birthday_visual:002sht` proves that the same gate works against a non-empty
registry rather than only an initial empty state. The publisher now validates
all existing stable registry assets before adding another entry, including
their bounded URLs, PNG bytes/dimensions, hashes, and exact string PathIDs.
Injected corruption of the existing fixture blocks publication.

The second candidate is a single-idol Sprite from
`RAW/asset/image_chara_birthday_visual_002sht.unity3d`, RAW SHA-256
`d205b564b0ba27aad07558553bbf05b623b665c9a601fb37da66572354b75f74`,
PathID `-5810813441337302374`, and four owned birthday-master rows. Its stable
PNG is `730×824`, 325,759 bytes, SHA-256
`edf893abdb34971e847da9c78032593618ddb932ad75a117334987c27500db67`.

The real second publication started from the one-entry registry hash
`758bfe9d1668b602e39bf032e5e190c3fc6f72513cb7dabca7547f00681413df`.
5174 then loaded both stable images. Explicit rollback removed only `002sht`,
restored that exact registry hash and its fallback, and left `001tom`
unchanged. Final republish produced the two-entry registry hash
`9b524139be7c0df551f020c3ffa05c316d35f3087d90ed294fbf7c028d4c5ef7`.
The final `002sht` stable image loaded at natural `730×824` and passed visual
layout inspection.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/002sht/stable-backup-20260727-final/`

### Shared birthday visual

`012yus` and `013kys` are the one birthday-image exception to the single-idol
gate. A dedicated group publisher consumes both candidate directories,
requires the complete confirmation
`birthday_visual:012yus+013kys`, and proves that both manifests select the same
RAW bundle, Unity Sprite, PathID, Sprite Rect, and PNG while retaining separate
owner-specific master rows.

The stable group uses one physical asset and two registry mappings:

- stable URL:
  `/assets/stories/birthday/image_chara_birthday_visual_012yus-013kys.png`;
- RAW SHA-256:
  `870a62220a98b6e8ac22b01339fbda2ea8efe4d1cf728e6a17e108a6f68a65ee`;
- PathID: `-2746721419655100402`;
- PNG `1109×826`, 480,735 bytes, SHA-256
  `7be1b676459a964c054b0fc5658ba69442513486b9e0d495ad3d9eab0449f99e`.

The real group publication began with two mappings. Both owner routes loaded
the same stable URL. Explicit group rollback removed both new mappings and the
one shared PNG, restored the exact prior registry hash, and returned both
routes to fallback without affecting `001tom`. Final republish leaves four
idol mappings backed by three physical image URLs; registry SHA-256 is
`becc2bb172430cfe7a017883aceab3686131f587051767e675d51b64da4a9ec2`.
The shared two-idol composition passed visual layout inspection.

The validator also rejects incomplete shared registry groups, so future
publication cannot silently build on only one side of this mapping. Final
rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/012yus-013kys-stable-backup-20260727-final/`

### First atomic multi-image batch

`003hok`, `004ter`, and `005kao` are the first small multi-image promotion.
The batch publisher runs the full single-idol evidence gate for every
candidate, then writes three distinct PNGs plus one registry revision as a
recoverable transaction. Duplicate targets, partial confirmation, a failure on
the second asset, a registry failure after asset writes, and hash drift all
restore the complete prior state.

Evidence summary:

- `003hok`: RAW
  `00e7cd4a873de200c2304ee1dca39c8051f3f8d1a4f9c4eec48f8dd7757dea92`,
  PathID `8982863484449506530`, PNG `786×837`,
  `a66c0fdc5bb37939a9933ddc623178ab2103a9d9e264cb447e1afabb9af63cb8`;
- `004ter`: RAW
  `c70d1b7b1e71af2c5f8b9ec8e31ec0fc51310cce0368b64161b063be60743854`,
  PathID `3602356276066031871`, PNG `975×869`,
  `21b644f589631f82d7e47202e1f10e04cee51b9c5e1d41ad9f3038e596f95e30`;
- `005kao`: RAW
  `3871ceba7d3b4069f3259b78330d085de0e2b8d022517bcc730d30540d0e0c1f`,
  PathID `1892783551249285074`, PNG `609×821`,
  `552546a3ad317294fadbb2d73e136e3634493165089cb2b40124051134691d0b`.

The real publish/rollback/final-republish sequence restored the exact
four-mapping baseline during rollback and preserved the existing shared image.
Final state is seven idol mappings and six physical URLs, registry SHA-256
`0e6c6c738479ff496c69336b1f6accc21f78378062d02ebf5bd2301b8bfb4740`.
All three stable routes loaded at natural dimensions; the widest and narrowest
outputs both passed visual layout inspection.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/batch-003hok-004ter-005kao-backup-20260727-final/`

### Five-image bounded batch

`006tsu`, `007kei`, `008rei`, `009kyj`, and `010pie` are the first maximum-size
batch. The publisher now rejects more than five candidate directories, making
the incremental replacement limit part of the source contract.

Evidence:

- `006tsu`: RAW
  `fb67d1f730664d03ca41843a4db7248e14a36f4ef86e4e64e8f6282b29d8d9a5`,
  PathID `-8280902255413043889`, PNG `1088×874`,
  `7983ae264144a90811eba916d30073fa098bf5e213decc43ccfd9b984b3a48e7`;
- `007kei`: RAW
  `b98f7cbe8cb1423a3e07b4762b31642d7c6499a5fffdb3b7e36b7401b71be7e3`,
  PathID `-126247317626979540`, PNG `1107×838`,
  `090dd824aabb6ec94a59c16dba272553ba205787927cf7f96f1a950cff4aafb2`;
- `008rei`: RAW
  `cf7162fc5e63fa2aa1eb894d2fa3f54cd4b051398ffd7689c84c14645885d21c`,
  PathID `-5985898852289501109`, PNG `746×881`,
  `6cdfe6fd2a4ffe6a61a6af4a0c4dbc187bc23f3130334b509685cab5847e9cfb`;
- `009kyj`: RAW
  `87dbd965429508c48b5ef7aa92b788238b4a11262f12e0b43d45b884205c390d`,
  PathID `-768001593005162926`, PNG `860×856`,
  `aefd35e8fb33739dfb0b6f704254c3d6b44d4b9f4db7695fa5db56b60d2123c3`;
- `010pie`: RAW
  `8be74f2cf8f1a4d0c80e77039e76ec9d142b66f155174b69827a7deb7efbb667`,
  PathID `-6635513665076385639`, PNG `843×898`,
  `8a32d2c784f706acfb04d30cd1888e994a8fad6538ef259890f1537742363dac`.

The real publish/rollback/final-republish cycle restored the exact seven-entry
baseline during rollback and preserved all earlier assets. Final state is
twelve idol mappings and eleven physical URLs, registry SHA-256
`061f00fd8b72109f7a263fc1e3ab71a82435fe79dd153bfe60e676044cf78f79`.
All five stable routes loaded at natural dimensions; width extremes passed
visual inspection.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/batch-006tsu-007kei-008rei-009kyj-010pie-backup-20260727-final/`

### Second five-image bounded batch

`011min`, `014hid`, `015ryu`, `016sei`, and `017kir` are the next master-order
batch. Evidence:

- `011min`: RAW
  `a951b66453de2836a3cc6fb7dcec21c16f3cfcfa285b1771262743c2b32589c8`,
  PathID `6347870598022394189`, PNG `812×842`,
  `08675f2afa7294b74e0d0e54f260629f16ac70c142eac589e412dce06e5cc035`;
- `014hid`: RAW
  `c7b8421d1d2f879b8313dc05342002647ade26a340416c4e4028c017ca7f40ef`,
  PathID `-1827195483708291138`, PNG `956×841`,
  `bec903356f54d601538a8447de8ad1fd63e4594704879b27e72336b088a28099`;
- `015ryu`: RAW
  `40d1a6c2fef42cb8086b602eece4d523a32c114df632783329d63001258fc788`,
  PathID `-7974334565183057656`, PNG `926×839`,
  `fd74f1543f7134ee064c300e8c643afe45fa3df907169b99d6d3b6bdce5174df`;
- `016sei`: RAW
  `38ee10f0e36d49f3a7f618cce9fa7cb16c4824d795486ee9479e69cb17d86cae`,
  PathID `2109130252596898194`, PNG `858×855`,
  `0a76da1eb25a13aa600cfdd2bf775385368260366adb71f977e003c0f6fd77bb`;
- `017kir`: RAW
  `e843442e9cf355c3256a903c9d7d9f862d42ae763dabb5fd847052f7959616b4`,
  PathID `8646653807885103205`, PNG `1188×870`,
  `f3789384dcda3e88eb6d5afd41f15b85cd7b4872c6761afcd24be38d23150632`.

The real publish/rollback/final-republish cycle restored the exact
`061f00fd8b72109f7a263fc1e3ab71a82435fe79dd153bfe60e676044cf78f79`
baseline during rollback, removed all five new PNGs, and preserved `010pie`.
Final state is seventeen idol mappings and sixteen physical URLs, registry
SHA-256
`ead36216820b63b7b274ad281488fbe625a3d773f6f88f684d77d24ae955547e`.
All five stable routes loaded at natural dimensions; `011min` and `017kir`
passed visual layout inspection. The remote Statsig telemetry timeout seen in
browser control was unrelated to the successful local 5174 checks.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/batch-011min-014hid-015ryu-016sei-017kir-backup-20260727-final/`

### Third five-image bounded batch

`018shm`, `019kur`, `020hay`, `021jun`, and `022nat` are the next master-order
batch. Evidence:

- `018shm`: RAW
  `99487e5ec5710c88bac7f1228ba4aa0db4cff1c6b5f399284f3ebb960e24491d`,
  PathID `4083446340310980541`, PNG `1202×863`,
  `5f7d1817c2f0773e7dffc4f19f9bb43980ad2b5e74e4263e84c54f72366562fc`;
- `019kur`: RAW
  `6180f81dade3a5a6f92d83a9ff5a24df522daaf35866fb04e05292546c7b27bb`,
  PathID `-7541408428981436444`, PNG `874×824`,
  `0f1ac21c5568dbbb736958038b378edc138654b583c0c199531ab8d79c71a71a`;
- `020hay`: RAW
  `517f28497690adf9d0fe74181ca462f03cff4ffe9b874c40791b6ed19a31ccc5`,
  PathID `8995473977128221475`, PNG `976×827`,
  `89a73a04f2184ea20f1d01fa9f24761fb9e133ef2c19902ac95712d3efd3b86e`;
- `021jun`: RAW
  `7e61df1cdac2309d3a591866ee1f274912d10b18908f997453ce15f732608a51`,
  PathID `-1079152942904299386`, PNG `1159×801`,
  `ecbc005484f0373aeae6ffd0399301ba5b0c254398625d03b843e6277ad6d66c`;
- `022nat`: RAW
  `ef846e5d2187fb459163770332cd6a0124d052fe0b87a60e04760dcce183fefd`,
  PathID `-5858754875459902066`, PNG `983×819`,
  `9d215b3c4fcf5ebc8a8079a68d5664a1cd33daf823582fc109ff2084f74b67c5`.

The real publish/rollback/final-republish cycle restored the exact
`ead36216820b63b7b274ad281488fbe625a3d773f6f88f684d77d24ae955547e`
baseline during rollback, removed all five new PNGs, and preserved `017kir`.
Final state is twenty-two idol mappings and twenty-one physical URLs, registry
SHA-256
`79a9d92f963049d48ce95b7e78286cc537b710c6a1f4a206811d4822fbc7e5ca`.
All five stable routes loaded at natural dimensions; `018shm` and `019kur`
passed visual layout inspection.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/batch-018shm-019kur-020hay-021jun-022nat-backup-20260727-final/`

### Fourth five-image bounded batch

`023har`, `024shk`, `025suz`, `026gen`, and `027yuk` are the next master-order
batch. Evidence:

- `023har`: RAW
  `da57c26c79756b6dce80c4c4de3e3644c52feb0b1426d8352d5d353ded4ac4f2`,
  PathID `6274914879522109866`, PNG `1800×960`,
  `f2a056e1f269e11561067379ece592ca68fe6f3d42847ff9a5f84bb32c7aafb3`;
- `024shk`: RAW
  `273c28c5ccc20a3fccda00ff1199860bb0561cec103cb860f7b4142d8608f069`,
  PathID `-2665266097907987525`, PNG `765×892`,
  `74b593a01a4cdcb7827a900ce3786f0ea061d1083b326287925e20b57250e3d4`;
- `025suz`: RAW
  `2cc2e0971ecdaa0fdaff8bc1f1146d7afc6437b82266605055a9373fff354710`,
  PathID `1264523719426961948`, PNG `740×933`,
  `f48dc2256355f95c1d8e01b41ad8fabd9e7022530f29c7480293e2f1fefab1c0`;
- `026gen`: RAW
  `f21536d84b81511e493dbdab3ea9fcb8a60d14cccf4d14b8d471cde08c5630c9`,
  PathID `-1047053079907757995`, PNG `724×889`,
  `fdb18f9597cf14fe8f1628d7190fe0c8a188f40eef840350521c4c18a62ba7d5`;
- `027yuk`: RAW
  `1248e6cff2dcf9a72d43ba5096c414f822537fc41b3b4a0e7a672c096da15ebe`,
  PathID `-261943468093583930`, PNG `916×842`,
  `d45bc2fa1a7b3cc0f3a40f789c5598d3caef9b70db5f680a705e2ec948355a07`.

The real publish/rollback/final-republish cycle restored the exact
`79a9d92f963049d48ce95b7e78286cc537b710c6a1f4a206811d4822fbc7e5ca`
baseline during rollback, removed all five new PNGs, and preserved `022nat`.
Final state is twenty-seven idol mappings and twenty-six physical URLs,
registry SHA-256
`5353936027c438cc7713cbbde3f179c0b46fa74e8b9f4288ac4e96c210d07759`.
All five stable routes loaded at natural dimensions; the landscape `023har`
and narrowest `026gen` outputs passed visual layout inspection. Remote Statsig
telemetry timeouts were unrelated to the successful local 5174 checks.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/batch-023har-024shk-025suz-026gen-027yuk-backup-20260727-final/`

### Fifth five-image bounded batch

`028soi`, `029ass`, `030mak`, `031sak`, and `032nao` are the next master-order
batch. Evidence:

- `028soi`: RAW
  `a80205ae2c72d5ec50987280e478de6d9711b6f3d3868c6b37b0a311e3c0eb46`,
  PathID `7689127519335195737`, PNG `895×830`,
  `75b6466cf7a89cd3fa447246a5cd4928d7aa354d8fc93feb2932e2dc87eee594`;
- `029ass`: RAW
  `fc2fa3e7e587bbff405dab190a144030389ae137bfb56a07db3f2baec6d40b9e`,
  PathID `9001415395409568943`, PNG `1077×825`,
  `bf5c38a248d4241d8cce01071d2ca0d5675cff5c09be9f75bb49fd6ad2ec8bc1`;
- `030mak`: RAW
  `dff7cc4c2676eda3f703080d4045e1e0274f1aa5f1c9eb16dbcc4dec3d4a3c83`,
  PathID `1019936051257360751`, PNG `1038×819`,
  `904b026b8882af6fd1e0ee802ba556d0ef2a675cb8b769e18d6c04dc61095cfc`;
- `031sak`: RAW
  `3ca889304a602125adb0d8b6b736f93fdcddd4f7c2cb2f1b6d0b6880fc2131a9`,
  PathID `-2128585307808258559`, PNG `878×860`,
  `96b680a6225f9cecf89b35a6617272028b79e722ed009127d58a7586ab28c43c`;
- `032nao`: RAW
  `6f0b01bd58465b25c4f47bf1957e7b6ee55a317a28aaeb46d7553481014654d2`,
  PathID `7734075291173605705`, PNG `949×831`,
  `65ce92e9838b54199c7a66f3647ebee2b3661280cfa404d257d42c0c879e0d23`.

The real publish/rollback/final-republish cycle restored the exact
`5353936027c438cc7713cbbde3f179c0b46fa74e8b9f4288ac4e96c210d07759`
baseline during rollback, removed all five new PNGs, and preserved `027yuk`.
Final state is thirty-two idol mappings and thirty-one physical URLs, registry
SHA-256
`213b1c1c782345ff896b13b1ba69da4097f04c7f748c65527d1cdc6afa2485a8`.
All five stable routes loaded at natural dimensions; the widest `029ass` and
narrowest `031sak` outputs passed visual layout inspection. Page identity,
non-empty DOM, framework-overlay, console, screenshot, and interaction checks
were also recorded. The interaction entered the `028soi` player successfully.
Console output retained the known `noAudio=1` `useVoicePlayer` null-context
decode error; remote Statsig telemetry timeout was unrelated to local 5174.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/batch-028soi-029ass-030mak-031sak-032nao-backup-20260727-final/`

### Sixth five-image bounded batch

`033shr`, `034kan`, `035mco`, `036rui`, and `037jir` are the next master-order
batch. Evidence:

- `033shr`: RAW
  `dacfa697ee625371d17a49f1225bf2fbfe88fc11cf2da21a9b0381b269348560`,
  PathID `1393926239256617402`, PNG `783×846`,
  `5460930fb74617eff2186d2b53067180c8e0575af91c4a595708a96a04a269b9`;
- `034kan`: RAW
  `46010b91ad5e36eadb287192948fec35c5999ed9bf9e516e5648742ee2f4beed`,
  PathID `2794286035226723385`, PNG `845×921`,
  `e2e5e8ebad8124b01245705922eace060eb36e730b6c98d04ea7f335471d25ba`;
- `035mco`: RAW
  `f6279f03c0d81d59d1ba6204672e8bfd508f81be1dda9f62848a440aef6bdf3d`,
  PathID `-2091414793709629411`, PNG `674×834`,
  `8f8b878300458efad403339a103b276e9baaaef64704d564cec799a81d8b4189`;
- `036rui`: RAW
  `78c6616ed90b04b469f5d26574ffdc72c8e5a9fe037601baf2484b2e63b3bf79`,
  PathID `2576356709593939599`, PNG `726×863`,
  `900ea42d76ca98c71270f2b9660232f6d8f5c77de6b58c1e61a6574a097b235a`;
- `037jir`: RAW
  `c7d6f6645b66082a6f513188aad5e571a398e45e387cc5e853d7f54ac8f7c093`,
  PathID `494254807622901840`, PNG `913×878`,
  `bc5648cd08277512703087b28db1655eafccf89d3152ce285789dd3960f881b2`.

The real publish/rollback/final-republish cycle restored the exact
`213b1c1c782345ff896b13b1ba69da4097f04c7f748c65527d1cdc6afa2485a8`
baseline during rollback, removed all five new PNGs, and preserved `032nao`.
Final state is thirty-seven idol mappings and thirty-six physical URLs,
registry SHA-256
`0abb01793be4d51b2a53417265a0c36782ea971e2090c92cb8c2f162b1de82df`.
All five stable routes loaded at natural dimensions; the widest `037jir` and
narrowest `035mco` outputs passed visual layout inspection. Page identity,
non-empty DOM, framework-overlay, console, screenshot, and `033shr` player
interaction checks were also recorded. Console output retained only the known
`noAudio=1` null-context decode error.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/batch-033shr-034kan-035mco-036rui-037jir-backup-20260727-final/`

### Seventh five-image bounded batch

`038tak`, `039mcr`, `040ren`, `041ryo`, and `042dai` continue the master-order
sequence. Evidence:

- `038tak`: RAW
  `dabd31e7aeb4750af011b81e830bfb5edcfad1c84d29658ef4c863e853c214c1`,
  PathID `-3332754183812213576`, PNG `719×865`,
  `31a342f81a4c275d57f18a562167599a5cf106953025cf02e085831de49734bc`;
- `039mcr`: RAW
  `24040c2604bf9dd5b50abae737648a6964355f44a8ff90fc0934a4d6a9b15cba`,
  PathID `-7195810734023595213`, PNG `944×855`,
  `1544615692efc126accf2598e435c4cfaead00e7c795658d4f024b571745c503`;
- `040ren`: RAW
  `14eb92663f41b54bb77fc5c061e78d03e6444c63eb69fd26c6625e7d6843cc91`,
  PathID `1627532361084008386`, PNG `981×820`,
  `88261d3253529b865c7162762f426c08ad90b4c4db980a7fb9647bd58745e9bf`;
- `041ryo`: RAW
  `a4ac8989a1b2d07b67d52951a7cd7f86daad4c9044b837c59cee5ccfe59e9a59`,
  PathID `1141097572195058682`, PNG `770×882`,
  `331ec13288643c291937af0d0c202a6f0b4360941c3686fb2541a73992ad5608`;
- `042dai`: RAW
  `f9bbb90eb1e836ae08d286b45d22e09743a26326ecb5343250853d1d49fd9435`,
  PathID `-5749448713032568943`, PNG `916×882`,
  `1519067837217a5d7d8d1c409350ec0f7e7c2f8b5f2b9d08d6f18f23d3798054`.

The real publish/rollback/final-republish cycle restored the exact
`0abb01793be4d51b2a53417265a0c36782ea971e2090c92cb8c2f162b1de82df`
baseline during rollback, removed all five new PNGs, returned the five routes
to fallback, and preserved `037jir`. Final state is forty-two idol mappings and
forty-one physical URLs, registry SHA-256
`dca942c5a9d6dfc741012609fd612fbf2b3e54bfbcad6227f4bf87cb9765310c`.
All five candidate and final stable routes passed URL, page identity,
non-empty DOM, framework-overlay, title, and natural-dimension checks. The
`038tak` player interaction succeeded; the widest `040ren` and narrowest
`038tak` outputs passed screenshot inspection. Console output retained the
known `noAudio=1` null-context decode error; browser-control Statsig warnings
were external to local 5174.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/batch-038tak-039mcr-040ren-041ryo-042dai-backup-20260727-final/`

### Eighth five-image bounded batch

`043kaz`, `044ame`, `045sor`, `046chr`, and `047shu` continue the master-order
sequence. Evidence:

- `043kaz`: RAW
  `2f83fa76d9fe3d6d5bed4cf6809492a430570b3b6d6b8d2fb81682c2a30412dc`,
  PathID `-190198550445127689`, PNG `844×849`,
  `170f3b5e20e5fa0abc1dbcbb7a87012e4605f73109209a910cbe082332fb20a0`;
- `044ame`: RAW
  `84c5604d9899c79bba54c9902a5da6c51acb052f79b98c5bc674fe6fe1d8c313`,
  PathID `-7434065863575947792`, PNG `928×928`,
  `6a1bf2da0cbc640ca210dcbb3c5d2f604a48b9cb4a8064d50ba0f3fb7f78d625`;
- `045sor`: RAW
  `dc8c5cb4ce2f206a3c30bca031b858acdc6a0cee0537b32196581458fdd14d2c`,
  PathID `-7090070828571097385`, PNG `622×833`,
  `21d894ebb4bf2ef90e8e98cfa5d9fcf5729360d9b92edf5829e9eeb2742fd853`;
- `046chr`: RAW
  `1da1781912be848aaee0fcada119a2af8c49f98c9ae06bf27f36644710e03442`,
  PathID `-388944988657992739`, PNG `857×879`,
  `02b872ff13cdbce4e9ea373bf24f73e7a32977b31439494c965c82e925bc32cd`;
- `047shu`: RAW
  `0bd0525e9918a00eeb775bc0ccc11da4ea41dd579e4001a7327969805694c099`,
  PathID `-3944623707261270729`, PNG `801×847`,
  `9a6d1e74a3c1bc8ab47cdaf85b68e7196425d4bf7e25ece81b20d35b43475303`.

The real publish/rollback/final-republish cycle restored the exact
`dca942c5a9d6dfc741012609fd612fbf2b3e54bfbcad6227f4bf87cb9765310c`
baseline during rollback, removed all five new PNGs, returned the five routes
to their `148×148` icon fallbacks, and preserved `042dai` at `916×882`. Final
state is forty-seven idol mappings and forty-six physical URLs, registry
SHA-256
`521ef1e578675c149a5b9c54884546ff30cf645c4826791cfaeec25ecb1c41b1`.
All five candidate and final stable routes passed URL, title, page-identity,
non-empty DOM, framework-overlay, and natural-dimension checks. The `043kaz`
player interaction rendered a canvas and exposed `前へ`, `AUTO`, and `SKIP`;
the widest `044ame` and narrowest `045sor` outputs passed screenshot
inspection. Console output retained the known `noAudio=1` null-context decode
error and player-only Pixi Spine update/tint warnings. Browser-control Statsig
warnings were external to local 5174.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/batch-043kaz-044ame-045sor-046chr-047shu-backup-20260727-final/`

### Final two-idol birthday batch

`048mom` and `049eis` complete the master-idol portion of the birthday domain:

- `048mom`: RAW
  `548ad03cb2f7110b1d88349a13486e5ab4a3af37af8a175c91875ad0a2ed589d`,
  PathID `865479516661722991`, PNG `720×866`,
  `dc43cade4dba6ffd7fea1ba8c92ba36ea0d080eb63ed2ad4377efa9da5f721a0`;
- `049eis`: RAW
  `a1f12c26054433871acb80868d763a941af1550807426c6f858aa91cc61cb727`,
  PathID `-5212614188762763632`, PNG `968×872`,
  `6a377a43f33c8f02d1408458d1fd40a340e76b2dbed49ab640d3c5bb59214ff5`.

The real publish/rollback/final-republish cycle restored the exact
`521ef1e578675c149a5b9c54884546ff30cf645c4826791cfaeec25ecb1c41b1`
baseline during rollback, removed both PNGs, returned both routes to their
`148×148` icon fallbacks, and preserved `047shu` at `801×847`. Final state is
all forty-nine master-idol mappings backed by forty-eight physical URLs,
registry SHA-256
`7e6529c7ac74f658f602b7aaf7e70c1d751e45b7e5c973769cf82a4b3cd51a0c`.
Both candidate and stable routes passed URL, title, page-identity, non-empty
DOM, framework-overlay, natural-dimension, and screenshot checks. The
`048mom` player interaction rendered a canvas and exposed `前へ`, `AUTO`, and
`SKIP`. The known `noAudio=1` null-context decode error and player-only Pixi
Spine update/tint warnings remain unrelated to these PNGs.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/batch-048mom-049eis-backup-20260727-final/`

### Explicit NPC birthday gate

`101ken` is deliberately excluded from the default master-idol extractor.
`speaker_dictionary.json` instead proves it is NPC ID `101`, `山村 賢`, with
the exact `101ken` speaker/npc code and birthday `7月2日`. Five birthday-master
rows have compiled files beginning `1_x_101ken_` and identify only `101ken`.

The new explicit `--identity-scope npc` path requires that speaker evidence and
rejects both master idols and mismatched NPC codes. The publisher also requires
exactly one `master_idol` or `npc_speaker` scope and records the NPC scope in
stable registry evidence. Synthetic tests cover missing/mismatched identity,
NPC publication, resolver lookup, and rollback.

The real isolated candidate records RAW
`a3d004e4c949c9f653997504f2d84545cac448c416f12c7fc6ff1b9d7e3dab17`,
PathID `4948771745467967869`, PNG `778×833`,
`5ff9f9e04a37c02dc7475674b249285e4624566e94c0171e958587fcf5799216`,
and five compiled master references. Its 5174 candidate page and player
interaction passed.

The real publish/rollback/final-republish cycle restored the exact
`7e6529c7ac74f658f602b7aaf7e70c1d751e45b7e5c973769cf82a4b3cd51a0c`
baseline during rollback, removed the PNG, returned `101ken` to its `148×148`
icon fallback, and preserved `049eis` at `968×872`. Final state is fifty
identity mappings backed by all forty-nine physical birthday URLs, registry
SHA-256
`661852cf0bd631a4c82dc7be616f478a8bf49cc169164219958ead0023feb3ec`.
The stable registry retains NPC ID `101`, speaker ID `101ken`, display name
`山村 賢`, and five references rather than presenting the entry as a master
idol. The final stable route loaded at `778×833` without a candidate parameter;
both desktop candidate and narrow stable-page layouts passed inspection.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/birthday_visual/101ken/stable-backup-20260727-final/`

### First stable event-story visual

`event_story_visual:001tom` comes directly from
`RAW/asset/image_chara_event_story_visuals.unity3d`, SHA-256
`b2c586614b404c0fffb6103ba331a8700f6b1f9089880d228adf5cc8fd10f8e8`.
The exact Sprite PathID is `-7457278555292857429`; the resolved PNG is
`719×820`, 296,055 bytes, SHA-256
`f85215af82d5d91f0fe0279ffc728b8dd89d5b272bb9af806b618e2c41c07bba`.

The candidate now carries event master ownership, not only idol identity.
`story_master_index.json` proves `001tom` is in compiled event files
`1_3_10011_01.json` and `1_3_30018_01.json`, corresponding to event IDs
`410011`/`430018` and event codes `10011`/`30018`. Promotion rejects missing
compiled membership, duplicate compiled references, mismatched event IDs or
codes, and non-exact Sprite identity.

The event-detail cast consumes the candidate or stable registry URL. The
portrait layout activates only when at least one event visual resolves;
unpromoted cast members keep their normal icons, and an all-fallback event
keeps the original compact layout.

The real publish/rollback/final-republish cycle restored the exact
`661852cf0bd631a4c82dc7be616f478a8bf49cc169164219958ead0023feb3ec`
baseline during rollback, removed the PNG, and returned event `410011` to
three icons with no portrait layout. Final stable URL is
`/assets/events/characters/image_chara_event_story_visual_001tom.png`, and the
51-entry registry SHA-256 is
`5e6d8bcedd55f2ecc00ea81489b6483788dba51355ebce4a81b7bdcaef4072c0`.

Both master-linked activity routes loaded the stable image at natural
`719×820`; the `430018` route retained two icon fallbacks and its `001tom`
cast-card interaction navigated to the correct idol detail. Page identity,
DOM, overlay, URL, dimensions, fallback, and interaction checks passed. The
Browser surface lacked screenshot support, so visual evidence is limited to
original-resolution PNG inspection plus rendered DOM/geometry checks.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/event_story_visual/001tom/stable-backup-20260727-final/`

### Second stable event-story visual

`event_story_visual:002sht` is a separate Sprite in the same verified RAW
aggregate, with exact PathID `-5184400692822500854`. Its PNG is `475×783`,
227,024 bytes, SHA-256
`a83344e535e4292a8f0b1dac5d3c3b9951d0a05c32c5fc225dc5eea501fc0631`.

Event master evidence resolves three unique compiled files:
`1_3_10011_01.json`, `1_3_30008_01.json`, and `1_3_30018_01.json`, owned by
event IDs `410011`, `430008`, and `430018`. Each compiled character list
contains `002sht`.

The candidate route rendered stable `001tom`, candidate `002sht`, and the
`003hok` icon fallback together. Explicit rollback restored registry SHA-256
`5e6d8bcedd55f2ecc00ea81489b6483788dba51355ebce4a81b7bdcaef4072c0`,
removed only `002sht`, preserved stable `001tom`, and returned the other two
Jupiter members to icons. Final republish produced registry SHA-256
`25f631de7b5268343f83291bfef8ab8174ca536926f1e84c4d0f5f7bbf7e0471`.

The additional stable route `430008 / 30008` loaded
`/assets/events/characters/image_chara_event_story_visual_002sht.png` at
natural `475×783` with four icon fallbacks. Its cast screenshot passed layout
inspection, and clicking the visual opened `idol=002sht`.

Final rollback evidence:

`.analysis/raw-migration/character-image-candidate/event_story_visual/002sht/stable-backup-20260727-final/`

### Standalone promotion gate and first stable replacement

The generic strict collection publisher requires an aggregate plus episode
files, so it cannot safely publish a one-file RAW story. A dedicated
single-story gate now accepts only the compatibility delta actually proven for
this class:

- scenario ID, step count/type, scene state, cues, choices, dialogue audio,
  and source text must remain unchanged;
- the only permitted compatibility differences are an added top-level episode
  list and added per-step `episode_index`/`episode_part`;
- strict schema and compatibility-to-authoritative projection must pass;
- any non-empty inline `*_cn` value blocks promotion;
- every existing overlay must retain its file hash, RAW source hash, unit IDs,
  and per-unit source hashes;
- candidate output under `public/` is rejected;
- publish requires exact scenario confirmation, current/candidate/evidence
  hashes, an empty external backup, atomic replacement, final hash verification,
  and rollback on injected failure.

The real `1_x_001tom_2_1_2_001_12` manifest passed with 41 episode-only
additions and zero disallowed differences. A mirror publish was accepted first,
then the stable file changed from
`a0fe2085c1ad9d62998196ae29a668eaf8a7ea3061840c4872a3ce80a7d4d089`
to
`274cbd61b618de80a3bda317cfbef7133448ca7bafad1ec3d1f196d879c8cbff`.
The old file and backup manifest remain under the ignored promotion evidence
directory.

On the formal 5174 path, the promoted file rendered the same Japanese
dialogue and two Spine characters and registered
`1_2_001_12_a1000.m4a`. Chinese mode fell back to the original source text
without resetting the story because no overlay exists for this scenario.

## Reproduction

```powershell
python ..\data_pipeline\extract_raw_story_candidate.py `
  --raw-root ..\RAW `
  --scenario-id 1_4_001_01 `
  --output-dir .analysis\raw-migration\1_4_001_01

python ..\data_pipeline\verify_raw_story_candidate.py `
  --candidate .analysis\raw-migration\1_4_001_01\compiled\authoritative\1_4_001_01.json `
  --current public\data\compiled\1_4_001_01.json

python ..\data_pipeline\extract_raw_card_candidate.py 001tom_r01 `
  --organized-photo-root E:\BaiduNetdiskDownload\SideM\GS_Res\ALL_PHOTOS\assets\resources\image\image_card

python ..\data_pipeline\audit_raw_card_coverage.py

python ..\data_pipeline\extract_raw_background_candidate.py `
  bg001_315pro_in_01 `
  --scenario .analysis\raw-migration\1_4_001_01\compiled\authoritative\1_4_001_01.json

python ..\data_pipeline\audit_raw_background_coverage.py

python ..\data_pipeline\audit_raw_character_resources.py

python ..\data_pipeline\extract_raw_character_image_candidate.py `
  birthday_visual 001tom

npm run character:promotion-publish -- `
  --candidate-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/001tom `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/001tom/stable-backup-20260727-final-v2 `
  --confirm=birthday_visual:001tom

npm run character:promotion-rollback -- `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/001tom/stable-backup-20260727-final-v2 `
  --confirm=birthday_visual:001tom

npm run character:promotion-publish -- `
  --candidate-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/002sht `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/002sht/stable-backup-20260727-final `
  --confirm=birthday_visual:002sht

npm run character:promotion-publish-group -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/012yus,.analysis/raw-migration/character-image-candidate/birthday_visual/013kys `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/012yus-013kys-stable-backup-20260727-final `
  --confirm=birthday_visual:012yus+013kys

npm run character:promotion-publish-batch -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/003hok,.analysis/raw-migration/character-image-candidate/birthday_visual/004ter,.analysis/raw-migration/character-image-candidate/birthday_visual/005kao `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/batch-003hok-004ter-005kao-backup-20260727-final `
  --confirm=birthday_visual:003hok+004ter+005kao

npm run character:promotion-publish-batch -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/006tsu,.analysis/raw-migration/character-image-candidate/birthday_visual/007kei,.analysis/raw-migration/character-image-candidate/birthday_visual/008rei,.analysis/raw-migration/character-image-candidate/birthday_visual/009kyj,.analysis/raw-migration/character-image-candidate/birthday_visual/010pie `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/batch-006tsu-007kei-008rei-009kyj-010pie-backup-20260727-final `
  --confirm=birthday_visual:006tsu+007kei+008rei+009kyj+010pie

npm run character:promotion-publish-batch -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/011min,.analysis/raw-migration/character-image-candidate/birthday_visual/014hid,.analysis/raw-migration/character-image-candidate/birthday_visual/015ryu,.analysis/raw-migration/character-image-candidate/birthday_visual/016sei,.analysis/raw-migration/character-image-candidate/birthday_visual/017kir `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/batch-011min-014hid-015ryu-016sei-017kir-backup-20260727-final `
  --confirm=birthday_visual:011min+014hid+015ryu+016sei+017kir

npm run character:promotion-publish-batch -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/018shm,.analysis/raw-migration/character-image-candidate/birthday_visual/019kur,.analysis/raw-migration/character-image-candidate/birthday_visual/020hay,.analysis/raw-migration/character-image-candidate/birthday_visual/021jun,.analysis/raw-migration/character-image-candidate/birthday_visual/022nat `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/batch-018shm-019kur-020hay-021jun-022nat-backup-20260727-final `
  --confirm=birthday_visual:018shm+019kur+020hay+021jun+022nat

npm run character:promotion-publish-batch -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/023har,.analysis/raw-migration/character-image-candidate/birthday_visual/024shk,.analysis/raw-migration/character-image-candidate/birthday_visual/025suz,.analysis/raw-migration/character-image-candidate/birthday_visual/026gen,.analysis/raw-migration/character-image-candidate/birthday_visual/027yuk `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/batch-023har-024shk-025suz-026gen-027yuk-backup-20260727-final `
  --confirm=birthday_visual:023har+024shk+025suz+026gen+027yuk

npm run character:promotion-publish-batch -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/028soi,.analysis/raw-migration/character-image-candidate/birthday_visual/029ass,.analysis/raw-migration/character-image-candidate/birthday_visual/030mak,.analysis/raw-migration/character-image-candidate/birthday_visual/031sak,.analysis/raw-migration/character-image-candidate/birthday_visual/032nao `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/batch-028soi-029ass-030mak-031sak-032nao-backup-20260727-final `
  --confirm=birthday_visual:028soi+029ass+030mak+031sak+032nao

npm run character:promotion-publish-batch -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/033shr,.analysis/raw-migration/character-image-candidate/birthday_visual/034kan,.analysis/raw-migration/character-image-candidate/birthday_visual/035mco,.analysis/raw-migration/character-image-candidate/birthday_visual/036rui,.analysis/raw-migration/character-image-candidate/birthday_visual/037jir `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/batch-033shr-034kan-035mco-036rui-037jir-backup-20260727-final `
  --confirm=birthday_visual:033shr+034kan+035mco+036rui+037jir

npm run character:promotion-publish-batch -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/038tak,.analysis/raw-migration/character-image-candidate/birthday_visual/039mcr,.analysis/raw-migration/character-image-candidate/birthday_visual/040ren,.analysis/raw-migration/character-image-candidate/birthday_visual/041ryo,.analysis/raw-migration/character-image-candidate/birthday_visual/042dai `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/batch-038tak-039mcr-040ren-041ryo-042dai-backup-20260727-final `
  --confirm=birthday_visual:038tak+039mcr+040ren+041ryo+042dai

npm run character:promotion-publish-batch -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/043kaz,.analysis/raw-migration/character-image-candidate/birthday_visual/044ame,.analysis/raw-migration/character-image-candidate/birthday_visual/045sor,.analysis/raw-migration/character-image-candidate/birthday_visual/046chr,.analysis/raw-migration/character-image-candidate/birthday_visual/047shu `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/batch-043kaz-044ame-045sor-046chr-047shu-backup-20260727-final `
  --confirm=birthday_visual:043kaz+044ame+045sor+046chr+047shu

npm run character:promotion-publish-batch -- `
  --candidate-dirs=.analysis/raw-migration/character-image-candidate/birthday_visual/048mom,.analysis/raw-migration/character-image-candidate/birthday_visual/049eis `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/batch-048mom-049eis-backup-20260727-final `
  --confirm=birthday_visual:048mom+049eis

python ..\data_pipeline\extract_raw_character_image_candidate.py `
  birthday_visual 101ken --identity-scope npc

npm run character:promotion-publish -- `
  --candidate-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/101ken `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/101ken/stable-backup-20260727-final `
  --confirm=birthday_visual:101ken

python ..\data_pipeline\extract_raw_character_image_candidate.py `
  event_story_visual 001tom

npm run character:promotion-publish -- `
  --candidate-dir=.analysis/raw-migration/character-image-candidate/event_story_visual/001tom `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/event_story_visual/001tom/stable-backup-20260727-final `
  --confirm=event_story_visual:001tom

python ..\data_pipeline\extract_raw_character_image_candidate.py `
  event_story_visual 002sht

npm run character:promotion-publish -- `
  --candidate-dir=.analysis/raw-migration/character-image-candidate/event_story_visual/002sht `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/event_story_visual/002sht/stable-backup-20260727-final `
  --confirm=event_story_visual:002sht

python ..\data_pipeline\extract_raw_audio_candidate.py `
  --raw-root ..\RAW --kind bgm --container usual_day.awb --cue usual_day `
  --selection 1 --output-root .analysis\raw-migration\audio `
  --vgmstream "E:\Program Files\vgmstream-win64\vgmstream-cli.exe" `
  --ffmpeg "D:\Program Files\ffmpeg\bin\ffmpeg.exe"

python ..\data_pipeline\audit_raw_audio_coverage.py `
  --raw-root ..\RAW `
  --music-catalog public\data\masterdata\music_catalog.json `
  --compiled-root public\data\compiled `
  --output .analysis\raw-migration\audio\audit.json

python ..\data_pipeline\index_raw_audio_cues.py `
  --raw-root ..\RAW `
  --compiled-root public\data\compiled `
  --output-root .analysis\raw-migration\audio\cue-index `
  --vgmstream "E:\Program Files\vgmstream-win64\vgmstream-cli.exe" `
  --workers 12

python ..\data_pipeline\audit_raw_story_voice_gaps.py `
  --coverage .analysis\raw-migration\story\coverage.json `
  --cue-index .analysis\raw-migration\audio\cue-index\cue_index.json `
  --raw-root ..\RAW `
  --public-voice-root public\assets\voice `
  --legacy-voice-root E:\BaiduNetdiskDownload\SideM\story_viewer\voice_ogg `
  --output .analysis\raw-migration\story\voice_gap_audit.json

npm run story:raw-promotion-candidate -- `
  --current=public/data/compiled/1_x_001tom_2_1_2_001_12.json `
  --compatibility=.analysis/raw-migration/1_x_001tom_2_1_2_001_12/compiled/compatibility/1_x_001tom_2_1_2_001_12.json `
  --authoritative=.analysis/raw-migration/1_x_001tom_2_1_2_001_12/compiled/authoritative/1_x_001tom_2_1_2_001_12.json `
  --output-dir=.analysis/raw-migration/story-promotion/1_x_001tom_2_1_2_001_12 `
  --scenario-id=1_x_001tom_2_1_2_001_12
```

Candidate outputs remain under ignored `.analysis/`; they are not production
assets.

## Live-chibi audio source-contract slice

Commit `4f69af1` is the first live/chibi helper migration. The song builder now
defaults to configured `RAW/audio` and configured media tools, while retaining
explicit overrides and the existing stable output path. The old and new
`song3_drvalv.acb` inputs are byte-identical
(`B655D57D8A7AEC20C73E39B823AB9296D28AAF0766CC954A026AFF7CF96450D2`).

The bounded proof used two modes:

```powershell
# Non-destructive stable regression: existing derivatives are reused.
python scripts\prepare-live-chibi-audio.py --song-code drvalv

# Forced extraction only in ignored candidate space.
python scripts\prepare-live-chibi-audio.py `
  --song-code drv999 --force `
  --output-root .analysis\raw-migration\live-chibi-audio
```

The first mode left stable `drvalv.m4a` and `index.json` byte-exact. The second
produced a `drv999.m4a` byte-identical to the stable file. Port 5174 then
confirmed the real five-character stage could start the official audio, advance
its shared clock, render choreography/lyrics, and pause. No stable asset was
published or replaced.

## Live Backmonitor source-contract slice

Commit `f20d014` makes configured `RAW/movie` the physical default for the
Backmonitor builder while retaining organizer-era `liveeffectscript` CSVs as
declared semantic references. The 260-file RAW movie domain is not uniformly
classified: 77 CSV-referenced USMs are now proven live Backmonitor assets;
183 still need card/event/announcement/tutorial/system classification.

All 77 referenced old/new USM pairs are byte-identical. Bounded forced
extraction of one loop and one color/alpha transition produced three MP4s
byte-identical to stable. A mirror of the full index remained byte-identical
after a selected rebuild, proving the merge path does not collapse the existing
73-movie/4-transition catalog.

```powershell
python scripts\prepare-live-chibi-backmonitor.py `
  --asset live_backmonitor_movie_ballade_01 `
  --force `
  --output-root .analysis\raw-migration\live-chibi-backmonitor\candidate

python scripts\prepare-live-chibi-backmonitor.py `
  --asset live_backmonitor_movie_alpha_blackout `
  --force `
  --output-root .analysis\raw-migration\live-chibi-backmonitor\candidate
```

Port 5174 then exercised the actual DRIVE A LIVE 2,500 ms Backmonitor switch:
the loop became ready, the blackout transition activated and later retired,
and no Backmonitor media error appeared. Stable videos and index stayed
unchanged.

## Next batches

1. Migrate `prepare-live-chibi-image-layers.py` alone, using an ignored output
   root and port-5174 consumer check before any stable replacement.
2. Extend the proven single-story promotion gate to multi-part aggregate
   collections and promote another small representative batch.
3. Continue the proven `001tom`/`002sht` event-story visual consumer in another
   bounded batch; keep the complete birthday domain unchanged.
4. Classify the remaining 183 non-Backmonitor RAW USMs against master-data
   consumers.
5. Continue promoting verified domains one reversible batch at a time, with
   5174 acceptance and rollback evidence before each stable-path replacement.
