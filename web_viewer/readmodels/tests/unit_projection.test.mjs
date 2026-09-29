import test from 'node:test';
import assert from 'node:assert/strict';
import { projectUnitRecord } from '../lib/checkout_adapter.mjs';
import { jsonBytes } from '../lib/common.mjs';

test('Unit catalog and detail retain counts without duplicating full card records', () => {
  const cards = Array.from({ length: 100 }, (_, index) => ({ id: index, payload: 'x'.repeat(8000) }));
  const entry = {
    unit: { unit_id: 1, unit_code: 'jupiter', unit_name: 'Jupiter' },
    members: [{ idol_code: '001tom' }],
    cardStats: { cards, total: 100, rarity_counts: { SSR: 10 }, cards_with_story: 5, single_state: 2 },
    eventRelations: { team_events: [{ event_id: 1 }], attribute_event_appearances: [], mixed_unit_appearances: [] },
  };
  const record = projectUnitRecord(entry, [], []);
  assert.equal(record.summary.catalog.teamEventCount, 1);
  assert.deepEqual(record.view.entry.cardStats, {
    total: 100, rarity_counts: { SSR: 10 }, cards_with_story: 5, single_state: 2,
  });
  assert.equal(entry.cardStats.cards.length, 100);
  assert.ok(jsonBytes(record).length < 2000);
});
