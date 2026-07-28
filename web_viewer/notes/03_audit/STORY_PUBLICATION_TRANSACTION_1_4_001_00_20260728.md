# Story Publication Transaction: `1_4_001_00`

Date: 2026-07-28
Release: `2026-07-28-story-1-4-001-00-001`
Prepared from: `7310ea06c7fccba64d1c8cbefa6de43b50917150`

## Result

The first publication-ledger transaction completed for the main-story
prologue collection `1_4_001_00`.

The transaction covered the aggregate and episodes a/b as one indivisible
collection:

```text
candidate
-> parity
-> publish
-> 5174 acceptance
-> rollback
-> exact old hashes
-> republish
-> 5174 acceptance
```

Final stable state is strict `story-runtime-v2`, compiled by
`raw-source-candidate-v1`.

## Source identity

- container: `RAW/asset/scenario_1_4_001_00.unity3d`;
- SHA-256: `f8e3437a3626fc3fff3da0065802db70096c26b989caceca91a2495aa4f4cbc6`;
- TextAsset a PathID: `7072651050332240271`;
- TextAsset b PathID: `-3578250919027490954`;
- masterdata: `story_master_index`, main story, decoded table 6 field 6;
- voice: 11 references / 11 resolved / 0 unresolved.

The candidate and backup workspaces remain ignored. The checked release uses
only archive-relative paths.

## Parity

| Artifact | Steps | Added text identities | Non-text differences |
| --- | ---: | ---: | ---: |
| aggregate | 60 | 30 | 0 |
| episode a | 27 | 16 | 0 |
| episode b | 33 | 14 | 0 |

Dialogue audio, choice targets, and episode boundaries were unchanged for all
three artifacts. The authoritative schema and runtime/text projection gates
passed before stable writes.

## Stable hashes

| Artifact | Old SHA-256 | Final SHA-256 |
| --- | --- | --- |
| aggregate | `249ff82d083a6ee746091cfe32b362c9beecfbb4d574aa8d1575defb2e59797b` | `56f871f7fc0da7d523d6eb61b25202fa8ee18c250bec304c030e3702497911d9` |
| episode a | `a07866e0a05e6bf160b8b4a7721ac9e1c60525e65738e6b7c85200ab072eaca6` | `3da2d6f5f7d80489efdcd746fb523346d9898cc17d9634a5d81a49ca72c7c202` |
| episode b | `afad528fc5cc32f37d0ffc98d84e6af28b317d1edf460d357f593b20191a2a47` | `0e2f8caeecae7f1ce04bef7dfcfb8368192ac8111d59ed931dcbab93b1db0a46` |

Explicit rollback restored all three old hashes. Final republish restored all
three candidate hashes.

## Browser acceptance

Natural entry:

```text
http://127.0.0.1:5174/?view=story_detail&story=1_4_001_00&story_type=main&story_mode=search&story_section=101&noAudio=1&runtimeDebug=1
```

The detail page showed:

- `新たな夢の開演`;
- `2 parts`;
- `59 steps`;
- `11 voices`;
- the chapter 1 collection context.

Player anchors:

- step 7 showed the expected producer monologue over
  `bg066_stageside_in_10`;
- step 12 showed `……なに？　プロデューサー。アンタ、もう感動してんの？`;
- step 12 had one active `047shu` Spine instance;
- `noAudio=1` kept AudioContext uninitialized, both audio layers disabled,
  and active sources at zero;
- after final republish, console errors were zero.

This is a no-audio batch acceptance. It does not upgrade the separate real
Edge audio, hidden/resume, cross-episode, or long-soak acceptance state.

## Git boundary

The general compiled corpus remains ignored. This transaction force-adds only
the three stable JSON artifacts named by the ledger so source-only CI can
verify their existence, sizes, and hashes. It does not add other compiled
files or any RAW/media bytes.

## Source-only CI

GitHub `Web Viewer Source Gate` run `30374641388` passed on commit `948a2ef`.
The clean Linux checkout verified:

- all three ledger artifacts are tracked and hash-exact;
- all three pass the strict authoritative schema;
- mounted-only `1_4_001_01` checks remain optional when that ignored corpus is
  absent;
- publication manifest generation and current stable state agree;
- the complete source-only contract and production build pass.
