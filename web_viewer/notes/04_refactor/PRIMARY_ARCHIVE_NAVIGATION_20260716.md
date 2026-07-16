# Primary Archive Navigation

Last checked: 2026-07-16

## Decision

The primary sidebar is now content-first instead of resource-group-first:

| Sidebar | Canonical view | Default context |
| --- | --- | --- |
| 偶像 | `idol_detail` | `001tom` |
| 卡片 | `cards` | `001tom` |
| 互动 | `mobile_archive` | `001tom`, `personal` |

If a valid idol is already selected, moving between these three sidebar sections preserves that idol. Touma is only the fallback when no valid selection exists.

## Interaction Ownership

Mobile communication is owned by the Interaction section. It is no longer a secondary gateway in the Story portal.

- Personal chat, phone calls, unit chat and random Talk remain tabs of one Mobile archive.
- After Story phone links from personal stories still deep-link to the exact Mobile record.
- Personal Idol Episodes remain in Story because they have formal sections, synopsis metadata and continuous playback.
- Raw `idol_chat` and `idol_phone` compiled groups remain available to internal resource tooling, but are not the primary archive navigation.

## Legacy URL Migration

Route normalization upgrades old category landing URLs:

```text
?view=idols&category=idol
  -> ?view=idol_detail&category=idol&idol=001tom

?view=idols&category=cards
  -> ?view=cards&category=cards&idol=001tom

?view=idols&category=idol_chat
  -> ?view=mobile_archive&idol=001tom&unit=01jup

?view=idols&category=idol_phone&idol=040ren
  -> ?view=mobile_archive&idol=040ren&unit=01jup&mobile_mode=phone
```

Direct `idol_detail`, `cards`, and `mobile_archive` routes also receive `001tom` when `idol` is absent.

## Idol Selection Contract

Idol Detail and Card Archive use the shared `ArchiveIdolSwitcher` control:

- native searchable select behavior supplied by the platform;
- previous and next icon buttons;
- URL synchronization after every selection;
- current-idol preservation when changing primary sections;
- stable horizontal layout on desktop and 390px mobile widths.

Mobile keeps its domain-specific hero selector but follows the same previous/select/next behavior and route contract.

## Normalized Counts

Idol Detail no longer reports legacy compiled group counts for its related domains:

- Personal Story: normalized episode segments;
- Cards: normalized card records;
- Personal Chat: normalized `idol_talk` records;
- Phone Communication: normalized `idol_phone` records.

This prevents an entry from opening the new interface while displaying counts from the old resource hierarchy.

## Verification

Automated:

```powershell
npm run verify:routes
npm run verify:idol-story-interface
npm run build
```

Browser checks covered:

- legacy `idol_chat` landing migration and Interaction sidebar ownership;
- default Touma for a parameterless Idol Detail route;
- preserving `040ren` across Mobile, Cards and Idol Detail;
- absence of the duplicate Mobile gateway in Story;
- desktop and 390x844 Idol Detail and Card Archive layouts;
- no broken images, page-level horizontal overflow or console errors.

