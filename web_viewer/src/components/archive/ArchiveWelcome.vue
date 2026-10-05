<template>
  <ArchiveProducerSettings v-if="canCancel && !selectionOnly" :preferences="preferences" :idols="idols" :preferred-idols="preferredIdols" :idol-name="idolName" :idol-search="idolSearch" :notice="notice" @cancel="emit('cancel')" @save-startup="emit('save-startup',$event)" @save-preferred="emit('save-preferred',$event)" @settings-applied="emit('settings-applied')" />
  <section v-else aria-labelledby="welcome-title" class="idol-select" data-archive-scroll-container>
    <div class="idol-select-body">
      <header class="idol-select-head">
        <button v-if="canCancel" class="idol-select-back" type="button" aria-label="返回来源页" @click="emit('cancel')"><ArrowLeft :size="20" /></button>
        <h1 id="welcome-title" ref="heading" tabindex="-1">选择偶像</h1>
        <ArchiveLanguageSwitch />
      </header>
      <p class="idol-select-lede">{{ targetLabel === '首页' ? '选择的偶像将用于首页，可随时更改。' : '只用于本次打开，不改变已保存的启动方式。' }}</p>
      <p v-if="notice" class="idol-select-notice" role="status">{{ notice }}</p>
      <p v-if="!dataReady" class="idol-select-notice" role="status">正在准备人物名单…</p>
      <ArchiveIdolPickerPanel v-model="selectedIdol" :idols="idols" :idol-name="idolName" :idol-search="idolSearch" />
    </div>
    <footer class="idol-select-actions" aria-label="确认偶像与打开页面">
      <p class="idol-select-summary" role="status">{{ selectedName ? `已选：${selectedName}` : '请选择一位偶像' }}<small>打开{{ targetLabel }}</small></p>
      <label class="idol-select-remember"><input v-model="setPreferred" type="checkbox" /> 同时设为我的担当</label>
      <div class="idol-select-buttons">
        <button class="idol-select-secondary" type="button" :disabled="!idols.length" @click="chooseRandom"><Shuffle :size="16" />随机一位</button>
        <button class="idol-select-primary" type="button" :disabled="!selectedName" @click="chooseIdol">打开{{ targetLabel }}</button>
      </div>
    </footer>
  </section>
</template>
<script setup>
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import ArchiveProducerSettings from './ArchiveProducerSettings.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Shuffle } from '@lucide/vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
const props = defineProps({
  idols: { type: Array, default: () => [] }, preferredIdols: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' },
  preferences: { type: Object, default: () => ({}) }, notice: { type: String, default: '' },
  dataReady: Boolean, selectionOnly: Boolean, canCancel: Boolean,
  targetLabel: { type: String, default: '立绘主页' },
})
// The producer settings page (opened from the archive) or the idol picker for a page that needs one.
// The first-run mode chooser is retired: new visitors start in the archive with ArchiveOnboarding.
// The SSR wallpaper lives on the portal; this page is plain paper.
const emit = defineEmits(['cancel', 'choose-idol', 'save-startup', 'save-preferred', 'settings-applied'])
const heading = ref(null)
const selectedIdol = ref(props.preferences.startupIdol || props.preferences.preferredIdol || ''), setPreferred = ref(!props.preferences.preferredIdol)
const selectedName = computed(() => {
  const idol = props.idols.find(idol => idol.id === selectedIdol.value)
  return idol ? props.idolName(idol.id) || idol.name || '' : ''
})
watch(() => props.idols, idols => {
  if (!idols.some(x => x.id === selectedIdol.value)) selectedIdol.value = idols.some(x => x.id === props.preferences.startupIdol) ? props.preferences.startupIdol : ''
}, { immediate: true })
onMounted(() => { heading.value?.focus({ preventScroll: true }) })
function chooseRandom() { if (props.idols.length) selectedIdol.value = props.idols[Math.floor(Math.random() * props.idols.length)].id }
function chooseIdol() {
  if (props.idols.some(x => x.id === selectedIdol.value)) emit('choose-idol', { idolCode: selectedIdol.value, rememberStartup: false, setPreferred: setPreferred.value })
}
</script>
<style scoped>
.idol-select { display: flex; flex-direction: column; height: 100%; overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); container: idol-select / inline-size; }
.idol-select-body { flex: 1 0 auto; width: 100%; max-width: 880px; margin: 0 auto; padding: var(--gs-space-8) var(--gs-space-7) var(--gs-space-6); box-sizing: border-box; }
.idol-select-head { display: flex; align-items: center; gap: var(--gs-space-3); }
.idol-select-head h1 { flex: 1; min-width: 0; margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); outline: none; }
.idol-select-back { display: grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); margin-left: calc(-1 * var(--gs-space-3)); padding: 0; border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-2); cursor: pointer; }
.idol-select-lede { margin: var(--gs-space-3) 0 var(--gs-space-6); color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.7; }
.idol-select-notice { margin: 0 0 var(--gs-space-4); padding-left: var(--gs-space-4); border-left: 2px solid var(--gs-mint); color: var(--gs-ink-2); font-size: var(--gs-text-ui); line-height: 1.7; }
/* The decision stays in reach: a bar pinned to the bottom of the page. */
.idol-select-actions { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3) var(--gs-space-5); padding: var(--gs-space-4) max(var(--gs-space-7), calc((100% - 880px) / 2 + var(--gs-space-7))); border-top: 1px solid var(--gs-line); background: var(--gs-surface); }
.idol-select-summary { flex: 1 1 200px; min-width: 0; margin: 0; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.idol-select-summary small { display: block; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.idol-select-remember { display: flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-compact); color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.idol-select-remember input { accent-color: var(--gs-mint-ink); }
.idol-select-buttons { display: flex; gap: var(--gs-space-3); }
.idol-select-buttons button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-5); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.idol-select-buttons .idol-select-primary { border-color: var(--gs-ink); background: var(--gs-ink); color: var(--gs-paper); }
.idol-select-buttons button:disabled { opacity: .45; cursor: default; }
.idol-select :is(button, input):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@container idol-select (max-width: 560px) {
  .idol-select-body { padding: var(--gs-space-5) var(--gs-space-5) var(--gs-space-4); }
  .idol-select-head h1 { font-size: var(--gs-text-section); }
  .idol-select-actions { padding: var(--gs-space-3) var(--gs-space-5) calc(var(--gs-space-3) + var(--gs-safe-bottom)); }
  .idol-select-remember { flex-basis: 100%; order: 2; }
  .idol-select-buttons { flex-basis: 100%; order: 3; }
  .idol-select-buttons button { flex: 1; min-height: var(--gs-control-touch); }
  .idol-select-buttons .idol-select-secondary { flex: 0 0 auto; }
}
</style>
