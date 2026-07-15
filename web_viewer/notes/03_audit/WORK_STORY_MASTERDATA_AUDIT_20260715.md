# Work Story Masterdata Audit

Date: 2026-07-15

External comparison:

- `https://wikiwiki.jp/sidem-gstars/お仕事`
- `https://wikiwiki.jp/sidem-gstars/【お仕事】天ヶ瀬 冬馬`

## Conclusion

Work content is a permanent idol-oriented archive family, not an event-story family. Its two presentation layers must remain distinct:

1. `scene_line`: short voiced lines shown in work scenes;
2. `short_story`: multi-step playable stories that may occur during work.

The local masterdata and compiled archive are sufficient to build both layers for all 49 idols.

## Source Tables

| Table | Rows | Meaning |
| ---: | ---: | --- |
| 53 | 4 | Physical, Intelli, Mental and All work category metadata |
| 54 | 441 | 49 idols x 9 work-scene lines |
| 55 | 196 | 49 idols x 4 work short stories |

Table 53 fields 3 and 4 link the attribute category to the scene-line and short-story relation ids. The `All` category is a gameplay selection mode and has no independent story rows.

All 637 table 54/55 resources resolve to local compiled JSON.

## Compiled-Derived Presentation

The compiled files supply information not present as display fields in tables 54/55:

- scene-line text and short-story title;
- representative background resource;
- costume/model resource;
- dialogue, voice and step counts;
- the participant and dialogue preview.

Picture Studio tables 107/108 give official names to 444 of the 637 representative backgrounds: 324 scene lines and 120 short stories. Other backgrounds are still locally verified resources, but their human-readable location labels are not present in those tables.

The Wiki explicitly distinguishes official Picture Studio spot names from temporary labels used for backgrounds absent from Picture Studio. The archive must therefore show the background resource id when no local official name exists, rather than importing a Wiki temporary label as raw masterdata.

## Touma Verification

`001tom` contains nine scene lines and four short stories. The four local compiled titles match the Wiki list:

1. `大衆向けアニメのお仕事`
2. `古典劇の舞台に出演するお仕事`
3. `チョコレート系菓子のCMのお仕事`
4. `スポーツニュース番組のレポーターのお仕事`

Each short story contains ten dialogue steps. Scene-line files contain one voiced ADV line plus staging and transition steps.

## Generated Index

`public/data/masterdata/work_story_index.json` is generated with:

```powershell
python ..\data_pipeline\masterdata_extract.py <client_master_data> `
  --out-dir .analysis\masterdata `
  --public-out-dir public\data\masterdata `
  --compiled-dir public\data\compiled `
  --bg-dir public\assets\bg `
  --work-story-only
```

Run `npm run verify:work-story` to validate the 49 x 9 / 49 x 4 structure and the Touma comparison titles.

## UI Direction

1. Use an idol selector as the primary navigation level.
2. Show the four playable short stories first, with background previews and dialogue/voice counts.
3. Keep the nine scene lines in a separate tab or section with their full line preview.
4. Use Physical/Intelli/Mental as filters and color accents; do not create a fictional All-story group.
5. Display official location names only when backed by Picture Studio masterdata, otherwise show the background resource id.
