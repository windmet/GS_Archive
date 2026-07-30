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

The checked Extra Story index lists six official works:

- 謹賀新年2022;
- GROWING FES -夜陰のルミネセンス-;
- 1st Anniversary;
- GROWING FES -終夜のアストロロジー-;
- GROWING FES -窮月のグロリアスナイト-;
- 謹賀新年2023.

Source:

- https://wikiwiki.jp/sidem-gstars/エクストラストーリー

Four additional series exist in Extra masterdata but are not listed by that
checked index. They remain visible under a separate masterdata supplement
heading rather than being discarded or silently promoted into the official
list.

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
- 6 works in the checked official index;
- 4 masterdata supplement works;
- 47 logical chapters;
- 45 resource identities;
- 44 compiled playback files.

The work count is a presentation hierarchy. It does not change or collapse
the 47 masterdata chapter identities.
