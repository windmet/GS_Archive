import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveMobileArchiveUnit } from '../src/core/mobileArchiveIdentity.js'

const read = path => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), 'utf8'))
const manifest = read('archive_manifest.json')
const identity = read('masterdata/idol_unit_dictionary.json')
const archive = read('masterdata/mobile_archive_index.json')
const inputs = { manifest, units: identity.units, archive }
const memberships = Object.entries(manifest.unit_membership_by_idol)
assert.equal(memberships.length, 49)
assert.equal(new Set(memberships.map(([, value]) => value.unit_code)).size, 16)
for (const [idolCode, membership] of memberships) {
  for (const mode of ['personal', 'phone', 'random']) {
    assert.equal(resolveMobileArchiveUnit({ ...inputs, idolCode, mode, requestedUnit: '01jup' }), membership.unit_code,
      `${idolCode} in ${mode} must ignore a stale requested unit`)
  }
}
assert.equal(resolveMobileArchiveUnit({ ...inputs, idolCode: '038tak', mode: 'personal' }), '13the')
assert.equal(resolveMobileArchiveUnit({ ...inputs, idolCode: '038tak', mode: 'unit', requestedUnit: '01jup' }), '01jup',
  'Unit Talk owns its explicit selection')
assert.equal(resolveMobileArchiveUnit({ ...inputs, idolCode: '038tak', mode: 'unit', requestedUnit: 'bad' }), '13the')
assert.equal(resolveMobileArchiveUnit({ ...inputs, idolCode: 'unknown', mode: 'personal' }), '', 'unknown idols do not become Jupiter')
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const component = readFileSync(new URL('../src/components/archive/ArchiveMobileArchive.vue', import.meta.url), 'utf8')
assert.ok(app.includes('resolveMobileArchiveUnit({'))
assert.doesNotMatch(component, /props\.units\[0\]/)
console.log('Mobile archive identity: 49 idols across 16 units, stale URL/selection rejection and unknown-state safety passed')
