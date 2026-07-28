# Archive Multidimensional Status Contract

Status: current contract
Date: 2026-07-28
Current baseline:
`notes/03_audit/CURRENT_ARCHIVE_BASELINE_20260728.md`

## 1. Purpose

The archive previously used words such as "complete", "published", "verified",
and "browser-accepted" without always recording what population had been
tested. This contract prevents a representative sample from being promoted to
a domain-wide conclusion and prevents branch-local publication from being
mistaken for a merge or product release.

Every status statement must identify:

- the exact scope;
- the independent status dimensions that apply;
- the commit or checkout;
- the evidence files;
- the tested URL and time when a browser is involved.

## 2. Required record

```json
{
  "schema_version": 1,
  "logical_id": "event-story-visual:001tom",
  "scope": {
    "kind": "item",
    "ids": ["001tom"],
    "population": 1
  },
  "source_evidence": {
    "state": "source-proven",
    "evidence": []
  },
  "relation_mapping": {
    "state": "parity-verified",
    "evidence": []
  },
  "publication": {
    "state": "stable-published",
    "release_id": null
  },
  "browser_acceptance": {
    "state": "browser-accepted",
    "tested_url": null,
    "tested_at": null,
    "evidence": []
  },
  "git_lifecycle": {
    "state": "draft-pr",
    "commit": "d8d819dedda3ad043bd7885f82ac6f015190d2fc",
    "pull_request": 2
  },
  "product_acceptance": {
    "state": "not-accepted",
    "evidence": []
  }
}
```

Not every dimension applies to every record. An inapplicable dimension must be
written as `not-applicable`; it must not be omitted and later inferred.

## 3. Scope

Allowed scope kinds:

| Kind | Meaning |
| --- | --- |
| `sample` | one exploratory or representative input |
| `item` | one stable logical asset or story |
| `collection` | one defined multi-part collection |
| `matrix` | a declared representative set with listed members |
| `batch` | one atomic publication transaction |
| `domain` | the complete enumerated population for a resource domain |

`domain` requires:

- a machine-readable population definition;
- a count;
- an audit that enumerates the population;
- no unreported exclusions.

An undeclared set of "representative examples" is a sample, not a matrix.

## 4. Source evidence

Allowed states:

```text
unresolved
candidate-source
source-proven
not-applicable
```

`source-proven` requires an authoritative path or container identity and a
content hash. For Unity subresources it should also record object type, object
name, container path, and PathID where available. For CRI content it should
record the ACB/AWB identity and cue/selector/sequence/waveform evidence.

Finding a same-named organizer export is not sufficient source proof.

## 5. Relation mapping

Allowed states:

```text
unmapped
candidate-mapped
parity-verified
not-applicable
```

`candidate-mapped` means the proposed masterdata/consumer relation is explicit
but not yet proven against the stable reference.

`parity-verified` requires a declared comparison:

- byte identity;
- decoded pixel identity;
- semantic JSON equality;
- cue/waveform identity;
- or another domain-specific comparator documented in evidence.

## 6. Publication

Allowed states:

```text
not-published
candidate
stable-published
rolled-back
superseded
not-applicable
```

`stable-published` means the artifact occupies the stable URL in the stated
checkout. It does not mean:

- merged to `master`;
- deployed to a public host;
- accepted in every browser;
- release-accepted as a product.

After the publication-ledger contract is implemented, new stable binary and
authoritative story promotions must name their release ID.

## 7. Browser acceptance

Allowed states:

```text
not-tested
sample-accepted
browser-accepted
failed
needs-reproduction
not-applicable
```

`sample-accepted` applies to a representative sample or matrix.

`browser-accepted` applies only when the entire declared item, collection, or
batch acceptance gate was exercised. It still does not elevate the surrounding
domain.

Browser evidence should include:

- commit;
- browser and version where available;
- URL;
- target entity;
- natural image dimensions or media metadata where applicable;
- console boundary;
- candidate/stable/fallback identity;
- rollback and republish identity when publication is involved;
- tested time.

## 8. Git lifecycle

Allowed states:

```text
worktree-only
committed-local
pushed-branch
draft-pr
ready-pr
merged
reverted
not-applicable
```

Git status must be verified from the repository. Documentation must not infer a
merge from a successful source gate or infer a push from a local commit.

## 9. Product acceptance

Allowed states:

```text
not-accepted
release-accepted
regressed
not-applicable
```

Product release acceptance requires the domain-specific release matrix.
For Story Runtime it currently includes real Edge interaction, real audio,
hidden/resume, cross-episode BGM/Ambient, long mixed use, and quiet-endpoint
resource convergence.

`noAudio`, source-only builds, Node lifecycle tests, and short recorder
self-tests are not real-audio product acceptance.

## 10. External community links

External Bilibili translation links use the same scope rule but have different
evidence:

- `source_evidence` refers to the existence and identity of the external
  video, not to RAW authority;
- `relation_mapping` describes the link to an internal GS story/event identity;
- `publication` is `not-applicable` because GS Archive does not publish the
  video;
- availability is maintained in the external-link registry;
- the original uploader remains the content owner and attribution target.

External-link availability must not be combined with RAW completeness,
interactive-play coverage, or built-in translation coverage.

## 11. Examples

### One event visual

```text
scope: item / 001tom
source: source-proven
mapping: parity-verified
publication: stable-published
browser: browser-accepted
Git: draft-pr
product: not-accepted
```

### Audio inventory and samples

```text
audio cue inventory
scope: domain
source: source-proven
browser: not-applicable

selected song/BGM/Ambient/SE set
scope: matrix
mapping: parity-verified
browser: sample-accepted
```

### Story corpus

```text
RAW discovery
scope: domain / 3,398 groups
source: source-proven
mapping: parity-verified against public outputs

strict v2 publication
scope: 2 collections + 1 standalone item
publication: stable-published in the applicable checkout

full corpus strict v2
scope: domain
publication: not-published
```

## 12. Reporting rule

Every handoff and final report must list unfinished work first, then give:

1. checkout and Git lifecycle;
2. exact scope changed;
3. source evidence;
4. mapping/parity evidence;
5. publication state;
6. browser evidence;
7. product acceptance boundary;
8. remaining risks and next bounded action.

