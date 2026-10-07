import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { archiveGeneralTextCorpus } from './lib/archive-general-text-corpus.mjs'
import { archiveGeneralText } from '../src/presentation/ArchiveGeneralTextCore.mjs'

// Profile fields (idol profile, unit introduction, 通信 status, work labels) are translated in
// full in the published 'profiles' shard; game markup survives and authored line breaks are kept,
// so the three-line 通信 status reservation still holds in Chinese.
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const shard = JSON.parse(readFileSync(new URL('../public/translations/zh-CN/archive-general/profiles.json', import.meta.url), 'utf8'))
const kinds = ['idol-profile', 'unit-profile', 'mobile-status', 'work']
assert.deepEqual(Object.keys(shard.entries).sort(), [...kinds].sort(), 'the profiles shard holds exactly the profile kinds')
const rows = archiveGeneralTextCorpus(root).filter(row => kinds.includes(row.kind))
assert.ok(rows.length > 450, `expected the profile corpus, found ${rows.length}`)
const markup = text => (text.match(/<[^>]+>/g) || []).join('')
const counted = new Map()
for (const row of rows) {
  const shown = archiveGeneralText(shard.entries, row.kind, row.source, row.field)
  // Presence, not difference: 料理, 京都 or NORINORI everyday translate to themselves.
  assert.ok(Object.hasOwn(shard.entries[row.kind]?.[row.field] || {}, row.source), `untranslated ${row.kind}.${row.field}: ${row.source}`)
  assert.equal(markup(shown), markup(row.source), `game markup kept: ${row.source}`)
  if (['mobile-status', 'unit-profile'].includes(row.kind)) {
    assert.equal(shown.split('\n').length, row.source.split('\n').length, `line breaks kept: ${row.source}`)
  }
  assert.equal(archiveGeneralText(shard.entries, row.kind, row.source, row.field, 'ja-JP'), row.source, 'the Japanese UI shows the source')
  counted.set(row.kind, (counted.get(row.kind) || 0) + 1)
}
const statuses = rows.filter(row => row.kind === 'mobile-status').map(row => archiveGeneralText(shard.entries, row.kind, row.source, row.field))
assert.ok(statuses.every(text => text.split('\n').length <= 3), 'statuses fit the three reserved lines')
console.log(`Profile translations: ${[...counted].map(([kind, n]) => `${kind} ${n}`).join(', ')}; markup and line breaks kept, Japanese UI unchanged`)
