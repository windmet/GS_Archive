# Honor Event Exact Relations

Status: merged in PR #14 as `724ec9885eee1e782aa5104d0a9809b425e221b3`

Date: 2026-07-30

## Scope

This batch refines only the `image_honor_event_*` subset of the committed RAW
image-bundle catalog. It adds semantic bundle-to-event relations. It does not
export, decode, replace, or publish image payloads.

An exact relation is emitted only when:

1. the complete bundle ID matches `image_honor_event_<numeric-code>`;
2. that code identifies one unique row in the committed event index;
3. the bundle already carries the exact delimiter-bounded
   `event_index.events` token.

## Population

The mounted RAW population contains 41 complete `image_honor_event_*` bundle
IDs. Forty codes are unique committed event-index identities:

```text
10001 through 10020: 20 bundles
30001 through 30018: 18 bundles
40001 through 40002: 2 bundles
```

This produces:

| Metric | Value |
| --- | ---: |
| inspected honor-event bundles | 41 |
| exact event codes | 40 |
| exact honor bundles | 40 |
| base variants | 40 |
| ambiguous matches | 0 |
| explicit exclusions | 1 |

The excluded bundle is:

```text
image_honor_event_30026001
```

There is no event-index row or event token for `30026001`, so the bundle
remains `filename-candidate`. Its numeric-looking filename is not sufficient
authority for an exact semantic relation.

The covered bundles contain different numbers and arrangements of Unity image
objects. This batch deliberately does not interpret those internal Sprite or
Texture2D identities. The exact relation applies only to bundle ownership.

## Relation record

Each generated `exact_event_relations` record contains:

- event code;
- committed event name;
- event type and type label;
- fixed asset role `honor`;
- fixed observed variant `base`;
- fixed relation type `exact_bundle_filename_event_code`.

The relation is catalog metadata, not an asset publication.

## Mapping boundary

After P1-G, the complete 1,271-bundle catalog records:

| State | Bundles |
| --- | ---: |
| `stable-promotion` | 50 |
| `exact-masterdata-relation` | 158 |
| `organizer-export-candidate` | 2 |
| `masterdata-candidate` | 102 |
| `filename-candidate` | 959 |

The 158 exact-masterdata bundles comprise 98 gasha banner/logo bundles, 20
event item-icon bundles, and these 40 honor-event bundles.

## Verification

The verifier independently reconstructs both supported event relation forms
from bundle IDs and the committed event index. For honor-event relations it
requires:

- unique event codes in the index;
- exact generated/reconstructed record equality;
- matching `event_index.events` token evidence;
- exactly 40 `honor` relations across 40 codes;
- exactly one `base` variant per covered code;
- no relation for `image_honor_event_30026001`;
- all normal source-only and mounted image-catalog checks.

Validated locally:

```text
RAW image bundle relation catalog verified (source-only):
1271 bundles / 7816 image objects

RAW image bundle relation catalog verified (mounted):
1271 bundles / 7816 image objects

Vite production build:
2405 modules / PASS in 133.7 seconds
```

Deterministic catalog SHA-256:

```text
61B7D550C18153DA665B0E01A9378D0DE16BD19CEEFFBDC7140C3D9970E863D4
```

## Exclusions

This batch does not:

- infer a relation for `image_honor_event_30026001`;
- assign semantics to individual honor-bundle image objects;
- alter other honor families;
- export PNG;
- alter stable assets;
- create publication-ledger records;
- execute the deferred Runtime long soak.
