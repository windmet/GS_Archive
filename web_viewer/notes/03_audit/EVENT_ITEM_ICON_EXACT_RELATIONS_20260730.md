# Event Item Icon Exact Relations

Status: implemented on `codex/event-item-icon-exact-relations`; pending review

Date: 2026-07-30

## Scope

This batch refines only the `image_item_icon_event_*` subset of the committed
RAW image-bundle catalog. It does not export or replace images.

An exact relation is emitted only when:

1. the complete bundle ID matches
   `image_item_icon_event_<numeric-code>[_n|_r]`;
2. that code identifies one unique row in the committed event index;
3. the bundle already carries the exact delimiter-bounded
   `event_index.events` token.

## Population

The event index contains 59 unique event codes. Nineteen are represented by
the current event-item-icon RAW subset:

```text
10001 through 10018: one base icon each
20001: one _n and one _r icon
```

This produces:

| Metric | Value |
| --- | ---: |
| exact event codes | 19 |
| exact item-icon bundles | 20 |
| base variants | 18 |
| `n` variants | 1 |
| `r` variants | 1 |
| ambiguous matches | 0 |

Every covered bundle contains one Sprite and one Texture2D. The `n` and `r`
suffixes are preserved as observed variant codes; this contract does not infer
expanded meanings for them.

The other 172 item-family bundles remain unchanged.

## Relation record

Each `exact_event_relations` record contains:

- event code;
- committed event name;
- event type and type label;
- fixed asset role `item-icon`;
- observed variant code;
- fixed relation type `exact_bundle_filename_event_code`.

The relation is semantic catalog metadata, not an asset publication.

## Mapping boundary

After P1-F, the complete 1,271-bundle catalog records:

| State | Bundles |
| --- | ---: |
| `stable-promotion` | 50 |
| `exact-masterdata-relation` | 118 |
| `organizer-export-candidate` | 2 |
| `masterdata-candidate` | 142 |
| `filename-candidate` | 959 |

The 118 exact-masterdata bundles comprise the prior 98 gasha banner/logo
relations plus these 20 event item-icon relations.

## Verification

The verifier independently reconstructs event relations from the bundle ID and
committed event index. It requires:

- unique event codes in the index;
- exact generated/reconstructed record equality;
- matching `event_index.events` token evidence;
- 20 relations across 19 codes;
- one base variant for codes `10001` through `10018`;
- exactly `n` and `r` for code `20001`;
- all normal source-only and mounted image-catalog checks.

Validated locally:

```text
RAW image bundle relation catalog verified (source-only):
1271 bundles / 7816 image objects

RAW image bundle relation catalog verified (mounted):
1271 bundles / 7816 image objects
```

Deterministic catalog SHA-256:

```text
48EE2942C826521A2665E2BA8F5B9299F68EA123D7AEA414B6F34A34E9298160
```

## Exclusions

This batch does not:

- assign relations to other item, honor, gasha, or shop bundles;
- interpret `n` or `r` beyond their exact filename values;
- export PNG;
- alter stable assets;
- create publication-ledger records;
- execute the deferred Runtime long soak.
