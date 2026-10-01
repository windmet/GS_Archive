import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {archiveGeneralTextCorpus} from './lib/archive-general-text-corpus.mjs';
import {commonNames, photoDescriptions, skillNames, bondHonorNames, skillDescriptionDraft, centerSkillDraft, itemNames, itemDescriptions, itemMaterialDescriptionDraft} from '../translation/studio/general/metadata-drafts.mjs';

const root = process.cwd();
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const corpus = archiveGeneralTextCorpus(root);
const idols = read('public/data/masterdata/idol_unit_dictionary.json').idols;
const chineseIdols = read('public/translations/zh-CN/entities/idols.json').entries;
const honorRows = read('public/data/masterdata/domains/honor_catalog.json').entries;
const byHonorId = new Map(honorRows.map(row => [row.id, row]));
const bonds = {};
const compactNames = new Map(idols.map(idol => [idol.display_name.replace(/\s/g, ''), chineseIdols[idol.idol_code]?.name]));
// The honor uses the source's shortened spelling, while the idol dictionary uses the full name.
compactNames.set('アスラン=BBⅡ世', chineseIdols[idols.find(idol => idol.idol_id === 29).idol_code].name);
for (const idol of idols) for (const suffix of [15001, 22001]) {
  const id = (200 + idol.idol_id) * 100000 + suffix;
  const row = byHonorId.get(id);
  assert.ok(row && row.honorType === 2 && row.resourceId === `honor_idol_${id}`, `Bond family drift ${id}`);
  if (suffix === 15001) assert.equal(row.nameJa, `${idol.idol_id === 29 ? 'アスラン=BBⅡ世' : idol.display_name.replace(/\s/g, '')}担当`);
  else assert.ok(Object.hasOwn(bondHonorNames, row.nameJa), `Missing bond title ${row.nameJa}`);
  bonds[id] = {sourceName: row.nameJa, resourceId: row.resourceId, idolCode: idol.idol_code,
    levels: [50, 100], level: null, evidence: 'user-reported', evidenceDate: '2026-10-02',
    note: '用户转述朋友确认两组称号对应偶像羁绊等级 50 / 100；两组与单独等级的对应尚未明确。'};
}
assert.equal(Object.keys(bonds).length, 98);
const entries = {}, missing = [];
const cornerColors = {'ホワイト':'白色','ブラック':'黑色','グラスグリーン':'草绿','オレンジ':'橙色','スカイブルー':'天蓝','レッド':'红色','イエロー':'黄色','ピンク':'粉色'};
for (const row of corpus) {
  let translation = null;
  if (row.kind === 'background' || row.kind.startsWith('photo-')) {
    translation = (row.field === 'description' ? photoDescriptions : commonNames)[row.source];
    const corner = row.source.match(/^コーナーデコ（(.+)）$/);
    if (corner && cornerColors[corner[1]]) translation = `角落装饰（${cornerColors[corner[1]]}）`;
  } else if (row.kind === 'skill' || row.kind === 'skill-category') {
    translation = row.field === 'description' ? skillDescriptionDraft(row.source) : skillNames[row.source];
  } else if (row.kind === 'center-skill') {
    translation = centerSkillDraft(row.source, row.field);
  } else if (row.kind === 'item') {
    translation = row.field === 'name' ? itemNames[row.source] : itemDescriptions[row.source] || itemMaterialDescriptionDraft(row.source);
  } else if (row.kind === 'honor') {
    if (row.field === 'description') translation = row.source === 'プロデューサーのプロフィールに\n設定できる称号。' ? '可设置在制作人个人资料中的称号。' : null;
    else if (row.source.endsWith('担当') && compactNames.has(row.source.slice(0, -2))) translation = `${compactNames.get(row.source.slice(0, -2))}担当`;
    else translation = bondHonorNames[row.source];
  }
  if (translation) ((entries[row.kind] ||= {})[row.field] ||= {})[row.source] = translation;
  else missing.push(row);
}
const target = path.join(root, 'public/translations/zh-CN/archive-general.json');
fs.writeFileSync(target, JSON.stringify({schemaVersion: 1, locale: 'zh-CN', status: 'draft',
  scope: 'metadata-only', excluded: ['dialogue','unit-story','work-communication','home-dialogue'], entries}, null, 2) + '\n');
const bondTarget = path.join(root, 'public/data/editorial/honor-bonds.json');
fs.mkdirSync(path.dirname(bondTarget), {recursive: true});
fs.writeFileSync(bondTarget, JSON.stringify({schemaVersion: 1, evidence: 'user-reported', entries: bonds}, null, 2) + '\n');
const uniqueMissing = [...new Map(missing.map(row => [`${row.kind}:${row.field}:${row.source}`, row])).values()];
fs.mkdirSync(path.join(root, '.analysis/archive-general-localization'), {recursive: true});
fs.writeFileSync(path.join(root, '.analysis/archive-general-localization/untranslated.json'), JSON.stringify(uniqueMissing, null, 2) + '\n');
console.log(JSON.stringify({sourceRows: corpus.length, translatedRows: corpus.length - missing.length,
  uniqueTranslations: Object.fromEntries(Object.entries(entries).map(([kind, fields]) => [kind, Object.values(fields).reduce((sum, values) => sum + Object.keys(values).length, 0)])),
  untranslatedUnique: uniqueMissing.length, bondSourceEntries: Object.keys(bonds).length}, null, 2));
