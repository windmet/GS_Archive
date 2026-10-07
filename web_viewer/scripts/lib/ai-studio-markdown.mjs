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
  const contextual = batch.projection_version === 2 || batch.projection_version === 3
  const lines = [`# GS Archive Translation Batch ${batch.batch_id}`, '',
    `Batch schema: ${studioSchema}`, 'Target: Simplified Chinese',
    `Source commit: ${batch.source_commit}`, '',
    'Translate every T ID exactly once. Return only a Markdown table with columns `ID` and `Chinese`.',
    ...(batch.projection_version === 3 ? [
      'IDs are opaque strings: copy each T plus SIX digits exactly, including every leading zero. Never renumber or shorten an ID.',
      'Boundary examples: T000099, T000100, T000999. T00100 and T00999 are INVALID. Before returning, compare the complete ID set with the input.',
    ] : []),
    contextual
      ? 'Do not copy Japanese or context columns into the answer. Do not invent missing rows.'
      : 'Do not copy Japanese, Speaker or Kind into the answer. Do not invent missing rows.',
    '`{{GS_ADDRESS:...}}` is an immutable placeholder: it may move with Chinese word order, but must not be edited, deleted or duplicated.',
    'Keep title short, synopsis natural, dialogue in character, choices concise, and narration/captions clear.',
    'Preserve the meaning of honorifics and fixed forms of address; do not invent character-specific naming rules.',
    'Use `\\|` for a literal pipe and `<br>` for a line break inside a table cell.', '']
  if (contextual) {
    lines.push('Context is source-bound guidance for this trial, not approved Chinese name policy.',
      'Speaker is the original visible label. Voice is internal acting context only: never reveal a concealed name in the translated line.',
      'An empty or unresolved Voice must not be guessed from sprites, the preceding line, or dialogue content.',
      'Phone and message rows need their channel preserved. Choice targets are entry-only; keep wrong answers wrong.',
      'Voice suggestions below are provisional. Pending Chinese proper names and honorifics require human review.', '')
    if (batch.projection_version === 3) {
      lines.push(batch.trial_prompt.trim(), '',
        '## 本轮已冻结的试译词条（不是官方审定）', '')
      for (const item of batch.trial_policy.items)
        lines.push(`- ${item.key}: ${item.scope} → ${item.chosen_rendering}。要求：${item.required}`)
      if (batch.trial_policy.proper_name_exceptions.length)
        lines.push('', `精确保留专名：${batch.trial_policy.proper_name_exceptions.join('、')}。此例外不适用于普通日语语法。`)
      lines.push(`待审术语：${batch.trial_policy.pending_terms.join('；')}。不要在Chinese写译注。`, '')
    }
    for (const [id, profile] of Object.entries(batch.voice_roster || {})) {
      if (batch.projection_version === 3) lines.push(profile.style
        ? `- ${id} (${profile.name}): 风格 ${profile.style} 必须 ${profile.required} 禁止 ${profile.forbidden}`
        : `- ${id} (${profile.name})`)
      else lines.push(`- ${id} (${profile.name}): ${profile.style || 'No voice proposal.'}${profile.avoid ? ` Avoid: ${profile.avoid}` : ''}`)
    }
    lines.push('')
  }
  let number = 0
  for (const doc of batch.documents) {
    const title = protectProducerAddressingForTranslation(doc.title || '').text
    if (title.includes('●')) throw Error(`Unprotected title placeholder: ${doc.document_id}`)
    lines.push(`## D${String(++number).padStart(3, '0')} — ${title.replace(/[\r\n]+/gu, ' ') || doc.document_id}`, '')
    if (contextual) lines.push('| ID | Speaker | Voice | Kind | Mode | Japanese |', '|---|---|---|---|---|---|')
    else lines.push('| ID | Speaker | Kind | Japanese |', '|---|---|---|---|')
    for (const row of batch.rows.filter(item => item.document_id === doc.document_id)) {
      if (row.protected_source.includes('●')) throw Error(`Unprotected source placeholder: ${row.rid}`)
      if (contextual) {
        const actor = row.context?.actor
        const voice = actor?.status === 'resolved' ? actor.entity_id : ''
        const mode = row.context?.channel?.value || row.kind
        lines.push(`| ${row.rid} | ${escapeCell(row.speaker)} | ${escapeCell(voice)} | ${escapeCell(row.kind)} | ${escapeCell(mode)} | ${escapeCell(row.protected_source)} |`)
      } else lines.push(`| ${row.rid} | ${escapeCell(row.speaker)} | ${escapeCell(row.kind)} | ${escapeCell(row.protected_source)} |`)
    }
    if (contextual) {
      const choices = batch.rows.filter(row => row.document_id === doc.document_id && row.context?.choice_entry)
      for (const row of choices) {
        const entry = row.context.choice_entry
        if (batch.projection_version === 3) {
          const targetIds = entry.target_text_unit_ids.map(id => batch.rows.find(candidate => candidate.unit_id === id)?.rid).filter(Boolean)
          lines.push(`Choice entry ${row.rid}: ${entry.resolution}; ${targetIds.length ? `target ${targetIds.join(', ')}` : 'no direct text target in this request'}; entry only, exit unverified.`)
        } else lines.push(`Choice entry ${row.rid}: ${entry.resolution}; target step ${entry.target_step_index ?? 'unknown'}; target text units ${entry.target_text_unit_ids.length}. Entry only; exit and reconvergence unverified.`)
      }
      if (batch.projection_version === 3) for (const row of batch.rows.filter(item => item.document_id === doc.document_id && item.context?.mentions?.length))
        for (const mention of row.context.mentions)
          lines.push(`Mention ${row.rid}: ${mention.source_form} → ${mention.canonical_ja} (${mention.target_entity_id}); this trial renders ${mention.chosen_rendering}. Preserve source naming level; do not replace Speaker or add a name absent from Japanese.`)
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
    if (!cells) { errors.push(`line ${index + 1}: malformed Markdown row (missing final pipe)`); continue }
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

// R3.3: a named さん keeps an honorific (先生／小姐／女士); groups, roles, family and the Producer do not.
const SAN = /([\p{Script=Han}々ァ-ヶー]{1,8}|[ぁ-ゖ]{2,6})(さん|サン(?!キュ))/gu
const NOT_A_NAME = /^(?:.*(?:皆|みな|客|店員|母|父|兄|姉|叔|祖|奥|前|番長|プロデューサー|プロダクション|事務所|スタッフ|ちゃん|たく|沢山|おやっ|ジイ|ジジ|バア|オッ|オジ|オバ|アニ|アネ)|おはよう|おつかれ|お疲れ|おまえ|おじ|おば|おにい|おねえ|かあ|とう|にい|ねえ)$/u
export function checkNamedSan(source, translated, trialPolicy = null) {
  const items = trialPolicy?.items || []
  // Frozen さん forms (道流さん, 番長さん) and non-person terms (the cat にゃこ) follow their own entries.
  const frozen = items.map(item => item.source_form).filter(form => form?.endsWith('さん'))
  const terms = items.filter(item => item.target_term && item.source_form).map(item => item.source_form)
  const named = [...source.matchAll(SAN)].filter(match => !NOT_A_NAME.test(match[1])
    && !terms.some(form => match[1].endsWith(form))
    && !frozen.some(form => source.slice(match.index).startsWith(form) || form.endsWith(match[0])))
  const kept = (translated.match(/先生|小姐|女士/gu) || []).length
  if (named.length > kept) return `honorific さん dropped (${kept}/${named.length})`
  if (!named.length && source.includes('先生') && translated.includes('先生')) return 'せんせい rendered as 先生'
  return null
}

export function checkStudioRows(rows, translations, { trialPolicy = null } = {}) {
  const blocking = [], review = []
  for (const row of rows) {
    const translated = translations.get(row.rid)
    if (!translated) continue
    try { restoreProducerAddressingAfterTranslation(translated,
      protectProducerAddressingForTranslation(row.source_text)) }
    catch (error) { blocking.push(`${row.rid}: ${error.message}`); continue }
    if (translated === row.protected_source) review.push(`${row.rid}: unchanged source`)
    let languageText = translated.replace(/\{\{GS_ADDRESS:[^{}]*\}\}/gu, '')
    if (trialPolicy) for (const name of trialPolicy.proper_name_exceptions || [])
      if (row.source_text.includes(name)) languageText = languageText.replaceAll(name, '')
    if (trialPolicy) for (const form of trialPolicy.meaningful_kana || []) {
      if (!row.source_text.includes(form.source_form)) continue
      if (!translated.includes(form.retained_form)) review.push(`${row.rid}: meaningful reading ${form.retained_form} missing`)
      languageText = languageText.replaceAll(form.retained_form, '')
    }
    if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(languageText))
      review.push(`${row.rid}: Japanese kana remains`)
    if (/^\n|\n$/u.test(translated)) review.push(`${row.rid}: leading or trailing line break`)
    if (trialPolicy) for (const item of trialPolicy.items) {
      if (item.actor_ids && (row.context?.actor?.status !== 'resolved'
        || !item.actor_ids.includes(row.context.actor.entity_id))) continue
      if (item.source_form && row.source_text.includes(item.source_form)
        && !translated.includes(item.chosen_rendering))
        review.push(`${row.rid}: trial term ${item.key} needs review`)
    }
    const honorific = checkNamedSan(row.source_text, translated, trialPolicy)
    if (honorific) review.push(`${row.rid}: ${honorific}`)
    const displayLength = Array.from(translated.replace(/\{\{GS_ADDRESS:[^{}]*\}\}/gu, '制作人')).length
    if (row.kind === 'choice' && displayLength > 36) review.push(`${row.rid}: long choice (${displayLength})`)
  }
  return { blocking, review }
}

export function renderRepair(batch, missing) {
  const needed = new Set(missing)
  if (batch.projection_version === 2 || batch.projection_version === 3) {
    const rows = batch.rows.filter(row => needed.has(row.rid))
    const ids = new Set(rows.map(row => row.context?.actor?.entity_id).filter(Boolean))
    const roster = Object.fromEntries(Object.entries(batch.voice_roster || {}).filter(([id]) => ids.has(id)))
    const lines = [`# ${batch.batch_id} Repair`, '', 'Return only the missing T IDs in a two-column ID | Chinese table.',
      'C rows are read-only context; do not output or revise them.',
      'Hidden Speaker labels must stay hidden in translated text.', '']
    if (batch.projection_version === 3) lines.push(batch.trial_prompt.trim(), '',
      ...batch.trial_policy.items.map(item => `- ${item.key}: ${item.scope} → ${item.chosen_rendering}。${item.required}`), '')
    for (const [id, profile] of Object.entries(roster)) lines.push(batch.projection_version === 3
      ? `- ${id} (${profile.name}): ${profile.style || ''} 必须 ${profile.required || ''} 禁止 ${profile.forbidden || ''}`
      : `- ${id} (${profile.name}): ${profile.style || 'No voice proposal.'}`)
    lines.push('', '| ID | Speaker | Voice | Kind | Mode | Japanese |', '|---|---|---|---|---|---|')
    for (const row of rows) {
      const i = batch.rows.indexOf(row)
      const preceding = batch.rows[i - 1]
      if (preceding?.document_id === row.document_id && !needed.has(preceding.rid))
        lines.push(`| C${preceding.rid.slice(1)} | ${escapeCell(preceding.speaker)} | | ${escapeCell(preceding.kind)} | ${escapeCell(preceding.context?.channel?.value || '')} | ${escapeCell(preceding.protected_source)} |`)
      lines.push(`| ${row.rid} | ${escapeCell(row.speaker)} | ${row.context?.actor?.status === 'resolved' ? row.context.actor.entity_id : ''} | ${escapeCell(row.kind)} | ${escapeCell(row.context?.channel?.value || '')} | ${escapeCell(row.protected_source)} |`)
    }
    return `${lines.join('\n')}\n`
  }
  return `# ${batch.batch_id} Repair\n\n| ID | Speaker | Kind | Japanese |\n|---|---|---|---|\n${batch.rows
    .filter(row => needed.has(row.rid))
    .map(row => `| ${row.rid} | ${escapeCell(row.speaker)} | ${escapeCell(row.kind)} | ${escapeCell(row.protected_source)} |`)
    .join('\n')}\n`
}
