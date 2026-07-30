# GS Archive Extra Story Official Taxonomy

Date: 2026-07-30
Phase: P1 Story IA follow-up
Branch: `codex/extra-official-taxonomy-p1`

## Problem corrected

The first Extra landing treated every table 144 group as an independent
collection. That preserved all 47 masterdata identities, but flattened works
whose official presentation contains multiple chapters.

The canonical archive model is now:

```text
Extra Story domain
  -> official work / masterdata supplement
    -> masterdata chapter
      -> compiled playback target
```

Legacy `story_section` values such as `60801` remain accepted as aliases. New
navigation uses the series ID (`608`) as the canonical collection route.

## Source reconciliation

The checked Wiki Extra Story index lists six works:

- 謹賀新年2022;
- GROWING FES -夜陰のルミネセンス-;
- 1st Anniversary;
- GROWING FES -終夜のアストロロジー-;
- GROWING FES -窮月のグロリアスナイト-;
- 謹賀新年2023.

Source:

- https://wikiwiki.jp/sidem-gstars/エクストラストーリー

Table 178 is the stronger local archive authority. It exposes seven explicit
`ExtraStoryChapterData` entries and adds the March 2023 GROWING FES series
`609`, which the checked Wiki index omits. The product therefore presents seven
formal Extra works. The remaining three table-143 Home Story families
(`602`, `603`, `610`) stay under a separate supplement heading.

## Table-178 visual relation

The seven formal works have exact masterdata-to-RAW navigation visuals:

| chapter | work | table-178 ResourceId |
| ---: | --- | ---: |
| 601 | 謹賀新年2022 | `1010010` |
| 604 | GROWING FES -夜陰のルミネセンス- | `1010040` |
| 605 | 1st Anniversary | `1010070` |
| 606 | GROWING FES -終夜のアストロロジー- | `1010060` |
| 607 | GROWING FES -窮月のグロリアスナイト- | `1010080` |
| 608 | 謹賀新年2023 | `1010090` |
| 609 | GROWING FES -光彩のポートレート- | `1010100` |

The `605` relation is deliberately not inferred from the entry ID:
table 178 entry `1010050` explicitly points to visual ResourceId `1010070`.
Each declared RAW bundle contains one 300 x 150 banner, one 1456 x 548 key
visual and one logo. P1 publishes only the banner and key visual used by
`ArchiveStoryCatalog` and `ArchiveStoryCollection`; logos remain catalog-only.

## 謹賀新年2023

Series `608` is one work with 17 chapters, not 17 unrelated collections.
The chapter titles and release order match the dedicated source page.

Source:

- https://wikiwiki.jp/sidem-gstars/謹賀新年2023

## 終夜のアストロロジー relation

Series `606` contains:

- story: `星座と占いとカオマンガイ`;
- resource: `5_05_002_00`;
- release: 2022-09-28 15:00 JST.

It is related to:

- gasha code: `300031`;
- announcement ID: `1300033`;
- title: `GROWING FES -終夜のアストロロジー-`;
- new pickup SSR: `023har_ssr02`, `040ren_ssr03`, `044ame_ssr02`.

The story release timestamp, curated gasha title, and three pickup relations
agree with the dedicated gasha page. The collection page exposes an internal
link to the existing gasha detail instead of duplicating card or gasha data.

Source:

- https://wikiwiki.jp/sidem-gstars/【ガシャ】「GROWING FES -終夜のアストロロジー-」

## Counts

- 10 work-level collections;
- 7 formal table-178 works;
- 3 special Home Story supplement works;
- 47 logical chapters;
- 45 resource identities;
- 44 compiled playback files.
- 14 bounded RAW-derived navigation PNGs.

The work count is a presentation hierarchy. It does not change or collapse
the 47 masterdata chapter identities.
