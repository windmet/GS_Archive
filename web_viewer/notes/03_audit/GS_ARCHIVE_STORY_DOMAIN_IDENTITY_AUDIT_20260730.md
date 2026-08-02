# GS Archive Story Domain Identity Audit

Date: 2026-07-30

Branch: `codex/story-domain-ia-a`

Base: `master` / `f82647ad7402b1f51dfdbd7674b1a15fb70abf35`

## 1. Scope

This is the first bounded P1-Story-IA batch. It defines an auditable identity
model for:

- `main`;
- `birthday`;
- `extra`.

It does not:

- scan unindexed `RAW`;
- rewrite the global story search;
- add a domain landing page;
- change player navigation or playback ranges;
- create or modify a publication transaction;
- promote any story to strict-v2.

## 2. Authority decision

The model keeps the existing authority boundary:

- `story_master_index.json` owns story-domain identity and parent relations;
- `idol_unit_dictionary.json` owns idol identity;
- `speaker_dictionary.json` owns NPC identity;
- `compiled_file` identifies a playback target and may be shared by multiple
  logical archive entries.

The first batch therefore uses a pure derived index in:

```text
src/data/storyDomainIdentityIndex.js
```

It does not write another static JSON beside `story_master_index.json`.
Persisting the same rows in a second generated file would create another
refresh obligation without adding source authority. A persisted client
contract can be introduced later only if the landing-page payload or load
boundary requires one.

## 3. Verified identity facts

### 3.1 Main story

Source tables:

- table 4: main groups;
- table 5: main chapters;
- table 6: main episode rows.

Verified counts:

| Item | Count |
| --- | ---: |
| Collections | 3 |
| Placeholder collections | 1 |
| Chapters | 22 |
| Logical episode rows | 204 |
| Distinct resource IDs | 204 |
| Distinct compiled files | 22 |

Group `101` has 11 chapters, group `102` has 11 chapters, and group `103`
currently has no chapter. The domain landing must represent group `103` as a
non-playable master placeholder rather than fabricate published content.

### 3.2 Birthday story

Source table:

- table 78: birthday episode rows.

Birthday subject identity is resolved from the table-78 master
`resource_id`, whose numeric subject segment is joined to:

- `idol_unit_dictionary.by_numeric_id` for idols;
- `speaker_dictionary.speakers[*].npc_id` for NPCs.

The compiled filename and `compiled_summary.characters` are not used as the
sole identity source.

Verified counts:

| Item | Count |
| --- | ---: |
| Subject collections | 50 |
| Idol-linked logical rows | 176 |
| NPC-linked logical rows | 5 |
| Unresolved logical rows | 0 |
| Total logical rows | 181 |
| Distinct resource IDs | 181 |
| Distinct compiled files | 181 |
| Resource/master series | 4 |
| Files also present in another story domain | 29 |

The five NPC-linked records resolve to `101ken` / 山村 賢 through the master
resource ID and speaker dictionary. The 29 cross-domain files are present in
both `idol_story` and `birthday`; a global file-keyed catalog must not erase
their birthday membership.

### 3.3 Extra story

Source tables:

- table 144: Extra groups;
- table 145: Extra episode rows.

Verified counts:

| Item | Count |
| --- | ---: |
| Collections | 47 |
| Logical episode rows | 47 |
| Distinct resource IDs | 45 |
| Distinct compiled files | 44 |
| Shared playback files | 1 |
| Maximum logical rows on one playback file | 4 |

Every table-145 row resolves to exactly one table-144 group. The compiled file
`5_03_000_22.json` is referenced by four logical master rows. A future Extra
landing must use master row/group IDs for archive identity while allowing the
four records to share one playback target.

## 4. Derived contract

`buildStoryDomainIdentityIndex()` exposes:

```text
domains.main.collections
domains.main.logicalEntries
domains.birthday.collections
domains.birthday.logicalEntries
domains.extra.collections
domains.extra.logicalEntries
byCompiledFile
```

Each logical entry keeps:

- domain;
- master ID and parent ID;
- title and release timestamp;
- resource ID;
- compiled playback file;
- master source table and offset.

Birthday entries additionally keep the resolved subject, neutral series IDs,
and all observed domain memberships.

## 5. Verification

Run:

```text
npm run verify:story-domain-identity
```

The verifier fails on:

- count drift;
- source-table drift across main table 4/5/6, birthday table 78, or Extra
  table 144/145;
- unresolved birthday subject identity;
- loss of the 29 birthday/idol-story shared memberships;
- broken table-144/table-145 parent relations;
- collapse of 47 Extra logical rows into 44 archive identities;
- loss of the four-to-one Extra playback mapping.

## 6. Next bounded batch

After this audit/index batch is reviewed, P1-Story-IA-B can consume the
`main` portion to implement:

```text
view=story_catalog&story_type=main
```

as a real domain landing. Birthday and Extra UI remain separate follow-up
batches because their identity and shared-playback rules differ.
