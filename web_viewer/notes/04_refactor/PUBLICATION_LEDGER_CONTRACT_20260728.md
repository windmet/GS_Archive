# Publication Ledger Contract

Status: contract, explicit collection rollback, and first real transaction implemented
Date: 2026-07-28

Implementation:

```text
web_viewer/schemas/publication-release-v1.schema.json
web_viewer/public/data/publication/manifest.json
web_viewer/public/data/publication/releases/
web_viewer/scripts/generate-publication-manifest.mjs
web_viewer/scripts/verify-publication-ledger.mjs
web_viewer/scripts/rollback-authoritative-story-collection.mjs
```

The history now contains its first real transaction. `1_4_001_00` completed
RAW extraction, 2/2 part identity, 11/11 voice resolution, masterdata table 6
relation, legacy-to-authoritative parity, publish, exact rollback, republish,
and no-audio browser acceptance. Source-only CI run `30374641388` verified the
tracked stable files, strict schema, ledger state, and production build.

## 1. Purpose

The archive has domain-specific candidate metadata, promotion registries,
compiled manifests, and rollback manifests, but no single history answering:

- what stable artifact changed;
- which authoritative source and semantic relation justified it;
- which transform produced it;
- which consumer uses it;
- which exact prior state can be restored.

The publication ledger records local GS Archive publication transactions. It
does not catalog third-party videos and does not replace RAW or masterdata
inventories.

## 2. Layout

```text
web_viewer/schemas/
  publication-release-v1.schema.json

web_viewer/public/data/publication/
  manifest.json
  releases/
    <release-id>.json
```

Responsibilities:

| File | Responsibility |
| --- | --- |
| `releases/*.json` | append-only transaction history |
| `manifest.json` | generated current stable state |
| JSON Schema | structural contract |
| verifier | path, hash, relation, history, and stable-state checks |

`manifest.json` is generated from release files. It is not edited by hand.

## 3. Immutability and Git identity

A release file is immutable after merge except for an explicitly documented
schema migration. Rollback and republish create new release transactions; they
do not mutate the original record.

A Git commit cannot reliably contain its own final commit hash. Therefore a
release record must not require `published_in_commit` to equal the commit that
first adds the file.

Use:

- `prepared_from_commit`: the verified repository state before publication;
- release ID and ledger file path: stable transaction identity;
- Git history: the authoritative commit that added the transaction;
- handoff/PR report: the resulting commit and push state.

This avoids a circular self-hash or a mandatory follow-up commit.

## 4. Release ID

Format:

```text
YYYY-MM-DD-<domain>-<bounded-name>-<sequence>
```

Examples:

```text
2026-07-29-story-multipart-001
2026-07-30-event-visual-003hok-001
2026-07-31-event-visual-003hok-rollback-001
```

Release IDs are unique and never reused.

## 5. Minimum release shape

```json
{
  "schema_version": 1,
  "release_id": "2026-07-29-story-multipart-001",
  "created_at": "2026-07-29T00:00:00+08:00",
  "prepared_from_commit": "0123456789abcdef0123456789abcdef01234567",
  "transaction_kind": "publish",
  "scope": {
    "kind": "collection",
    "ids": ["example"]
  },
  "entries": [
    {
      "logical_id": "story-collection:example",
      "domain": "story",
      "source": {
        "archive_relative_path": "asset/scenario_example.unity3d",
        "sha256": "...",
        "objects": [
          {
            "type": "TextAsset",
            "name": "scenario_example_a",
            "container_path": "assets/resources/scenariodata/example/scenario_example_a.json",
            "path_id": 123
          }
        ]
      },
      "semantic_evidence": [
        {
          "master_product": "story_master_index",
          "key": "example",
          "evidence": "exact resource and collection relation"
        }
      ],
      "transform": {
        "tool": "build-raw-story-promotion.mjs",
        "contract_version": 1
      },
      "published": [
        {
          "path": "web_viewer/public/data/compiled/example.json",
          "url": "/data/compiled/example.json",
          "bytes": 1234,
          "sha256": "..."
        }
      ],
      "consumers": ["StoryViewer"],
      "comparison": {
        "state": "parity-verified",
        "evidence": []
      },
      "browser_acceptance": {
        "state": "browser-accepted",
        "tested_url": "http://127.0.0.1:5174/...",
        "tested_at": "2026-07-29T00:00:00+08:00",
        "evidence": []
      },
      "previous_state": {
        "release_id": null,
        "artifacts": []
      },
      "rollback_evidence": {
        "performed": true,
        "backup_manifest": "...",
        "restored_artifacts": [],
        "final_republish_verified": true
      }
    }
  ]
}
```

## 6. Source paths

Allowed:

```text
asset/scenario_example.unity3d
audio/bgm_example.acb
movie/live_example.usm
```

Forbidden:

```text
E:\Web_build\...
C:\Users\...
..\..\personal-folder
```

All source paths are relative to the configured archive source root and use
forward slashes in JSON.

Machine-local source configuration remains in ignored
`config/archive_sources.local.json`.

## 7. Semantic evidence

`master_table: 0` or another placeholder is forbidden.

Evidence must name a stable generated masterdata product or a decoded table ID
plus documented field mapping. Prefer generated products exposed under
`public/data/masterdata`, for example:

- `event_index`;
- `story_master_index`;
- `story_presentation_index`;
- `card_index`;
- `background_catalog`;
- `music_catalog`;
- `idol_unit_dictionary`.

If no masterdata relation exists, the entry must explicitly state which RAW
container/object identity and consumer contract establishes the logical ID.

## 8. Transaction kinds

```text
publish
replace
rollback
republish
backfill
supersede
```

Rollback is a first-class transaction. It references the release being undone
and records the exact restored artifact hashes.

Backfill records an already tracked stable asset without changing its bytes.
Backfill must verify the current stable hash and source identity; it must not
re-encode the file merely to make a new ledger entry.

## 9. Generated stable manifest

`public/data/publication/manifest.json` should contain only current stable
state and indexes useful to runtime/audit consumers:

```json
{
  "schema_version": 1,
  "generated_from": [
    "2026-07-29-story-multipart-001"
  ],
  "by_logical_id": {
    "story-collection:example": {
      "release_id": "2026-07-29-story-multipart-001",
      "domain": "story",
      "artifacts": []
    }
  }
}
```

It must be deterministic. Re-running the generator against unchanged release
files must produce the same bytes.

## 10. Verification

The future verifier must check:

- schema validity;
- unique release IDs;
- unique logical IDs within a transaction;
- valid archive-relative source paths;
- no personal absolute paths;
- source and published SHA-256 format;
- published file existence, size, and hash;
- named consumer;
- valid previous-release chain;
- rollback restoration hashes;
- stable manifest determinism;
- current stable manifest agrees with the release history;
- every current stable artifact is Git tracked so source-only CI can verify it;
- binary-policy limits and categories where applicable.

The verifier must not require RAW or ignored media in a source-only CI job
unless the checked release declares a small tracked fixture. Mounted-source
checks remain a separate local gate.

## 11. First real transaction

The first implementation transaction should be one multi-part RAW story
collection:

```text
candidate
-> parity
-> ledger release fixture
-> publish
-> 5174
-> rollback
-> exact old hashes
-> republish
-> 5174
```

This tests collection scope, multiple artifacts, stable manifest generation,
rollback, and republish without adding a new binary resource domain.

Selected transaction:

```text
story-collection:1_4_001_00
aggregate + episodes a/b
60 steps
11/11 voice references resolved
legacy -> strict story-runtime-v2
```

The candidate is generated outside the stable corpus. The explicit rollback
command requires the original publish backup, the exact candidate, and a
matching group confirmation. It refuses rollback if current published,
candidate, or backup hashes drift.

After the contract is proven, backfill `001tom` and `002sht` without modifying
their PNG bytes.

## 12. Explicit exclusions

The publication ledger does not contain:

- RAW file inventory;
- masterdata record inventory;
- candidate-only work;
- temporary decode caches;
- third-party Bilibili links or availability;
- screenshots that are only narrative evidence;
- unverified guesses.

External GS translation links use
`EXTERNAL_GS_TRANSLATION_LINK_CONTRACT_20260728.md`.

## 13. Post-merge version and portability evolution

The first merged v1 release is immutable:

```text
2026-07-28-story-1-4-001-00-001
```

Its v1 model cannot fully describe the unmanaged stable files that existed
before the ledger. This is a historical schema limitation, not permission to
rewrite the release.

Future evolution must:

1. freeze v1 with an explicit historical release-ID allowlist or cutoff;
2. reject newly authored v1 releases;
3. introduce a compatible v2 release schema;
4. introduce append-only annotations for historical semantic clarification;
5. keep annotations out of stable-state replay;
6. validate release and annotation files with independent schemas.

The machine-enforced transition state is:

```text
policies/publication-ledger-versions.v1.json
schemas/publication-ledger-version-policy-v1.schema.json
```

Release schema v1 is frozen to the single historical release above. Release
schema v2 and annotation schema v1 are `reserved`: their directories and
version numbers are claimed, but files using them must be rejected until their
schemas and replay-independent verifiers land together. `reserved` must never
be interpreted as permission to draft production ledger records.

V2 should add state-dependent requirements for non-empty published artifacts,
RAW object identity, accepted-browser commit/environment evidence, unmanaged
previous state, and backup-manifest identity.

Canonical byte identity has four phases:

| Phase | Required identity |
| --- | --- |
| candidate | deterministic LF output and semantic validation |
| staged | Git index blob bytes and SHA-256 |
| committed | HEAD blob bytes and SHA-256 |
| runtime | worktree existence, parse/schema, semantic equality, and Vite read |

Ledger-governed text paths require exact `eol=lf` coverage. Do not globally
renormalize the compiled corpus. The verifier must not change a release hash
to match a machine-specific CRLF checkout.
