// Reading indices are array positions; source step IDs are identity checks only.
export function readingPlaybackTarget(document, rowId, revision, entry, { fullDocument = false } = {}) {
  if (!entry || document?.document_id !== entry.document_id || revision !== entry.sha256) throw Error('阅读版本已变化，请重新打开本篇正文后再演出。')
  const row = document?.rows.find(row => row.anchor.row_id === rowId)
  if (document?.status !== 'ready' || (!fullDocument && (!row || ['title', 'synopsis'].includes(row.kind)))) {
    throw Error('这一行暂时不能定位演出，请选择正文台词。')
  }
  // Full playback includes opening steps; the reading row remains a return anchor only.
  if (document.schema_version !== 2 || document.playback?.file !== document.source.file ||
      document.playback.start_step_index !== 0 || document.playback.end_step_index !== document.source.step_count - 1) {
    throw Error('阅读格式已变化，请重新载入正文。')
  }
  const range = { ...document.playback,
    target_step_index: fullDocument ? document.playback.start_step_index : row.anchor.step_index }
  if (!Number.isInteger(document.source.step_count) || document.source.step_count < 1) throw Error('正文与演出定位不一致，已停止载入。')
  return {
    file: range.file, startStep: range.start_step_index + 1,
    endStep: range.end_step_index + 1, initialStep: range.target_step_index + 1,
    async readScenario(response) {
      const bytes = await response.arrayBuffer()
      const digest = `sha256:${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')}`
      if (digest !== document.source.sha256) throw Error('演出来源已更新，与当前正文不一致。请刷新正文后重试。')
      const scenario = JSON.parse(new TextDecoder().decode(bytes))
      const step = row && scenario.steps?.[row.anchor.step_index]
      if (scenario.steps?.length !== document.source.step_count || (!fullDocument && (step?.step_id !== row.anchor.step_id || step?.type === 'synopsis'))) {
        throw Error('正文与演出定位不一致，已停止载入。')
      }
      return scenario
    },
  }
}
