import { voicePreviewScenario } from './voicePreviewScenario.js'

// The profile's 自己紹介 line (IdolProfileView plays it from its button) as a one-step preview: the
// voiced step of the compiled IdolDetail scenario (3_x_<idol>_9_2_*), whose state already carries the
// whole scene (background, model, face timeline), as the card previews' preview_step does.
export const IDOL_INTRO_FILE = /^3_x_[a-z0-9]+_9_2_\d{3}\.json$/

export async function buildIdolIntroPreviewScenario(intro, { translate, fetchImpl = (...args) => fetch(...args), signal } = {}) {
  if (!IDOL_INTRO_FILE.test(intro?.file || '') || !intro.voice) throw new Error('没有这位偶像的自我介绍演出')
  const response = await fetchImpl(`/data/compiled/${intro.file}`, { cache: 'no-cache', signal })
  if (!response.ok) throw new Error(`自我介绍演出读取失败：HTTP ${response.status}`)
  const compiled = await response.json()
  const step = (compiled?.steps || []).find(candidate => candidate?.dialogue?.voice === intro.voice &&
    (intro.stepId == null || candidate.step_id === intro.stepId))
  if (!step) throw new Error(`自我介绍演出缺少 ${intro.voice}`)
  return voicePreviewScenario({ id: `idol_intro_preview_${compiled.scenario_id}`, step,
    sourceScenarioId: compiled.scenario_id, sourceCompiledFile: intro.file, translate })
}
