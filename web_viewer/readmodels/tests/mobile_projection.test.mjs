import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readCheckout } from '../lib/checkout_adapter.mjs';
import { buildCompiledGroupTitleMap, groupMobileScenarios, buildRandomTalkBundles } from '../../src/data/idolCommunicationSelectors.js';

test('mobile route leaves match source grouping for every idol and unit', async () => {
  const viewer = new URL('../..', import.meta.url);
  const publicRoot = new URL('../../public/data/', import.meta.url);
  const read = async file => JSON.parse(await fs.readFile(new URL(file, publicRoot), 'utf8'));
  const [archive, presentation, compiled] = await Promise.all([
    read('masterdata/mobile_archive_index.json'),
    read('masterdata/random_talk_presentation_index.json'),
    read('compiled/index.json'),
  ]);
  const { product } = await readCheckout(fileURLToPath(viewer),
    { dataRevision: 'test', mediaEpoch: 'test' });
  const titleMap = buildCompiledGroupTitleMap(compiled);
  const scenarios = new Map(archive.scenarios.map(entry => [entry.id, entry]));
  const idolRecords = product.extraDomains['mobile-idols'].records;
  const unitRecords = product.extraDomains['mobile-units'].records;
  assert.equal(idolRecords.length, Object.keys(archive.by_idol_code).length);
  assert.equal(unitRecords.length, Object.keys(archive.by_unit_code).length);
  const group = (ids, kind) => groupMobileScenarios(ids.map(id => scenarios.get(id)).filter(entry => entry?.kind === kind), titleMap);
  for (const record of idolRecords) {
    const ids = archive.by_idol_code[record.id];
    for (const [field, kind] of [['personalBundles', 'idol_talk'], ['phoneBundles', 'idol_phone']]) {
      const expected = group(ids, kind);
      assert.deepEqual(record.view[field].map(bundle => [bundle.id, bundle.title, bundle.releaseAt, bundle.scenarios.map(s => s.id)]),
        expected.map(bundle => [bundle.id, bundle.title, bundle.releaseAt, bundle.scenarios.map(s => s.id)]));
    }
    const expectedRandom = buildRandomTalkBundles(archive, record.id, titleMap, presentation);
    assert.deepEqual(record.view.randomBundles.map(bundle => [bundle.id, bundle.topics.map(topic => [topic.id, topic.presentation?.start_step, topic.presentation?.end_step])]),
      expectedRandom.map(bundle => [bundle.id, bundle.topics.map(topic => [topic.id, topic.presentation?.start_step, topic.presentation?.end_step])]));
    assert.equal(record.summary.randomTopicCount, expectedRandom.reduce((sum, bundle) => sum + bundle.topics.length, 0));
    assert.ok(Buffer.byteLength(JSON.stringify(record.view)) < 64 * 1024);
  }
  for (const record of unitRecords) {
    const expected = group(archive.by_unit_code[record.id], 'unit_talk');
    assert.deepEqual(record.view.unitBundles.map(bundle => [bundle.id, bundle.scenarios.map(s => s.id)]),
      expected.map(bundle => [bundle.id, bundle.scenarios.map(s => s.id)]));
  }
});
