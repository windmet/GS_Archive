import { assert, pick } from './common.mjs';

const ID = /^[A-Za-z0-9_-]+$/;
const HASH = /^sha256:[a-f0-9]{64}$/;

export function buildReadingLocatorRecords(manifest) {
  assert(manifest?.schema_version === 1 && Array.isArray(manifest.entries), 'Reading manifest version/entries');
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
      view: { entry: pick(entry, ['document_id', 'logical_id', 'scenario_id', 'file', 'schema_version',
        'sha256', 'source_sha256', 'source_file', 'status', 'row_count', 'title', 'episode_label', 'domain', 'parent_file']) },
    };
  });
}
