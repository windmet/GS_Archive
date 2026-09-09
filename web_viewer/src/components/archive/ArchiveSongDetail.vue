<template>
  <section class="song-detail">
    <header class="song-detail-hero">
      <img v-if="song.jacketUrl" class="song-detail-jacket" :src="song.jacketUrl" :alt="`${song.title} 封面`" />
      <div class="song-detail-title">
        <span>SONG ARCHIVE</span>
        <h2>{{ song.title }}</h2>
        <p v-if="song.kana" class="song-detail-kana">{{ song.kana }}</p>
        <button v-if="song.parentId" class="song-parent-link" @click="emit('open-song', song.parentId)">返回歌曲作品</button>
        <div class="song-detail-badges">
          <span v-if="song.special" class="badge badge-special">特殊版本</span>
          <span class="badge badge-layered">{{ song.formLabel }}</span>
        </div>
      </div>
      <dl class="song-detail-stats" aria-label="歌曲档案统计">
        <div><dt>试听</dt><dd>{{ song.playbackLabel }}</dd></div>
        <div><dt>音频形态</dt><dd>{{ song.formLabel }}</dd></div>
        <div><dt>开放时间</dt><dd>{{ song.openDate }}</dd></div>
      </dl>
    </header>
    <div class="song-detail-body">
      <section v-if="song.credits.length" class="song-block">
        <div class="song-block-heading"><span>CREDITS</span><h3>制作信息</h3></div>
        <ul class="credit-list"><li v-for="line in song.credits" :key="line">{{ line }}</li></ul>
      </section>
      <section class="song-block">
        <div class="song-block-heading"><span>PERFORMERS</span><h3>演唱者</h3></div>
        <div v-if="song.unit" class="song-subsection">
          <h4>演唱组合</h4>
          <ul class="chip-list"><li><button :disabled="!song.unit.actionable" @click="emit('open-unit', song.unit.id)">{{ song.unit.displayName }}</button></li></ul>
        </div>
        <div v-else class="performance-scope-card"><strong>{{ song.scopeLabel }}</strong><p>{{ song.scopeDescription }}</p></div>
        <div v-if="song.performers.length" class="song-subsection">
          <h4>演唱成员</h4><p v-if="song.performerNote" class="song-block-note">{{ song.performerNote }}</p>
          <ul class="chip-list"><li v-for="entry in song.performers" :key="entry.id"><button :disabled="!entry.actionable" @click="emit('open-idol', entry.id)">{{ entry.displayName }}</button></li></ul>
        </div>
      </section>
      <ArchiveSongExperimentalPlayer v-if="song.playback.experiment" :song="song" :audio-experiment="song.playback.experiment" />
      <ArchiveSongSinglePlayer v-else-if="song.playback.track" :song="song" :track="song.playback.track" />
      <section class="song-block">
        <div class="song-block-heading"><span>AUDIO</span><h3>收录音频</h3></div>
        <p class="song-block-note">完整混音：{{ song.fullMixCollected ? '已收录' : '未收录' }}。{{ song.playbackLabel }}。</p>
        <div v-for="group in song.audioGroups" :key="group.title" class="song-subsection">
          <h4>{{ group.title }}（{{ group.entries.length }}）</h4><p v-if="group.note" class="song-block-note">{{ group.note }}</p>
          <ul class="chip-list"><li v-for="entry in group.entries" :key="entry.id"><button :disabled="!entry.actionable" @click="emit(group.kind === 'unit' ? 'open-unit' : 'open-idol', entry.id)">{{ entry.displayName }}</button></li></ul>
        </div>
      </section>
      <section v-if="song.variants.length" class="song-block">
        <div class="song-block-heading"><span>VERSIONS</span><h3>关联演出版本</h3></div>
        <div class="variant-list"><button v-for="variant in song.variants" :key="variant.id" @click="emit('open-song', variant.id)"><strong>{{ variant.title }}</strong><ChevronRight :size="16" /></button></div>
      </section>
      <section v-if="song.related.length" class="song-block">
        <div class="song-block-heading"><span>RELATED ARCHIVE</span><h3>关联档案</h3></div>
        <div class="variant-list"><button v-for="(entry, index) in song.related" :key="index" @click="emit('open-related-story', entry.payload)"><strong>{{ entry.title }}</strong><ChevronRight :size="16" /></button></div>
      </section>
      <section v-if="song.movies.length" class="song-block">
        <div class="song-block-heading"><span>MOVIES</span><h3>影像资料</h3></div>
        <ul class="movie-list"><li v-for="movie in song.movies" :key="movie.id"><strong>{{ movie.title }}</strong><span>{{ movie.status }}</span></li></ul>
      </section>
      <section v-if="song.links.length" class="song-block">
        <div class="song-block-heading"><span>RELEASES</span><h3>专辑链接</h3></div>
        <ul class="link-list"><li v-for="link in song.links" :key="link"><a :href="link" target="_blank" rel="noopener noreferrer external">前往专辑页面 <ExternalLink :size="14" /></a></li></ul>
      </section>
      <ArchiveTechnicalDetails :key="song.id" :evidence="song.technicalEvidence" />
    </div>
  </section>
</template>

<script setup>
import { ChevronRight, ExternalLink } from '@lucide/vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveSongExperimentalPlayer from './ArchiveSongExperimentalPlayer.vue'
import ArchiveSongSinglePlayer from './ArchiveSongSinglePlayer.vue'
defineProps({ song: { type: Object, required: true } })
const emit = defineEmits(['open-song', 'open-unit', 'open-idol', 'open-related-story'])
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
.song-block-note { margin: 8px 0 0; color: #7a858e; font-size: 0.72rem; }
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
