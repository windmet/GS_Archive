# Image Relation Refinement Closeout

Status: current post-P1-H boundary

Date: 2026-07-30

## Result

The bounded image-relation sequence is merged through PR #15. The committed
catalog remains a metadata inventory only:

```text
1271 RAW image bundles
7816 Sprite/Texture2D objects
50 stable-promotion bundles
170 exact-masterdata-relation bundles
2 organizer-export-candidate bundles
90 masterdata-candidate bundles
959 filename-candidate bundles
```

The 170 exact-masterdata bundles are:

| Proven relation family | Bundles |
| --- | ---: |
| gasha banner/logo | 98 |
| event item-icon | 20 |
| honor-event | 40 |
| gasha-skill speaker | 12 |

These batches use complete filename patterns, one committed authority row, and
existing delimiter-bounded token evidence. Their generators and verifier
independently reconstruct the same records.

## Remaining 90 masterdata candidates

| Family | Bundles | Why candidate-only |
| --- | ---: | --- |
| `chara` | 7 | aggregate bundles contain many speaker identities |
| `gasha` banner/logo | 68 | numeric tokens resolve to event/seasonal namespaces, not the committed gasha index |
| `gasha` background | 8 | numeric event-token coincidence does not prove a gasha or event-owned background contract |
| `mobile` | 2 | aggregate bundles contain many speaker identities |
| `picturestudio` | 1 | aggregate bundle contains many speaker identities |
| `shop` | 4 | the same code exists in both event and seasonal-campaign namespaces |
| total | 90 | no one-bundle/one-authority proof |

Token presence remains discovery evidence. It is not sufficient authority to
promote these records. A future refinement requires a new independent source
or consumer contract that resolves the ambiguity for one bounded family.

## Track decision

The current automatic exact-relation refinement track is closed. Do not:

- promote the remaining 90 records merely because a masterdata token exists;
- reinterpret event codes as gasha codes;
- split aggregate bundles into object-level semantics without an independent
  mapping source;
- export PNG or alter stable assets as part of relation discovery;
- add publication-ledger transactions for catalog-only changes.

The Story Runtime long soak remains deferred by user decision. Future work can
proceed on another independent archive track without reopening this boundary.

## Verification basis

The last functional batch, PR #15, passed:

```text
PR head Source-only contract: run 30474769111
post-merge master Source-only contract: run 30474870836
local image catalog source-only and mounted: 1271 / 7816
local archive baseline source-only and mounted: 10329 JSON / 108 PNG
local Vite production build: 2405 modules / 144.2 seconds
catalog SHA-256:
545E5C9D760F11173BF0A3434EC25516EE4224F954A4676E7B7E8734F77A2C95
```

No PNG, audio, stable asset, or publication release changed in P1-H.
