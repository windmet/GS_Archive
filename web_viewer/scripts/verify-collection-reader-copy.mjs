// Reader-facing copy rules for the 图鉴 (docs/GS_ARCHIVE_COLLECTION_CLEANUP_20261110.md section 2.1).
// The readers of the collection pages see only what is known; engineering words and "unknown" placeholders
// stay out. This scans the reader templates (plus the Chinese string literals in their scripts), the
// currency catalog's textZh and the voice archives' reader `note` fields (their `maintainerNote` is the
// maintainer view) for the banned terms.
//
// Exclusions, by construction and nothing else:
//   - the 原始资料 fold:  <details class="collection-source-meta"> ... </details>
//   - maintainer-gated blocks: any element whose v-if starts with `maintainer` (CollectionEntryDetails
//     reads isMaintainerMode() into `maintainer`), removed together with its children.
//   - comments (HTML and JS) and the code outside string literals.
// Hollow-pass guard: a minimum number of files and strings must actually be scanned, and every exclusion
// rule must have matched something, so a renamed class or flag cannot silently widen or empty the scan.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

export const BANNED = ['客户端', '服务端', '配置', '资源键', '类型码', 'Prefab', 'spine', 'WorkTopView', 'IdolController', '未收录', '待确认', '未记录', '占位']
const FILES = [
  'src/components/archive/CurrencyDetailSections.vue',
  'src/components/archive/CollectionEntryDetails.vue',
  'src/components/archive/CollectionDetailPanel.vue',
  'src/components/archive/ArchiveRewardTable.vue',
  'src/components/archive/ArchiveCollectionCatalog.vue',
  'src/components/archive/ArchiveUnusedVoices.vue',
  'src/components/archive/ArchivePhotoCatalog.vue',
]
const VOICE_NOTES = { 'src/data/unusedVoiceArchive.json': 'families', 'src/data/officeSystemVoices.json': 'scenes' }

// Removes `<tag ...attr...>...</tag>` blocks whose opening tag matches `opening`, balancing nested same-name tags.
function removeBlocks(html, opening) {
  let removed = 0
  for (;;) {
    const match = opening.exec(html)
    if (!match) return { html, removed }
    const tag = match[1]
    const token = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g')
    token.lastIndex = match.index
    let depth = 0, end = -1
    for (let t = token.exec(html); t; t = token.exec(html)) {
      if (t[2] === '/') { if (depth === 0) { end = token.lastIndex; break } continue }
      depth += t[1] ? -1 : 1
      if (depth === 0) { end = token.lastIndex; break }
    }
    assert.ok(end > 0, `unbalanced <${tag}> block`)
    html = html.slice(0, match.index) + html.slice(end)
    removed++
    opening.lastIndex = 0
  }
}

// String literals that carry Chinese text, with JS comments skipped.
function chineseLiterals(code) {
  const out = []
  for (let i = 0; i < code.length;) {
    const c = code[i]
    if (c === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; continue }
    if (c === '/' && code[i + 1] === '*') { const e = code.indexOf('*/', i + 2); i = e < 0 ? code.length : e + 2; continue }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1
      while (j < code.length && code[j] !== c) j += code[j] === '\\' ? 2 : 1
      const text = code.slice(i + 1, j)
      if (/[一-鿿]/.test(text)) out.push(text)
      i = j + 1
      continue
    }
    i++
  }
  return out
}

export function readerStrings(source) {
  const template = source.slice(source.indexOf('<template>') + 10, source.lastIndexOf('</template>'))
  const script = /<script[^>]*>([\s\S]*?)<\/script>/.exec(source)?.[1] || ''
  let html = template.replace(/<!--[\s\S]*?-->/g, '')
  const gated = removeBlocks(html, /<(\w+)\b[^>]*\sv-if="maintainer\b[^"]*"[^>]*>/)
  const fold = removeBlocks(gated.html, /<(details)\b[^>]*class="collection-source-meta"[^>]*>/)
  // Template text and attribute values (labels, placeholders, aria) plus mustache string literals.
  const strings = [...fold.html.matchAll(/>([^<>]+)</g)].map(m => m[1]).concat([...fold.html.matchAll(/="([^"]*[一-鿿][^"]*)"/g)].map(m => m[1]))
  for (const m of fold.html.matchAll(/\{\{([\s\S]*?)\}\}/g)) strings.push(...chineseLiterals(m[1]))
  strings.push(...chineseLiterals(script))
  return { strings: strings.map(text => text.trim()).filter(text => /[一-鿿]/.test(text)), folds: fold.removed, gated: gated.removed }
}

export function violations(label, strings) {
  return strings.flatMap(text => BANNED.filter(word => text.includes(word)).map(word => `${label}: 「${word}」 in 「${text.slice(0, 60)}」`))
}

function run() {
  const failures = []
  let scannedStrings = 0, folds = 0, gated = 0
  for (const file of FILES) {
    const result = readerStrings(read(file))
    assert.ok(result.strings.length > 0, `${file}: no reader strings found, the scan is hollow`)
    scannedStrings += result.strings.length
    folds += result.folds
    gated += result.gated
    failures.push(...violations(file, result.strings))
  }
  const catalog = JSON.parse(read('config/currency-catalog.v1.json'))
  const zh = []
  ;(function walk(node) {
    if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) key === 'textZh' && typeof value === 'string' ? zh.push(value) : walk(value)
  })(catalog)
  assert.ok(zh.length >= 5, `currency catalog: only ${zh.length} textZh fields, the scan is hollow`)
  failures.push(...violations('config/currency-catalog.v1.json', zh))
  let notes = 0
  for (const [file, key] of Object.entries(VOICE_NOTES)) {
    const rows = JSON.parse(read(file))[key]
    assert.ok(rows?.length > 0 && rows.every(row => typeof row.note === 'string'), `${file}: no ${key}[].note to scan, the scan is hollow`)
    notes += rows.length
    failures.push(...violations(file, rows.map(row => row.note)))
  }
  assert.ok(scannedStrings >= 80, `only ${scannedStrings} reader strings scanned`)
  assert.ok(folds >= 1, 'the 原始资料 fold exclusion matched nothing (class renamed?)')
  assert.ok(gated >= 7, `maintainer-gated exclusion matched ${gated} blocks (flag renamed?)`)
  assert.deepEqual(failures, [], `reader copy uses banned terms:\n  ${failures.join('\n  ')}`)
  console.log(`Collection reader copy: ${FILES.length} files, ${scannedStrings} strings, ${zh.length} currency texts and ${notes} voice notes clean (${folds} fold and ${gated} maintainer blocks excluded)`)
}
run()
