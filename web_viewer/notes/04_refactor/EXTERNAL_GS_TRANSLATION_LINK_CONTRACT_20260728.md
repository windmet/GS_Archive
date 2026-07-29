# External GROWING STARS Translation Link Contract

Status: pilot merged in PR #6; THE KOGADO exact expansion active
Date: 2026-07-28
Scope: SideM GROWING STARS only

Implementation refresh: 2026-07-29

- `8d3d582`: Schema, two exact event records, offline verifier, and CI gate.
- `09ded27`: Event/Story detail UI, exact-resource selectors, and UI source gate.
- Browser-verified at 5174 for both exact events and one Story detail route.
- 390px layout has no horizontal overflow; no remote image is requested.
- 2026-07-30: the three THE KOGADO Episode 0 entries passed opening/title-card
  and final-dialogue boundary checks and are now exact unit-story records.
- The registry now contains five exact GS mappings: two events and three
  unit-story collections.
- `ArchiveStoryCollection` now renders the exact resource inside its matching
  expanded chapter while retaining internal chapter and episode Play actions.
- Current production build passed at 2,405 modules; the built preview passed
  exact-link, safe-anchor, no-remote-image, no-overflow, and console-error gates.
- The local full Vite build reached its 183-second execution limit, so this
  was the historical PR #6 pilot result and is superseded for this expansion.

## 1. Product decision

GS Archive may link an internal GROWING STARS event or story identity to an
existing community-subtitled Bilibili video.

The feature is a lightweight discovery and viewing layer:

```text
GS archive identity
-> credited original Bilibili upload
```

It is not:

- a mirror of a third-party directory;
- a Bilibili video mirror;
- a replacement for RAW/masterdata identity;
- proof of built-in text translation;
- proof of Story Runtime release acceptance.

`idol-master.top` was useful product inspiration, but it is not a runtime,
data, attribution, or availability dependency for this feature.

## 2. Inclusion boundary

Include only content confidently identified as GROWING STARS:

- main story;
- Episode 0/unit story;
- idol/personal story;
- GS event story;
- GS card-associated scenario only when such an internal GS scenario identity
  actually exists;
- GS seasonal, work, mobile, birthday, or other masterdata-backed story.

Exclude:

- SideM Mobage card and event stories;
- CD or song drama;
- live-event footage;
- anime clips;
- translated short reactions or excerpts without an exact GS story relation;
- mixed compilations whose GS portion cannot be bounded;
- unknown-product videos;
- deleted/private videos that cannot be identified reliably.

The existence of a SideM title or unit name is not sufficient to classify a
video as GROWING STARS.

## 3. Discovery

Public uploader favorite folders may be used to discover candidate videos.
The currently verified example is the public favorite-folder owner:

```text
UID: 313228356
display name at verification: 惬意茶会
example folder: THE 虎牙道
folder media count at 2026-07-28: 30
```

The folder is a discovery queue, not an authority:

- folder membership can change;
- GS and Mobage entries may be mixed;
- a video may belong to CD drama or another SideM product;
- titles can contain typos or incomplete coverage descriptions;
- the uploader of the folder is not necessarily the uploader or translator of
  each video.

Every accepted record must be opened or otherwise inspected at the original
Bilibili identity and mapped independently to GS Archive.

## 4. Attribution

Every entry records:

- canonical Bilibili URL;
- BVID;
- original video uploader name;
- original uploader UID when available;
- translation language;
- a short coverage description;
- discovery folder reference when useful;
- verification time.

Attribution is to the original video uploader. The favorite-folder curator may
be credited separately as discovery metadata, but must not be presented as the
translator unless they uploaded the video.

## 5. Data layout

Initial implementation:

```text
web_viewer/schemas/external-story-resource-v1.schema.json
web_viewer/public/data/external_story_resources.json
```

One file is sufficient for the pilot. Split by unit or domain only after the
registry becomes large enough to justify generated indexes.

## 6. Entry shape

```json
{
  "schema_version": 1,
  "entries": [
    {
      "external_id": "bilibili:BV1ac411S7KB",
      "product": "growing_stars",
      "content_kind": "translated_story_video",
      "language": "zh-CN",
      "platform": {
        "name": "bilibili",
        "bvid": "BV1ac411S7KB",
        "canonical_url": "https://www.bilibili.com/video/BV1ac411S7KB"
      },
      "uploader": {
        "uid": "16493529",
        "name": "叶絵理奈"
      },
      "internal_mapping": {
        "state": "exact-event",
        "event_id": "10008",
        "story_resource_ids": ["1_3_10008_01"],
        "collection_ids": [],
        "evidence": [
          "exact GS event title",
          "masterdata event 10008",
          "compiled story 1_3_10008_01"
        ]
      },
      "translation": {
        "coverage": "complete-collection",
        "subtitle_kind": "embedded",
        "notes": null
      },
      "discovery": {
        "kind": "bilibili-public-favorite-folder",
        "curator_uid": "313228356",
        "folder_id": "3689692756"
      },
      "availability": {
        "state": "active",
        "last_checked_at": "2026-07-28"
      },
      "visual": {
        "policy": "local-gs-archive-visual",
        "url": null
      }
    }
  ]
}
```

## 7. Mapping states

Allowed mapping states:

```text
exact-story
exact-collection
exact-event
exact-unit-story
exact-idol-story
partial-story
candidate
unmapped
```

Only exact states are displayed beside an internal Play button in the pilot.
`partial-story` and `candidate` may appear later in a dedicated community
resource view, clearly labeled.

Do not use a numeric confidence score without a calibrated formula.

## 8. Coverage states

```text
complete-story
complete-collection
partial
excerpt
unknown
```

Coverage describes the video, not GS Archive completeness. The portal must
keep these metrics separate:

```text
original GS story coverage
interactive-play coverage
external Chinese video coverage
built-in Chinese text coverage
```

No combined "translation completion" percentage is allowed.

## 9. Pilot mappings

### Exact event collections

| BVID | Uploader | Internal GS relation |
| --- | --- | --- |
| `BV1ac411S7KB` | 叶絵理奈 | event `10008`, story `1_3_10008_01`, `GROWING SIGN@L -K.now O.nly-` |
| `BV1od4y1x7X6` | 月剑P | event `30014`, story `1_3_30014_01`, `GROWING SELECTION -PROOF OF ONESELF-` |

These are the preferred two-record first commit because the external titles,
masterdata events, and compiled story collections agree directly.

### THE KOGADO Episode 0 exact unit stories

| BVID | Uploader | Exact collection |
| --- | --- | --- |
| `BV1LL411G7LD` | HaaNaaaP (`14496860`) | `1_1_013the_01_1_1_013_01` |
| `BV1xA4y1S7Cb` | HaaNaaaP (`14496860`) | `1_1_013the_02_1_1_013_02` |
| `BV16u4y187tH` | 死扛桑 (`8798195`) | `1_1_013the_03_1_1_013_03` |

Each video was checked against the local collection opening/title card and the
final dialogue in part `j`. All three span their complete ten-part collection
and are recorded as `exact-unit-story` with `complete-collection` coverage.
Detailed evidence is in
`notes/03_audit/EXTERNAL_GS_THE_KOGADO_EXACT_LINKS_20260730.md`.

### Deferred personal-story candidates

Broad titles such as "圆城寺道流个人剧情" may contain more than one internal
story identity. They remain candidates until the video boundary is compared
with `idol_episode_index` and compiled resources.

## 10. Visual policy

Do not:

- copy images from `idol-master.top`;
- hotlink Bilibili covers or avatars;
- download video frames as an undocumented shortcut;
- add remote images to the local publication ledger.

Use:

1. exact local RAW-derived event visual when available;
2. existing story presentation visual;
3. local unit logo or representative background;
4. a small local generic placeholder.

The UI can be useful without a video thumbnail.

## 11. Link and UI behavior

Pilot placement:

- `ArchiveEventDetail`: external translation link beside the event story;
- `ArchiveStoryDetail`: external translation link near the internal play action.

Label:

```text
社区中文资源
<uploader> · Bilibili
[前往观看]
```

External anchors require:

```html
target="_blank"
rel="noopener noreferrer external"
```

Initial domain allowlist:

```text
https://www.bilibili.com/video/<BVID>
```

Do not embed an iframe in the pilot.

## 12. Verification

Source-only verifier:

- schema validity;
- unique `external_id`;
- unique BVID unless multiple internal mappings are explicitly intended;
- BVID and canonical URL agree;
- product is exactly `growing_stars`;
- uploader fields exist;
- exact event/story/collection IDs exist locally;
- no Mobage, drama, live, or unknown-product category;
- no remote visual URL;
- allowed platform and domain only.

External availability:

- may be checked manually or by an opt-in script;
- must not make ordinary source-only CI depend on Bilibili uptime;
- records active/private/deleted/unavailable without removing the mapping
  history;
- updates `last_checked_at` only when a real check occurs.

Browser gate at 5174:

- internal event/story route remains stable;
- internal Play action still opens StoryViewer;
- external action opens the canonical Bilibili URL in a new tab;
- uploader and external nature are visible before navigation;
- no remote image request is added;
- mobile layout remains usable;
- Mobage and drama entries do not appear in GS counts or GS detail pages.

## 13. Git plan

PR #2 intentionally contained no external-link pilot. PR #6 merged the first
two exact event links. The bounded THE KOGADO expansion uses:

```text
branch:
codex/external-story-links-the-kogado

scope:
three Episode 0 mappings after exact coverage verification, schema/verifier
support for exact unit-story relations, and audit/handoff refresh
```

Only after a meaningful exact GS set exists should the portal add a dedicated
"中文剧情导航" view or home-page entry.
