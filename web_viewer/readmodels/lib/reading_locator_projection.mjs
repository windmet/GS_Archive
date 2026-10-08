import { assert, pick } from './common.mjs';

const ID = /^[A-Za-z0-9_-]+$/;
const HASH = /^sha256:[a-f0-9]{64}$/;

// directoryEntries is the App's readingDirectoryEntries (src/data/ReadingDirectory.js), passed in by
// the checkout adapter so the published locator groups segments exactly as the Reader does.
export function buildReadingLocatorRecords(manifest, directoryEntries) {
  assert(manifest?.schema_version === 1 && Array.isArray(manifest.entries), 'Reading manifest version/entries');
  assert(typeof directoryEntries === 'function', 'Reading directory grouping');
  const ids = new Set();
  const files = new Set();
  return manifest.entries.map(entry => {
    assert(ID.test(entry.document_id || '') && !ids.has(entry.document_id), 'Reading locator document identity');
    assert(entry.file === `${entry.document_id}.json` && entry.schema_version === 2, 'Reading locator file/version');
    assert(HASH.test(entry.sha256 || '') && HASH.test(entry.source_sha256 || ''), 'Reading locator hashes');
    assert(typeof entry.source_file === 'string' && !files.has(entry.source_file), 'Reading locator source identity');
    assert(['ready', 'empty', 'unsupported'].includes(entry.status) && Number.isInteger(entry.row_count), 'Reading locator status/count');
    ids.add(entry.document_id);
    files.add(entry.source_file);
    return { id: entry.document_id,
      summary: pick(entry, ['source_file', 'status', 'row_count', 'title', 'episode_label', 'domain']),
      view: { entry, entries: directoryEntries(manifest.entries, entry) },
    };
  });
}

export function readingEntriesForFiles(entries, files, { includeChildrenOf = [] } = {}) {
  const sources = new Set(files.filter(Boolean));
  const parents = new Set(includeChildrenOf.filter(Boolean));
  return entries.filter(entry => sources.has(entry.source_file) || parents.has(entry.parent_file));
}
