const ID = /^[A-Za-z0-9_-]+$/
const HASH = /^sha256:[a-f0-9]{64}$/
const STATUS = new Set(['ready', 'empty', 'unsupported'])
const KINDS = new Set(['title', 'synopsis', 'narration', 'dialogue', 'caption', 'choice', 'choice_detail'])
const PRESENCE = new Set(['visible', 'hidden', 'offstage', 'silhouette', 'unknown', 'not-applicable'])
const IDOL = /^[0-9]{3}[a-z]{3}$/
const record = x => !!x && typeof x === 'object' && !Array.isArray(x)
function requireValue(ok, message) { if (!ok) throw new TypeError(`Invalid reading data: ${message}`) }

export function validateReadingManifest(value) {
  requireValue(value?.schema_version === 1 && Array.isArray(value.entries), 'manifest version/entries')
  const ids = new Set()
  for (const e of value.entries) {
    requireValue(ID.test(e.document_id || '') && !ids.has(e.document_id), 'document identity')
    ids.add(e.document_id)
    requireValue(e.file === `${e.document_id}.json` && e.schema_version === 2, 'document file/version (v2 required)')
    requireValue(HASH.test(e.sha256) && HASH.test(e.source_sha256), 'document hashes')
    requireValue(e.source_file == null || /^episodes\/[A-Za-z0-9_-]+\.json$/.test(e.source_file), 'source file')
    requireValue(STATUS.has(e.status) && Number.isInteger(e.row_count) && e.row_count >= 0, 'document status/count')
    requireValue(typeof e.logical_id === 'string' && typeof e.scenario_id === 'string', 'story identity')
    requireValue(e.title == null || typeof e.title === 'string', 'presentation title')
    requireValue(e.episode_label == null || typeof e.episode_label === 'string', 'presentation episode label')
  }
  return value
}

export function validateReadingDocument(d, entry) {
  requireValue(d?.schema_version === 2 && entry.schema_version === 2 && d.document_id === entry.document_id, 'document version/identity (v2 required)')
  requireValue(d.logical_id === entry.logical_id && d.scenario_id === entry.scenario_id, 'story identity')
  requireValue(d.source?.sha256 === entry.source_sha256 && d.status === entry.status, 'source/status')
  requireValue(/^episodes\/[A-Za-z0-9_-]+\.json$/.test(d.source?.file || ''), 'source file')
  requireValue(entry.source_file == null || d.source.file === entry.source_file, 'source discovery identity')
  requireValue(Number.isInteger(d.source.step_count) && d.source.step_count >= 0, 'source step count')
  requireValue(d.playback?.file === d.source.file && d.playback.start_step_index === 0
    && d.playback.end_step_index === d.source.step_count - 1, 'document playback range')
  requireValue(Array.isArray(d.rows) && d.rows.length === entry.row_count, 'rows')
  requireValue(Array.isArray(d.diagnostics) && Array.isArray(d.controls), 'diagnostics/controls')
  requireValue(typeof d.text_catalog_id === 'string' && ID.test(d.text_catalog_id), 'text catalog identity')
  const rowIds = new Set()
  for (const r of d.rows) {
    const a = r.anchor
    requireValue(KINDS.has(r.kind) && typeof r.source_text === 'string', 'row text')
    requireValue(record(r.speaker) && typeof r.speaker.sourceName === 'string' && typeof r.speaker.kind === 'string', 'speaker')
    requireValue(r.text_ref === null || (record(r.text_ref) && typeof r.text_ref.unit_id === 'string' && HASH.test(r.text_ref.source_hash)), 'text reference')
    requireValue(record(a) && typeof a.row_id === 'string' && a.row_id.startsWith(`${d.document_id}:`) && !rowIds.has(a.row_id), 'row anchor')
    rowIds.add(a.row_id)
    requireValue(Number.isInteger(a.step_id) && Number.isInteger(a.step_index) && a.step_index >= 0 && a.step_index < d.source.step_count, 'step anchor')
    requireValue(!('playback' in a), 'row playback range retired')
    const p = r.performance, v = r.visual
    requireValue(record(p) && ((p.entityType === null && p.entityId === null)
      || (p.entityType === 'idol' && IDOL.test(p.entityId || ''))), 'performance actor')
    requireValue(record(v) && PRESENCE.has(v.presence) && typeof v.reason === 'string' && v.reason.length > 0,
      'visual presence')
    requireValue(v.entityType === p.entityType && v.entityId === p.entityId && v.stepId === a.step_id, 'visual actor/step')
    requireValue((v.source === 'stage-snapshot' && v.snapshot === 'entry')
      || (v.source === null && v.snapshot === null && ['unknown', 'not-applicable'].includes(v.presence)), 'visual evidence source')
    requireValue(Array.isArray(r.diagnostics) && r.diagnostics.every(code => typeof code === 'string'), 'row diagnostics')
    if (v.presence === 'visible') {
      requireValue(r.kind === 'dialogue' && !['none', 'producer'].includes(r.speaker.kind)
        && p.entityType === 'idol' && (!r.speaker.entityId || r.speaker.entityId === p.entityId)
        && (!r.speaker.entityType || r.speaker.entityType === 'idol'), 'visible dialogue identity')
    }
    if (r.option !== null) {
      requireValue(record(r.option) && ['resolved', 'unresolved'].includes(r.option.resolution), 'choice resolution')
      requireValue(r.option.target_step_index === null || (Number.isInteger(r.option.target_step_index)
        && r.option.target_step_index >= 0 && r.option.target_step_index < d.source.step_count), 'choice target')
    }
  }
  requireValue(d.status !== 'empty' || d.rows.length === 0, 'empty status')
  requireValue(d.status !== 'ready' || (d.rows.length > 0 && !d.diagnostics.some(x => x.severity === 'unsupported')), 'ready status')
  return d
}
