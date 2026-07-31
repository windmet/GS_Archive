<template>
  <section class="song-detail">
    <header class="song-detail-hero">
      <img
        v-if="song.jacket_url"
        class="song-detail-jacket"
        :src="song.jacket_url"
        :alt="`${song.title} 封面`"
      />
      <div class="song-detail-title">
        <span>SONG · {{ song.song_id }}</span>
        <h2>{{ song.title }}</h2>
        <p v-if="song.kana" class="song-detail-kana">{{ song.kana }}</p>
        <div class="song-detail-badges">
          <span v-if="!song.available" class="badge badge-muted">未开放</span>
          <span v-for="movie in song.movies" :key="movie.kind + movie.resource_id" class="badge badge-movie">
            {{ movie.kind === '3dmv' ? '3DMV' : 'MV LIVE' }} · {{ movie.resource_id }}
          </span>
          <span v-if="song.audio_form === 'layered'" class="badge badge-layered">分层演出</span>
          <span v-if="song.audio_form === 'oneshot'" class="badge badge-oneshot">声部版</span>
        </div>
      </div>
      <dl class="song-detail-stats" aria-label="歌曲档案统计">
        <div><dt>曲目 ID</dt><dd>{{ song.song_id }}</dd></div>
        <div><dt>音频形态</dt><dd>{{ formLabel }}</dd></div>
        <div><dt>开放时间</dt><dd>{{ openDate }}</dd></div>
      </dl>
    </header>

    <div class="song-detail-body">
      <section v-if="creditLines.length" class="song-block" aria-labelledby="song-credits-title">
        <div class="song-block-heading">
          <span>CREDITS</span>
          <h3 id="song-credits-title">制作信息</h3>
        </div>
        <ul class="credit-list">
          <li v-for="line in creditLines" :key="line">{{ line }}</li>
        </ul>
      </section>

      <section class="song-block" aria-labelledby="song-audio-title">
        <div class="song-block-heading">
          <span>AUDIO LAYERS</span>
          <h3 id="song-audio-title">音频层</h3>
        </div>
        <p class="song-block-note">原始 ACB 资源层结构（cue 与文件名证据见音频关系目录）。</p>
        <dl class="audio-stats">
          <div><dt>完整混音</dt><dd>{{ song.audio.has_full_mix ? '有' : '无' }}</dd></div>
          <div><dt>组合声部 cue</dt><dd>{{ song.audio.unit_cue_count }}</dd></div>
          <div><dt>偶像声部 cue</dt><dd>{{ song.audio.oneshot_cue_count }}</dd></div>
          <div><dt>偶像声部文件</dt><dd>{{ song.audio.idol_vocal_file_count }}</dd></div>
          <div><dt>伴奏文件</dt><dd>{{ song.audio.backing_file_count }}</dd></div>
        </dl>

        <div v-if="unitEntries.length" class="song-subsection">
          <h4>组合演出版本（{{ unitEntries.length }}）</h4>
          <ul class="chip-list">
            <li v-for="entry in unitEntries" :key="entry.code">
              <code>{{ entry.code }}</code>{{ entry.name }}
            </li>
          </ul>
        </div>

        <div v-if="oneshotEntries.length" class="song-subsection">
          <h4>偶像声部 cue（{{ oneshotEntries.length }}）</h4>
          <ul class="chip-list">
            <li v-for="entry in oneshotEntries" :key="entry.code">
              <code>{{ entry.code }}</code>{{ entry.name }}
            </li>
          </ul>
        </div>

        <div v-if="idolVocalEntries.length" class="song-subsection">
          <h4>偶像声部文件（{{ idolVocalEntries.length }}）</h4>
          <ul class="chip-list">
            <li v-for="entry in idolVocalEntries" :key="entry.code">
              <code>{{ entry.code }}</code>{{ entry.name }}
            </li>
          </ul>
        </div>
      </section>

      <section class="song-block" aria-labelledby="song-choreography-title">
        <div class="song-block-heading">
          <span>CHOREOGRAPHY</span>
          <h3 id="song-choreography-title">编舞与演出</h3>
        </div>
        <dl class="audio-stats">
          <div><dt>编舞数据</dt><dd>{{ song.choreography.has_fumen ? '有' : '无' }}</dd></div>
          <div><dt>口型数据</dt><dd>{{ song.choreography.has_for_lipsync ? '有' : '无' }}</dd></div>
          <div><dt>舞台特效</dt><dd>{{ song.choreography.has_live_effect ? '有' : '无' }}</dd></div>
          <div><dt>封面</dt><dd>{{ song.choreography.has_jacket ? '有' : '无' }}</dd></div>
          <div><dt>舞台背景</dt><dd>{{ song.choreography.has_song_bg ? '有' : '无' }}</dd></div>
        </dl>
        <div v-if="effectEntries.length" class="song-subsection">
          <h4>特效变体（{{ effectEntries.length }}）</h4>
          <ul class="chip-list">
            <li v-for="entry in effectEntries" :key="entry.code">
              <code>{{ entry.code }}</code>{{ entry.name }}
            </li>
          </ul>
        </div>
      </section>

      <section v-if="song.movies.length" class="song-block" aria-labelledby="song-movie-title">
        <div class="song-block-heading">
          <span>MOVIES</span>
          <h3 id="song-movie-title">MV 关系</h3>
        </div>
        <ul class="movie-list">
          <li v-for="movie in song.movies" :key="movie.kind + movie.resource_id">
            <strong>{{ movie.kind === '3dmv' ? '3DMV' : 'MV LIVE' }}</strong>
            <code>{{ movie.resource_id }}</code>
            <span v-if="movie.movie_offset != null">
              offset {{ movie.movie_offset }}ms
              <template v-if="movie.movie_finish_offset != null">– {{ movie.movie_finish_offset }}ms</template>
            </span>
          </li>
        </ul>
      </section>

      <section v-if="song.links.length" class="song-block" aria-labelledby="song-links-title">
        <div class="song-block-heading">
          <span>RELEASES</span>
          <h3 id="song-links-title">专辑链接</h3>
        </div>
        <ul class="link-list">
          <li v-for="link in song.links" :key="link">
            <a :href="link" target="_blank" rel="noopener noreferrer external">前往专辑页面 <ExternalLink :size="14" /></a>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { ExternalLink } from '@lucide/vue'
import { IDOL_ID_TO_NAME } from '../../utils/IdolNameMap.js'

const props = defineProps({
  song: { type: Object, required: true },
  units: { type: Object, default: null },
})

const formLabel = computed(() => ({
  layered: '分层演出',
  oneshot: '声部版',
  'single-cue': '单曲',
}[props.song.audio_form] || props.song.audio_form))

const openDate = computed(() => {
  const openAt = props.song.open_at
  if (openAt == null || openAt >= 4102412400) return '未开放'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(openAt * 1000))
})

const creditLines = computed(() => (props.song.credits || '').split('\n').filter(Boolean))

function unitName(code) {
  const normalized = code.replace(/^0(\d{2}[a-z0-9]{3})/, '$1')
  const unit = props.units?.by_unit_code?.[normalized]
  if (unit) return unit.unit_name
  if (/^(solo|solo_multi|solo_single|tutorial)$/.test(code)) {
    return { solo: '独唱', solo_multi: '多人独唱', solo_single: '单人独唱', tutorial: '教程' }[code]
  }
  return '未知组合'
}

const unitEntries = computed(() =>
  (props.song.audio.unit_codes || []).map(code => ({ code, name: unitName(code) })),
)
const oneshotEntries = computed(() =>
  (props.song.audio.oneshot_idol_codes || []).map(code => ({ code, name: IDOL_ID_TO_NAME[code] || code })),
)
const idolVocalEntries = computed(() =>
  (props.song.audio.idol_vocal_codes || []).map(code => ({ code, name: IDOL_ID_TO_NAME[code] || code })),
)
const effectEntries = computed(() =>
  (props.song.choreography.live_effect_variants || []).map(code => ({ code, name: unitName(code) })),
)
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
.song-detail-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
.badge { padding: 3px 10px; border-radius: 999px; font-size: 0.64rem; font-weight: 700; }
.badge-movie { background: #fff3e0; color: #b26a00; }
.badge-layered { background: #e8f0fe; color: #2f5fd0; }
.badge-oneshot { background: #f3e8fd; color: #7a3fd0; }
.badge-muted { background: #3a4752; color: #b6c0c9; }
.song-detail-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
.song-detail-stats div { min-width: 0; padding: 7px 14px; border-left: 1px solid #34414c; }
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
.credit-list { margin: 10px 0 0; padding: 0; list-style: none; color: #4a545e; font-size: 0.78rem; line-height: 1.7; }
.audio-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 12px 0 0; }
.audio-stats div { padding: 10px 12px; border-radius: 6px; background: #f4f7f8; }
.audio-stats dt { color: #7a858e; font-size: 0.64rem; }
.audio-stats dd { margin: 5px 0 0; font-size: 0.9rem; font-weight: 700; }
.song-subsection { margin-top: 16px; }
.song-subsection h4 { margin: 0 0 8px; font-size: 0.78rem; color: #5c6771; }
.chip-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.chip-list li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f0fbfa;
  color: #36636b;
  font-size: 0.7rem;
}
.chip-list code { color: #158f87; font-weight: 700; }
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
  .song-detail-stats div:nth-child(3) { border-left: 0; }
}
</style>
