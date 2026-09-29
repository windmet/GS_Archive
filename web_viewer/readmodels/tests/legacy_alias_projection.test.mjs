import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildLegacyAliasRecords } from '../lib/legacy_alias_projection.mjs';
import { groupFileList } from '../../src/utils/IndexNormalizer.js';

const publicRoot = new URL('../../public/data/', import.meta.url);
const read = async file => JSON.parse(await fs.readFile(new URL(file, publicRoot), 'utf8'));

test('[local-corpus] legacy route aliases retain every source group, file order and selected file metadata', async () => {
  const [compiled, catalog] = await Promise.all([
    read('compiled/index.json'), read('masterdata/story_catalog.json'),
  ]);
  const aliases = buildLegacyAliasRecords(compiled, catalog);
  const sourceGroups = [];
  for (const category of compiled.categories) {
    for (const group of category.groups || []) {
      if (Array.isArray(group.groups)) sourceGroups.push(...group.groups);
      else sourceGroups.push(group);
    }
    for (const entry of Object.values(category.characters || category.individual || {}))
      sourceGroups.push(...(entry.groups || []));
    for (const unit of category.units || []) sourceGroups.push(...(unit.episodes || []));
  }
  const byId = new Map(sourceGroups.map(group => [String(group.id), group]));
  assert.equal(byId.size, sourceGroups.length);
  assert.equal(aliases.fileRecords.length, sourceGroups.length);
  assert.equal(aliases.groupRecords.length, 166);
  assert.equal(aliases.episodeRecords.length, 16);
  assert.equal(aliases.zeroRecords[0].view.units.length, 16);
  const metadata = new Map(catalog.fileMetadata.entries.map(entry => [entry.key, entry]));
  for (const record of aliases.fileRecords) {
    const source = byId.get(record.id);
    assert.ok(source, record.id);
    const files = groupFileList(source);
    assert.deepEqual(record.view.entries.slice(0, files.length).map(entry => entry.file), files, record.id);
    assert.equal(record.summary.fileCount, files.length);
    for (const entry of record.view.entries.slice(0, files.length)) {
      const meta = metadata.get(entry.file);
      assert.equal(entry.missing, meta?.exists === false);
      assert.equal(entry.resourceId, meta?.resourceIds?.[0] || entry.file);
      assert.ok(entry.searchText.includes(entry.file));
    }
    assert.ok(Buffer.byteLength(JSON.stringify(record.view)) < 64 * 1024);
  }
  const main = aliases.groupRecords.find(record => record.id === 'main_story');
  assert.deepEqual(main.view.groups.map(group => group.id), compiled.categories[0].groups.map(group => group.id));
  const first = aliases.fileRecords.find(record => record.id === '1_4_001');
  assert.equal(first.view.entries[0].title, 'エピソード1 - エピソード2');
  assert.equal(first.view.entries[0].subtitle, '1_4_001_00_a, 1_4_001_00_b · 11 voices · 11 lips');
});

test('extra aliases retain explicitly missing supplemental files', () => {
  const compiled = { categories: [{ id: 'extra', name: 'Extra', groups: [{ id: 'extra-one', title: 'One', files: ['one.json'] }] }] };
  const catalog = { fileMetadata: { entries: [], missingExtra: [{ resourceId: 'uncompiled', title: 'Unavailable' }] } };
  const aliases = buildLegacyAliasRecords(compiled, catalog);
  assert.equal(aliases.fileRecords[0].view.entries[1].resourceId, 'uncompiled');
  assert.equal(aliases.fileRecords[0].view.entries[1].missing, true);
});
