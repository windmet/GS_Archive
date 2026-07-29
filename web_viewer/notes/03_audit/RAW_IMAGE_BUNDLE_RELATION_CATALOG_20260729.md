# RAW Image Bundle Relation Catalog

Status: implemented on `codex/image-bundle-relation-catalog`; pending review

Date: 2026-07-29

## Scope

This batch establishes a machine-readable identity and relation catalog for all
mounted `RAW/asset/image_*.unity3d` bundles. It reads Unity metadata but does
not render, decode, export, copy, publish, or add any image payload to Git.

The committed authority surface is:

```text
schemas/image-bundle-relation-catalog-v1.schema.json
public/data/image_bundle_relation_catalog.json
scripts/generate-image-bundle-relation-catalog.py
scripts/verify-image-bundle-relation-catalog.mjs
```

Each bundle records:

- relative RAW path, bytes, SHA-256, and `UnityFS` magic;
- complete Unity object-type counts;
- container path, object type, and exact decimal-string PathID;
- every Sprite and Texture2D name, PathID, dimensions, and container paths;
- direct Sprite-to-Texture2D PathID where serialized directly;
- exact delimiter-bounded masterdata identity candidates;
- filename-family consumer candidates;
- tracked public-PNG basename parity candidates;
- a candidate-only mapping state and evidence.

The catalog contains no machine absolute paths.

## Population

| Metric | Value |
| --- | ---: |
| RAW image bundles | 1,271 |
| RAW bytes | 263,071,090 |
| Unity objects | 9,157 |
| container entries | 7,826 |
| image objects | 7,816 |
| Sprite objects | 3,928 |
| Texture2D objects | 3,888 |
| direct Sprite-to-Texture2D links | 3,885 |
| image-object metadata reads | 7,816 / 7,816 |

The 43 Sprites without direct Texture2D PathIDs belong to the serialized atlas
case, including the emoji atlas. They remain cataloged with Sprite identity,
rect, and container evidence; the catalog does not invent a direct pointer.

Two `Font Texture` Texture2D records in
`image_loginbonus_normal_release` are legitimately `0×0`. They are retained as
observed metadata rather than rewritten as missing or positive dimensions.

Family population:

| Family | Bundles | Family | Bundles |
| --- | ---: | --- | ---: |
| `gasha` | 433 | `item` | 192 |
| `honor` | 166 | `picturestudio` | 135 |
| `bg` | 101 | `shop` | 66 |
| `chara` | 57 | `campaign` | 32 |
| `live` | 18 | `home` | 16 |
| `shoplineup` | 14 | `title` | 11 |
| `story` | 8 | `unit` | 8 |
| all other bounded families | 14 | | |

## Relation boundary

Mapping states are candidates, not publication claims:

| State | Bundles |
| --- | ---: |
| `organizer-export-candidate` | 52 |
| `masterdata-candidate` | 260 |
| `filename-candidate` | 959 |

There are 865 exact delimiter-bounded masterdata tokens across 310 bundles.
The allowed sources are the committed speaker, event, gasha, and seasonal
campaign indexes. A numeric identity only matches at numeric boundaries, so
`10001` does not falsely match `100001`. Idol codes use alphanumeric
boundaries, including the paired `012yus-013kys` identity.

The 52 organizer-export candidate bundles contain 136 image objects whose
container/object basename equals at least one tracked public PNG basename.
This is parity-discovery evidence only. It does not assert byte equality,
semantic ownership, or authorization to replace a stable asset.

Consumer names are derived from the top-level `image_<family>` filename token.
They remain `filename-candidate`, even where the family is well understood.

## Verification

Source-only verification checks:

- strict JSON Schema 2020-12;
- deterministic sorted, unique bundle identities and RAW paths;
- summary byte, Unity-object, container, image-object, family, and mapping
  totals;
- bidirectional container-to-object relations;
- exact decimal-string PathIDs;
- successful name/dimension reads, including legitimate zero dimensions;
- direct Sprite pointers target a Texture2D inside the same bundle;
- exact masterdata identity existence and delimiter boundaries;
- tracked public candidate existence and exact basename evidence;
- mapping-state precedence;
- absence of absolute paths;
- the current `1,271 bundles / 7,816 image objects` boundary.

Mounted verification additionally checks:

- exact equality with the live `RAW/asset/image_*.unity3d` filename population;
- byte count;
- `UnityFS` magic;
- SHA-256 for all 1,271 files.

Validated locally on 2026-07-29:

```text
RAW image bundle relation catalog verified (source-only):
1271 bundles / 7816 image objects

RAW image bundle relation catalog verified (mounted):
1271 bundles / 7816 image objects

Archive baseline verified (source-only):
10329 compiled JSON artifacts, 108 tracked PNG files

Archive baseline verified (mounted):
10329 compiled JSON artifacts, 108 tracked PNG files
```

Regenerating the catalog produced the same catalog SHA-256:

```text
790066A9A1731DCE4223743B3BCA96F3A7ABA993F2FC187A71F1BCB2C74ADC47
```

The source-only GitHub gate now runs the catalog verifier. The archive baseline
report embeds the committed relation summary, so the 1,271-bundle population is
machine-verifiable without mounting ignored RAW.

## Next boundary

This phase is complete when the branch passes review and merges. Any follow-up
should select a bounded family and improve semantic relations without rewriting
physical identity. It must remain separate from:

- full PNG export;
- stable asset replacement;
- organizer-export promotion;
- Story Runtime long-soak acceptance;
- publication-ledger transactions.
