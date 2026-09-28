import assert from 'node:assert/strict'
import { scanProducerPlaceholders, producerContext } from './lib/producer-placeholder-audit.mjs'

assert.deepEqual(scanProducerPlaceholders('●●●●プロデューサー、'), [
  { form: '●●●●', index: 0, class: 'four-dot-producer-prefix' },
])
assert.deepEqual(scanProducerPlaceholders('●●●●●●●●●●監督'), [
  { form: '●●●●●●●●●●', index: 0, class: 'ten-dot-name-candidate' },
])
assert.equal(scanProducerPlaceholders('プロデューサー、今日は……').length, 0)
assert.equal(scanProducerPlaceholders('<P>').at(0)?.class, 'other-candidate')
assert.equal(scanProducerPlaceholders('●●●●先生').at(0)?.class, 'unclassified-dot-run')
assert.deepEqual(producerContext('前文●●●●プロデューサー', { form: '●●●●', index: 2 }),
  { before: '前文', after: 'プロデューサー' })
console.log('Producer placeholder patterns: role prefix, name candidate, role term and unknown forms separated')
