import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { reflowReadingText } from '../shared/reading/ReadingTypography.js'

assert.equal(reflowReadingText('第一行\r\n第二行\r\n\r\n下一段', 'zh-CN'), '第一行第二行\n\n下一段')
assert.equal(reflowReadingText('Hello\nworld\n \nSecond\nparagraph', 'en-US'), 'Hello world\n\nSecond paragraph')
assert.equal(reflowReadingText('あのさ。\nこれから\n\n本番だ。', 'ja'), 'あのさ。これから\n\n本番だ。')
assert.equal(reflowReadingText(null), '')
const document = JSON.parse(await readFile(new URL('../public/data/reading/1_4_001_00_a.json', import.meta.url)))
const before = JSON.stringify(document)
const row = document.rows.find(row => row.anchor.step_id === 13 && row.kind === 'dialogue')
assert.ok(row.source_text.includes('から、\n今日まで'))
assert.ok(reflowReadingText(row.source_text, 'ja').includes('から、今日まで'))
assert.equal(JSON.stringify(document), before, 'source evidence and anchors must remain unchanged')
console.log('Reading typography verified: CJK/Latin reflow, CRLF, paragraph breaks and unchanged real source evidence')
