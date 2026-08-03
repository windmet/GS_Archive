# GS Archive Birthday Story Domain Landing

Date: 2026-07-30
Phase: P1-Story-IA-D
Branch: `codex/story-birthday-domain-landing-p1`
Stacked base: `codex/story-domain-ia-a` (`cc8043b`)

## Outcome

`view=story_catalog&story_type=birthday` is now a formal subject archive
instead of an implicit search result page.

Identity comes from three existing masterdata authorities:

- `story_master_index.json` for story semantics;
- `idol_unit_dictionary.json` for idol identity;
- `speaker_dictionary.json` for NPC identity.

The resulting archive contains:

- 50 subject collections;
- 181 logical records;
- 176 idol records;
- 5 NPC records;
- 0 unresolved subjects;
- 29 files shared with the personal-story domain.

## Series organization

The birthday records retain their masterdata families:

- `1_8`: producer-birthday greetings, 102 records;
- `1_7`: idol-birthday greetings, 50 records;
- `1_2`: birthday short stories, 29 records.

The 29 `1_2` files also belong to `idol_story`. The two domain memberships are
preserved in the index, but the product surfaces no longer present them as two
independent chapters:

- `birthday` is canonical for producer-birthday and idol-birthday greetings;
- `idol_story_archive` is canonical for the formal Idol Episode section,
  including its birthday Small Talk segments;
- the birthday subject page keeps the `1_2` row as a labelled relationship
  entry and routes to the exact personal-story section/episode;
- the personal-story page marks birthday-aligned release dates and the exact
  file shared by the birthday domain, with a reciprocal link to the birthday
  subject archive.

For `017kir`, four birthday logical rows therefore render as three independent
birthday records plus one relationship entry. Only
`1_x_017kir_2_1_2_017_12.json` is shared; the two producer greetings and the
idol-birthday greeting remain independent birthday content.

The subject page must not expose opaque duplicate labels. A trustworthy year
is derived only from a non-sentinel `releaseAt`; producer-birthday rows whose
masterdata date is the sentinel are labelled by explicit resource batch
(`第1期`, `第2期`) instead of inventing a calendar year. For `017kir` the visible
sequence is therefore producer greeting batch 1, producer greeting batch 2,
2021 idol-birthday greeting, and the 2022 personal-story relationship entry.

## Routes and navigation

- Domain landing:
  `?view=story_catalog&story_type=birthday`
- Subject collection:
  `?view=story_collection&story_type=birthday&story_section=<subject_code>`
- Player:
  preserves the subject collection and returns through
  `return=story_collection`.

The natural story-portal entry, direct landing and subject deep links, refresh,
browser Back, and the existing Back button have been exercised on port 5174.
Stable parameters such as `q`, `unit_filter`, and `rarity` remain present
through the landing, collection, player, and return path.

## Subject boundary

The subject key is the resolved character code, not a compiled filename.
Examples:

- `001tom` resolves to idol `天ヶ瀬 冬馬` and has four logical records across
  three display families;
- `101ken` resolves through the speaker dictionary to NPC `山村 賢` and has
  five logical records.

## Responsive and accessibility contract

- desktop: three-column subject grid;
- medium viewport: two columns;
- narrow viewport at 620 px or below: one column;
- archive counts use `dl` semantics;
- the subject list is a labelled region;
- subject entries are native buttons with complete accessible names.

The in-app browser session is fixed at 1280 by 720. Desktop behavior was
live-tested; narrow-screen behavior is covered by CSS/source verification and
still needs a live resizable viewport acceptance.

## Verification

```powershell
npm run verify:birthday-story-domain-landing
npm run verify:story-domain-identity
npm run verify:story-collections
npm run verify:story-presentation
npm run verify:routes
npm run verify:archive-baseline:source-only
npm run build
git diff --check
```

## Explicit exclusions

- cross-branch breadcrumb integration remains a small merge-order patch;
- search, relationship data, player internals, and publication are unchanged;
- strict-v2 promotion remains P2-A;
- 2–4 hour soak remains P2-B and is still **NOT EXECUTED**.
