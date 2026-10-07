import assert from 'node:assert/strict';
import fs from 'node:fs';
import {archiveGeneralTextCorpus} from './lib/archive-general-text-corpus.mjs';
import {sourceUnits,loadGeneralRevisions,shards} from './lib/general-translation-batches.mjs';
import {resolveArchiveGeneralText as text, honorBondSource} from '../src/presentation/ArchiveGeneralText.mjs';
import {domainInlineParts} from '../src/presentation/DomainInlineText.mjs';
import {historicalPeriod} from '../src/components/archive/DomainPresentation.mjs';
import {isArchiveResourceDescription, archiveBackgroundLabel} from '../src/presentation/ArchiveGeneralTextCore.mjs';

const corpus = archiveGeneralTextCorpus(process.cwd());
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const translation = read('public/translations/zh-CN/archive-general.json');
const revisions=loadGeneralRevisions(process.cwd(),sourceUnits(process.cwd()));
const hasRevision=(kind,source,field='name')=>[...revisions.values()].some(r=>r.kind===kind&&r.field===field&&r.source===source);
for(const row of revisions.values())assert.equal(text(row.kind,row.source,row.field),row.translation,'Imported revisions must override initial drafts');
// The shard list is the one the batches and the generator use.
const shardNames=Object.keys(shards);
const shardEntries={};
for (const name of shardNames) {
  const shard=read(`public/translations/zh-CN/archive-general/${name}.json`);
  for (const [kind, fields] of Object.entries(shard.entries)) {
    assert.ok(!Object.hasOwn(shardEntries,kind),'Domains must not be duplicated across shards');
    shardEntries[kind]=fields;
  }
}
assert.deepEqual(shardEntries,translation.entries,'Page shards must be exactly the source-bound index');
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
if(!hasRevision('skill','8秒ごとに32％の確率で4秒間、コンボスコアが18%アップ','description')) assert.equal(text('skill','8秒ごとに32％の確率で4秒間、コンボスコアが18%アップ','description'), '每8秒有32%的概率在4秒内，连击分数提升18%');
if(!hasRevision('photo-spots','Café Parade店内')) assert.equal(text('photo-spots','Café Parade店内'),'Café Parade 店内');
if(!hasRevision('photo-stickers','ステッカー SideMini 鷹城恭二')) assert.equal(text('photo-stickers','ステッカー SideMini 鷹城恭二'),'SideMini 鹰城恭二');
if(!hasRevision('honor','2022/VDCPの硲 道夫の渡したチョコ数100個達成')) assert.match(text('honor','2022/VDCPの硲 道夫の渡したチョコ数100個達成'),/硲道夫.*100 个$/);
if(!hasRevision('honor','12月上旬イベント のランキングで4～10位にランクイン')) assert.equal(text('honor','12月上旬イベント のランキングで4～10位にランクイン'),'12月上旬活动 · 第 4–10 名');
assert.ok(corpus.filter(row=>row.kind==='honor').every(row=>translation.entries.honor[row.field]?.[row.source]),'All published honor titles and descriptions covered');
assert.ok(corpus.filter(row=>row.kind==='photo-stickers').every(row=>translation.entries['photo-stickers'][row.field]?.[row.source]),'All sticker names/descriptions covered');
for (const kind of ['card','costume','item']) {
  assert.ok(corpus.filter(row=>row.kind===kind).every(row=>translation.entries[kind][row.field]?.[row.source]),`All ${kind} sources covered`);
}
for (const row of corpus.filter(row=>row.kind==='item' && row.field==='description')) {
  const amount=row.source.match(/STを(\d+)回復する。/)?.[1];
  if(amount) assert.ok(text('item',row.source,'description').includes(amount),'Recovery amount must remain intact');
}
if(!hasRevision('card','瞳に映るその先に','title')) assert.equal(text('card','瞳に映るその先に','title'),'映在眼眸中的远方');
assert.ok(corpus.filter(row=>row.kind==='background-variant').every(row=>translation.entries['background-variant'][row.field]?.[row.source]), 'All source scene variants covered');
if(![...revisions.values()].some(r=>r.kind==='background'||r.kind==='background-variant')) assert.equal(archiveBackgroundLabel(translation.entries,'会議室 / 通常'),'会议室 / 通常');
if(![...revisions.values()].some(r=>r.kind==='background'||r.kind==='background-variant')) assert.equal(archiveBackgroundLabel(translation.entries,'電気街 / 夕方'),'电器街 / 傍晚');
if(![...revisions.values()].some(r=>r.kind==='background'||r.kind==='background-variant')) assert.equal(archiveBackgroundLabel(translation.entries,'曇り'),'阴天');
if(![...revisions.values()].some(r=>r.kind==='background'||r.kind==='background-variant')) assert.equal(archiveBackgroundLabel(translation.entries,'unknown / 日中2'),'unknown / 白天 2');
assert.equal(archiveBackgroundLabel(translation.entries,'電気街 / 夕方','ja-JP'),'電気街 / 夕方');
assert.equal(archiveBackgroundLabel(translation.entries,'bg014_otokomichi_in_01'),'bg014_otokomichi_in_01');
if(!hasRevision('costume','ミッドナイトプラネット+')) assert.equal(text('costume','ミッドナイトプラネット+'),'午夜行星+');
if(!hasRevision('item','Welcome Sunlight Liveガシャ\n10回チケット')) assert.match(text('item','Welcome Sunlight Liveガシャ\n10回チケット'),/10次票券$/);
if(!hasRevision('item','SSR確定！今年も良い1年に！心を込めた年賀状ガシャを\n10回引けるチケット。','description')) assert.match(text('item','SSR確定！今年も良い1年に！心を込めた年賀状ガシャを\n10回引けるチケット。','description'),/10 次.*保证 SSR/);
assert.equal(isArchiveResourceDescription('photo-scenes','bg211_catcafe_in_01'),true);
assert.equal(isArchiveResourceDescription('photo-scenes','摄影棚'),false);
if(!hasRevision('costume','040ren_004_00')) assert.equal(text('costume','040ren_004_00'),'040ren_004_00');
if(!hasRevision('skill','constructor')) assert.equal(text('skill','constructor'),'constructor');
if(!hasRevision('dialogue','クールで熱い王子様')) assert.equal(text('dialogue','クールで熱い王子様'),'クールで熱い王子様');
const honorRows = read('public/data/masterdata/domains/honor_catalog.json').entries;
assert.equal(honorRows.filter(row => honorBondSource(row)).length,98);
assert.equal(Object.keys(bonds.entries).length,98);
assert.deepEqual(honorBondSource(honorRows.find(row => row.id===20915001)).levels,[50,100]);
assert.equal(honorBondSource(honorRows.find(row => row.id===20915001)).level,50);
assert.equal(honorBondSource(honorRows.find(row => row.id===20922001)).level,100);
assert.equal(honorRows.filter(row=>honorBondSource(row)?.level===50).length,49);
assert.equal(honorRows.filter(row=>honorBondSource(row)?.level===100).length,49);
assert.equal(honorBondSource({...honorRows.find(row => row.id===20915001), nameJa:'changed'}),null);
assert.equal(honorBondSource(honorRows.find(row => row.id===10001001)),null);
assert.equal(historicalPeriod({term:{openAt:946652400,closeAt:4102412400},termInfo:{open:{sentinelCandidate:true},close:{sentinelCandidate:true}}}),'未限定配置期');
assert.match(historicalPeriod({term:{openAt:1664377200,closeAt:4102412400},termInfo:{close:{sentinelCandidate:true}}}), /2022.*起$/);
assert.deepEqual(domainInlineParts('A [stamina] B<script>'),[{kind:'text',text:'A '},{kind:'stamina'},{kind:'text',text:' B<script>'}]);
console.log(`General metadata: ${count} source-bound drafts; all skill descriptions and 98 user-reported honors; source fallback, numeric identity and safe inline parts passed.`);
