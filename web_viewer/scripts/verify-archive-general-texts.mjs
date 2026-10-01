import assert from 'node:assert/strict';
import fs from 'node:fs';
import {archiveGeneralTextCorpus} from './lib/archive-general-text-corpus.mjs';
import {resolveArchiveGeneralText as text, honorBondSource} from '../src/presentation/ArchiveGeneralText.mjs';
import {domainInlineParts} from '../src/presentation/DomainInlineText.mjs';
import {historicalPeriod} from '../src/components/archive/DomainPresentation.mjs';

const corpus = archiveGeneralTextCorpus(process.cwd());
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const translation = read('public/translations/zh-CN/archive-general.json');
const bonds = read('public/data/editorial/honor-bonds.json');
const sources = new Set(corpus.map(row => JSON.stringify([row.kind,row.field,row.source])));
let count = 0;
for (const [kind, fields] of Object.entries(translation.entries)) for (const [field, values] of Object.entries(fields)) {
  for (const [source, chinese] of Object.entries(values)) {
    assert.ok(sources.has(JSON.stringify([kind,field,source])), 'Orphan translation source');
    assert.equal(text(kind,source,field,'ja-JP'),source);
    assert.equal(text(kind,`${source} changed`,field),`${source} changed`, 'Changed sources must fall back');
    assert.ok(chinese.trim());
    if (['skill','center-skill'].includes(kind) && field === 'description') {
      assert.deepEqual(chinese.match(/<[a-z][a-z0-9_]*>|\d+(?:\.\d+)?/g), source.match(/<[a-z][a-z0-9_]*>|\d+(?:\.\d+)?/g), 'Numeric/unknown parameter identity must remain intact');
    }
    count++;
  }
}
const skillRows = corpus.filter(row => row.kind === 'skill');
assert.ok(skillRows.every(row => translation.entries.skill[row.field]?.[row.source]), 'All source skills must be covered');
assert.ok(corpus.filter(row => row.kind === 'center-skill').every(row => translation.entries['center-skill'][row.field]?.[row.source]), 'All center skills must be covered');
assert.equal(text('skill','8秒ごとに32％の確率で4秒間、コンボスコアが18%アップ','description'), '每 8 秒以 32% 的概率触发，持续 4 秒：连击得分提升 18%。');
assert.equal(text('photo-spots','Café Parade店内'),'Café Parade 店内');
assert.equal(text('costume','040ren_004_00'),'040ren_004_00');
assert.equal(text('skill','constructor'),'constructor');
assert.equal(text('dialogue','クールで熱い王子様'),'クールで熱い王子様');
const honorRows = read('public/data/masterdata/domains/honor_catalog.json').entries;
assert.equal(honorRows.filter(row => honorBondSource(row)).length,98);
assert.equal(Object.keys(bonds.entries).length,98);
assert.deepEqual(honorBondSource(honorRows.find(row => row.id===20915001)).levels,[50,100]);
assert.equal(honorBondSource({...honorRows.find(row => row.id===20915001), nameJa:'changed'}),null);
assert.equal(honorBondSource(honorRows.find(row => row.id===10001001)),null);
assert.equal(historicalPeriod({term:{openAt:946652400,closeAt:4102412400},termInfo:{open:{sentinelCandidate:true},close:{sentinelCandidate:true}}}),'未限定配置期');
assert.match(historicalPeriod({term:{openAt:1664377200,closeAt:4102412400},termInfo:{close:{sentinelCandidate:true}}}), /2022.*起$/);
assert.deepEqual(domainInlineParts('A [stamina] B<script>'),[{kind:'text',text:'A '},{kind:'stamina'},{kind:'text',text:' B<script>'}]);
console.log(`General metadata: ${count} source-bound drafts; all skill descriptions and 98 user-reported honors; source fallback, numeric identity and safe inline parts passed.`);
