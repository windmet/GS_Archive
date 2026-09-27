import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildReadingLocatorRecords } from '../lib/reading_locator_projection.mjs';

const source = new URL('../../public/data/reading/manifest.json', import.meta.url);

test('reading locator preserves every source entry and its document digest', async () => {
  const manifest = JSON.parse(await fs.readFile(source, 'utf8'));
  const records = buildReadingLocatorRecords(manifest);
  assert.equal(records.length, manifest.entries.length);
  for (let i = 0; i < records.length; i++) {
    assert.equal(records[i].id, manifest.entries[i].document_id);
    assert.deepEqual(records[i].view.entry, manifest.entries[i]);
    assert.equal(records[i].summary.status, manifest.entries[i].status);
    assert.ok(!('rows' in records[i].view));
  }
});

test('reading locator rejects duplicate identity and altered document hash', async () => {
  const manifest = JSON.parse(await fs.readFile(source, 'utf8'));
  const first = manifest.entries[0];
  assert.throws(() => buildReadingLocatorRecords({ schema_version: 1, entries: [first, first] }), /identity/);
  assert.throws(() => buildReadingLocatorRecords({ schema_version: 1, entries: [{ ...first, sha256: 'sha256:bad' }] }), /hashes/);
});
