# Gasha Skill Exact Relations

Status: merged in PR #15 as `a9ea2012e1e55c158050424c146b743f17e87700`

Date: 2026-07-30

## Scope

This batch refines only complete bundle IDs matching:

```text
image_gasha_skill_<speaker-id>_<ssr02|ssr03>
```

It adds exact bundle-to-idol relations from the committed speaker dictionary.
It does not export, decode, replace, or publish image payloads.

An exact relation is emitted only when:

1. the complete bundle ID matches the bounded pattern;
2. the speaker ID is one exact key in the committed speaker dictionary;
3. the row identifies an `idol`;
4. the bundle already carries the exact delimiter-bounded speaker token.

## Population

The current RAW population contains exactly 12 matching bundles:

| Variant | Bundles |
| --- | ---: |
| `ssr02` | 7 |
| `ssr03` | 5 |
| total | 12 |

Every covered bundle contains exactly one Sprite and one Texture2D. Both image
object names exactly equal the complete bundle ID. The 12 speaker IDs are
unique, and each resolves to one committed idol row.

## Relation record

Each `exact_speaker_relations` record contains:

- committed speaker ID;
- speaker type `idol`;
- committed display name;
- committed numeric idol ID;
- fixed asset role `gasha-skill`;
- observed rarity variant `ssr02` or `ssr03`;
- fixed relation type `exact_bundle_filename_speaker_code`.

The `ssr02` and `ssr03` values are retained as observed filename variants. This
contract does not infer a card, skill, or gasha release identity beyond the
speaker relation.

## Mapping boundary

After P1-H, the complete 1,271-bundle catalog records:

| State | Bundles |
| --- | ---: |
| `stable-promotion` | 50 |
| `exact-masterdata-relation` | 170 |
| `organizer-export-candidate` | 2 |
| `masterdata-candidate` | 90 |
| `filename-candidate` | 959 |

The 170 exact-masterdata bundles comprise 98 gasha banner/logo bundles, 20
event item-icon bundles, 40 honor-event bundles, and these 12 gasha-skill
bundles.

## Verification

The verifier independently reconstructs every relation from the bundle ID and
committed speaker dictionary. It requires:

- exact generated/reconstructed record equality;
- matching `speaker_dictionary.speakers` token evidence;
- 12 relations across 12 unique speaker IDs;
- exactly 7 `ssr02` and 5 `ssr03` relations;
- one rarity variant per covered speaker;
- all normal source-only and mounted image-catalog checks.

Validated locally:

```text
RAW image bundle relation catalog verified (source-only):
1271 bundles / 7816 image objects

RAW image bundle relation catalog verified (mounted):
1271 bundles / 7816 image objects

Vite production build:
2405 modules / PASS in 144.2 seconds
```

Deterministic catalog SHA-256:

```text
545E5C9D760F11173BF0A3434EC25516EE4224F954A4676E7B7E8734F77A2C95
```

## Remaining candidate boundary

After this batch, 90 `masterdata-candidate` bundles remain:

- 7 aggregate `chara` bundles with many speaker identities;
- 76 gasha banner/logo/background bundles whose numeric token belongs to an
  event or seasonal namespace, not the committed gasha index;
- 2 aggregate `mobile` bundles with many speaker identities;
- 1 aggregate `picturestudio` bundle with many speaker identities;
- 4 shop bundles whose code exists in both event and seasonal-campaign
  namespaces.

Those candidates do not satisfy the same one-bundle/one-authority proof and
must not be batch-promoted by token presence alone.

## Exclusions

This batch does not:

- infer card or skill semantics from `ssr02` or `ssr03`;
- reinterpret event-code collisions as gasha identities;
- upgrade aggregate multi-speaker bundles;
- export PNG;
- alter stable assets;
- create publication-ledger records;
- execute the deferred Runtime long soak.
