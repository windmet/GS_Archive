import assert from 'node:assert/strict'
import { checkStudioRows, escapeCell, parseStudioResult } from './ai-studio-markdown.mjs'
import { sha256 } from './ai-studio-source.mjs'

const linked = [['T000058', 'T000059'], ['T000874', 'T000875']]

export function qualityTargets(batch, ids) {
  const available = new Set(batch.rows.map(row => row.rid))
  const selected = new Set(ids)
  assert(selected.size && selected.size === ids.length, 'Provide distinct target IDs')
  for (const id of selected) assert(available.has(id), `Unknown quality target: ${id}`)
  for (const group of linked) {
    if (group.some(id => selected.has(id)) && group.every(id => available.has(id)))
      for (const id of group) selected.add(id)
  }
  return batch.rows.filter(row => selected.has(row.rid))
}

export function makeQualityRequest(batch, parentOutput, ids) {
  assert.equal(batch.projection_version, 3, 'Quality repair requires V3 trial policy')
  const parsed = parseStudioResult(parentOutput, batch.rows.map(row => row.rid))
  assert.deepEqual(parsed.errors, [], 'Parent output must be structurally complete')
  const targets = qualityTargets(batch, ids)
  const selected = new Set(targets.map(row => row.rid))
  const lines = [`# ${batch.batch_id} Quality repair`, '',
    'Only output the target T IDs below as ID | Chinese. C rows are read-only context.',
    'Keep each T line\'s source meaning in its own cell; linked target lines must be revised together.',
    'Check speaker, mentioned people, agency, condition, time, and protected slots. Do not add story facts.', '',
    batch.trial_prompt.trim(), '', '## Frozen trial terms', '',
    ...batch.trial_policy.items.map(item => `- ${item.key}: ${item.scope} → ${item.chosen_rendering}。${item.required}`), '',
    '## Relevant voice guidance', '']
  const actors = new Set(targets.map(row => row.context?.actor?.entity_id).filter(Boolean))
  for (const [id, profile] of Object.entries(batch.voice_roster)) if (actors.has(id))
    lines.push(`- ${id} (${profile.name}): ${profile.style || ''} 必须 ${profile.required || ''} 禁止 ${profile.forbidden || ''}`)
  lines.push('', '| ID | Speaker | Voice | Mode | Japanese | Current Chinese |', '|---|---|---|---|---|---|')
  const addRow = (row, id) => lines.push(`| ${id} | ${escapeCell(row.speaker)} | ${row.context?.actor?.status === 'resolved' ? row.context.actor.entity_id : ''} | ${escapeCell(row.context?.channel?.value || row.kind)} | ${escapeCell(row.protected_source)} | ${escapeCell(parsed.translations.get(row.rid))} |`)
  for (const row of targets) {
    const index = batch.rows.indexOf(row)
    const prior = batch.rows[index - 1]
    if (prior?.document_id === row.document_id && !selected.has(prior.rid)) addRow(prior, `C${prior.rid.slice(1)}`)
    addRow(row, row.rid)
    const next = batch.rows[index + 1]
    if (next?.document_id === row.document_id && !selected.has(next.rid)) addRow(next, `C${next.rid.slice(1)}`)
  }
  const request = `${lines.join('\n')}\n`
  const map = { schema: 'GS-STUDIO-QUALITY-REPAIR-V1', batch_id: batch.batch_id,
    source_commit: batch.source_commit, parent_input_sha256: batch.input_sha256,
    parent_output_sha256: sha256(parentOutput), request_sha256: sha256(request),
    targets: targets.map(row => ({ rid: row.rid, unit_id: row.unit_id,
      source_hash: row.source_hash, old_translation_sha256: sha256(parsed.translations.get(row.rid)) })) }
  return { request, map }
}

export function mergeQualityPatch(batch, parentOutput, request, map, patch) {
  assert.equal(map.schema, 'GS-STUDIO-QUALITY-REPAIR-V1')
  assert.equal(map.batch_id, batch.batch_id)
  assert.equal(map.source_commit, batch.source_commit)
  assert.equal(map.parent_input_sha256, batch.input_sha256)
  assert.equal(map.parent_output_sha256, sha256(parentOutput), 'Parent output changed after repair request')
  assert.equal(map.request_sha256, sha256(request), 'Quality request changed')
  const expected = makeQualityRequest(batch, parentOutput, map.targets.map(item => item.rid))
  assert.equal(request, expected.request, 'Quality request no longer canonical')
  assert.deepEqual(map, expected.map, 'Quality map drift')
  const parent = parseStudioResult(parentOutput, batch.rows.map(row => row.rid))
  assert.deepEqual(parent.errors, [])
  for (const item of map.targets) assert.equal(sha256(parent.translations.get(item.rid)), item.old_translation_sha256,
    `Old translation changed: ${item.rid}`)
  const targetIds = map.targets.map(item => item.rid)
  const parsed = parseStudioResult(patch, targetIds)
  assert.deepEqual(parsed.errors, [], 'Patch must contain exactly requested T IDs')
  const qa = checkStudioRows(batch.rows.filter(row => targetIds.includes(row.rid)), parsed.translations,
    { trialPolicy: batch.trial_policy })
  assert.deepEqual(qa.blocking, [], 'Patch contains invalid protected slots')
  const merged = new Map(parent.translations)
  for (const [id, text] of parsed.translations) merged.set(id, text)
  const output = `| ID | Chinese |\n|---|---|\n${batch.rows.map(row =>
    `| ${row.rid} | ${escapeCell(merged.get(row.rid))} |`).join('\n')}\n`
  const complete = parseStudioResult(output, batch.rows.map(row => row.rid))
  assert.deepEqual(complete.errors, [])
  return { output, review: qa.review, changed: targetIds }
}
