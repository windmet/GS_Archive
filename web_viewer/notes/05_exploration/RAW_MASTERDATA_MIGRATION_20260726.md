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

## Next batches

1. Extend the proven single-story promotion gate to multi-part aggregate
   collections and promote another small representative batch.
2. Keep the remaining 28 physical birthday images isolated and promote another
   bounded batch only after its own 5174 and rollback evidence. The 27
   master idols and `101ken` NPC remain distinct identity scopes.
3. Map all 260 RAW USM files to master-data consumers.
4. Continue promoting verified domains one reversible batch at a time, with
   5174 acceptance and rollback evidence before each stable-path replacement.
