# GS Archive Story IA Integration

Date: 2026-07-30
Phase: P1 Story IA integration
Branch: `codex/story-ia-integration-p1`
Base: `master` at `f82647ad7402b1f51dfdbd7674b1a15fb70abf35`

## Integrated batches

This branch combines the independently reviewable P1 batches:

1. story-domain identity authority;
2. main-story formal domain landing;
3. Extra formal domain landing and logical collections;
4. Birthday formal subject landing and collections;
5. archive breadcrumb UI.

The source branches remain available for focused review. This integration
branch is the combined acceptance target.

## Canonical hierarchy

Formal story routes now use:

```text
资料馆 / 剧情 / <正式故事域> / <collection>
```

The formal story domains are:

- 主线剧情 (`main`);
- 额外剧情 (`extra`);
- 生日剧情 (`birthday`).

The domain breadcrumb returns to
`view=story_catalog&story_type=<domain>` and preserves stable filters such as
`q`, `unit_filter`, `event_scope`, `rarity`, availability, and sort state.
The higher `剧情` breadcrumb returns to the general story portal.

This hierarchy does not encode browser-history provenance. Existing
`parent`, `return`, browser Back, and the top-bar Back button remain separate
navigation mechanisms.

## Combined route behavior

- a formal domain landing Back returns to the general story portal;
- a formal collection Back returns to its formal domain landing;
- player return restores its collection;
- browser Back follows the actual browser stack;
- `player`, `spine_lab`, and `chibi_stage` do not render breadcrumbs.

## Combined authority counts

- main: 3 chapter collections, 22 formal chapters, 204 logical segments;
- Extra: 10 work-level collections, 47 logical chapters, 45 resource IDs,
  44 playback files;
- Birthday: 50 subjects, 181 logical records, 29 files shared with
  `idol_story`.

Compiled files remain playback targets and are not used to collapse semantic
identity.

## Acceptance

Source gates:

```powershell
npm run verify:routes
npm run verify:story-domain-identity
npm run verify:main-story-domain-landing
npm run verify:extra-story-domain-landing
npm run verify:birthday-story-domain-landing
npm run verify:story-collections
npm run verify:story-presentation
npm run verify:archive-baseline:source-only
npm run build
git diff --check
```

Port 5174 acceptance on 2026-08-02 covered natural entry to Main, Extra and
Birthday, direct collection deep links, refresh, browser Back, the page Return
button, one formal Extra collection, one supplement collection and the Birthday
subject page. A real 390 by 844 viewport verified the four-level breadcrumb
collapse (`资料馆 / … / domain / current`), `aria-current="page"`, no broken
images, no page-level horizontal overflow and no application console errors.
The 7 Extra banners and 7 key visuals also matched their declared natural
dimensions and exact ResourceIds.

## Remaining phase boundary

- strict-v2 promotion remains P2-A;
- 2–4 hour soak remains P2-B and is still **NOT EXECUTED**;
- no search, relationship-data, player-internal, or publication rewrite is
  included here.
