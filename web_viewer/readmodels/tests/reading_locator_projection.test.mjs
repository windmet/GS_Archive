import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildReadingLocatorRecords } from '../lib/reading_locator_projection.mjs';
import { readingDirectoryEntries } from '../../src/data/ReadingDirectory.js';

const source = new URL('../../public/data/reading/manifest.json', import.meta.url);

test('reading locator preserves every source entry and its document digest', async () => {
  const manifest = JSON.parse(await fs.readFile(source, 'utf8'));
  const records = buildReadingLocatorRecords(manifest, readingDirectoryEntries);
  assert.equal(records.length, manifest.entries.length);
  for (let i = 0; i < records.length; i++) {
    assert.equal(records[i].id, manifest.entries[i].document_id);
    assert.deepEqual(records[i].view.entry, manifest.entries[i]);
    if (!manifest.entries[i].directory_id)
      assert.deepEqual(records[i].view.entries, manifest.entries.filter(entry => entry.logical_id === manifest.entries[i].logical_id));
    assert.equal(records[i].summary.status, manifest.entries[i].status);
    assert.ok(!('rows' in records[i].view));
  }
});

test('reading locator rejects duplicate identity and altered document hash', async () => {
  const manifest = JSON.parse(await fs.readFile(source, 'utf8'));
  const first = manifest.entries[0];
  assert.throws(() => buildReadingLocatorRecords({ schema_version: 1, entries: [first, first] }, readingDirectoryEntries), /identity/);
  assert.throws(() => buildReadingLocatorRecords({ schema_version: 1, entries: [{ ...first, sha256: 'sha256:bad' }] }, readingDirectoryEntries), /hashes/);
});

test('a birthday chapter reads as one directory in in-game order', async () => {
  const manifest = JSON.parse(await fs.readFile(source, 'utf8'));
  const index = JSON.parse(await fs.readFile(new URL('../../public/data/masterdata/idol_episode_index.json', import.meta.url), 'utf8'));
  const section = index.chapters.find(chapter => chapter.idol_code === '002sht').sections.find(row => row.id === 20202);
  const expected = section.episodes.map(episode => episode.resource_id);
  const records = buildReadingLocatorRecords(manifest, readingDirectoryEntries);
  for (const id of [expected[0], expected.at(-1)]) {
    assert.deepEqual(records.find(record => record.id === id).view.entries.map(entry => entry.document_id), expected);
  }
  assert.equal(new Set(expected.map(id => manifest.entries.find(entry => entry.document_id === id).logical_id)).size, 2,
    'small talks and episodes stay separate stories');
});
