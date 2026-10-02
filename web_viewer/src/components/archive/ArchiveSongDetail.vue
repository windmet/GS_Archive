<template>
  <section class="song-detail" data-archive-scroll-container>
    <header class="song-detail-hero">
      <img v-if="song.jacketUrl" class="song-detail-jacket" :src="song.jacketUrl" :alt="`${song.title} 封面`" />
      <div class="song-detail-title">
        <h2>{{ song.title }}</h2>
        <p v-if="song.kana" class="song-detail-kana">{{ song.kana }}</p>
        <button v-if="song.parentId" class="song-parent-link" @click="emit('open-song', song.parentId)">返回歌曲作品</button>
        <div class="song-detail-badges">
          <span class="badge badge-layered">属性 · {{ song.attributeLabel || '待确认' }}</span>
          <span v-if="song.special" class="badge badge-special">特殊版本</span>
          <span class="badge badge-layered">{{ song.formLabel }}</span>
        </div>
      </div>
      <dl class="song-detail-stats" aria-label="歌曲档案统计">
        <div><dt>试听</dt><dd>{{ song.playbackLabel.replace(' · 实验混音', '') }}</dd></div>
        <div><dt>音频形态</dt><dd>{{ song.formLabel }}</dd></div>
        <div><dt>首次实装</dt><dd>{{ song.gameplay?.history.firstImplementedOn || song.openDate }}</dd></div>
      </dl>
    </header>
    <div class="song-detail-body">
      <div class="song-listen-column">
      <ArchiveSongExperimentalPlayer v-if="song.playback.experiment" ref="songPlayer" :song="song" :audio-experiment="song.playback.experiment" :idol-directory="idolDirectory" @open-stage="openStage" />
      <ArchiveSongSinglePlayer v-else-if="song.playback.track" ref="songPlayer" :song="song" :track="song.playback.track" />
      <button v-if="song.stageCandidate" class="stage-open-button" type="button" @click="openStage({ songCode: song.id, choreographyId: song.stageCandidate.id })">{{ song.stageCandidate.stageKind === 'special_single' ? '社长特别演出' : 'Chibi 舞台演出' }} →</button>
      </div>
      <div class="song-record-column">
      <section v-if="song.gameplay" class="song-block song-gameplay">
        <div class="song-block-heading"><h3>难度与解锁</h3></div>
        <p class="song-block-note">{{ song.gameplay.releaseCondition.label }}</p>
        <details class="song-history"><summary>实装与解锁历史</summary>
          <p class="song-block-note">首次实装：{{ song.gameplay.history.firstImplementedOn }} · <a :href="song.gameplay.history.sourceUrl" target="_blank" rel="noopener noreferrer">历史来源</a></p>
          <p class="song-block-note">{{ song.gameplay.history.historicalUnlock }}</p>
          <p v-if="song.gameplay.history.permanentOn" class="song-block-note">加入普通歌曲：{{ song.gameplay.history.permanentOn }}</p>
          <p v-else-if="song.gameplay.history.permanentDateStatus === 'pending'" class="song-block-note">加入普通歌曲日期待核实。</p>
          <p v-if="song.gameplay.wikiLevelStatus === 'resolved_song_page'" class="song-block-note">难度按本地主数据与单曲页核对。</p>
          <p v-else-if="song.gameplay.wikiLevelStatus === 'conflict_pending'" class="song-block-note">Wiki 与主数据难度不一致，暂按主数据展示；差异待核实。</p>
        </details>
        <table class="song-difficulties"><caption>谱面难度与最大 Combo</caption><thead><tr><th scope="col">难度</th><th scope="col">等级</th><th scope="col">最大 Combo</th></tr></thead><tbody><tr v-for="d in song.gameplay.difficulties" :key="d.id"><th scope="row">{{ d.label }}</th><td>{{ d.levelLabel }}</td><td>{{ d.maxCombo }}</td></tr></tbody></table>
        <button class="stage-open-button" type="button" @click="openChart">打开谱面预览 ↗</button>
      </section>
      <section class="song-block">
        <div class="song-block-heading"><h3>演唱者</h3></div>
        <div v-if="song.unit" class="song-subsection">
          <h4>演唱组合</h4>
          <ul class="chip-list"><li><button :disabled="!song.unit.actionable" :data-archive-focus-id="`song-unit:${song.unit.id}`" @click="emit('open-unit', song.unit.id)">{{ song.unit.displayName }}</button></li></ul>
        </div>
        <div v-else class="performance-scope-card"><strong>{{ song.scopeLabel }}</strong><p>{{ song.scopeDescription }}</p></div>
        <details v-if="song.performers.length > 5" class="song-subsection" @toggle="performersOpen = $event.target.open"><summary>演唱成员（{{ song.performers.length }}）</summary><ul v-if="performersOpen" class="performer-list"><li v-for="entry in song.performers" :key="entry.id"><ArchiveIdolReference :reference="entry.reference" density="portrait" @open="emit('open-idol', $event)" /></li></ul></details>
        <div v-else-if="song.performers.length" class="song-subsection">
          <h4>演唱成员</h4><p v-if="song.performerNote && song.performerNote !== '按已确认的演唱组合列出成员。'" class="song-block-note">{{ song.performerNote }}</p>
          <ul class="performer-list"><li v-for="entry in song.performers" :key="entry.id"><ArchiveIdolReference :reference="entry.reference" density="portrait" @open="emit('open-idol', $event)" /></li></ul>
        </div>
      </section>
      <details class="song-block" @toggle="audioArchiveOpen = $event.target.open">
        <summary>声部与音频归档</summary>
        <div v-if="audioArchiveOpen">
        <p class="song-block-note">完整混音：{{ song.fullMixCollected ? '已收录' : '未收录' }}。{{ song.playbackLabel.replace(' · 实验混音', '') }}。</p>
        <div v-for="group in song.audioGroups" :key="group.title" class="song-subsection">
          <h4>{{ group.title }}（{{ group.entries.length }}）</h4><p v-if="group.note" class="song-block-note">{{ group.note }}</p>
          <ul v-if="group.kind === 'unit'" class="chip-list"><li v-for="entry in group.entries" :key="entry.id"><button :disabled="!entry.actionable" :data-archive-focus-id="`audio-unit:${entry.id}`" @click="emit('open-unit', entry.id)">查看组合 · {{ entry.displayName }} <ChevronRight :size="14" aria-hidden="true" /></button></li></ul>
          <ul v-else class="audio-idol-list"><li v-for="entry in group.entries" :key="entry.id"><ArchiveIdolReference :reference="entry.reference" :show-image="false" @open="emit('open-idol', $event)" /></li></ul>
        </div>
        </div></details>
      <section v-if="song.variants.length" class="song-block">
        <div class="song-block-heading"><h3>关联演出版本</h3></div>
        <div class="variant-list"><button v-for="variant in song.variants" :key="variant.id" @click="emit('open-song', variant.id)"><strong>{{ variant.title }}</strong><ChevronRight :size="16" /></button></div>
      </section>
      <section v-if="song.related.length" class="song-block">
        <div class="song-block-heading"><h3>关联档案</h3></div>
        <div class="variant-list"><button v-for="(entry, index) in song.related" :key="index" @click="emit('open-related-story', entry.payload)"><strong>{{ entry.title }}</strong><ChevronRight :size="16" /></button></div>
      </section>
      <section v-if="song.movies.length" class="song-block">
        <div class="song-block-heading"><h3>影像资料</h3></div>
        <ul class="movie-list"><li v-for="movie in song.movies" :key="movie.id"><strong>{{ movie.title }}</strong><span>{{ movie.status }}</span></li></ul>
      </section>
      <section v-if="song.links.length" class="song-block">
        <div class="song-block-heading"><h3>专辑链接</h3></div>
        <ul class="link-list"><li v-for="link in song.links" :key="link"><a :href="link" target="_blank" rel="noopener noreferrer external">前往专辑页面 <ExternalLink :size="14" /></a></li></ul>
      </section>
      <section v-if="song.credits.length" class="song-block">
        <div class="song-block-heading"><h3>制作信息</h3></div>
        <ul class="credit-list"><li v-for="line in song.credits" :key="line">{{ line }}</li></ul>
      </section>
      <ArchiveTechnicalDetails :key="song.id" :evidence="song.technicalEvidence" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ChevronRight, ExternalLink } from '@lucide/vue'
import { ref } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import ArchiveSongExperimentalPlayer from './ArchiveSongExperimentalPlayer.vue'
import ArchiveSongSinglePlayer from './ArchiveSongSinglePlayer.vue'
defineProps({ song: { type: Object, required: true }, idolDirectory: { type: Array, default: () => [] } })
const emit = defineEmits(['open-song', 'open-unit', 'open-idol', 'open-related-story', 'open-stage', 'open-chart'])
const songPlayer = ref(null)
const performersOpen = ref(false), audioArchiveOpen = ref(false)
function openStage(target) { songPlayer.value?.pause(); emit('open-stage', target) }
function openChart() { songPlayer.value?.pause(); emit('open-chart') }
</script>

<style scoped>
.song-detail { height: 100%; padding: 24px; overflow-y: auto; background: #f7f9fa; }
.song-detail-hero {
  display: grid;
  grid-template-columns: 172px minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 24px 28px;
  border-bottom: 3px solid #28b6ac;
  background: #17212b;
  color: #fff;
}
.song-detail-jacket {
  width: 172px;
  height: auto;
  border-radius: 8px;
  display: block;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.song-detail-title > span { color: #56d0c7; font-size: 0.68rem; font-weight: 800; }
.song-detail-title h2 { margin: 7px 0 0; font-size: 1.5rem; }
.song-detail-kana { margin: 5px 0 0; color: #aeb9c2; font-size: 0.78rem; }
.song-parent-link { margin-top: 10px; padding: 0; border: 0; background: transparent; color: #76d9d1; cursor: pointer; font: inherit; font-size: 0.72rem; }
.song-parent-link:hover { text-decoration: underline; }
.song-detail-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
.badge { padding: 3px 10px; border-radius: 999px; font-size: 0.64rem; font-weight: 700; }
.badge-movie { background: #fff3e0; color: #b26a00; }
.badge-layered { background: #e8f0fe; color: #2f5fd0; }
.badge-oneshot { background: #f3e8fd; color: #7a3fd0; }
.badge-special { background: #f3e8fd; color: #7136a5; }
.badge-muted { background: #3a4752; color: #b6c0c9; }
.performance-scope-card { margin-top: 12px; padding: 11px 13px; border-left: 3px solid #3aa89f; border-radius: 4px; background: #eef8f7; }
.performance-scope-card strong { color: #246d67; font-size: 0.78rem; }
.performance-scope-card p { margin: 5px 0 0; color: #526a68; font-size: 0.7rem; line-height: 1.55; }
.performance-scope-card small { display: block; margin-top: 6px; color: #778786; font-size: 0.62rem; line-height: 1.45; }
.song-detail-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
.song-detail-stats div { box-sizing: border-box; min-width: 0; padding: 7px 14px; border-left: 1px solid #34414c; }
.song-detail-stats dt { color: #98a6b1; font-size: 0.64rem; white-space: nowrap; }
.song-detail-stats dd { margin: 5px 0 0; font-size: 1rem; font-weight: 700; }
.song-detail-body { padding-top: 20px; display: flex; flex-direction: column; gap: 16px; }
.song-block {
  padding: 16px 18px;
  border: 1px solid #dfe4e8;
  border-radius: 6px;
  background: #fff;
}
.song-block-heading span { color: #2bb3aa; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.05em; }
.song-block-heading h3 { margin: 4px 0 0; font-size: 0.94rem; }
.song-difficulties { width: 100%; margin-top: 12px; border-collapse: collapse; font-size: .78rem; }
.song-difficulties caption { text-align: left; font-size: .75rem; color: #617380; margin-bottom: 8px; }
.song-difficulties th, .song-difficulties td { text-align: left; padding: 10px; border-bottom: 1px solid #e0e9ed; }
.song-difficulties thead { background: #f1f7f8; }
.song-gameplay a { color: #137b75; }
.song-block-note { margin: 8px 0 0; color: #7a858e; font-size: 0.72rem; }
.stage-open-button { min-height: 44px; margin-top: 12px; padding: 0 18px; border: 0; border-radius: 22px; background: #168f87; color: #fff; font: inherit; font-size: .78rem; font-weight: 700; cursor: pointer; }
.stage-open-button:focus-visible { outline: 3px solid #37a9a1; outline-offset: 3px; }
.mapping-caution { margin: 12px 0 0; padding: 9px 11px; border-left: 3px solid #b08a4b; background: #fff8e9; color: #775f35; font-size: 0.72rem; line-height: 1.6; }
.credit-list { margin: 10px 0 0; padding: 0; list-style: none; color: #4a545e; font-size: 0.78rem; line-height: 1.7; }
.audio-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 12px 0 0; }
.audio-stats div { padding: 10px 12px; border-radius: 6px; background: #f4f7f8; }
.audio-stats dt { color: #7a858e; font-size: 0.64rem; }
.audio-stats dd { margin: 5px 0 0; font-size: 0.9rem; font-weight: 700; }
.song-subsection { margin-top: 16px; }
.song-subsection h4 { margin: 0 0 8px; font-size: 0.78rem; color: #5c6771; }
.chip-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.chip-list li { display: inline-flex; }
.performer-list, .audio-idol-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
.audio-idol-list { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.performer-list li, .audio-idol-list li { min-width: 0; }
.chip-list button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 0;
  border-radius: 999px;
  background: #f0fbfa;
  color: #36636b;
  cursor: pointer;
  font: inherit;
  font-size: 0.7rem;
}
.chip-list button:hover:not(:disabled) { background: #dff5f2; }
.chip-list button:focus-visible { outline: 2px solid #158f87; outline-offset: 2px; }
.chip-list button:disabled { cursor: default; opacity: 0.78; }
.chip-list code { color: #158f87; font-weight: 700; }
.variant-list { display: grid; gap: 8px; margin-top: 12px; }
.variant-list button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  padding: 10px 12px;
  border: 1px solid #dfe4e8;
  border-radius: 6px;
  background: #f8fafb;
  color: #26313a;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.variant-list button:hover { border-color: #7bcfc9; background: #f0fbfa; }
.variant-list button > span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.variant-list strong { font-size: 0.78rem; }
.variant-list small { color: #7a858e; font-size: 0.66rem; }
.movie-list { margin: 12px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.movie-list li { display: flex; align-items: center; gap: 10px; font-size: 0.78rem; }
.movie-list code { color: #158f87; font-weight: 700; }
.movie-list span { color: #7a858e; }
.link-list { margin: 10px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.link-list a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #158f87;
  font-size: 0.78rem;
  text-decoration: none;
}
.link-list a:hover { text-decoration: underline; }

@media (max-width: 980px) {
  .song-detail-hero { grid-template-columns: 1fr; }
  .song-detail-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .audio-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 560px) {
  .song-detail { padding: 12px; }
  .song-detail-hero { padding: 18px; }
  .song-detail-jacket { width: 140px; }
  .audio-stats { grid-template-columns: 1fr; }
  .song-detail-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .song-detail-stats div { padding: 7px 10px; }
  .song-detail-stats div:nth-child(3) {
    grid-column: 1 / -1;
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid #34414c;
    border-left: 0;
  }
}
</style>

<style scoped>
.chip-list button { min-height: 44px; }
.song-block-note { margin-bottom: 10px; line-height: 1.6; }
.song-detail-stats dd { font-size: .82rem; line-height: 1.5; }
</style>

<style scoped>
.song-detail-body { display: grid; grid-template-columns: minmax(300px,.8fr) minmax(0,1.2fr); align-items: start; gap: 20px; }
.song-listen-column { position: sticky; top: 0; min-width: 0; }
.song-record-column { display: grid; gap: 16px; min-width: 0; }
summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: 700; font-size: 14px; color: #285969; }
summary::after { content: '⌄'; margin-left: auto; } details[open] > summary::after { content: '⌃'; }
@media(max-width:1100px) { .song-detail-body { grid-template-columns: 1fr; } .song-listen-column { position: static; } }
@media(max-width:560px) {
.song-detail-hero { grid-template-columns: 72px minmax(0,1fr); gap: 12px; padding: 14px; }
.song-detail-jacket { width: 72px; height: 72px; } .song-detail-title h2 { font-size: 20px; }
.song-detail-stats { grid-column: 1 / -1; grid-template-columns: repeat(3,minmax(0,1fr)); }
.song-detail-stats div:nth-child(3) { grid-column: auto; margin: 0; padding-top: 7px; border-top: 0; }
.song-block { padding: 14px; } .song-detail-body { padding-top: 12px; }
}
</style>
