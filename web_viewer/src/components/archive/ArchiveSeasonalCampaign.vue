<template>
  <!-- Valentine / White Day as one ledger: every participant's episodes across the four campaigns
       (2022 and 2023, each Valentine → White Day). A row opens that participant's arc in a drawer;
       a selected campaign only highlights its column and adds its source evidence. -->
  <section class="seasonal-page story-page" data-archive-scroll-container>
    <header class="story-head">
      <h2 class="shell-named">季节企划</h2>
      <ul class="story-footprint" aria-label="收录">
        <li><b>{{ years.length }}</b>届 · <b>{{ campaigns.length }}</b>期</li>
        <li><b>{{ episodeCount }}</b>段剧情</li>
        <li><b>{{ idolRows.length }}</b>位偶像</li>
        <li v-if="staffRows.length"><b>{{ staffRows.length }}</b>位事务所成员</li>
      </ul>
    </header>

    <section class="story-section ledger-section" aria-labelledby="seasonal-ledger-title">
      <div class="story-section-head">
        <h3 id="seasonal-ledger-title">交换记录</h3>
        <small>每年情人节收到巧克力，白色情人节回礼</small>
      </div>

      <!-- Narrow pages pick one campaign here; wide pages use the column heads. -->
      <div class="story-chips campaign-chips" role="group" aria-label="企划">
        <button type="button" :aria-pressed="!focusId" @click="emit('select', '')">全部 <small>{{ campaigns.length }} 期</small></button>
        <button v-for="campaign in campaigns" :key="campaign.id" type="button" :aria-pressed="focusId === campaign.id" @click="emit('select', campaign.id)">
          <component :is="seasonIcon(campaign)" :size="14" aria-hidden="true" />{{ campaign.year }} {{ seasonLabel(campaign) }}
        </button>
      </div>

      <table class="seasonal-ledger">
        <colgroup><col class="who-column"><col v-for="campaign in campaigns" :key="campaign.id"></colgroup>
        <thead>
          <tr>
            <th scope="col" class="who-head">参与者</th>
            <th v-for="campaign in campaigns" :key="campaign.id" scope="col" :class="{ focused: focusId === campaign.id }">
              <button type="button" class="campaign-head" :aria-pressed="focusId === campaign.id" :title="focusId === campaign.id ? '显示全部四期' : `突出 ${campaign.year} ${seasonLabel(campaign)}`" @click="emit('select', focusId === campaign.id ? '' : campaign.id)">
                <span class="campaign-year">{{ campaign.year }}</span>
                <span class="campaign-name"><component :is="seasonIcon(campaign)" :size="14" aria-hidden="true" />{{ seasonLabel(campaign) }}</span>
                <small>{{ termText(campaign) }}</small>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr class="ledger-row common-row" :class="{ selected: participantCode === COMMON }" @click="open(COMMON)">
            <th scope="row"><button type="button" class="who-button" @click.stop="open(COMMON)"><span class="who-mark" aria-hidden="true"><Users :size="16" /></span><span class="who-name">共通导入</span></button></th>
            <td v-for="campaign in campaigns" :key="campaign.id" :class="{ focused: focusId === campaign.id }">
              <span v-for="episode in campaign.introduction" :key="episode.id" class="ledger-title" lang="ja">{{ episodeTitle(episode) }}</span>
            </td>
          </tr>
        </tbody>
        <tbody v-for="group in groups" :key="group.name">
          <tr class="group-row"><th :colspan="campaigns.length + 1" scope="rowgroup">{{ group.name }}</th></tr>
          <tr v-for="row in group.rows" :key="row.participant_code" class="ledger-row" :class="{ selected: participantCode === row.participant_code }" @click="open(row.participant_code)">
            <th scope="row">
              <button type="button" class="who-button" @click.stop="open(row.participant_code)">
                <ArchiveIdolAvatar :idol-code="row.participant_code" :accent-color="row.color" :size="28" :ring-width="2" :gap="1" decorative :fallback-text="row.name.slice(0, 1)" />
                <span class="who-name">{{ row.name }}</span>
              </button>
            </th>
            <td v-for="campaign in campaigns" :key="campaign.id" :class="{ focused: focusId === campaign.id }">
              <span v-for="(episode, index) in row.episodes[campaign.id]" :key="episode.id" class="ledger-title">
                <span v-if="row.episodes[campaign.id].length > 1" class="part-mark" aria-hidden="true">{{ PARTS[index] }}</span><span lang="ja">{{ episodeTitle(episode) }}</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- The same rows as a list on narrow pages: one whole-row target per participant. -->
      <div class="ledger-list">
        <button type="button" class="list-row" :class="{ selected: participantCode === COMMON }" @click="open(COMMON)">
          <span class="who-mark" aria-hidden="true"><Users :size="18" /></span>
          <span class="list-copy">
            <strong>共通导入</strong>
            <span v-for="line in listLines({ episodes: commonEpisodes })" :key="line.key" class="list-line"><small>{{ line.label }}</small><span lang="ja">{{ line.title }}</span></span>
          </span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
        <template v-for="group in groups" :key="group.name">
          <h4 class="list-group">{{ group.name }}</h4>
          <button v-for="row in group.rows" :key="row.participant_code" type="button" class="list-row" :class="{ selected: participantCode === row.participant_code }" @click="open(row.participant_code)">
            <ArchiveIdolAvatar :idol-code="row.participant_code" :accent-color="row.color" :size="40" :ring-width="2" decorative :fallback-text="row.name.slice(0, 1)" />
            <span class="list-copy">
              <strong>{{ row.name }}</strong>
              <span v-for="line in listLines(row)" :key="line.key" class="list-line"><small>{{ line.label }}</small><span lang="ja">{{ line.title }}</span></span>
            </span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </template>
      </div>
    </section>

    <section v-if="page.campaign" class="story-section">
      <ArchiveTechnicalDetails :key="page.campaign.id" :evidence="page.sourceEvidence ? { campaign: page.campaign, sourceEvidence: page.sourceEvidence } : page.campaign" />
    </section>

    <Teleport to="body">
      <div v-if="drawer" class="seasonal-drawer-backdrop" @click.self="close">
        <section ref="drawerElement" class="seasonal-drawer" role="dialog" aria-modal="true" :aria-label="`${drawer.name} 的季节企划`" @keydown.esc.stop.prevent="close" @keydown.tab="cycleFocus">
          <header class="drawer-head">
            <ArchiveIdolAvatar v-if="drawer.code !== COMMON" :idol-code="drawer.code" :accent-color="drawer.color" :size="52" :ring-width="3" decorative :fallback-text="drawer.name.slice(0, 1)" />
            <span v-else class="who-mark large" aria-hidden="true"><Users :size="22" /></span>
            <div class="drawer-identity">
              <h2>{{ drawer.name }}</h2>
              <small>{{ drawer.group }} · {{ drawer.campaignCount }} 期 · {{ drawer.episodes.length }} 段</small>
            </div>
            <button ref="closeButton" type="button" class="drawer-close" aria-label="关闭" title="关闭" @click="close"><X :size="20" /></button>
          </header>

          <div class="drawer-body">
            <section v-for="year in drawer.years" :key="year.year" class="drawer-year" :aria-label="`${year.year} 年`">
              <h3>{{ year.year }}</h3>
              <div v-for="block in year.campaigns" :key="block.campaign.id" class="drawer-campaign" :class="{ focused: focusId === block.campaign.id }">
                <div class="drawer-campaign-head">
                  <span class="drawer-campaign-name"><component :is="seasonIcon(block.campaign)" :size="15" aria-hidden="true" />{{ seasonLabel(block.campaign) }}</span>
                  <small>{{ termText(block.campaign) }}</small>
                  <button v-if="block.playable" type="button" class="drawer-play" :aria-label="`播放 ${block.campaign.year} ${seasonLabel(block.campaign)}`" :title="`播放 ${block.campaign.year} ${seasonLabel(block.campaign)}`" @click="emit('play', block.playable.compiled_file)"><Play :size="15" fill="currentColor" /></button>
                </div>
                <ol class="drawer-episodes">
                  <li v-for="(episode, index) in block.episodes" :key="episode.id">
                    <button type="button" class="drawer-episode" :disabled="!episode.reading" @click="emit('read', episode.reading.document_id)">
                      <span v-if="block.episodes.length > 1" class="part-mark" aria-hidden="true">{{ PARTS[index] }}</span>
                      <span class="drawer-episode-copy">
                        <strong lang="ja">{{ episodeTitle(episode) }}</strong>
                        <small v-if="episode.level">Lv.{{ episode.level }} 解锁</small>
                      </span>
                      <BookOpen :size="16" aria-hidden="true" />
                    </button>
                  </li>
                </ol>
              </div>
            </section>
          </div>

          <footer class="drawer-actions">
            <button type="button" class="story-action primary" :disabled="!drawer.firstReading" @click="emit('read', drawer.firstReading)"><BookOpen :size="16" />阅读 {{ drawer.campaignCount }} 期 · {{ drawer.episodes.length }} 段</button>
            <button type="button" class="story-action" :disabled="!drawer.playableCount" @click="emit('play-participant', drawer.episodes)"><Play :size="15" fill="currentColor" />连播演出</button>
          </footer>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch, onBeforeUnmount } from 'vue'
import { BookOpen, ChevronRight, Gift, Heart, Play, Users, X } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import { useReaderTitles } from './useReaderTitles.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { SEASONAL_SEASON_LABEL } from '../../../shared/reading/ReadingCatalog.js'
import '../../styles/archive-story.css'

const props = defineProps({
  page: { type: Object, required: true },
  focusId: { type: String, default: '' },
  participantCode: { type: String, default: '' },
  idols: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' },
})
const emit = defineEmits(['select', 'select-participant', 'read', 'play', 'play-participant'])
const COMMON = 'common'
const PARTS = ['①', '②', '③', '④']

const readerTitle = useReaderTitles()
const episodeTitle = episode => presentProducerAddressingText(readerTitle(episode.reading, episode.title))
const seasonLabel = campaign => SEASONAL_SEASON_LABEL[campaign.season] || campaign.season
const seasonIcon = campaign => campaign.season === 'valentine' ? Heart : Gift
const day = value => { const date = new Date(value * 1000); return `${date.getMonth() + 1}/${date.getDate()}` }
const termText = campaign => campaign.term?.['1'] && campaign.term?.['2'] ? `${day(campaign.term['1'])}–${day(campaign.term['2'])}` : '时间未记录'

const campaigns = computed(() => props.page.ledger.campaigns)
const years = computed(() => [...new Set(campaigns.value.map(campaign => campaign.year))])
const commonEpisodes = computed(() => Object.fromEntries(campaigns.value.map(campaign => [campaign.id, campaign.introduction])))
// Rows follow the archive's idol order, grouped by unit; office staff close the ledger.
const rows = computed(() => {
  const order = new Map(props.idols.map((idol, index) => [idol.id, { idol, index }]))
  return props.page.ledger.participants.map(participant => {
    const known = order.get(participant.participant_code)
    return { ...participant, order: known?.index ?? Number.MAX_SAFE_INTEGER, unitName: known?.idol.unitName || '', color: known?.idol.color || '',
      name: (participant.participant_type === 'idol' && props.idolName(participant.participant_code, participant.display_name)) || participant.display_name || '姓名待确认' }
  }).sort((a, b) => a.order - b.order || a.participant_code.localeCompare(b.participant_code))
})
const idolRows = computed(() => rows.value.filter(row => row.participant_type === 'idol'))
const staffRows = computed(() => rows.value.filter(row => row.participant_type !== 'idol'))
const groups = computed(() => {
  const list = []
  for (const row of idolRows.value) {
    const name = row.unitName || '315 Production'
    if (list.at(-1)?.name !== name) list.push({ name, rows: [] })
    list.at(-1).rows.push(row)
  }
  if (staffRows.value.length) list.push({ name: '事务所', rows: staffRows.value })
  return list
})
const episodeCount = computed(() => [commonEpisodes.value, ...rows.value.map(row => row.episodes)]
  .reduce((sum, episodes) => sum + Object.values(episodes).flat().length, 0))

// Narrow list: one line per campaign, or every part of the selected campaign.
function listLines(row) {
  const shown = props.focusId ? campaigns.value.filter(campaign => campaign.id === props.focusId) : campaigns.value
  return shown.flatMap(campaign => {
    const episodes = row.episodes[campaign.id] || []
    if (props.focusId) return episodes.map((episode, index) => ({ key: episode.id, title: episodeTitle(episode),
      label: episodes.length > 1 ? PARTS[index] : seasonLabel(campaign) }))
    return episodes.length ? [{ key: campaign.id, title: episodeTitle(episodes[0]) + (episodes.length > 1 ? ` 等 ${episodes.length} 段` : ''),
      label: `${String(campaign.year).slice(2)} ${seasonLabel(campaign)}` }] : []
  })
}

const drawer = computed(() => {
  const code = props.participantCode
  if (!code) return null
  const row = code === COMMON ? { name: '共通导入', group: '每期开场', episodes: commonEpisodes.value, color: '' }
    : rows.value.find(entry => entry.participant_code === code)
  if (!row) return null
  const blocks = campaigns.value.map(campaign => {
    const episodes = row.episodes[campaign.id] || []
    return { campaign, episodes, playable: episodes.find(episode => episode.playable && episode.compiled_file) || null }
  }).filter(block => block.episodes.length)
  const episodes = blocks.flatMap(block => block.episodes.map(episode => ({ ...episode, label: `${block.campaign.year} ${seasonLabel(block.campaign)}` })))
  return { code, name: row.name, color: row.color, group: code === COMMON ? row.group : row.participant_type === 'idol' ? row.unitName : '事务所',
    years: years.value.map(year => ({ year, campaigns: blocks.filter(block => block.campaign.year === year) })).filter(year => year.campaigns.length),
    campaignCount: blocks.length, episodes, firstReading: episodes.find(episode => episode.reading)?.reading.document_id || '',
    playableCount: episodes.filter(episode => episode.playable).length }
})

const open = code => emit('select-participant', code)
const close = () => emit('select-participant', '')

// Drawer surface contract: focus moves in, Tab stays inside, the page behind is inert, and focus
// returns to the opener when it closes.
const drawerElement = ref(null), closeButton = ref(null)
let opener = null, background = null, wasInert = false
watch(() => Boolean(drawer.value), async isOpen => {
  if (isOpen) {
    opener = document.activeElement
    background = document.querySelector('#story-viewer')
    wasInert = background?.inert || false
    if (background) background.inert = true
    await nextTick()
    closeButton.value?.focus({ preventScroll: true })
  } else release()
}, { immediate: true })
function release() {
  if (background) background.inert = wasInert
  background = null
  if (opener?.isConnected) opener.focus({ preventScroll: true })
  opener = null
}
onBeforeUnmount(() => { if (background) background.inert = wasInert })
function cycleFocus(event) {
  const choices = [...drawerElement.value.querySelectorAll('button:not([disabled]),a[href]')].filter(element => element.getClientRects().length)
  const first = choices[0], last = choices.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
</script>

<style scoped>
.ledger-section { padding-top: 0; }
.story-section-head > small { white-space: normal; text-align: right; }

/* Wide pages: a table on the paper. Rows are hairlines, the head sits on a rule. */
.campaign-chips { display: none; }
.seasonal-ledger { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: var(--gs-text-ui); }
.who-column { width: 184px; }
.seasonal-ledger thead th { padding: 0; border-bottom: 1px solid var(--gs-rule); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); text-align: left; vertical-align: bottom; }
.seasonal-ledger .who-head { padding: var(--gs-space-3) 0; }
.campaign-head { display: grid; gap: var(--gs-space-1); width: 100%; padding: var(--gs-space-3) var(--gs-space-4); border: 0; border-bottom: 2px solid transparent; background: none; color: var(--gs-ink-2); cursor: pointer; font: inherit; text-align: left; transition: color var(--gs-motion-feedback) var(--gs-motion-ease); }
.campaign-head:hover { color: var(--gs-mint-ink); }
.campaign-head[aria-pressed=true] { border-bottom-color: var(--gs-selected-line); }
.campaign-year { color: var(--gs-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); font-variant-numeric: tabular-nums; line-height: 1.2; }
.campaign-name { display: inline-flex; align-items: center; gap: var(--gs-space-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.campaign-head small { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }

.seasonal-ledger td, .seasonal-ledger tbody th { padding: var(--gs-space-3) var(--gs-space-4); border-bottom: 1px solid var(--gs-line); text-align: left; vertical-align: top; }
.seasonal-ledger tbody th { padding-left: 0; font-weight: var(--gs-weight-regular); }
.seasonal-ledger td.focused, .seasonal-ledger th.focused { background: var(--gs-selected-bg); }
.ledger-row { cursor: pointer; }
.ledger-row:hover .who-name { color: var(--gs-mint-ink); }
.ledger-row.selected > * { background: var(--gs-selected-bg); }
.group-row th { padding: var(--gs-space-6) 0 var(--gs-space-2); border-bottom: 1px solid var(--gs-line); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); text-align: left; }

.who-button { display: flex; align-items: center; gap: var(--gs-space-3); width: 100%; min-width: 0; min-height: var(--gs-control-compact); padding: 0; border: 0; background: none; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.who-name { overflow: hidden; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.common-row .who-name { color: var(--gs-mint-ink); }
.who-mark { display: grid; flex: none; place-items: center; width: 28px; height: 28px; border-radius: var(--gs-radius-pill); background: var(--gs-line); color: var(--gs-ink-2); }
.who-mark.large { width: 52px; height: 52px; }
.ledger-title { display: flex; gap: var(--gs-space-2); min-width: 0; overflow: hidden; color: var(--gs-ink-2); line-height: 1.6; text-overflow: ellipsis; white-space: nowrap; }
.ledger-title > span:last-child { overflow: hidden; text-overflow: ellipsis; }
.part-mark { flex: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }

/* Narrow pages: the same rows as a list. */
.ledger-list { display: none; }
.list-group { margin: var(--gs-space-6) 0 0; padding-bottom: var(--gs-space-2); border-bottom: 1px solid var(--gs-line); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.list-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) 18px; align-items: start; gap: var(--gs-space-4); width: 100%; min-height: var(--gs-control-touch); padding: var(--gs-space-4) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.list-row > svg { align-self: center; color: var(--gs-ink-3); }
.list-row .who-mark { width: 40px; height: 40px; }
.list-row.selected { background: var(--gs-selected-bg); }
.list-copy { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; }
.list-copy strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.list-line { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: var(--gs-space-3); min-width: 0; color: var(--gs-ink-2); font-size: var(--gs-text-meta); }
.list-line small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
.list-line > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@container story-page (max-width: 720px) {
  .campaign-chips { display: flex; }
  .seasonal-ledger { display: none; }
  .ledger-list { display: block; }
  .story-section-head > small { display: none; }
}

/* Side drawer (480px); a bottom sheet on phones. */
.seasonal-drawer-backdrop { position: fixed; inset: 0; z-index: 3000; display: flex; justify-content: flex-end; background: color-mix(in srgb, var(--gs-chrome) 32%, transparent); }
.seasonal-drawer { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: min(var(--gs-surface-drawer-width), 100%); height: 100dvh; box-sizing: border-box; padding-top: var(--gs-safe-top); padding-right: var(--gs-safe-right); background: var(--gs-surface); box-shadow: var(--gs-shadow-float); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); }
.drawer-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); padding: var(--gs-space-5) var(--gs-space-5) var(--gs-space-4); border-bottom: 1px solid var(--gs-rule); }
.drawer-identity { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; }
.drawer-identity h2 { margin: 0; overflow-wrap: anywhere; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); line-height: 1.3; }
.drawer-identity small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.drawer-close { display: grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink-2); cursor: pointer; }
.drawer-close:hover { color: var(--gs-mint-ink); }
.drawer-body { overflow-y: auto; overscroll-behavior: contain; padding: 0 var(--gs-space-5) var(--gs-space-5); }
.drawer-year h3 { margin: var(--gs-space-6) 0 var(--gs-space-2); font-family: var(--gs-font-stage); font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); font-variant-numeric: tabular-nums; }
.drawer-campaign { padding: var(--gs-space-3) 0 var(--gs-space-2); border-top: 1px solid var(--gs-line); }
.drawer-campaign-head { display: flex; align-items: center; gap: var(--gs-space-3); min-height: var(--gs-control-touch); }
.drawer-campaign-name { display: inline-flex; align-items: center; gap: var(--gs-space-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.drawer-campaign.focused .drawer-campaign-name { color: var(--gs-selected-ink); }
.drawer-campaign-head small { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.drawer-play { display: grid; place-items: center; width: var(--gs-control-normal); height: var(--gs-control-normal); margin-left: auto; border: 0; border-radius: var(--gs-radius-pill); background: var(--gs-play-bg); color: var(--gs-play-ink); cursor: pointer; }
.drawer-episodes { margin: 0; padding: 0; list-style: none; }
.drawer-episode { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-3); width: 100%; min-height: var(--gs-control-touch); padding: var(--gs-space-2) 0; border: 0; background: none; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.drawer-episode:not(:has(.part-mark)) { grid-template-columns: minmax(0, 1fr) auto; }
.drawer-episode > svg { color: var(--gs-ink-3); }
.drawer-episode:hover:not(:disabled) strong, .drawer-episode:hover:not(:disabled) > svg { color: var(--gs-mint-ink); }
.drawer-episode:disabled { cursor: default; opacity: .45; }
.drawer-episode-copy { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; }
.drawer-episode-copy strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-medium); line-height: 1.5; }
.drawer-episode-copy small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.drawer-actions { display: flex; gap: var(--gs-space-3); padding: var(--gs-space-4) var(--gs-space-5) calc(var(--gs-space-4) + var(--gs-safe-bottom)); border-top: 1px solid var(--gs-line); }
.drawer-actions .story-action { flex: 1 1 0; min-height: var(--gs-control-touch); }
.drawer-actions .story-action.primary { flex-grow: 2; }
.seasonal-drawer :is(button, a):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
/* Shared story-page action styles, scoped to the drawer that lives outside the page. */
.seasonal-drawer .story-action { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); cursor: pointer; font: inherit; font-size: var(--gs-text-ui); white-space: nowrap; }
.seasonal-drawer .story-action.primary { border-color: var(--gs-action-bg); background: var(--gs-action-bg); color: var(--gs-action-ink); }
.seasonal-drawer .story-action:disabled { cursor: default; opacity: .45; }

@media (max-width: 760px) {
  .seasonal-drawer-backdrop { align-items: flex-end; }
  .seasonal-drawer { width: 100%; height: 85dvh; padding-top: 0; padding-right: 0; border-top-left-radius: var(--gs-radius-panel); border-top-right-radius: var(--gs-radius-panel); }
}
@media (prefers-reduced-motion: reduce) { .campaign-head { transition: none; } }
</style>
