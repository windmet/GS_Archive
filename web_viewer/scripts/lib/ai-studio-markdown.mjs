import { protectProducerAddressingForTranslation, restoreProducerAddressingAfterTranslation } from '../../src/localization/story/ProducerAddressing.js'

export const studioSchema = 'GS-STUDIO-MD-V1'
export const escapeCell = value => String(value).replaceAll('\\', '\\\\').replaceAll('|', '\\|')
  .replace(/\r\n?|\n/gu, '<br>')

function splitRow(line) {
  if (!line.startsWith('|') || !line.endsWith('|')) return null
  const cells = [], content = line.slice(1, -1)
  let cell = '', escaped = false
  for (const char of content) {
    if (escaped) {
      if (char !== '|' && char !== '\\') throw Error(`Unsupported Markdown escape: \\${char}`)
      cell += char; escaped = false
    } else if (char === '\\') escaped = true
    else if (char === '|') { cells.push(cell.trim()); cell = '' }
    else cell += char
  }
  if (escaped) throw Error('Trailing Markdown escape')
  cells.push(cell.trim())
  return cells.map(value => value.replace(/<br\s*\/?\s*>/giu, '\n'))
}

export function renderStudioInput(batch) {
  const lines = [`# GS Archive Translation Batch ${batch.batch_id}`, '',
    `Batch schema: ${studioSchema}`, 'Target: Simplified Chinese',
    `Source commit: ${batch.source_commit}`, '',
    'Translate every T ID exactly once. Return only a Markdown table with columns `ID` and `Chinese`.',
    'Do not copy Japanese, Speaker or Kind into the answer. Do not invent missing rows.',
    '`{{GS_ADDRESS:...}}` is an immutable placeholder: it may move with Chinese word order, but must not be edited, deleted or duplicated.',
    'Keep title short, synopsis natural, dialogue in character, choices concise, and narration/captions clear.',
    'Preserve the meaning of honorifics and fixed forms of address; do not invent character-specific naming rules.',
    'Use `\\|` for a literal pipe and `<br>` for a line break inside a table cell.', '']
  let number = 0
  for (const doc of batch.documents) {
    const title = protectProducerAddressingForTranslation(doc.title || '').text
    if (title.includes('●')) throw Error(`Unprotected title placeholder: ${doc.document_id}`)
    lines.push(`## D${String(++number).padStart(3, '0')} — ${title.replace(/[\r\n]+/gu, ' ') || doc.document_id}`, '',
      '| ID | Speaker | Kind | Japanese |', '|---|---|---|---|')
    for (const row of batch.rows.filter(item => item.document_id === doc.document_id)) {
      if (row.protected_source.includes('●')) throw Error(`Unprotected source placeholder: ${row.rid}`)
      lines.push(`| ${row.rid} | ${escapeCell(row.speaker)} | ${escapeCell(row.kind)} | ${escapeCell(row.protected_source)} |`)
    }
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

export function parseStudioResult(markdown, expectedIds) {
  const expected = new Set(expectedIds), translations = new Map(), errors = []
  if (expected.size !== expectedIds.length) throw Error('Duplicate expected RID')
  for (const [index, raw] of String(markdown).replace(/^\uFEFF/u, '').split(/\r?\n/u).entries()) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (!line.startsWith('|')) { errors.push(`line ${index + 1}: unexpected content`); continue }
    let cells
    try { cells = splitRow(line) } catch (error) { errors.push(`line ${index + 1}: ${error.message}`); continue }
    if (cells.length === 2 && cells[0] === 'ID' && cells[1] === 'Chinese') continue
    if (cells.length === 2 && /^:?-{3,}:?$/u.test(cells[0]) && /^:?-{3,}:?$/u.test(cells[1])) continue
    if (cells.length !== 2 || !/^T\d{6}$/u.test(cells[0])) {
      errors.push(`line ${index + 1}: expected | Txxxxxx | Chinese |`); continue
    }
    const [rid, text] = cells
    if (!expected.has(rid)) errors.push(`line ${index + 1}: unknown ID ${rid}`)
    else if (translations.has(rid)) errors.push(`line ${index + 1}: duplicate ID ${rid}`)
    else if (!text.trim()) errors.push(`line ${index + 1}: empty Chinese for ${rid}`)
    else translations.set(rid, text)
  }
  const missing = expectedIds.filter(rid => !translations.has(rid))
  if (missing.length) errors.push(`missing ${missing.length} IDs`)
  return { translations, missing, errors }
}

export function checkStudioRows(rows, translations) {
  const blocking = [], review = []
  for (const row of rows) {
    const translated = translations.get(row.rid)
    if (!translated) continue
    try { restoreProducerAddressingAfterTranslation(translated,
      protectProducerAddressingForTranslation(row.source_text)) }
    catch (error) { blocking.push(`${row.rid}: ${error.message}`); continue }
    if (translated === row.protected_source) review.push(`${row.rid}: unchanged source`)
    if (/[\u3040-\u30ff]/u.test(translated.replace(/\{\{GS_ADDRESS:[^{}]*\}\}/gu, '')))
      review.push(`${row.rid}: Japanese kana remains`)
    if (row.kind === 'choice' && translated.length > 36) review.push(`${row.rid}: long choice (${translated.length})`)
  }
  return { blocking, review }
}

export function renderRepair(batch, missing) {
  const needed = new Set(missing)
  return `# ${batch.batch_id} Repair\n\n| ID | Speaker | Kind | Japanese |\n|---|---|---|---|\n${batch.rows
    .filter(row => needed.has(row.rid))
    .map(row => `| ${row.rid} | ${escapeCell(row.speaker)} | ${escapeCell(row.kind)} | ${escapeCell(row.protected_source)} |`)
    .join('\n')}\n`
}
