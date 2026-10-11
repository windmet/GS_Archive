import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildReadingParents } from '../lib/reading_parent_projection.mjs';
import { buildReadingLocatorRecords } from '../lib/reading_locator_projection.mjs';
import { readingDirectoryEntries } from '../../src/data/ReadingDirectory.js';
import { normalizeArchiveRoute } from '../../src/core/archiveRoute.js';
import { readCheckout } from '../lib/checkout_adapter.mjs';

const doc = (document_id, domain, extra = {}) => ({ document_id, domain, source_file: `episodes/${document_id}.json`, parent_file: `${document_id.replace(/_[a-z]$/, '')}.json`, ...extra });

test('a reprint shares its story with the first run, which is the canonical event', () => {
  const entry = doc('1_3_10001_01_a', 'event');
  const event = (id, isReprint, startAt) => ({ id, view: { identity: { isReprint }, period: { startAt }, readingEntries: [entry] } });
  for (const events of [[event('410001', false, 100), event('event:10019', true, 50)], [event('event:10019', true, 50), event('410001', false, 100)]]) {
    assert.deepEqual(buildReadingParents({ events })(entry), { route: { view: 'event_detail', event: '410001' }, source: 'event' });
  }
  const both = [event('b', false, 200), event('a', false, 100)];
  assert.equal(buildReadingParents({ events: both })(entry).route.event, 'a', 'the earliest first run wins');
});

test('story-collection domains need a collection of their own domain; otherwise the story page owns it', () => {
  const entry = doc('1_4_001_00_a', 'main');
  const collection = (domain, sectionId) => ({ view: { collection: { domain, sectionId }, readingEntries: [entry] } });
  const parentFor = buildReadingParents({ collections: [collection('birthday', '9'), collection('main', 101)],
    stories: [{ id: '1_4_001_00.json', readingEntries: [entry] }] });
  assert.deepEqual(parentFor(entry), { route: { view: 'story_collection', storyType: 'main', storySection: '101' }, source: 'collection' });
  const card = doc('card_a', 'card_scenarios');
  assert.deepEqual(buildReadingParents({ stories: [{ id: 'card_a.json', readingEntries: [card] }] })(card),
    { route: { view: 'story_detail', story: 'card_a.json' }, source: 'story' });
  assert.equal(buildReadingParents({})(card), null, 'no owner means no parent, never a guess');
});

test('idol story, work and seasonal owners resolve their own address fields', () => {
  const idolEntry = doc('1_2_001_01_a', 'idol_story');
  const workEntry = doc('work_a', 'work', { source_file: 'work_a.json', parent_file: 'work_a.json' });
  const lineEntry = doc('line_a', 'work', { source_file: 'line_a.json', parent_file: 'line_a.json' });
  const seasonEntry = doc('5_01_001_22_a', 'seasonal');
  const introEntry = doc('5_01_000_22_a', 'seasonal');
  const parentFor = buildReadingParents({
    idolStories: [{ view: { page: { idol_code: '001tom', sections: [{ id: 20101, episodes: [{ id: 2010101, resource_id: '1_2_001_01_a' }] }] } } }],
    work: [{ view: { idol: { idol_code: '001tom', short_stories: [{ compiled_file: 'work_a.json' }], scene_lines: [{ compiled_file: 'line_a.json' }] },
      readingEntries: [workEntry, lineEntry] } }],
    seasonal: [{ view: { campaign: { id: 'valentine_2022', introduction: [{ compiled_file: '5_01_000_22.json' }],
      participants: [{ participant_code: '001tom', episodes: [{ compiled_file: '5_01_001_22.json' }] }] }, readingEntries: [seasonEntry, introEntry] } }],
  });
  assert.deepEqual(parentFor(idolEntry).route, { view: 'idol_story_archive', idol: '001tom', storySection: '20101', episode: '2010101' });
  assert.deepEqual(parentFor(workEntry).route, { view: 'work_archive', storyType: 'work', idol: '001tom', story: 'work_a.json', workMode: 'stories' });
  assert.equal(parentFor(lineEntry).route.workMode, 'lines');
  assert.deepEqual(parentFor(seasonEntry).route, { view: 'seasonal_campaign', storyType: 'seasonal_campaign', storySection: 'valentine_2022', idol: '001tom' }, 'a segment follows its parent file');
  assert.equal(parentFor(introEntry).route.idol, 'common');
});

test('the locator row carries parent only when a resolver is supplied', () => {
  const manifest = { schema_version: 1, entries: [{ document_id: 'a', logical_id: 'story:a', file: 'a.json', schema_version: 2, sha256: `sha256:${'a'.repeat(64)}`,
    source_sha256: `sha256:${'b'.repeat(64)}`, source_file: 'a.json', status: 'ready', row_count: 1, domain: 'main' }] };
  assert.ok(!('parent' in buildReadingLocatorRecords(manifest, readingDirectoryEntries)[0].view));
  assert.equal(buildReadingLocatorRecords(manifest, readingDirectoryEntries, () => null)[0].view.parent, null);
});

// Floors guard against regressions in owner matching; a document with no owner stays null instead of blocking the build.
const FLOORS = { event: 1, work: 1, idol_story: 1, main: 0.99, unit_story: 0.99, birthday: 0.99, extra: 0.99, card_scenarios: 0.99, seasonal: 0.99 };
const EXPECTED_VIEW = { event: 'event_detail', work: 'work_archive', idol_story: 'idol_story_archive', seasonal: 'seasonal_campaign',
  main: 'story_collection', unit_story: 'story_collection', birthday: 'story_collection', extra: 'story_collection', card_scenarios: 'story_detail' };

test('local-corpus: every domain meets its coverage floor and each parent is a canonical route', async () => {
  const viewer = fileURLToPath(new URL('../..', import.meta.url));
  const { product } = await readCheckout(viewer, { dataRevision: '0'.repeat(64), mediaEpoch: 'test' });
  const rows = product.extraDomains['reading-docs'].records;
  const stat = {};
  for (const row of rows) {
    const domain = row.view.entry.domain;
    const s = stat[domain] ||= { total: 0, parent: 0 };
    s.total++;
    const parent = row.view.parent;
    if (!parent) continue;
    s.parent++;
    const route = normalizeArchiveRoute(parent.route);
    assert.equal(route.view, EXPECTED_VIEW[domain], `${row.id}: parent view`);
    for (const [key, value] of Object.entries(parent.route)) if (key !== 'view') assert.equal(String(route[key]), String(value), `${row.id}: ${key} survives normalization`);
    for (const forbidden of ['sourceRoute', 'reading', 'readingRow', 'readingMode', 'readingRev', 'parentView', 'returnView']) assert.ok(!(forbidden in parent.route), `${row.id}: no ${forbidden}`);
    if (domain === 'event') assert.ok(!parent.route.event.startsWith('event:'), `${row.id}: a reprint is never the canonical event`);
  }
  for (const [domain, floor] of Object.entries(FLOORS)) assert.ok(stat[domain].parent / stat[domain].total >= floor, `${domain} coverage ${stat[domain].parent}/${stat[domain].total}`);
  assert.deepEqual(Object.keys(stat).sort(), Object.keys(FLOORS).sort(), 'a new Reader domain needs a coverage floor');
});
