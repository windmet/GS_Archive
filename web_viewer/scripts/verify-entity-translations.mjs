import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildEntitySearchText,
  EntityTranslationRepository,
  hashEntitySourceText,
  normalizeEntitySourceText,
  validateEntityTranslationOverlay,
} from '../src/localization/story/EntityTranslationRepository.js'
import { parseJsonStrict } from './lib/strict-json.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const fixturePath = path.join(ROOT, 'public/translations/zh-CN/entities/idols.json')
const overlay = parseJsonStrict(await readFile(fixturePath, 'utf8'), fixturePath)
const sourceNames = {
  '001tom': '天ヶ瀬 冬馬',
  '007kei': '都築 圭',
  '047shu': '天峰 秀',
}

assert.equal(normalizeEntitySourceText('\uFEFF都築 圭\r\n'), '都築 圭\n')
assert.equal(await hashEntitySourceText(sourceNames['007kei']), overlay.entries['007kei'].source_hash)
assert.deepEqual(validateEntityTranslationOverlay(overlay, { entityType: 'idol', locale: 'zh-CN' }), {
  valid: true,
  errors: [],
})

const requestedUrls = []
const repository = new EntityTranslationRepository({
  assetRevision: 'fixture',
  fetchImpl: async url => {
    requestedUrls.push(url)
    return { status: 200, ok: true, async text() { return JSON.stringify(overlay) } }
  },
})
await repository.loadEntity({ entityType: 'idol', locale: 'zh-CN', sourceNames })
assert.match(requestedUrls[0], /\/zh-CN\/entities\/idols\.json\?rev=fixture$/u)
assert.equal(repository.resolveName({
  entityType: 'idol', entityId: '007kei', sourceName: sourceNames['007kei'], locale: 'zh-CN',
}), '都筑圭')
const bilingualIndex = repository.getSearchText({
  entityType: 'idol', entityId: '007kei', sourceName: sourceNames['007kei'], locale: 'zh-CN',
})
assert.equal(bilingualIndex.includes('都築 圭'), true)
assert.equal(bilingualIndex.includes('都筑圭'), true)
assert.equal(bilingualIndex.includes('007kei'), true)
assert.equal(repository.getDiagnostics({ entityType: 'idol', locale: 'zh-CN' }).staleEntityIds.length, 0)

const staleRepository = new EntityTranslationRepository({
  fetchImpl: async () => ({ status: 200, ok: true, async text() { return JSON.stringify(overlay) } }),
})
await staleRepository.loadEntity({
  entityType: 'idol',
  locale: 'zh-CN',
  sourceNames: { ...sourceNames, '007kei': '都築 圭（改訂）' },
})
assert.equal(staleRepository.getEntry({ entityType: 'idol', entityId: '007kei', locale: 'zh-CN' }), null)
assert.equal(staleRepository.resolveName({
  entityType: 'idol', entityId: '007kei', sourceName: '都築 圭（改訂）', locale: 'zh-CN',
}), '都築 圭（改訂）')
assert.deepEqual(staleRepository.getDiagnostics({ entityType: 'idol', locale: 'zh-CN' }).staleEntityIds, ['007kei'])

const missingRepository = new EntityTranslationRepository({
  fetchImpl: async () => ({ status: 404, ok: false, async text() { return '' } }),
})
const missing = await missingRepository.loadEntity({ entityType: 'idol', locale: 'ja-JP', sourceNames })
assert.deepEqual(missing.entries, {})
assert.equal(missingRepository.getDiagnostics({ entityType: 'idol', locale: 'ja-JP' }).code, 'entity_translation_missing')

const poisoned = structuredClone(overlay)
poisoned.entries['007kei'].target_step_id = 99
const invalid = validateEntityTranslationOverlay(poisoned, { entityType: 'idol', locale: 'zh-CN' })
assert.equal(invalid.valid, false)
assert.equal(invalid.errors.some(error => error.includes('unexpected property')), true)

assert.equal(buildEntitySearchText({ entityId: 'x', sourceName: '原名', translatedName: '译名' }), 'x 原名 译名')

console.log('Entity translation repository verification passed')
console.log('  strict schema, source-hash stale fallback, 404 fallback, and cache URL covered')
console.log('  bilingual index contains entity id, Japanese source name, and Chinese translation')
