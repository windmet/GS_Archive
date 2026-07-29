# Gasha Image Exact Relations

Status: merged in PR #12

Date: 2026-07-30

## Scope

This batch refines the merged RAW image-bundle catalog without exporting,
copying, or replacing any image. It promotes only relations jointly proven by:

1. a bundle ID that fully matches
   `image_gasha_(banner|logo)_<numeric-code>`;
2. one unique committed `gasha_index.gashas.code` row for that code;
3. the existing delimiter-bounded masterdata token in the bundle catalog.

The relation record carries the exact gasha ID, code, logical ID, phase,
asset role, and fixed relation type
`exact_bundle_filename_gasha_code`.

## Population

The RAW `gasha` family contains 433 bundles:

| Subfamily | Bundles |
| --- | ---: |
| banner | 195 |
| logo | 195 |
| background | 25 |
| skill | 12 |
| balloon | 4 |
| button | 2 |

The committed gasha index contains 61 unique IDs and 61 unique codes. Exactly
49 codes occur in the mounted RAW image population, each as one banner and one
logo:

```text
49 exact gasha codes
49 exact banner relations
49 exact logo relations
98 exact bundle relations
```

All 98 bundles contain one Sprite and one Texture2D. None has an ambiguous
index match.

The other 335 gasha bundles remain unchanged. In particular, filename
similarity without a committed index row is not promoted.

## Explicitly uncovered index rows

Twelve committed index codes have no matching RAW banner or logo bundle in the
current mounted population:

```text
300011
300012
300031
1000011
300032
1000051
300061
300062
200701
200721
300091
300092
```

Their absence is recorded rather than filled from guesses or external assets.

## Mapping boundary

After this refinement, the full 1,271-bundle catalog mapping states are:

| State | Bundles |
| --- | ---: |
| `stable-promotion` | 50 |
| `exact-masterdata-relation` | 98 |
| `organizer-export-candidate` | 2 |
| `masterdata-candidate` | 162 |
| `filename-candidate` | 959 |

`exact-masterdata-relation` is a semantic relation, not an image publication.
No ledger entry, tracked PNG, or stable asset changes in this batch.

## Verification

The verifier independently reconstructs every gasha relation from the
committed gasha index and bundle ID. It requires:

- unique gasha codes in the index;
- exact equality between generated and reconstructed relation records;
- a matching `gasha_index.gashas.code` masterdata token;
- exactly 98 relations across 49 codes;
- exactly one banner and one logo for every covered code;
- normal catalog schema, ordering, summary, mounted bytes, UnityFS, and SHA-256
  checks.

Validated locally:

```text
RAW image bundle relation catalog verified (source-only):
1271 bundles / 7816 image objects

RAW image bundle relation catalog verified (mounted):
1271 bundles / 7816 image objects
```

Deterministic catalog SHA-256:

```text
E70FACA5381E783350E337CB13CB3F321AED014A16484ED7D5AF39BB509BB50F
```

## Next boundary

The remaining gasha bundles must not inherit an exact relation merely because
their filename resembles a historical code. Any further refinement needs a
separate, independently authoritative source and a bounded subfamily.
