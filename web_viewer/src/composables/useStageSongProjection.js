import { computed } from 'vue'

export function useStageSongProjection({ songReadModelDetail, currentSongId, view, songReadModelCatalog }) {
  const stageAudioExperiments = computed(() => songReadModelDetail.value?.id === (currentSongId.value || (view.value === 'chibi_stage' ? 'drvalv' : '')) && songReadModelDetail.value?.experimental
    ? { [songReadModelDetail.value.id]: songReadModelDetail.value.experimental }
    : {})
  // The stage's 原曲成员: performer-slot order when table 46 records it, else the member list.
  const stagePerformanceMapping = computed(() => songReadModelDetail.value?.id === (currentSongId.value || (view.value === 'chibi_stage' ? 'drvalv' : ''))
    ? songReadModelDetail.value.song?.performance_mapping || null : null)
  const stageOriginalSlotOrdered = computed(() => Boolean(stagePerformanceMapping.value?.performer_slot_idol_codes?.length))
  const stageOriginalPerformers = computed(() => stageOriginalSlotOrdered.value
    ? stagePerformanceMapping.value.performer_slot_idol_codes : stagePerformanceMapping.value?.performer_idol_codes || [])
  const stageSongDirectory = computed(() => Object.values(songReadModelCatalog.value?.songs || {}))
  return { stageAudioExperiments, stageOriginalSlotOrdered, stageOriginalPerformers, stageSongDirectory }
}
