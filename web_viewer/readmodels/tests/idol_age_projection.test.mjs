import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readCheckout } from '../lib/checkout_adapter.mjs';

test('published read models carry the display age, never the internal numeric age', async () => {
  const viewer = fileURLToPath(new URL('../..', import.meta.url));
  const { product } = await readCheckout(viewer, { dataRevision: '0'.repeat(64), mediaEpoch: 'test' });
  // _source.fields maps field names to master-data column numbers; it is provenance, not a value.
  const text = JSON.stringify(product, (key, value) => (key === '_source' ? undefined : value));
  assert.ok(!/"age":/.test(text), 'no read model row exposes the internal age');
  assert.ok(text.includes('"display_age":"？？"'), 'the placeholder display age survives into the read models');
});
