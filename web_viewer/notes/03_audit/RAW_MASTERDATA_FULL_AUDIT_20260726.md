# RAW + Master Data Full Resource Audit

Started: 2026-07-26
Last updated: 2026-07-27
Repository: `E:\Web_build\SideM_Archived`
Branch: `codex/post-merge-story-handoff`

## Executive conclusion

The archive can change from an organizer-package-first pipeline to a
master-data-plus-RAW pipeline.

The authority boundary is:

1. master data supplies semantic IDs, titles, grouping, unlock relations, and
   cross-domain relations;
2. `RAW/asset`, `RAW/audio`, and `RAW/movie` supply original physical payloads;
3. Unity object metadata and ACB cue metadata supply subresource identity;
4. organizer-created image/audio packages remain comparison and browser-format
   references only;
5. stable `public/` URLs are promoted one domain and one verified batch at a
   time.

This is not yet a statement that every public resource has been regenerated.
Cards, ADV backgrounds, costumes/Spine, idol settings, the complete RAW story
structural inventory, the complete RAW audio cue inventory, the complete
table-133 seasonal BGM relation, and representative browser candidates have
strong evidence.
Twelve authored story voice references have been proven to be dangling in RAW
and are explicitly waived without replacement audio.
Movies, general UI images, stable character-image promotion, and multi-story
stable promotion still require domain-specific audits.

## 1. Source integrity

The clean extracted RAW tree contains:

| Section | Files | Physical formats |
| --- | ---: | --- |
| `asset` | 8,639 | Unity bundles |
| `audio` | 4,098 | 4,055 ACB + 43 AWB |
| `movie` | 260 | USM |
| archive metadata | 3 | TXT |
| total | 13,000 | 8,232,049,221 bytes |

The earlier archive-member comparison found zero missing members, zero extra
members, and zero size differences. A new SHA-256 file manifest is generated
under the ignored path:

`web_viewer/.analysis/raw-migration/source/files.jsonl`

During audio work, 268 range-enumeration WAVs and three candidate-metadata WAVs
were detected because they were absent from the 13,000-member archive baseline.
All 271 were moved out of `RAW/audio` into the ignored recoverable quarantine:

`web_viewer/.analysis/raw-migration/generated-wav-quarantine/`

RAW was then re-counted and re-manifested at exactly 13,000 files. The cue
indexer no longer uses vgmstream range mode, and candidate metadata inspection
now explicitly uses metadata-only mode. A fresh candidate extraction kept the
RAW WAV count at zero.

## 2. Master-data products in scope

The current site has normalized master-data products for:

- backgrounds;
- card summaries and card detail;
- costumes;
- events;
- face names;
- gasha records and announcements;
- home interactions;
- idol episodes;
- idols and units;
- Mobile communication;
- songs and BGM;
- seasonal campaigns and communication;
- short ADV profiles;
- speakers;
- story hierarchy and presentation;
- work stories;
- validation and migration reports.

These JSON files are projections, not physical-resource authorities. Their
`_source` fields preserve table/field/offset evidence and should remain in
generated data.

## 3. Domain status matrix

| Domain | Semantic authority | RAW physical source | Current evidence | Status |
| --- | --- | --- | --- | --- |
| stories | story master/presentation + Unity container namespace | `scenario_*.unity3d` | 1,435 bundles; 3,398 logical stories; 4,939/4,939 parts compile and match public identity; 12 authored dangling voice refs explicitly waived | full structural coverage proven |
| lipsync | resolved RAW voice-bank identity | `lipsync_*.unity3d` | 3,234/3,234 unique referenced voice banks have matching lipsync bundles | full resolved-bank coverage proven |
| cards | card master `resource_id` | `card_<resource_id>.unity3d` | 826/826 unique resources | full physical coverage proven |
| ADV backgrounds | catalog/story background ID | `adv_background_<id>.unity3d` | catalog 192/192; story IDs 356/356 | full referenced coverage proven |
| songs | master song code | `song3_<code>.acb` | 61/61 master codes and exact cues | full identity coverage proven |
| story BGM | compiled cue ID | same-stem ACB/AWB | 105/105 referenced IDs have containers | full referenced coverage proven |
| story ambient | compiled environmental cue | same-stem ACB/AWB | 83/83 non-sentinel cues have containers | full referenced coverage proven |
| story SE | compiled SE cue + ACB sequence metadata | multi-cue ACB bank | 435/435 classified; `waribashi` composite reconstructed | full identity and representative sequence semantics proven |
| master seasonal BGM | table 133 relation + ACB action metadata | variant cues/banks | 92/92 classified; 42/42 switches resolved | full identity relation proven |
| character/costume/Spine | costume/idol dictionaries + Unity object identity | `costume_*`, `idol_settings_*`, `image_chara*` | 690/690 master costumes; 725 full Spine + 3 RAW silhouette-only; 257/257 idol-setting JSON assets; all 485 character-image paths classified | costume/Spine/idol settings proven; character-image consumers mapped, promotion partial |
| live/chibi | song/choreography IDs | `live_*`, `song_*`, image/object layers | representative song playback proven | partial |
| movies | event/live/card movie relations | 260 USM | filename inventory only | pending |
| general UI images | master records + bundle object names | 1,271 `image_*` bundles | no full relation table yet | pending |

## 4. Card-only question

RAW does contain the card-only physical content.

- master data has 836 card rows;
- tutorial/alias rows reuse ten resources;
- there are 826 unique `resource_id` values;
- RAW has exactly 826 `card_<resource_id>.unity3d` bundles;
- missing unique resources: 0;
- extra RAW card bundles: 0.

Organizer-created card image packages are therefore not required for card
identity. They remain useful regression evidence.

Each card bundle may contain both a full `Texture2D` and one or more cropped
Unity `Sprite` objects. The organizer exports do not consistently choose the
same layer. The RAW candidate pipeline therefore preserves:

- `textures/` for full Texture2D exports;
- `sprites/` for Sprite Rect exports;
- `resolved/` for the current Sprite-preferred runtime choice.

N/R/SR/SSR candidates all rendered normal and awakened `640x800` portraits in
5174. The SSR sample also rendered two `1800x960` landscape images.

## 4.1 Character, costume, and Spine evidence

The costume dictionary contains 690 unique `model_resource_id` values. All
690 have an exact `RAW/asset/costume_<model>.unity3d` bundle. RAW contains 728
costume bundles in total; the additional 38 are NPC/guest models such as
`101ken`, `104omn`, and the `sub` series, rather than organizer-created
duplicates.

All 728 bundles have now been classified from their Unity objects:

| Classification | Count | Evidence |
| --- | ---: | --- |
| full communication Spine | 725 | `comu.atlas`, `comu.skel`, and `comu` texture |
| silhouette-only | 3 | only one silhouette Texture2D/Sprite pair; no TextAsset or prefab |
| ambiguous | 0 | no unclassified costume bundle |

The current public Spine directory names are exactly the same 728-model set.
The 725 full rigs all have `comu.atlas`, `comu.png`, and `comu.skel`; the other
three directories contain no false core files. More importantly, all 1,450
RAW serialized TextAsset objects (`725 × atlas/skel`) are byte-identical to
the current public files. The representative `001tom_002_00` RAW `comu`
texture and public `1924×1924` PNG are also pixel-identical.

The three RAW-proven silhouette-only costume models are:

- `104omn_001_00`;
- `231sub_001_00`;
- `242sub_001_00`.

Each has a current public silhouette PNG, and each occurs in real compiled
stories. They now join the previously audited `102sha_001_00` runtime
exception, so the player goes directly to the silhouette instead of requesting
known-absent Spine files. `102sha_001_00` remains a separate legacy case: RAW
contains no same-name costume bundle, so it is not counted among the three
costume classifications.

The 5174 acceptance route used real aggregate story `1_4_002_00`, bounded to
steps 6–10. At ADV step 7 the screen rendered `104omn_001_00` as the intended
black silhouette over `bg089_waitingroom_in_01`. Runtime diagnostics reported
zero Spine instances, one silhouette with ID `104omn`, zero pending
silhouettes, and no console warning/error.

The three current public silhouette PNGs have the same cropped dimensions as
their RAW Sprite objects but are not pixel-identical. Therefore this batch does
not replace those PNGs. The runtime association change and a future image
provenance comparison remain separate decisions.

RAW has 85 `idol_settings_*` bundles: all 49 master idols plus 36 NPC/guest
identities. Across them are 257 JSON TextAssets:

| Setting kind | RAW assets | Current projection semantically equal |
| --- | ---: | ---: |
| motion | 84 | 84 |
| mouth | 87 | 87 |
| other | 86 | 86 |

The counts exceed one-per-bundle where a bundle carries costume-specific
variants. There are no missing, extra, or semantically different current
setting identities. This proves that organizer directories are no longer
needed as the authority for these settings.

The narrower character-image inventory covers all 57 `image_chara*` bundles:
485 unique container paths, each represented by both a Texture2D and Sprite.
Current public assets have exact-basename representatives for 187 paths:
80 character icons, 52 Mobile backgrounds, and 55 Mobile icons. Every one of
the other 298 paths is now classified by original client surface and compared
with its current archive consumer:

| Category | Paths | Identity coverage | Current archive behavior |
| --- | ---: | --- | --- |
| birthday visual | 49 | all 49 master idols + `101ken`; `012yus`/`013kys` share one visual | 32 idol mappings use 31 stable RAW-derived URLs; 18 physical visuals remain on fallback |
| event-story visual | 51 | all 49 master idols + `101ken`/`102sha` | event detail uses general character icons |
| Mobile bust-up | 51 | all 49 master idols + `101ken`/`102sha` | Mobile archive uses icon + room background |
| name plate | 49 | all 49 master idols | ADV UI renders speaker text with CSS |
| sign | 49 | all 49 master idols | idol detail has no signature slot |
| idol-story visual | 49 | all 49 master idols | idol-story header uses general character icon |

There are zero unclassified paths and every category covers all 49 master
idols. This resolves physical identity and the intended consumer family, but
it does not assert that all six original surfaces should replace the archive's
current presentation. In particular, name plates need a localization/layout
audit and Mobile bust-ups need a conversation-screen ownership decision before
promotion.

### First character-image candidate

Birthday visuals have the strongest first consumer because
`ArchiveStoryDetail` already owns a bounded `visualUrl`, while the birthday
branch currently falls back to the generic story image. The isolated
`birthday_visual:001tom` candidate records:

- RAW bundle:
  `RAW/asset/image_chara_birthday_visual_001tom.unity3d`;
- source SHA-256:
  `2590eb0feefa7cc23aa5ab7f16b965a42fb84103d5aff12e001621fc4ab6f6f0`,
  equal to the 13,000-file manifest;
- exact Sprite container path and PathID;
- master idol `001tom`, birthday `3月3日`, and four birthday-master rows whose
  compiled filename is owned by `1_x_001tom_*`;
- Sprite output `801×875`, SHA-256
  `a572186d263b52c2d70f9f2598304b2c89530f491595cc6561094ad4cf20ef2a`;
- zero current public files with the original basename.

The Vite candidate route serves only allow-listed kinds and six-character idol
codes from ignored `.analysis`; the UI displays it only with
`raw_character_candidate=birthday_visual:001tom`. The target idol is derived
from the compiled filename (`1_x_<idol>_*`), not merely from the cast list, so
Jupiter's shared 2022 birthday stories cannot select the wrong member visual.

The only shared birthday asset is also explicitly proven:
`012yus` and `013kys` both resolve to
`image_chara_birthday_visual_012yus-013kys` from the same source bundle hash
`870a62220a98b6e8ac22b01339fbda2ea8efe4d1cf728e6a17e108a6f68a65ee`.
Both candidates produce the same `1109×826` PNG hash
`7be1b676459a964c054b0fc5658ba69442513486b9e0d495ad3d9eab0449f99e`,
while their manifests retain three distinct master birthday rows per idol.

On 5174, the candidate route rendered the full RAW image at its natural
`801×875` size inside the birthday story detail. The same route without the
query flag retained the existing fallback and loaded no candidate image.
Both candidate and control also reproduced the same pre-existing
`decodeAudioData` error despite `noAudio=1`; that audio initialization issue is
not caused by the image path and remains separate follow-up work.

### First stable birthday-visual promotion

`birthday_visual:001tom` is now the first character image promoted through a
domain-specific registry and rollback gate. The stable pair is:

- registry:
  `public/data/assets/raw_character_image_promotions.json`;
- asset:
  `public/assets/stories/birthday/image_chara_birthday_visual_001tom.png`;
- stable URL:
  `/assets/stories/birthday/image_chara_birthday_visual_001tom.png`.

Publishing re-opens the exact RAW bundle and candidate PNG and verifies their
byte counts and SHA-256 hashes before writing either stable file. It also
requires exact `birthday_visual:001tom` confirmation, one single-idol Sprite
identity, birthday master rows owned by `1_x_001tom_*`, a candidate below
ignored `.analysis`, an empty backup directory below `.analysis`, and an
absent unregistered target. The registry records the exact Unity container and
decimal-string PathID `1704761937170686496`; using a string is required because
this identity exceeds JavaScript's safe integer range.

The first stable publication records:

- RAW bundle SHA-256:
  `2590eb0feefa7cc23aa5ab7f16b965a42fb84103d5aff12e001621fc4ab6f6f0`;
- output `801×875`, 355,496 bytes, SHA-256
  `a572186d263b52c2d70f9f2598304b2c89530f491595cc6561094ad4cf20ef2a`;
- pre-promotion registry SHA-256
  `406e9052d7c5782d0e70febbe2a12d5a9e72046854bdac2684c4c7909900ddc3`;
- final registry SHA-256
  `758bfe9d1668b602e39bf032e5e190c3fc6f72513cb7dabca7547f00681413df`;
- old stable asset state: absent.

The publisher writes the asset and registry as one recoverable operation. Any
injected asset/registry/report failure restores the previous registry and
removes the additive asset. The explicit rollback command additionally refuses
to act if either promoted hash drifted.

The real 5174 acceptance sequence was publish, browser check, explicit
rollback, browser check, then final republish:

1. without a query parameter, `001tom` loaded the stable URL at natural
   `801×875` with no fallback;
2. rollback restored the empty registry hash, removed the PNG, and the same
   route returned to zero images plus the original fallback;
3. after final republish, the no-query route again loaded the stable URL;
4. the explicit candidate query still selected
   `/assets/character-candidate/birthday_visual/001tom.png`;
5. unpromoted `002sht` still loaded zero images and retained the fallback.

This browser pass accepted image association and layout only; it does not
supersede the separately recorded `noAudio=1` audio-initialization defect.
The final ignored rollback evidence is:

`web_viewer/.analysis/raw-migration/character-image-candidate/birthday_visual/001tom/stable-backup-20260727-final-v2/`

### Second stable birthday visual and non-empty-registry proof

`birthday_visual:002sht` is the second additive promotion. Unlike the first
publication, this run started with the committed `001tom` entry and asset.
Before accepting a new candidate, the publisher now re-opens every existing
registry asset and verifies its URL boundary, exact decimal-string PathID, PNG
dimensions, byte count, and SHA-256. A damaged or missing existing asset blocks
the new publication.

The `002sht` evidence is:

- RAW bundle:
  `RAW/asset/image_chara_birthday_visual_002sht.unity3d`;
- RAW SHA-256:
  `d205b564b0ba27aad07558553bbf05b623b665c9a601fb37da66572354b75f74`;
- exact Sprite PathID string: `-5810813441337302374`;
- four birthday-master rows owned by compiled files beginning
  `1_x_002sht_*`;
- output `730×824`, 325,759 bytes, SHA-256
  `edf893abdb34971e847da9c78032593618ddb932ad75a117334987c27500db67`;
- stable URL:
  `/assets/stories/birthday/image_chara_birthday_visual_002sht.png`.

The real second-entry sequence again performed publish, browser acceptance,
explicit rollback, browser acceptance, and final republish. The initial
registry SHA-256 was the exact one-entry hash
`758bfe9d1668b602e39bf032e5e190c3fc6f72513cb7dabca7547f00681413df`.
After the first publish both `001tom` (`801×875`) and `002sht` (`730×824`)
loaded their stable URLs. Rollback removed only `002sht`, restored the exact
one-entry registry hash, and returned its route to the fallback while
`001tom` remained loaded and byte-identical. The final two-entry registry
SHA-256 is
`9b524139be7c0df551f020c3ffa05c316d35f3087d90ed294fbf7c028d4c5ef7`.

The final 5174 pass loaded both stable images without fallbacks. Visual
inspection confirmed that `002sht` fits the existing birthday-detail panel
without clipping. The final ignored rollback evidence is:

`web_viewer/.analysis/raw-migration/character-image-candidate/birthday_visual/002sht/stable-backup-20260727-final/`

### Shared birthday visual promotion

The only shared birthday Sprite is now promoted through a separate group
contract rather than being duplicated as two independent resources. The group
confirmation is `birthday_visual:012yus+013kys`; both candidate directories are
required, and both manifests must contain the exact identity set
`["012yus", "013kys"]`.

The group gate proves that both owner-specific manifests have identical:

- RAW bundle path, byte count, and SHA-256;
- Unity container, exact PathID, asset name, and Sprite Rect;
- PNG byte count, dimensions, and SHA-256.

Each manifest must still retain its own master ownership: three compiled files
beginning `1_x_012yus_*` and three beginning `1_x_013kys_*`. Missing one
identity, differing candidate output, incomplete confirmation, an interrupted
registry write, or a partial shared registry is rejected. The single-idol
publisher continues to reject this asset.

The shared evidence is:

- RAW bundle:
  `RAW/asset/image_chara_birthday_visual_012yus-013kys.unity3d`;
- RAW SHA-256:
  `870a62220a98b6e8ac22b01339fbda2ea8efe4d1cf728e6a17e108a6f68a65ee`;
- exact PathID string: `-2746721419655100402`;
- stable PNG `1109×826`, 480,735 bytes, SHA-256
  `7be1b676459a964c054b0fc5658ba69442513486b9e0d495ad3d9eab0449f99e`;
- one physical stable URL:
  `/assets/stories/birthday/image_chara_birthday_visual_012yus-013kys.png`;
- two registry entries pointing to that URL, each carrying
  `shared_identity_ids`.

The real group sequence started from the two-entry registry SHA-256
`9b524139be7c0df551f020c3ffa05c316d35f3087d90ed294fbf7c028d4c5ef7`.
After publish, both owner routes loaded the same stable URL at natural
`1109×826`. Explicit group rollback removed both mappings and the one PNG,
restored the exact two-entry registry hash, and returned both routes to their
fallback while `001tom` remained stable. Final republish produced four idol
mappings backed by three physical URLs. The final registry SHA-256 is
`becc2bb172430cfe7a017883aceab3686131f587051767e675d51b64da4a9ec2`.

Final 5174 visual inspection showed the two-idol composition fully contained
inside the existing story-detail panel. The final ignored rollback evidence
is:

`web_viewer/.analysis/raw-migration/character-image-candidate/birthday_visual/012yus-013kys-stable-backup-20260727-final/`

### First atomic multi-image birthday batch

The first bounded multi-image batch promotes `003hok`, `004ter`, and `005kao`
as one transaction. Each candidate still passes the complete single-idol gate,
including current RAW hash, exact Sprite identity, master ownership, PNG
dimensions/hash, existing-registry validation, and an absent stable target.
The batch then requires the full explicit confirmation
`birthday_visual:003hok+004ter+005kao`.

The three records are:

| idol | RAW SHA-256 | PathID | output | PNG SHA-256 | master rows |
| --- | --- | --- | --- | --- | ---: |
| `003hok` | `00e7cd4a873de200c2304ee1dca39c8051f3f8d1a4f9c4eec48f8dd7757dea92` | `8982863484449506530` | `786×837`, 314,628 bytes | `a66c0fdc5bb37939a9933ddc623178ab2103a9d9e264cb447e1afabb9af63cb8` | 4 |
| `004ter` | `c70d1b7b1e71af2c5f8b9ec8e31ec0fc51310cce0368b64161b063be60743854` | `3602356276066031871` | `975×869`, 344,689 bytes | `21b644f589631f82d7e47202e1f10e04cee51b9c5e1d41ad9f3038e596f95e30` | 4 |
| `005kao` | `3871ceba7d3b4069f3259b78330d085de0e2b8d022517bcc730d30540d0e0c1f` | `1892783551249285074` | `609×821`, 296,127 bytes | `552546a3ad317294fadbb2d73e136e3634493165089cb2b40124051134691d0b` | 3 |

The batch backup manifest records the registry once and all three asset states.
Duplicate candidates, incomplete confirmation, failure while writing the
second PNG, failure after all PNGs but before registry publication, current
asset drift, and incomplete final hashes are covered. Every failure restores
the original registry and removes all newly written PNGs. Batch rollback
similarly verifies the current registry and all three promoted hashes before
restoring anything; rollback failure re-applies the complete promoted state.

The real publish started from the four-mapping/three-URL registry SHA-256
`becc2bb172430cfe7a017883aceab3686131f587051767e675d51b64da4a9ec2`.
All three candidate routes first loaded from ignored `.analysis`. After
publication, all three no-query routes loaded their stable URLs and the
existing shared birthday image remained available. Explicit batch rollback
removed all three PNGs, restored the exact baseline registry hash, returned
all three routes to fallback, and kept existing resources intact. Final
republish leaves seven idol mappings backed by six physical URLs; registry
SHA-256 is
`0e6c6c738479ff496c69336b1f6accc21f78378062d02ebf5bd2301b8bfb4740`.

Final 5174 visual inspection covered the widest new image (`004ter`, 975
pixels) and narrowest (`005kao`, 609 pixels); both were contained correctly.
The browser control surface also emitted one unrelated remote Statsig telemetry
timeout to `ab.chatgpt.com`; it was not a 5174 application request and did not
affect DOM or asset validation. Final ignored rollback evidence:

`web_viewer/.analysis/raw-migration/character-image-candidate/birthday_visual/batch-003hok-004ter-005kao-backup-20260727-final/`

### Five-image bounded birthday batch

The next batch promotes `006tsu`, `007kei`, `008rei`, `009kyj`, and `010pie`.
The batch API now enforces a hard maximum of five candidates; a six-item call
is rejected before candidate assessment. This makes the repository's gradual
migration rule executable rather than relying only on operator convention.

| idol | RAW SHA-256 | PathID | output | PNG SHA-256 | master rows |
| --- | --- | --- | --- | --- | ---: |
| `006tsu` | `fb67d1f730664d03ca41843a4db7248e14a36f4ef86e4e64e8f6282b29d8d9a5` | `-8280902255413043889` | `1088×874`, 476,818 bytes | `7983ae264144a90811eba916d30073fa098bf5e213decc43ccfd9b984b3a48e7` | 3 |
| `007kei` | `b98f7cbe8cb1423a3e07b4762b31642d7c6499a5fffdb3b7e36b7401b71be7e3` | `-126247317626979540` | `1107×838`, 358,940 bytes | `090dd824aabb6ec94a59c16dba272553ba205787927cf7f96f1a950cff4aafb2` | 4 |
| `008rei` | `cf7162fc5e63fa2aa1eb894d2fa3f54cd4b051398ffd7689c84c14645885d21c` | `-5985898852289501109` | `746×881`, 283,524 bytes | `6cdfe6fd2a4ffe6a61a6af4a0c4dbc187bc23f3130334b509685cab5847e9cfb` | 3 |
| `009kyj` | `87dbd965429508c48b5ef7aa92b788238b4a11262f12e0b43d45b884205c390d` | `-768001593005162926` | `860×856`, 385,006 bytes | `aefd35e8fb33739dfb0b6f704254c3d6b44d4b9f4db7695fa5db56b60d2123c3` | 4 |
| `010pie` | `8be74f2cf8f1a4d0c80e77039e76ec9d142b66f155174b69827a7deb7efbb667` | `-6635513665076385639` | `843×898`, 388,437 bytes | `8a32d2c784f706acfb04d30cd1888e994a8fad6538ef259890f1537742363dac` | 3 |

All five ignored candidate routes loaded first. The real batch publish started
from the seven-mapping/six-URL registry SHA-256
`0e6c6c738479ff496c69336b1f6accc21f78378062d02ebf5bd2301b8bfb4740`.
All five stable routes then loaded while the earlier `003hok` asset remained
available. Explicit whole-batch rollback removed all five PNGs, restored the
exact baseline hash, returned all five routes to fallback, and preserved every
previous promotion. Final republish leaves twelve idol mappings backed by
eleven physical URLs; registry SHA-256 is
`061f00fd8b72109f7a263fc1e3ab71a82435fe79dd153bfe60e676044cf78f79`.

Final DOM checks covered every route. Visual checks covered the widest output
(`007kei`, 1107 pixels) and narrowest (`008rei`, 746 pixels); both fit the
existing panel. The browser control surface repeated its unrelated remote
Statsig timeout, while all local DOM and 5174 resource checks completed.
Final ignored rollback evidence:

`web_viewer/.analysis/raw-migration/character-image-candidate/birthday_visual/batch-006tsu-007kei-008rei-009kyj-010pie-backup-20260727-final/`

### Second five-image bounded birthday batch

The next master-order batch promotes `011min`, `014hid`, `015ryu`, `016sei`,
and `017kir`. Each candidate resolved to one exact Sprite identity and was
generated under ignored `.analysis/` before any stable path changed.

| idol | RAW SHA-256 | PathID | output | PNG SHA-256 | master rows |
| --- | --- | --- | --- | --- | ---: |
| `011min` | `a951b66453de2836a3cc6fb7dcec21c16f3cfcfa285b1771262743c2b32589c8` | `6347870598022394189` | `812×842`, 376,237 bytes | `08675f2afa7294b74e0d0e54f260629f16ac70c142eac589e412dce06e5cc035` | 4 |
| `014hid` | `c7b8421d1d2f879b8313dc05342002647ade26a340416c4e4028c017ca7f40ef` | `-1827195483708291138` | `956×841`, 335,606 bytes | `bec903356f54d601538a8447de8ad1fd63e4594704879b27e72336b088a28099` | 4 |
| `015ryu` | `40d1a6c2fef42cb8086b602eece4d523a32c114df632783329d63001258fc788` | `-7974334565183057656` | `926×839`, 304,815 bytes | `fd74f1543f7134ee064c300e8c643afe45fa3df907169b99d6d3b6bdce5174df` | 3 |
| `016sei` | `38ee10f0e36d49f3a7f618cce9fa7cb16c4824d795486ee9479e69cb17d86cae` | `2109130252596898194` | `858×855`, 296,604 bytes | `0a76da1eb25a13aa600cfdd2bf775385368260366adb71f977e003c0f6fd77bb` | 4 |
| `017kir` | `e843442e9cf355c3256a903c9d7d9f862d42ae763dabb5fd847052f7959616b4` | `8646653807885103205` | `1188×870`, 676,549 bytes | `f3789384dcda3e88eb6d5afd41f15b85cd7b4872c6761afcd24be38d23150632` | 4 |

All five candidate routes loaded at their natural dimensions before
publication. The real stable publish started from the twelve-mapping,
eleven-URL registry SHA-256
`061f00fd8b72109f7a263fc1e3ab71a82435fe79dd153bfe60e676044cf78f79`.
All five stable routes then resolved without the candidate query parameter.
Explicit whole-batch rollback restored that exact registry hash, removed all
five new PNGs, returned the five routes to fallback, and left `010pie`
available at `843×898`. Final republish leaves seventeen idol mappings backed
by sixteen physical URLs; registry SHA-256 is
`ead36216820b63b7b274ad281488fbe625a3d773f6f88f684d77d24ae955547e`.

Final DOM checks covered all five routes. Visual inspection covered the
narrowest new image (`011min`, 812 pixels) and widest (`017kir`, 1188 pixels);
both fit the existing story-detail panel. The browser control surface again
reported an unrelated Statsig timeout to `ab.chatgpt.com`; all local 5174 DOM
and image requests completed successfully. Final ignored rollback evidence:

`web_viewer/.analysis/raw-migration/character-image-candidate/birthday_visual/batch-011min-014hid-015ryu-016sei-017kir-backup-20260727-final/`

### Third five-image bounded birthday batch

The next master-order batch promotes `018shm`, `019kur`, `020hay`, `021jun`,
and `022nat`. Each candidate resolved to one exact Sprite identity, matched the
tracked RAW source manifest, and had no existing public exact-basename match.

| idol | RAW SHA-256 | PathID | output | PNG SHA-256 | master rows |
| --- | --- | --- | --- | --- | ---: |
| `018shm` | `99487e5ec5710c88bac7f1228ba4aa0db4cff1c6b5f399284f3ebb960e24491d` | `4083446340310980541` | `1202×863`, 591,578 bytes | `5f7d1817c2f0773e7dffc4f19f9bb43980ad2b5e74e4263e84c54f72366562fc` | 3 |
| `019kur` | `6180f81dade3a5a6f92d83a9ff5a24df522daaf35866fb04e05292546c7b27bb` | `-7541408428981436444` | `874×824`, 371,602 bytes | `0f1ac21c5568dbbb736958038b378edc138654b583c0c199531ab8d79c71a71a` | 3 |
| `020hay` | `517f28497690adf9d0fe74181ca462f03cff4ffe9b874c40791b6ed19a31ccc5` | `8995473977128221475` | `976×827`, 411,657 bytes | `89a73a04f2184ea20f1d01fa9f24761fb9e133ef2c19902ac95712d3efd3b86e` | 4 |
| `021jun` | `7e61df1cdac2309d3a591866ee1f274912d10b18908f997453ce15f732608a51` | `-1079152942904299386` | `1159×801`, 354,078 bytes | `ecbc005484f0373aeae6ffd0399301ba5b0c254398625d03b843e6277ad6d66c` | 4 |
| `022nat` | `ef846e5d2187fb459163770332cd6a0124d052fe0b87a60e04760dcce183fefd` | `-5858754875459902066` | `983×819`, 343,334 bytes | `9d215b3c4fcf5ebc8a8079a68d5664a1cd33daf823582fc109ff2084f74b67c5` | 3 |

All five ignored candidate routes loaded first at their exact natural
dimensions. The real stable publish started from the seventeen-mapping,
sixteen-URL registry SHA-256
`ead36216820b63b7b274ad281488fbe625a3d773f6f88f684d77d24ae955547e`.
All five stable routes then resolved without the candidate query parameter,
while `017kir` remained available at `1188×870`. Explicit whole-batch rollback
restored that exact registry hash, removed all five new PNGs, returned the five
routes to fallback, and preserved `017kir`. Final republish leaves twenty-two
idol mappings backed by twenty-one physical URLs; registry SHA-256 is
`79a9d92f963049d48ce95b7e78286cc537b710c6a1f4a206811d4822fbc7e5ca`.

Final DOM checks covered all five routes. Visual inspection covered the widest
new image (`018shm`, 1202 pixels) and narrowest (`019kur`, 874 pixels); both fit
the existing story-detail panel. Final ignored rollback evidence:

`web_viewer/.analysis/raw-migration/character-image-candidate/birthday_visual/batch-018shm-019kur-020hay-021jun-022nat-backup-20260727-final/`

### Fourth five-image bounded birthday batch

The next master-order batch promotes `023har`, `024shk`, `025suz`, `026gen`,
and `027yuk`. Each candidate resolved to one exact Sprite identity, matched the
tracked RAW source manifest, and had no existing public exact-basename match.

| idol | RAW SHA-256 | PathID | output | PNG SHA-256 | master rows |
| --- | --- | --- | --- | --- | ---: |
| `023har` | `da57c26c79756b6dce80c4c4de3e3644c52feb0b1426d8352d5d353ded4ac4f2` | `6274914879522109866` | `1800×960`, 765,427 bytes | `f2a056e1f269e11561067379ece592ca68fe6f3d42847ff9a5f84bb32c7aafb3` | 4 |
| `024shk` | `273c28c5ccc20a3fccda00ff1199860bb0561cec103cb860f7b4142d8608f069` | `-2665266097907987525` | `765×892`, 355,823 bytes | `74b593a01a4cdcb7827a900ce3786f0ea061d1083b326287925e20b57250e3d4` | 4 |
| `025suz` | `2cc2e0971ecdaa0fdaff8bc1f1146d7afc6437b82266605055a9373fff354710` | `1264523719426961948` | `740×933`, 465,081 bytes | `f48dc2256355f95c1d8e01b41ad8fabd9e7022530f29c7480293e2f1fefab1c0` | 4 |
| `026gen` | `f21536d84b81511e493dbdab3ea9fcb8a60d14cccf4d14b8d471cde08c5630c9` | `-1047053079907757995` | `724×889`, 378,288 bytes | `fdb18f9597cf14fe8f1628d7190fe0c8a188f40eef840350521c4c18a62ba7d5` | 3 |
| `027yuk` | `1248e6cff2dcf9a72d43ba5096c414f822537fc41b3b4a0e7a672c096da15ebe` | `-261943468093583930` | `916×842`, 333,074 bytes | `d45bc2fa1a7b3cc0f3a40f789c5598d3caef9b70db5f680a705e2ec948355a07` | 4 |

All five ignored candidate routes loaded at their exact natural dimensions.
The real stable publish started from the twenty-two-mapping, twenty-one-URL
registry SHA-256
`79a9d92f963049d48ce95b7e78286cc537b710c6a1f4a206811d4822fbc7e5ca`.
All five stable routes then resolved without the candidate query parameter,
while `022nat` remained available at `983×819`. Explicit whole-batch rollback
restored that exact registry hash, removed all five new PNGs, returned the five
routes to fallback, and preserved `022nat`. Final republish leaves twenty-seven
idol mappings backed by twenty-six physical URLs; registry SHA-256 is
`5353936027c438cc7713cbbde3f179c0b46fa74e8b9f4288ac4e96c210d07759`.

Final DOM checks covered all five routes. Visual inspection covered the
landscape `023har` output (`1800×960`) and the narrowest output (`026gen`, 724
pixels); both fit the existing story-detail panel. The browser control surface
again reported unrelated Statsig timeouts to `ab.chatgpt.com`; all local 5174
DOM and image checks succeeded. Final ignored rollback evidence:

`web_viewer/.analysis/raw-migration/character-image-candidate/birthday_visual/batch-023har-024shk-025suz-026gen-027yuk-backup-20260727-final/`

### Fifth five-image bounded birthday batch

The next master-order batch promotes `028soi`, `029ass`, `030mak`, `031sak`,
and `032nao`. Each candidate resolved to one exact Sprite identity, matched the
tracked RAW source manifest, and had no existing public exact-basename match.

| idol | RAW SHA-256 | PathID | output | PNG SHA-256 | master rows |
| --- | --- | --- | --- | --- | ---: |
| `028soi` | `a80205ae2c72d5ec50987280e478de6d9711b6f3d3868c6b37b0a311e3c0eb46` | `7689127519335195737` | `895×830`, 285,014 bytes | `75b6466cf7a89cd3fa447246a5cd4928d7aa354d8fc93feb2932e2dc87eee594` | 4 |
| `029ass` | `fc2fa3e7e587bbff405dab190a144030389ae137bfb56a07db3f2baec6d40b9e` | `9001415395409568943` | `1077×825`, 436,845 bytes | `bf5c38a248d4241d8cce01071d2ca0d5675cff5c09be9f75bb49fd6ad2ec8bc1` | 4 |
| `030mak` | `dff7cc4c2676eda3f703080d4045e1e0274f1aa5f1c9eb16dbcc4dec3d4a3c83` | `1019936051257360751` | `1038×819`, 346,056 bytes | `904b026b8882af6fd1e0ee802ba556d0ef2a675cb8b769e18d6c04dc61095cfc` | 4 |
| `031sak` | `3ca889304a602125adb0d8b6b736f93fdcddd4f7c2cb2f1b6d0b6880fc2131a9` | `-2128585307808258559` | `878×860`, 376,447 bytes | `96b680a6225f9cecf89b35a6617272028b79e722ed009127d58a7586ab28c43c` | 3 |
| `032nao` | `6f0b01bd58465b25c4f47bf1957e7b6ee55a317a28aaeb46d7553481014654d2` | `7734075291173605705` | `949×831`, 333,886 bytes | `65ce92e9838b54199c7a66f3647ebee2b3661280cfa404d257d42c0c879e0d23` | 4 |

All five candidate routes passed page identity, non-empty DOM, framework
overlay, URL, title, and natural-dimension checks. The `028soi` detail-page
interaction also entered `view=player`, rendered a stage canvas, and exposed
the player controls. The real stable publish started from the
twenty-seven-mapping, twenty-six-URL registry SHA-256
`5353936027c438cc7713cbbde3f179c0b46fa74e8b9f4288ac4e96c210d07759`.
All five stable routes then resolved without the candidate query parameter,
while `027yuk` remained available at `916×842`. Explicit whole-batch rollback
restored that exact registry hash, removed all five new PNGs, returned the five
routes to fallback, and preserved `027yuk`. Final republish leaves thirty-two
idol mappings backed by thirty-one physical URLs; registry SHA-256 is
`213b1c1c782345ff896b13b1ba69da4097f04c7f748c65527d1cdc6afa2485a8`.

Final DOM checks covered all five routes. Visual inspection covered the widest
new output (`029ass`, 1077 pixels) and narrowest (`031sak`, 878 pixels); both
fit the existing story-detail panel. Console inspection consistently exposed
the pre-existing `noAudio=1` `useVoicePlayer` null-`AudioContext` decode error
for `2_2_001_01_00_01.m4a`; it was present before stable replacement and is
not caused by these images. The browser control surface also reported an
unrelated Statsig timeout to `ab.chatgpt.com`; local 5174 checks succeeded.
Final ignored rollback evidence:

`web_viewer/.analysis/raw-migration/character-image-candidate/birthday_visual/batch-028soi-029ass-030mak-031sak-032nao-backup-20260727-final/`

The ignored report records each contributing bundle's path, size, and SHA-256
from the established 13,000-file source manifest:

`web_viewer/.analysis/raw-migration/character/coverage.json`

## 5. Story and background evidence

The RAW-only `1_4_001_01` candidate includes:

- 10 scenario parts;
- 13 lipsync containers;
- 13 voice ACB containers;
- 432 compiled steps;
- 10 episode boundaries;
- 139/139 exact voice cue memberships.

Ignoring provenance-only fields, its authoritative form is semantically equal
to the published scenario.

### Full RAW story inventory

The tracked all-bundle audit now reads the Unity container path and PathID for
every TextAsset instead of relying on `m_Name` alone. This distinction is
required: eleven bundles contain same-name, different-payload TextAssets, but
their container paths place them under different semantic namespaces such as
`scenariodata/001tom_301` and `scenariodata/028soi_302`. They are different
card stories, not old/new versions from which one may be discarded.

The full result is:

| Metric | Count |
| --- | ---: |
| RAW scenario bundles | 1,435 |
| all TextAssets | 4,942 |
| valid `scenario_*` JSON TextAssets | 4,939 |
| logical story groups recovered from container namespaces | 3,398 |
| compiler successes | 3,398 |
| compiler failures | 0 |
| compiled steps | 70,652 |
| RAW parts represented by the current public identity | 4,939 / 4,939 |
| logical groups with one unique public match | 3,398 / 3,398 |

The three excluded TextAssets are `chat_01`, `chat_02`, and non-JSON
`scenario_dummy`. The current public directory has four files outside the
3,398 RAW scenario mapping: the two chat files, `_test_se_env`, and an old
`scenario_2_4_040_01_00_compiled` duplicate.

The namespace grouping also recovers the organizer-era public filename
relation directly from RAW. For example:

- container path namespace: `scenariodata/1_x_001tom_2`;
- physical resource: `scenario_1_2_001_12`;
- public semantic identity:
  `1_x_001tom_2_1_2_001_12`.

No organizer directory is needed to recover that prefix.

### Full story voice and lipsync coverage

The 3,398 compiled groups contain 26,902 voice references:

- 26,890 resolve to indexed RAW cues;
- 12 remain unresolved;
- 3,234 unique resolved voice ACB banks are referenced;
- all 3,234 have same-stem RAW lipsync bundles;
- across stories there are 4,200 story-to-bank relations, all with lipsync.

The resolver records its evidence method rather than silently rewriting names:
exact cue, source-part number, resource prefix, timed-bank letter removal,
timed-bank regular fallback, and redundant container-bank prefix removal.

The twelve unresolved references were audited separately and are now
classified as `raw_authored_dangling`:

- two cues (`c1004`, `b1008`) authored in `1_1_007_01_a` but absent from the
  corresponding RAW voice banks;
- `1_5_037_03_3009`, while the bank contains 3002, 3003, 3004, 3006, 3008,
  and 3010 but not 3009;
- nine `2_3_013_02_09_a*` references in
  `013kys_302_2_3_002_01_09_a`. RAW has similarly numbered `2_4_013_02`
  cues, but the two scenarios contain different dialogue and different cue
  sequences. They must not be substituted.

For all twelve:

- the expected ACB bank exists, proving that the surrounding bank was not
  omitted from the backup;
- the exact cue is absent from the indexed ACB metadata;
- the same-stem lipsync Unity bundle exists, but its TextAssets omit the exact
  voice name too;
- no exact public M4A exists;
- no exact organizer-era `story_viewer/voice_ogg` OGG exists.

Only `2_4_013_02_09_a1000` exists under the superficially similar `2_4`
prefix. Its pajama-party-stream dialogue differs from the mountain-work phone
dialogue in `2_3`, and the rest of the sequence is numbered
`a2000-2004`/`a3000-3005`, not the nine missing `2_3` cues. The audit therefore
records it as `not_equivalent_story_do_not_substitute`.

The runtime keeps the authored dialogue and exact voice field but recognizes
only these twelve `scenario_id + voice` pairs as known dangling references.
It logs an explicit informational diagnostic and skips the guaranteed 404
requests. It does not add aliases or silence any other missing voice.

5174 browser acceptance covered:

- `1_1_007sai_01_1_1_007_01`, `c1004.m4a`: the `にゃあ！` line remained
  visible and the runtime logged the known-dangling skip with no prepare
  failure;
- `013kys_302_2_3_002_01_09_a`,
  `2_3_013_02_09_a1000.m4a`: the correct Kyosuke phone dialogue remained
  visible and the same skip policy was used;
- normal control `1_x_001tom_2_1_2_001_12`: the runtime still registered
  `1_2_001_12_a1000.m4a` as an active dialogue source.

The ignored evidence reports are:

- `web_viewer/.analysis/raw-migration/story/coverage.json`;
- `web_viewer/.analysis/raw-migration/story/voice_gap_audit.json`.

ADV background evidence:

- 394 RAW ADV background bundles;
- 192/192 master background-catalog IDs match exact RAW bundles;
- 356/356 compiled-story background IDs match exact RAW bundles;
- every RAW ADV background currently has a public PNG;
- six public PNGs are deliberate legacy/non-RAW aliases.

The browser candidate for `bg001_315pro_in_01` rendered the correct
`1800x960` image in the bounded EP10 story route with three Spine characters
and dialogue.

## 6. Complete RAW audio inventory

The resumable audio index covers:

| Metric | Count |
| --- | ---: |
| logical ACB banks | 4,055 |
| external AWB partners | 43 |
| indexed streams | 33,651 |
| unique cue aliases | 33,754 |

All 43 AWBs have a same-stem ACB. They are original external-wave-bank pairs,
not organizer derivatives. `usual_day.acb`, for example, contains the cue-sheet
metadata while the decodable HCA stream and loop points are in
`usual_day.awb`.

### Story SE coverage

Compiled story data references 435 unique SE cue strings:

- 433 resolve to one or more decodable RAW streams;
- two resolve to non-waveform ActionTrack controls in
  `se_commu_action.acb`;
- unclassified cues: 0.

The controls are:

- `00_action_volume_down_sebgm`;
- `00_action_volume_default_sebgm`.

They must not be fetched as sound files. The runtime now recognizes them as
non-waveform controls and skips audio loading. Their exact original control
curve remains a separate semantic reconstruction task.

### Same-name ambiguity

Thirteen story SE cues have more than one indexed entry.

- twelve ordinary/telephone duplicates decode to byte-identical WAV output and
  may be safely folded at the browser-derivative layer;
- `waribashi` has two distinct streams in `se_commu_2022.acb`, with durations
  0.529 and 0.505 seconds.

The neutral comparison classification is `distinct_decoded_waveforms`; it does
not assert that the cue randomly selects one waveform.

`waribashi` occurs in one actual scenario, `1_1_012_03_e`. Collection,
episode, and old compiled projections account for the repeated JSON hits. The
two organizer packages each retained only one half:

- `GS_Res/Audio/sfx/waribashi.ogg` is a 0.529-second Vorbis file matching the
  first decoded RAW stream;
- `story_viewer/voice_ogg/waribashi.ogg` is actually a 0.505-second PCM WAV
  despite its suffix, and its SHA-256 exactly matches the second decoded RAW
  stream.

The ACB metadata proves temporal composition rather than random variation:

- `CueTable`: cue ID 110, Sequence reference 60, length 1033 ms, two related
  waveforms;
- `SequenceTable`: Type 0, two tracks, indices 60 and 61;
- track 60 starts at 0 ms and references waveform 60 / selection 159;
- track 61 contains `0x07d1 00000211`, a 529 ms start delay, and references
  waveform 61 / selection 160;
- 529 ms + 505 ms is approximately the authored 1033 ms cue length.

This interpretation also agrees with CRI's official Atom Craft documentation:
Sequence Type 0 is Polyphonic, tracks may have timeline start offsets, and
`DelayTimeMS` is the track playback start time:

- <https://game.criware.jp/manual/adx2_tool_en/latest/criatom_tools_atomcraft_cue_type.html>
- <https://game.criware.jp/manual/adx2_tool_en/latest/criatom_tools_atomcraft_atombinary_json.html>
- <https://game.criware.jp/manual/adx2_tool_en/latest/criatom_tools_atomcraft_api_refparam_workunittree.html>

The tracked sequence extractor now emits both isolated segments plus a
1.040-second composed AAC candidate. It preserves every raw event command,
including `0x07d5 016c`; that command's exact meaning is unknown and is not
simulated or guessed.

### Master BGM distinction

All 61 song codes have exact `song3_<code>` cues.

Only 39 of the 92 `music_catalog.json` BGM records are exact waveform cue
names. The other 53 are table-133 control or container resources rather than
missing sound files. They are now classified as:

| Resource role | Count | Physical meaning |
| --- | ---: | --- |
| waveform cue | 39 | directly decodable HCA stream |
| switch ActionTrack cue | 42 | selects one of six running waveform cues |
| base ActionTrack cue | 7 | controls the six contextual waveform cues |
| ACB bank identifier | 4 | seasonal cue sheet/container name |

The concrete waveform family includes:

- `bgm_main_day_a`;
- `bgm_main_day_a_sub`;
- `bgm_main_day_b`;
- `bgm_main_day_c`;
- `bgm_main_day_d`;
- `bgm_main_day_story_sub`.

No BGM catalog resource remains unresolved.

### Table 133 and ACB action mapping

Table 133 contains 56 complete rows:

- four `season_id` groups: Christmas, New Year, Valentine, and White Day;
- 14 source states per group: day/night base plus six contextual states;
- field 3: normal source selector;
- field 4: seasonal ACB bank;
- field 5: seasonal base ActionTrack cue;
- field 6: seasonal selector.

The old projection retained only `row_id` and the field number on each resource,
which lost the four-way row relation. `music_catalog.json` schema 2 now keeps:

- all 56 records in `seasonal_switch_rows`;
- `season_id`, role, and field on every legacy `seasonal_variants` item;
- the set of table-133 roles on every affected BGM record;
- 61 songs and all 92 prior BGM records unchanged.

The ACB `@UTF` metadata proves that base and switch names are not audio
waveforms. Their `CueTable` rows report zero related waveforms, and their
`SequenceTable` rows point to `ActionTrackTable` actions. Every switch has six
targets. One target uses a command index that occurs once while the other five
share another command index. This recovers all 42 selections:

| Switch suffix | Selected concrete cue suffix |
| --- | --- |
| `sw_main` | `a` |
| `sw_work` | `b` |
| `sw_story` | `c` |
| `sw_idol` | `d` |
| `sw_main_sub` | `a_sub` |
| `sw_story_sub` | `story_sub` |

The rule resolves 42/42 switch cues, all selected targets exist in the full RAW
waveform index, and the structural-anomaly count is zero. The ignored evidence
report is:

`web_viewer/.analysis/raw-migration/audio/master-bgm/selector_mapping.json`

It records the master-data, catalog, cue-index and five inspected ACB hashes,
all 56 complete relation rows, the ACB action targets, and the selected concrete
waveform for every switch.

## 7. Browser candidate verification

No candidate changes a default production URL. Opt-in query parameters select
ignored `.analysis` outputs.

Verified on port 5174:

- story candidate JSON;
- N/R/SR/SSR card matrix;
- ADV background sample;
- `usual_day` BGM;
- `ambi_room` ambient loop;
- `step_walk_come_lino_boot` ordinary SE;
- `flash_in` from `se_commu_2022.acb`;
- `phone_rusuden_start` from `se_telephone.acb`;
- `2_4_003_02_09_c1900_t` from a story-specific bank;
- reconstructed `waribashi` two-track composite from `se_commu_2022.acb`;
- standalone RAW story `1_x_001tom_2_1_2_001_12` recovered from its Unity
  namespace;
- `bgm_main_christmas_day_a` selected by the Christmas `sw_main` ActionTrack;
- `DRIVE A LIVE` in the multi-character live stage.

The long story-specific SE was verified with:

- the exact RAW-derived candidate URL;
- `se_cache_entries: 1`;
- one registered SE source;
- AudioContext transition from `suspended` to `running`;
- source age advancing beyond two seconds.

The seasonal BGM was extracted from
`RAW/audio/bgm_system_christmas.awb`, selection 2:

- source SHA-256:
  `22206da46cc01500be788cf3c106f0dabee74642f821a03ccfe99bc2e77b7ad0`;
- source cue aliases: `bgm_main_christmas_day_a` and
  `bgm_main_christmas_day_a_sub`;
- output duration: 79.277 seconds, stereo AAC/M4A;
- candidate HTTP response: 200 `audio/mp4`;
- browser AudioContext: `suspended` before the user gesture, then `running`;
- registered runtime cue: `bgm_main_christmas_day_a`;
- source age observed at 2.64 seconds.

The opt-in browser probe requires both
`raw_audio_candidate=bgm:<cue>` and `raw_bgm_probe=<cue>`. It replaces only the
effective BGM requested by the bounded QA route. No default story or stable
asset URL changes.

The `waribashi` verification used the bounded actual episode route for
`episodes/1_1_012_03_e.json`, steps 21-24, with
`raw_audio_candidate=se:waribashi`:

- segment selection 159: HTTP 200 `audio/mp4`, 0.529 seconds;
- segment selection 160: HTTP 200 `audio/mp4`, 0.505 seconds;
- composed cue: HTTP 200 `audio/mp4`, 1.040 seconds;
- candidate manifest: HTTP 200 JSON;
- runtime log: `step-23:000:se-waribashi`;
- AudioContext state after the user gesture: `running`.

The one-shot source had normally ended before the periodic diagnostics
snapshot. The runtime trigger log, running context, exact candidate routing
unit check, and independent candidate HTTP/probe evidence are therefore kept
together instead of requiring a short-lived source to remain registered.

The standalone story candidate proves that the full-inventory rules also work
outside the original merged sample:

- source: `scenario_1_2_001_12.unity3d`;
- Unity container path:
  `assets/resources/scenariodata/1_x_001tom_2/scenario_1_2_001_12.json`;
- one scenario TextAsset, 20 compiled steps;
- three voice ACB banks and three matching lipsync bundles;
- 15/15 voice references resolved;
- candidate JSON returned HTTP 200 on 5174;
- browser route loaded two Spine characters and Japanese dialogue;
- runtime registered `1_2_001_12_a1001.m4a`;
- AudioContext was `running` and source age advanced to 0.87 seconds.

The compatibility migration report confirms unchanged step identity/type
sequence, dialogue voice/lip, cue profile, choice targets, and source
text/speaker. The generic compatibility report remains false because the new
candidate adds authoritative episode, evidence, and text-identity fields. A
dedicated RAW single-story promotion gate now distinguishes the permitted
episode metadata additions from forbidden runtime/text drift, and this sample
has been promoted through that narrower gate.

The live stage reported audio ready and advanced from 0:00 to 0:19 while
choreography and singer positions changed.

## 8. Promotion contract

A RAW-derived candidate may replace a stable path only when all of these are
recorded:

1. semantic ID and master-data evidence;
2. exact RAW container and object/cue identity;
3. source file SHA-256;
4. extraction selection, Sprite Rect, or stream index;
5. output dimensions/audio probe and SHA-256;
6. comparison with the current published derivative;
7. 5174 browser rendering or real playback;
8. build and domain regression checks;
9. rollback hash for the previous stable artifact;
10. a domain-scoped Git commit.

Failures or ambiguity keep the candidate isolated. They do not fall back to
organizer folder layout as authority.

### First stable RAW story promotion

`1_x_001tom_2_1_2_001_12.json` is the first standalone story promoted through
the RAW-specific gate. The promotion manifest records:

- current legacy hash:
  `sha256:a0fe2085c1ad9d62998196ae29a668eaf8a7ea3061840c4872a3ce80a7d4d089`;
- RAW compatibility hash:
  `sha256:75ae25e331305fb77ce858d735eba2c105fad193a050b93b11b267c8b3bd7ab0`;
- strict authoritative hash:
  `sha256:274cbd61b618de80a3bda317cfbef7133448ca7bafad1ec3d1f196d879c8cbff`;
- source bundle hash:
  `sha256:ead326dc81e3b8263d3aa974614a5e5d48514fd5125283fb598caaf5a606383b`;
- 20 steps, 15 voice references;
- 41 accepted differences, all limited to adding the top-level episode record
  and `episode_index`/`episode_part` to the 20 steps;
- zero disallowed scene, cue, choice, voice/lip, or source-text differences;
- zero non-empty inline localized fields and zero scenario overlay files.

The gate rejects any non-empty legacy `*_cn` value because strict v2 moves
localization out of compiled JSON. Existing translation overlays are hashed
and revalidated against candidate `source.raw_hash`, unit IDs, and per-unit
source hashes. An overlay cannot silently become stale during promotion.

Candidate build cannot target `public/`. Publishing requires the exact
scenario ID, re-runs all evidence checks against the current target, requires
an empty backup directory outside the compiled corpus, writes atomically,
verifies the final hash, and restores the exact backup on failure.

A mirror-corpus publish was completed before the stable write. The stable
backup and its manifest are under the ignored path:

`web_viewer/.analysis/raw-migration/story-promotion/1_x_001tom_2_1_2_001_12/stable-backup-20260727/`

The backup hash equals the old public hash. After stable publication, the
formal 5174 route rendered the same Japanese dialogue and two Spine
characters, registered `ambi_library_shop_cafe` plus
`1_2_001_12_a1000.m4a`, and reported no voice preparation failure. Switching
the UI to Chinese preserved the current step and used the source-text fallback
because this story has no translation overlay.

## 9. Remaining work in priority order

1. Extend the proven single-story gate to multi-part aggregate collections,
   then promote another small representative batch rather than all 3,398 at
   once.
2. Keep the other 18 physical birthday visuals isolated; they cover 17
   remaining master idols plus `101ken`. Promote another small sample only
   after its own 5174 and rollback evidence, and keep the NPC on a separate
   identity gate.
3. Map all 260 USM files to live-stage, card, event, and announcement semantics.
4. Audit the remaining 1,271 general `image_*` bundles by Unity object name and
   master-data consumer.
5. Reconstruct any additional non-waveform ActionTrack, sequence, loop, or
   switch semantics only when their ACB structure is proven.
6. Promote verified domains into stable public paths in small reversible
   commits, never as one bulk replacement.

## 10. Reproduction

```powershell
python ..\data_pipeline\raw_source_manifest.py `
  --raw-root ..\RAW `
  --output .analysis\raw-migration\source\files.jsonl `
  --summary .analysis\raw-migration\source\summary.json

python ..\data_pipeline\audit_raw_story_coverage.py `
  --raw-root ..\RAW `
  --cue-index .analysis\raw-migration\audio\cue-index\cue_index.json `
  --compiled-root public\data\compiled `
  --source-manifest .analysis\raw-migration\source\files.jsonl `
  --output .analysis\raw-migration\story\coverage.json

python ..\data_pipeline\verify_raw_story_identity.py

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

npm run character:promotion-rollback-batch -- `
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

npm run character:promotion-rollback -- `
  --registry=public/data/assets/raw_character_image_promotions.json `
  --assets-root=public/assets `
  --backup-dir=.analysis/raw-migration/character-image-candidate/birthday_visual/012yus-013kys-stable-backup-20260727-final `
  --confirm=birthday_visual:012yus+013kys

python ..\data_pipeline\audit_raw_story_voice_gaps.py `
  --coverage .analysis\raw-migration\story\coverage.json `
  --cue-index .analysis\raw-migration\audio\cue-index\cue_index.json `
  --raw-root ..\RAW `
  --public-voice-root public\assets\voice `
  --legacy-voice-root E:\BaiduNetdiskDownload\SideM\story_viewer\voice_ogg `
  --output .analysis\raw-migration\story\voice_gap_audit.json

python ..\data_pipeline\extract_raw_story_candidate.py `
  --raw-root ..\RAW `
  --scenario-container ..\RAW\asset\scenario_1_2_001_12.unity3d `
  --scenario-id 1_x_001tom_2_1_2_001_12 `
  --output-dir .analysis\raw-migration\1_x_001tom_2_1_2_001_12 `
  --cue-index .analysis\raw-migration\audio\cue-index\cue_index.json

npm run story:raw-promotion-candidate -- `
  --current=public/data/compiled/1_x_001tom_2_1_2_001_12.json `
  --compatibility=.analysis/raw-migration/1_x_001tom_2_1_2_001_12/compiled/compatibility/1_x_001tom_2_1_2_001_12.json `
  --authoritative=.analysis/raw-migration/1_x_001tom_2_1_2_001_12/compiled/authoritative/1_x_001tom_2_1_2_001_12.json `
  --output-dir=.analysis/raw-migration/story-promotion/1_x_001tom_2_1_2_001_12 `
  --scenario-id=1_x_001tom_2_1_2_001_12

npm run story:raw-promotion-publish -- `
  --candidate-dir=.analysis/raw-migration/story-promotion/1_x_001tom_2_1_2_001_12 `
  --compiled-dir=public/data/compiled `
  --backup-dir=.analysis/raw-migration/story-promotion/1_x_001tom_2_1_2_001_12/stable-backup-20260727 `
  --confirm-scenario=1_x_001tom_2_1_2_001_12

python ..\data_pipeline\index_raw_audio_cues.py `
  --raw-root ..\RAW `
  --compiled-root public\data\compiled `
  --output-root .analysis\raw-migration\audio\cue-index `
  --vgmstream "E:\Program Files\vgmstream-win64\vgmstream-cli.exe" `
  --workers 12

python ..\data_pipeline\compare_raw_audio_cue_variants.py `
  --raw-root ..\RAW `
  --coverage .analysis\raw-migration\audio\cue-index\story_se_coverage.json `
  --vgmstream "E:\Program Files\vgmstream-win64\vgmstream-cli.exe" `
  --output .analysis\raw-migration\audio\cue-index\ambiguous_decode_comparison.json

python ..\data_pipeline\extract_raw_acb_sequence_candidate.py `
  --raw-root ..\RAW `
  --cue-index .analysis\raw-migration\audio\cue-index\cue_index.json `
  --cue waribashi `
  --kind se `
  --output-root .analysis\raw-migration\audio `
  --vgmstream "E:\Program Files\vgmstream-win64\vgmstream-cli.exe" `
  --ffmpeg "D:\Program Files\ffmpeg\bin\ffmpeg.exe" `
  --ffprobe "D:\Program Files\ffmpeg\bin\ffprobe.exe"

python ..\data_pipeline\masterdata_extract.py $env:SIDEM_MASTER_DATA_PATH `
  --music-catalog-only `
  --out-dir .analysis\raw-migration\masterdata-music-generated `
  --public-out-dir public\data\masterdata

python ..\data_pipeline\audit_master_bgm_selector_mapping.py `
  --master-data $env:SIDEM_MASTER_DATA_PATH `
  --music-catalog public\data\masterdata\music_catalog.json `
  --cue-index .analysis\raw-migration\audio\cue-index\cue_index.json `
  --raw-root ..\RAW `
  --output .analysis\raw-migration\audio\master-bgm\selector_mapping.json
```

Generated evidence remains ignored under `.analysis`. Reproducible scripts,
runtime guards, and this audit document are tracked in Git.
