import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readCheckout } from '../lib/checkout_adapter.mjs';
import { readingEntriesForFiles } from '../lib/reading_locator_projection.mjs';

const viewer = fileURLToPath(new URL('../..', import.meta.url));

test('[local-corpus] route leaves preserve exact readable source membership and manifest order', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../../public/data/reading/manifest.json', import.meta.url), 'utf8'));
  const entries = manifest.entries;
  const { product } = await readCheckout(viewer, { dataRevision: 'test', mediaEpoch: 'test' });
  const check = (actual, files, options) => {
    assert.deepEqual(actual, readingEntriesForFiles(entries, files, options));
    assert.ok(actual.every(entry => files.includes(entry.source_file) || options?.includeChildrenOf?.includes(entry.parent_file)));
  };
  for (const story of product.stories) check(product.storyViews[story.id].readingEntries, [story.file], { includeChildrenOf: [story.file] });
  for (const record of product.extraDomains.collections.records) check(record.view.readingEntries,
    record.view.collection.chapters.flatMap(chapter => (chapter.episodes || []).map(episode => episode.file)));
  for (const record of product.extraDomains.events.records) check(record.view.readingEntries,
    record.view.episodes.map(episode => episode.file));
  for (const record of product.extraDomains.work.records) check(record.view.readingEntries,
    [...record.view.idol.short_stories, ...record.view.idol.scene_lines].map(entry => entry.compiled_file));
  for (const record of product.extraDomains['idol-stories'].records) check(record.view.readingEntries,
    record.view.page.sections.flatMap(section => (section.episodes || []).map(episode => episode.file)));
});
