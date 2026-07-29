# RAW Image Bundle Relation Catalog

Status: base catalog merged in PR #9; character relation refinement merged in
PR #10

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
- exact stable-promotion relations when independently recorded by the existing
  character-image promotion registry;
- a mapping state and evidence that preserves candidates separately from exact
  stable relations.

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

Mapping states now distinguish pre-existing stable character promotions from
discovery candidates:

| State | Bundles |
| --- | ---: |
| `stable-promotion` | 50 |
| `organizer-export-candidate` | 2 |
| `masterdata-candidate` | 260 |
| `filename-candidate` | 959 |

The 50 stable bundles carry 52 exact promotion relations. The difference is
the shared `012yus-013kys` birthday visual and the paired event-story visual
bundle: each has two registry identities but one physical RAW bundle. Every
relation is cross-checked against the committed promotion registry, including
RAW bytes/hash, exact Unity object PathID/type/name/container, target PNG
bytes/hash, kind, idol code, and asset URL.

There are 865 exact delimiter-bounded masterdata tokens across 310 bundles.
The allowed sources are the committed speaker, event, gasha, and seasonal
campaign indexes. A numeric identity only matches at numeric boundaries, so
`10001` does not falsely match `100001`. Idol codes use alphanumeric
boundaries, including the paired `012yus-013kys` identity.

The original 52 organizer-export candidate bundles contain 136 image objects whose
container/object basename equals at least one tracked public PNG basename.
Fifty are no longer inferred from basename alone because the promotion registry
already proves their stable identities. The remaining two retain
`organizer-export-candidate`; basename parity by itself does not assert byte
equality, semantic ownership, or authorization to replace a stable asset.

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
- exact parity with all 52 character-image promotion registry entries;
- stable RAW, Unity-object, and tracked-output bytes/hash evidence;
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

After the character relation refinement, regenerating the catalog produced:

```text
6D2C239557CC6D209868FD89288F39535E79BDA26CC3B37B99E23E79CBEF738D
```

The source-only GitHub gate now runs the catalog verifier. The archive baseline
report embeds the committed relation summary, so the 1,271-bundle population is
machine-verifiable without mounting ignored RAW.

## Next boundary

The base physical catalog merged in PR #9 as `d38c52f`. The character
refinement changes relation authority only; it exports no new PNG and modifies
no stable asset. Any follow-up should select another bounded family and improve
semantic relations without rewriting physical identity. It must remain
separate from:

- full PNG export;
- stable asset replacement;
- organizer-export promotion;
- Story Runtime long-soak acceptance;
- publication-ledger transactions.
