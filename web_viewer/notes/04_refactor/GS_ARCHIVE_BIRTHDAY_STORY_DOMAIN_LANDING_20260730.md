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

The 29 `1_2` files also belong to `idol_story`. Birthday pages reuse those
playback files but do not erase either semantic identity.

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
