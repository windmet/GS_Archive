# Binary and Publication Policy

Status: current policy
Date: 2026-07-28
Applies to: `E:\Web_build\SideM_Archived`

## 1. Purpose

The repository is an archive codebase and evidence ledger, not a mirror of the
original game. At the same time, the portal requires a bounded set of small
visual assets, fixtures, and promoted outputs to remain reproducible from Git.

This policy defines which binaries may be tracked, how ignored paths may be
overridden, and how local stable publication differs from source authority.

## 2. Current inventory boundary

At baseline `d8d819d`, Git tracks:

```text
108 PNG files
26,384,189 bytes
```

They include:

- birthday visuals, including `101ken`;
- two event-story visuals;
- unit and portal graphics;
- silhouette and other fixtures;
- generated FX images used by the current runtime;
- documentation or concept images.

These files are grandfathered for classification. They must not be deleted or
relocated merely to make the policy appear clean. A later machine-readable
inventory will classify them and identify which entries need a publication
ledger owner.

## 3. Categories

| Category | Git treatment |
| --- | --- |
| `raw-authority` | never tracked |
| `masterdata-authority` | never tracked |
| `reproducible-large-derived` | ignored; local derived cache or object storage |
| `stable-promoted-asset` | allowed when all publication gates pass |
| `portal-asset` | allowed when small, purpose-specific, and documented |
| `test-fixture` | allowed when minimal and named by a verifier |
| `documentation-evidence` | allowed when necessary to understand an audit |
| `exception` | requires explicit rationale and review |

### 3.1 Never tracked

- `RAW/`;
- RAW archive volumes;
- original XOR-state masterdata;
- decoded masterdata PB;
- IPA, APK, XAPK, AssetBundle extraction trees;
- ACB/AWB archives;
- bulk decoded WAV/M4A/MP4/PNG/WebP outputs;
- machine-local analysis, candidate, derived, and rollback workspaces;
- private configuration containing personal absolute paths;
- mirrored Bilibili videos, thumbnails, subtitles, or user avatars.

### 3.2 Stable promoted assets

A small derived asset may be tracked when all of these exist:

- logical ID;
- archive-relative authoritative source path;
- authoritative source SHA-256;
- Unity/CRI subresource identity when applicable;
- deterministic transform tool and contract version;
- stable published path and SHA-256;
- named consumer;
- candidate comparison;
- browser acceptance for the item or batch;
- rollback evidence;
- publication ledger entry after that contract is implemented.

### 3.3 Portal assets

Examples:

- brand mark;
- unit logo;
- small local placeholder;
- local navigation icon not supplied by a dependency;
- intentionally selected RAW-derived thumbnail.

The asset must have a named portal consumer and must not be a convenient
partial mirror of a larger source tree.

### 3.4 Test fixtures

A fixture must:

- be the smallest useful payload;
- be referenced by an automated verifier;
- state whether it is synthetic, transformed, or extracted;
- avoid containing unrelated neighboring resources;
- remain stable across machines.

### 3.5 Documentation evidence

Screenshots and concept images belong under `notes/` or a named evidence
directory. A screenshot is not runtime acceptance by itself. Its note must
identify the tested commit, route, purpose, and whether the image is current or
historical.

## 4. Size policy

These limits apply to new tracked binary changes, not retroactively to the
grandfathered 108-PNG baseline.

| Boundary | Normal | Exception review | Prohibited by default |
| --- | ---: | ---: | ---: |
| one file | up to 2 MiB | over 2 MiB through 5 MiB | over 5 MiB |
| one commit/batch | up to 10 MiB | over 10 MiB through 25 MiB | over 25 MiB |

An exception requires:

- why object storage or local derivation is unsuitable;
- expected update frequency;
- consumer;
- source and published hashes;
- rollback plan;
- explicit mention in the commit and handoff.

Files above the default prohibition belong in local derived storage or a future
object-storage release path unless the user approves a specific exception.

## 5. Ignored paths and `git add -f`

`web_viewer/public/assets/` remains ignored by default. This prevents a build or
sync command from accidentally staging a media tree.

`git add -f` is allowed only when:

1. the exact file list is resolved before staging;
2. every file has an approved category;
3. size limits are checked;
4. the logical ID and consumer are known;
5. source and published hashes are recorded;
6. the relevant verifier passes;
7. stable promotion and rollback evidence exist when applicable;
8. the staged diff contains no neighboring generated files.

Never force-add a directory recursively merely because a desired file is
inside it.

## 6. Candidate, derived, stable, and rollback locations

```text
web_viewer/.analysis/workspace/
  disposable tool/runtime work

web_viewer/.analysis/derived/
  reproducible transformed payloads

web_viewer/.analysis/raw-migration/
  inventories, candidates, parity evidence, and rollback evidence

web_viewer/public/
  runtime indexes and approved stable published outputs
```

Candidates and backups remain ignored. Only the selected stable artifact,
tracked registry/index changes, and bounded evidence documentation enter Git.

## 7. Publication boundary

Source proof and publication are separate:

```text
source-proven
does not imply
stable-published

stable-published in a branch
does not imply
merged or publicly deployed
```

New local binary promotions and authoritative story promotions should use the
append-only contract in:

```text
notes/04_refactor/PUBLICATION_LEDGER_CONTRACT_20260728.md
```

The existing `001tom`, `002sht`, birthday visual set, and other tracked assets
may be backfilled after the contract is implemented. Backfill is an audit
transaction and must not rewrite or re-encode the stable binaries.

## 8. External community video boundary

External GS translation links are metadata, not promoted media:

- store only the canonical video URL, BVID, uploader identity snapshot,
  internal GS mapping, attribution, and availability state;
- do not download or mirror the video;
- do not hotlink or copy third-party site cover images;
- prefer an existing local RAW/masterdata visual;
- do not place external links in the local publication ledger;
- validate them under the external-link contract.

## 9. Machine-readable inventory plan

The follow-up implementation should generate:

```text
web_viewer/policies/tracked-binary-assets.v1.json
```

Minimum entry:

```json
{
  "path": "web_viewer/public/assets/events/characters/example.png",
  "bytes": 123456,
  "sha256": "...",
  "category": "stable-promoted-asset",
  "logical_id": "event-story-visual:example",
  "consumer": ["ArchiveEventDetail"],
  "reason_tracked": "bounded stable portal asset",
  "force_add_allowed": true,
  "owner_release": null,
  "grandfathered": false
}
```

The inventory verifier should fail for:

- an unlisted tracked binary in governed paths;
- size-policy violations without an exception;
- duplicate logical IDs;
- missing files or hash drift;
- a force-added stable asset without a consumer;
- remote thumbnail URLs recorded as local portal assets.

The inventory is not created in the documentation-only P0 batch. Its schema,
generator, and verifier should be an isolated implementation commit.

## 10. Commit discipline

Recommended separation:

1. source/config/schema/verifier;
2. candidate and parity evidence, kept ignored where possible;
3. one bounded stable asset batch and registry/ledger entry;
4. audit and handoff update.

Before every commit:

```powershell
git status -sb
git diff --stat
git diff --check
git diff --cached --stat
git diff --cached --check
```

Only the current batch is staged.

## 11. Deletion and migration rule

This policy does not authorize deleting existing media, backups, or organizer
exports. Removing or relocating a material binary requires:

- exact target inventory;
- proof that no stable consumer depends on it;
- a replacement or archive location;
- a recoverability statement;
- explicit user authorization when the operation is destructive.
