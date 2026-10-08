import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { idolHonorIdentity, idolHonorBelongsTo, fesHonorMonth } from '../src/presentation/HonorIdentity.mjs'
import { honorBondSource } from '../src/presentation/HonorBondSource.mjs'

// The idol page lists an idol's own honors by decoding the honor id. Check the decoding against two
// independent sources: the 担当 names in HonorData, and the user-reported bond records.
const read = file => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
const honors = read('public/data/masterdata/domains/honor_catalog.json').entries
const idols = read('public/data/masterdata/idol_unit_dictionary.json').by_idol_code
const codeByNumber = new Map(Object.keys(idols).map(code => [Number(code.slice(0, 3)), code]))
// Names HonorData abbreviates; the id still decodes to this idol.
const ABBREVIATED = new Map([[22915001, '029ass']])

const typed = honors.filter(entry => entry.honorType === 2)
assert.equal(typed.length, 122)
const kinds = {}
let bonds = 0
for (const entry of typed) {
  const identity = idolHonorIdentity(entry)
  assert.ok(identity, `type-2 honor ${entry.id} decodes`)
  const code = codeByNumber.get(identity.idolNumber)
  assert.ok(code, `honor ${entry.id} names an existing idol`)
  assert.ok(idolHonorBelongsTo(entry, code))
  assert.equal(Object.keys(idols).filter(other => idolHonorBelongsTo(entry, other)).length, 1, `honor ${entry.id} belongs to exactly one idol`)
  kinds[identity.kind] = (kinds[identity.kind] || 0) + 1
  if (identity.kind === 'tantou') {
    const expected = `${String(idols[code].display_name).replace(/\s/g, '')}担当`
    if (ABBREVIATED.has(entry.id)) assert.equal(ABBREVIATED.get(entry.id), code)
    else assert.equal(entry.nameJa.replace(/\s/g, ''), expected, `担当 name matches its idol: ${entry.id}`)
  }
  if (identity.kind.startsWith('fes-')) assert.match(fesHonorMonth(entry), /^20\d\d年\d{1,2}月$/, `FES month: ${entry.id}`)
  const bond = honorBondSource(entry)
  if (bond) { bonds++; assert.equal(bond.idolCode, code, `bond record and id agree: ${entry.id}`) }
}
assert.deepEqual(kinds, { tantou: 49, catchphrase: 49, 'fes-change': 12, 'fes-limitbreak': 12 })
assert.equal(bonds, 98, 'every 担当 and catchphrase honor has a bond record naming the same idol')
assert.equal(honors.filter(entry => entry.honorType !== 2).filter(idolHonorIdentity).length, 0, 'only type-2 honors decode')
console.log('Idol honor identity: 122 honors decode to one idol each; 48 担当 names and 98 bond records agree')
