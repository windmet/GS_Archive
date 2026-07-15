<template>
  <section class="work-page" :style="{ '--work-accent': idol?.color || '#168f87' }">
    <header class="work-header">
      <div class="idol-heading">
        <img v-if="idol?.idol_code" :src="idolIcon(idol.idol_code)" :alt="idol.display_name" />
        <div>
          <span>WORK ARCHIVE</span>
          <h2>{{ idol?.display_name || '工作剧情' }}</h2>
          <p>{{ idol?.work_type_name || 'お仕事' }}</p>
        </div>
      </div>
      <div class="idol-controls">
        <button title="上一位偶像" @click="moveIdol(-1)"><ChevronLeft :size="18" /></button>
        <label>
          <span>偶像</span>
          <select :value="idol?.idol_code" @change="emit('select-idol', $event.target.value)">
            <option v-for="entry in idols" :key="entry.idol_code" :value="entry.idol_code">
              {{ entry.display_name }} · {{ shortType(entry.work_type_name) }}
            </option>
          </select>
        </label>
        <button title="下一位偶像" @click="moveIdol(1)"><ChevronRight :size="18" /></button>
      </div>
    </header>

    <div v-if="idol" class="work-body">
      <div class="work-overview">
        <div><strong>{{ idol.short_stories.length }}</strong><span>短剧情</span></div>
        <div><strong>{{ idol.scene_lines.length }}</strong><span>场景台词</span></div>
        <div><strong>{{ totalVoices }}</strong><span>语音</span></div>
        <div><strong>{{ namedLocations }}</strong><span>已命名场景</span></div>
      </div>

      <nav class="content-tabs" aria-label="工作内容">
        <button :class="{ active: mode === 'stories' }" @click="mode = 'stories'"><BookOpen :size="16" /> Short Story</button>
        <button :class="{ active: mode === 'lines' }" @click="mode = 'lines'"><MessageSquareText :size="16" /> 场景台词</button>
      </nav>

      <section v-if="mode === 'stories'" class="content-section">
        <div class="section-heading">
          <div><span>PLAYABLE STORIES</span><h3>工作短剧情</h3></div>
          <p>工作过程中出现的多段剧情</p>
        </div>
        <div class="story-grid">
          <article v-for="story in idol.short_stories" :key="story.id" class="story-card">
            <div class="story-visual">
              <img :src="backgroundUrl(story.background_resource_id)" :alt="locationLabel(story)" />
              <span>{{ locationLabel(story) }}</span>
            </div>
            <div class="story-copy">
              <small>{{ story.resource_id }}</small>
              <h4>{{ story.title }}</h4>
              <p>{{ story.dialogue_preview }}</p>
              <div class="story-footer">
                <span>{{ story.dialogue_count }} dialogues · {{ story.voice_count }} voices</span>
                <button :disabled="!story.compiled_exists" title="播放工作短剧情" @click="emit('play', story.compiled_file)"><Play :size="17" fill="currentColor" /></button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section v-else class="content-section">
        <div class="section-heading">
          <div><span>SCENE LINES</span><h3>工作场景台词</h3></div>
          <p>单句语音与对应工作场景</p>
        </div>
        <div class="line-list">
          <article v-for="line in idol.scene_lines" :key="line.id" class="line-row">
            <img :src="backgroundUrl(line.background_resource_id)" :alt="locationLabel(line)" />
            <div class="line-copy">
              <span>{{ locationLabel(line) }}</span>
              <p>{{ line.dialogue_preview }}</p>
              <small>{{ line.resource_id }} · {{ line.model_resource_id }}</small>
            </div>
            <button :disabled="!line.compiled_exists" title="播放场景台词" @click="emit('play', line.compiled_file)"><Play :size="16" fill="currentColor" /></button>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BookOpen, ChevronLeft, ChevronRight, MessageSquareText, Play } from '@lucide/vue'

const props = defineProps({ idol: { type: Object, default: null }, idols: { type: Array, default: () => [] } })
const emit = defineEmits(['select-idol', 'play'])
const mode = ref('stories')
const totalVoices = computed(() => [...(props.idol?.short_stories || []), ...(props.idol?.scene_lines || [])].reduce((sum, item) => sum + (item.voice_count || 0), 0))
const namedLocations = computed(() => [...(props.idol?.short_stories || []), ...(props.idol?.scene_lines || [])].filter(item => item.background_name).length)

function moveIdol(delta) {
  const index = props.idols.findIndex(entry => entry.idol_code === props.idol?.idol_code)
  if (index < 0 || !props.idols.length) return
  const next = props.idols[(index + delta + props.idols.length) % props.idols.length]
  emit('select-idol', next.idol_code)
}
function shortType(name = '') { return name.replace('のお仕事', '') }
function idolIcon(code) { return `/assets/idols/icons/image_chara_icon_${code}.png` }
function backgroundUrl(id) { return id ? `/assets/bg/${id}.png` : '' }
function locationLabel(entry) { return entry.background_name || entry.background_resource_id || '场景未记录' }
</script>

<style scoped>
.work-page { height: 100%; overflow-x: hidden; overflow-y: auto; background: #f4f6f7; color: #26343c; }.work-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 22px max(24px, calc((100% - 1080px) / 2)); border-bottom: 1px solid #dfe5e7; background: #fff; }.idol-heading { display: flex; align-items: center; gap: 14px; min-width: 0; }.idol-heading img { width: 62px; height: 62px; border: 3px solid var(--work-accent); border-radius: 50%; object-fit: cover; }.idol-heading span, .section-heading span { color: var(--work-accent); font-size: .58rem; font-weight: 800; }.idol-heading h2 { margin: 3px 0; font-size: 1.3rem; }.idol-heading p { margin: 0; color: #738087; font-size: .65rem; }.idol-controls { display: flex; align-items: end; gap: 6px; }.idol-controls > button { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #d6dee1; border-radius: 5px; background: #fff; color: #4f5d64; cursor: pointer; }.idol-controls label { display: flex; flex-direction: column; gap: 4px; }.idol-controls label span { color: #7a878d; font-size: .56rem; }.idol-controls select { min-width: 230px; height: 34px; padding: 0 30px 0 10px; border: 1px solid #d5dde0; border-radius: 5px; background: #fff; color: #28363d; font: inherit; font-size: .67rem; }
.work-body { max-width: 1080px; margin: 0 auto; padding: 18px 24px 38px; }.work-overview { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); border: 1px solid #dfe5e7; border-radius: 6px; background: #fff; }.work-overview div { display: flex; flex-direction: column; gap: 2px; padding: 12px 15px; border-right: 1px solid #e5eaec; }.work-overview div:last-child { border-right: 0; }.work-overview strong { font-size: .88rem; }.work-overview span { color: #7b888e; font-size: .56rem; }.content-tabs { display: flex; gap: 3px; margin: 18px 0 0; border-bottom: 1px solid #dce3e5; }.content-tabs button { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 13px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #718087; cursor: pointer; font: inherit; font-size: .67rem; }.content-tabs button.active { border-color: var(--work-accent); color: #26343c; font-weight: 800; }.content-section { padding-top: 18px; }.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 11px; }.section-heading h3 { margin: 3px 0 0; font-size: 1rem; }.section-heading p { margin: 0; color: #78858b; font-size: .62rem; }
.story-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }.story-card { display: grid; grid-template-columns: 148px minmax(0,1fr); overflow: hidden; min-height: 150px; border: 1px solid #dce3e5; border-radius: 6px; background: #fff; }.story-visual { position: relative; min-height: 150px; background: #dfe5e7; }.story-visual img { width: 100%; height: 100%; object-fit: cover; }.story-visual span { position: absolute; right: 6px; bottom: 6px; left: 6px; overflow: hidden; padding: 4px 6px; border-radius: 3px; background: rgba(25,35,40,.78); color: #fff; font-size: .52rem; text-overflow: ellipsis; white-space: nowrap; }.story-copy { display: flex; flex-direction: column; min-width: 0; padding: 11px 12px; }.story-copy > small { color: var(--work-accent); font-family: ui-monospace, Consolas, monospace; font-size: .52rem; }.story-copy h4 { margin: 4px 0 6px; font-size: .73rem; line-height: 1.4; }.story-copy p { display: -webkit-box; overflow: hidden; margin: 0; color: #66757c; font-size: .6rem; line-height: 1.5; white-space: pre-line; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }.story-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 8px; }.story-footer span { color: #879399; font-size: .52rem; }.story-footer button, .line-row > button { display: grid; flex: 0 0 auto; place-items: center; width: 32px; height: 32px; border: 1px solid color-mix(in srgb, var(--work-accent) 55%, #dce4e6); border-radius: 50%; background: #fff; color: var(--work-accent); cursor: pointer; }.story-footer button:disabled, .line-row > button:disabled { cursor: not-allowed; opacity: .4; }
.line-list { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; }.line-row { display: grid; grid-template-columns: 88px minmax(0,1fr) 32px; align-items: center; gap: 10px; min-height: 92px; padding: 7px; border: 1px solid #dce3e5; border-radius: 6px; background: #fff; }.line-row > img { width: 88px; height: 76px; border-radius: 4px; object-fit: cover; }.line-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.line-copy span { overflow: hidden; color: var(--work-accent); font-size: .56rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }.line-copy p { display: -webkit-box; overflow: hidden; margin: 0; font-size: .6rem; line-height: 1.4; white-space: pre-line; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }.line-copy small { overflow: hidden; color: #909ba0; font-family: ui-monospace, Consolas, monospace; font-size: .48rem; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 900px) { .line-list { grid-template-columns: repeat(2,minmax(0,1fr)); }.story-card { grid-template-columns: 120px minmax(0,1fr); } }
@media (max-width: 620px) { .work-header { align-items: start; flex-direction: column; padding: 14px 12px; }.idol-heading img { width: 52px; height: 52px; }.idol-controls { width: 100%; }.idol-controls label { flex: 1; }.idol-controls select { width: 100%; min-width: 0; }.work-body { padding: 10px 12px 28px; }.work-overview { grid-template-columns: repeat(2,minmax(0,1fr)); }.work-overview div:nth-child(2) { border-right: 0; }.work-overview div:nth-child(-n+2) { border-bottom: 1px solid #e5eaec; }.section-heading { align-items: start; flex-direction: column; }.story-grid, .line-list { grid-template-columns: 1fr; }.story-card { grid-template-columns: 116px minmax(0,1fr); }.line-row { grid-template-columns: 82px minmax(0,1fr) 32px; }.line-row > img { width: 82px; } }
</style>
