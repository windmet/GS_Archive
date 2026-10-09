<template>
  <section class="seasonal-page story-page" data-archive-scroll-container>
    <header class="campaign-header story-head">
      <h2 class="shell-named">{{ campaign?.name || '季节企划' }}</h2>
      <ul class="story-footprint" aria-label="收录">
        <li>{{ formatTerm(campaign?.term) }}</li>
        <template v-if="campaign">
          <li><b>{{ campaign.playback_entity_count }}</b>段剧情</li>
          <li><b>{{ idolParticipants.length }}</b>位偶像</li>
          <li v-if="supportParticipants.length"><b>{{ supportParticipants.length }}</b>位工作人员</li>
        </template>
      </ul>
      <div class="campaign-switches" aria-label="企划切换">
        <div class="story-chips" role="group" aria-label="年份">
          <button v-for="year in years" :key="year" :aria-pressed="campaign?.year === year" @click="select(year, campaign?.season)">{{ year }}</button>
        </div>
        <div class="story-chips" role="group" aria-label="企划">
          <button :aria-pressed="campaign?.season === 'valentine'" @click="select(campaign?.year, 'valentine')"><Heart :size="15" /> Valentine</button>
          <button :aria-pressed="campaign?.season === 'white_day'" @click="select(campaign?.year, 'white_day')"><Gift :size="15" /> White Day</button>
        </div>
      </div>
    </header>

    <div v-if="campaign" class="campaign-body story-section">
      <div class="story-section-head">
        <h3>角色剧情</h3>
        <div class="story-chips participant-filter" role="group" aria-label="角色类别">
          <button :aria-pressed="participantType === 'idol'" @click="participantType = 'idol'">偶像 <small>{{ idolParticipants.length }}</small></button>
          <button v-if="supportParticipants.length" :aria-pressed="participantType === 'support'" @click="participantType = 'support'">事务所 <small>{{ supportParticipants.length }}</small></button>
        </div>
      </div>

      <ul class="participant-list">
        <li v-if="campaign.introduction?.length" class="participant-row intro-row">
          <div class="participant-id"><strong>共通导入</strong></div>
          <div class="episode-titles"><span>{{ episodeTitle(campaign.introduction[0]) }}</span></div>
          <button class="story-icon-action" :disabled="!campaign.introduction[0].compiled_file" aria-label="播放共通导入" title="播放共通导入" @click="play(campaign.introduction[0])"><Play :size="17" fill="currentColor" /></button>
        </li>
        <li v-for="participant in visibleParticipants" :key="`${participant.participant_type}-${participant.participant_numeric_id}`" class="participant-row">
          <div class="participant-id">
            <strong>{{ participantName(participant) }}</strong>
            <small>{{ participant.playback_entity_count }} 段剧情<template v-if="participant.episodes[0]?.reward"> · 阅读奖励</template></small>
          </div>
          <div class="episode-titles">
            <span v-for="episode in participant.episodes" :key="episode.id">
              <small>Lv.{{ episode.required_valentine_level || 1 }}</small>{{ episodeTitle(episode) }}
            </span>
          </div>
          <button class="story-icon-action" :disabled="!participant.episodes[0]?.compiled_exists" :aria-label="`播放 ${participantName(participant)}`" title="播放角色剧情" @click="play(participant.episodes[0])">
            <Play :size="17" fill="currentColor" />
          </button>
        </li>
      </ul>
      <ArchiveTechnicalDetails :key="campaign.id" :evidence="sourceEvidence ? { campaign, sourceEvidence } : campaign" />
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import { useStoryTitles } from './useReaderTitles.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { Gift, Heart, Play } from '@lucide/vue'
import '../../styles/archive-story.css'

const props = defineProps({ campaign: { type: Object, default: null }, campaigns: { type: Array, default: () => [] },
  sourceEvidence: { type: Object, default: null }, idolName: { type: Function, default: () => '' } })
// Names and titles in the reader's language, from the same sources as every other story page.
const storyTitle = useStoryTitles()
const participantName = participant => (participant.participant_type === 'idol' && props.idolName(participant.participant_code, participant.display_name)) || participant.display_name || '姓名待确认'
const episodeTitle = episode => presentProducerAddressingText(storyTitle(episode.compiled_file, episode.title))
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
  return `${format(term['1'])} – ${format(term['2'])}`
}
</script>

<style scoped>
.campaign-switches { display: flex; flex-wrap: wrap; gap: var(--gs-space-2) var(--gs-space-5); margin-top: var(--gs-space-5); }
.campaign-switches .story-chips { margin: 0; }
.campaign-body { padding-top: 0; }
.story-section-head { align-items: center; }
.participant-filter { margin: 0; }
.participant-list { margin: 0; padding: 0; list-style: none; }
.participant-row { display: grid; grid-template-columns: 180px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-5); min-height: 64px; padding: var(--gs-space-3) 0; border-bottom: 1px solid var(--gs-line); }
.participant-id, .episode-titles { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; }
.participant-id strong { overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.participant-id small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.intro-row .participant-id strong { color: var(--gs-mint-ink); }
.episode-titles span { color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.episode-titles small { display: inline-block; min-width: 36px; margin-right: var(--gs-space-3); color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-caption); font-variant-numeric: tabular-nums; }

@container story-page (max-width: 560px) {
  .story-section-head { flex-wrap: wrap; }
  .participant-row { grid-template-columns: minmax(0, 1fr) auto; gap: var(--gs-space-2) var(--gs-space-4); }
  .participant-id, .episode-titles { grid-column: 1; }
  .participant-row > .story-icon-action { grid-column: 2; grid-row: 1 / span 2; }
}
</style>
