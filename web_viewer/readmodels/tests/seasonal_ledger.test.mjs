import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildSeasonalLedger } from '../lib/seasonal_ledger.mjs';

const read = async file => JSON.parse(await fs.readFile(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'));

test('seasonal ledger lists every participant across the four campaigns with a reading document', async () => {
  const index = await read('masterdata/seasonal_campaign_index.json');
  const manifest = await read('reading/manifest.json');
  const ledger = buildSeasonalLedger(index, manifest.entries);
  assert.deepEqual(ledger.campaigns.map(campaign => campaign.id), ['valentine_2022', 'white_day_2022', 'valentine_2023', 'white_day_2023']);
  assert.equal(ledger.participants.length, 51);
  assert.equal(ledger.participants.filter(row => row.participant_type === 'support').length, 2);
  const episodes = [...ledger.campaigns.flatMap(campaign => campaign.introduction),
    ...ledger.participants.flatMap(row => Object.values(row.episodes).flat())];
  assert.equal(episodes.length, index.meta.raw_episode_count);
  // Every listed episode opens its own document, and no document is listed twice.
  assert.ok(episodes.every(episode => episode.reading?.document_id && /^sha256:/.test(episode.reading.sha256)));
  assert.equal(new Set(episodes.map(episode => episode.reading.document_id)).size, episodes.length);
  for (const row of ledger.participants) assert.deepEqual(Object.keys(row.episodes), ledger.campaigns.map(campaign => campaign.id));
  const toma = ledger.participants.find(row => row.participant_code === '001tom');
  assert.deepEqual(Object.values(toma.episodes).map(list => list.length), [2, 2, 1, 1]);
  assert.ok(Buffer.byteLength(JSON.stringify(ledger)) < 160 * 1024, 'ledger stays a small leaf');
});

test('seasonal reading chapters follow one participant through the campaigns', async () => {
  const manifest = await read('reading/manifest.json');
  const toma = manifest.entries.filter(entry => entry.directory_id === 'seasonal-participant:001tom')
    .sort((a, b) => a.directory_order - b.directory_order);
  assert.deepEqual(toma.map(entry => entry.episode_label),
    ['2022 情人节 ①', '2022 情人节 ②', '2022 白色情人节 ①', '2022 白色情人节 ②', '2023 情人节', '2023 白色情人节']);
  assert.equal(manifest.entries.filter(entry => entry.directory_id === 'seasonal-common').length, 4);
  assert.ok(manifest.entries.filter(entry => entry.domain === 'seasonal').every(entry => entry.directory_id));
});
