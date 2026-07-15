<template>
  <section class="seasonal-page">
    <header class="campaign-header">
      <div>
        <span>SEASONAL CAMPAIGN</span>
        <h2>{{ campaign?.name || '季节企划' }}</h2>
        <p>{{ formatTerm(campaign?.term) }}</p>
      </div>
      <div class="campaign-switches" aria-label="企划切换">
        <div class="segmented">
          <button v-for="year in years" :key="year" :class="{ active: campaign?.year === year }" @click="select(year, campaign?.season)">{{ year }}</button>
        </div>
        <div class="segmented">
          <button :class="{ active: campaign?.season === 'valentine' }" @click="select(campaign?.year, 'valentine')"><Heart :size="15" /> Valentine</button>
          <button :class="{ active: campaign?.season === 'white_day' }" @click="select(campaign?.year, 'white_day')"><Gift :size="15" /> White Day</button>
        </div>
      </div>
    </header>

    <div v-if="campaign" class="campaign-body">
      <section class="campaign-summary">
        <div><strong>{{ campaign.playback_entity_count }}</strong><span>播放实体</span></div>
        <div><strong>{{ idolParticipants.length }}</strong><span>偶像</span></div>
        <div><strong>{{ supportParticipants.length }}</strong><span>工作人员</span></div>
        <div><strong>{{ campaign.bgm_resource_id || '—' }}</strong><span>BGM</span></div>
      </section>

      <section v-if="campaign.introduction?.length" class="intro-band">
        <div><span>COMMON INTRODUCTION</span><strong>{{ campaign.introduction[0].title }}</strong><small>{{ campaign.introduction[0].resource_id }}</small></div>
        <button title="播放共通导入" @click="play(campaign.introduction[0])"><Play :size="17" fill="currentColor" /></button>
      </section>

      <div class="participant-heading">
        <div><span>COMMUNICATIONS</span><h3>角色剧情</h3></div>
        <div class="participant-filter">
          <button :class="{ active: participantType === 'idol' }" @click="participantType = 'idol'">偶像 {{ idolParticipants.length }}</button>
          <button :class="{ active: participantType === 'support' }" @click="participantType = 'support'">事务所 {{ supportParticipants.length }}</button>
        </div>
      </div>

      <div class="participant-list">
        <article v-for="participant in visibleParticipants" :key="`${participant.participant_type}-${participant.participant_numeric_id}`" class="participant-row">
          <div class="participant-id">
            <span>{{ participant.participant_code || participant.participant_numeric_id }}</span>
            <strong>{{ participant.display_name || `角色 ${participant.participant_numeric_id}` }}</strong>
          </div>
          <div class="episode-titles">
            <span v-for="episode in participant.episodes" :key="episode.id">
              <small>Lv.{{ episode.required_valentine_level || 1 }}</small>{{ episode.title }}
            </span>
          </div>
          <div class="episode-meta">
            <span>{{ participant.playback_entity_count }} file</span>
            <span v-if="participant.episodes[0]?.reward">阅读奖励</span>
          </div>
          <button class="play-button" :disabled="!participant.episodes[0]?.compiled_exists" title="播放角色剧情" @click="play(participant.episodes[0])">
            <Play :size="16" fill="currentColor" />
          </button>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Gift, Heart, Play } from '@lucide/vue'

const props = defineProps({ campaign: { type: Object, default: null }, campaigns: { type: Array, default: () => [] } })
const emit = defineEmits(['select', 'play'])
const participantType = ref('idol')
const years = computed(() => [...new Set(props.campaigns.map(item => item.year))].sort())
const idolParticipants = computed(() => props.campaign?.participants?.filter(item => item.participant_type === 'idol') || [])
const supportParticipants = computed(() => props.campaign?.participants?.filter(item => item.participant_type === 'support') || [])
const visibleParticipants = computed(() => participantType.value === 'support' ? supportParticipants.value : idolParticipants.value)

watch(() => props.campaign?.id, () => { participantType.value = 'idol' })

function select(year, season) {
  const target = props.campaigns.find(item => item.year === year && item.season === season)
  if (target) emit('select', target.id)
}
function play(episode) {
  if (episode?.compiled_file) emit('play', episode.compiled_file)
}
function formatTerm(term) {
  if (!term?.['1'] || !term?.['2']) return '活动时间未记录'
  const format = value => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value * 1000))
  return `${format(term['1'])} - ${format(term['2'])}`
}
</script>

<style scoped>
.seasonal-page { height: 100%; overflow-y: auto; background: #f5f7f8; color: #26343c; }
.campaign-header { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 28px max(24px, calc((100% - 1080px) / 2)); border-bottom: 1px solid #dce4e6; background: #fff; }
.campaign-header span, .participant-heading span { color: #13877f; font-size: .58rem; font-weight: 800; }
.campaign-header h2 { margin: 4px 0 5px; font-size: 1.45rem; letter-spacing: 0; }.campaign-header p { margin: 0; color: #6c7a81; font-size: .68rem; }
.campaign-switches { display: flex; flex-wrap: wrap; justify-content: end; gap: 8px; }.segmented { display: inline-flex; overflow: hidden; border: 1px solid #d2dadd; border-radius: 6px; background: #f6f8f8; }
.segmented button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 34px; padding: 0 11px; border: 0; border-right: 1px solid #dce2e4; background: transparent; color: #637178; cursor: pointer; font: inherit; font-size: .65rem; }.segmented button:last-child { border-right: 0; }.segmented button.active { background: #168f87; color: #fff; font-weight: 800; }
.campaign-body { max-width: 1080px; margin: 0 auto; padding: 20px 24px 36px; }.campaign-summary { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); border: 1px solid #dfe5e7; border-radius: 6px; background: #fff; }
.campaign-summary div { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 13px 16px; border-right: 1px solid #e6eaeb; }.campaign-summary div:last-child { border-right: 0; }.campaign-summary strong { overflow: hidden; font-size: .9rem; text-overflow: ellipsis; white-space: nowrap; }.campaign-summary span { color: #7b888e; font-size: .58rem; }
.intro-band { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 12px; padding: 14px 16px; border-left: 3px solid #16968d; background: #eaf7f5; }.intro-band div { display: flex; flex-direction: column; gap: 3px; }.intro-band span { color: #16877f; font-size: .56rem; font-weight: 800; }.intro-band strong { font-size: .77rem; }.intro-band small { color: #7f8b91; font-family: ui-monospace, Consolas, monospace; font-size: .55rem; }.intro-band button, .play-button { display: grid; flex: 0 0 auto; place-items: center; width: 34px; height: 34px; border: 1px solid #82c8c3; border-radius: 50%; background: #fff; color: #14857d; cursor: pointer; }
.participant-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin: 24px 0 10px; }.participant-heading h3 { margin: 3px 0 0; font-size: 1rem; }.participant-filter { display: flex; gap: 4px; }.participant-filter button { min-height: 30px; padding: 0 10px; border: 1px solid #d7dfe1; border-radius: 5px; background: #fff; color: #66757c; cursor: pointer; font: inherit; font-size: .62rem; }.participant-filter button.active { border-color: #69bcb6; background: #eaf7f5; color: #117a73; font-weight: 800; }
.participant-list { border-top: 1px solid #dce3e5; }.participant-row { display: grid; grid-template-columns: 170px minmax(0,1fr) 90px 36px; align-items: center; gap: 14px; min-height: 72px; padding: 10px 8px; border-bottom: 1px solid #dce3e5; background: #fff; }.participant-id, .episode-titles { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.participant-id span { color: #15857e; font-family: ui-monospace, Consolas, monospace; font-size: .54rem; }.participant-id strong { overflow: hidden; font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }.episode-titles span { color: #394850; font-size: .66rem; }.episode-titles small { display: inline-block; min-width: 35px; margin-right: 7px; color: #16877f; font-size: .54rem; }.episode-meta { display: flex; flex-direction: column; gap: 3px; color: #829097; font-size: .55rem; text-align: right; }.play-button:disabled { cursor: not-allowed; opacity: .4; }
@media (max-width: 700px) { .campaign-header { align-items: start; flex-direction: column; padding: 18px 12px; }.campaign-switches { justify-content: start; }.campaign-body { padding: 12px; }.campaign-summary { grid-template-columns: repeat(2,minmax(0,1fr)); }.campaign-summary div:nth-child(2) { border-right: 0; }.campaign-summary div:nth-child(-n+2) { border-bottom: 1px solid #e6eaeb; }.participant-row { grid-template-columns: minmax(0,1fr) 36px; gap: 7px 12px; }.participant-id { grid-column: 1; }.episode-titles { grid-column: 1; }.episode-meta { display: none; }.play-button { grid-column: 2; grid-row: 1 / span 2; }.participant-heading { align-items: start; flex-direction: column; } }
</style>
