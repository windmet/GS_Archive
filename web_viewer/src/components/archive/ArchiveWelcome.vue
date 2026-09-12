<template>
  <section class="archive-welcome" :class="{ 'selection-only': selectionOnly }" aria-labelledby="welcome-title">
    <div class="welcome-card">
      <header>
        <span class="welcome-brand">SideM Archive</span>
        <h1 id="welcome-title" ref="heading" tabindex="-1">
          {{ selectionOnly ? `选择要打开${targetLabel}的偶像` : '欢迎来到资料馆' }}
        </h1>
        <p>{{ selectionOnly ? '这个选择只用于本次导航，不会自动改写“我的偶像”。' : '选择你希望每次打开资料馆时先看到的入口。之后可以随时更改。' }}</p>
      </header>

      <p v-if="notice" class="welcome-notice" role="status">{{ notice }}</p>

      <div v-if="!selectionOnly && step === 'mode'" class="mode-grid">
        <button class="mode-card light" @click="emit('choose-light')">
          <Library :size="28" />
          <strong>资料馆 / 轻量浏览</strong>
          <span>先看故事、歌曲、偶像与卡片，不准备人物舞台。</span>
        </button>
        <button class="mode-card immersive" @click="step = 'idol'">
          <Sparkles :size="28" />
          <strong>游戏风首页</strong>
          <span>选择一位偶像，再进入带人物与语音的首页。</span>
        </button>
      </div>

      <div v-else class="idol-step">
        <div class="idol-step-heading">
          <button v-if="!selectionOnly" class="text-button" @click="step = 'mode'"><ArrowLeft :size="16" />返回入口选择</button>
          <span v-if="!dataReady">正在准备可用人物名单…</span>
        </div>
        <div v-if="idols.length" class="idol-grid" role="group" aria-label="首页偶像">
          <button
            v-for="idol in idols"
            :key="idol.id"
            class="idol-choice"
            :class="{ selected: selectedIdol === idol.id }"
            :aria-pressed="selectedIdol === idol.id"
            @click="selectedIdol = idol.id"
          >
            <img :src="idolIcon(idol.id)" :alt="idol.name" />
            <span><strong>{{ idol.name }}</strong><small>{{ idol.unitName || '315 STARS' }}</small></span>
          </button>
        </div>
        <div class="idol-actions">
          <label><input v-model="setPreferred" type="checkbox" /> 同时设为“我的偶像”</label>
          <button class="random-button" :disabled="!idols.length" @click="chooseRandom"><Shuffle :size="17" />随机一位</button>
          <button class="primary-button" :disabled="!selectedIdol" @click="chooseIdol">打开{{ targetLabel }}</button>
        </div>
      </div>

      <footer v-if="!selectionOnly">
        <button class="later-button" @click="emit('choose-later')">稍后再选，先进入 Portal</button>
        <div class="preferred-setting">
          <label>
            <span>我的偶像</span>
            <select v-model="preferredDraft">
              <option value="">暂不设置</option>
              <option v-for="idol in idols" :key="idol.id" :value="idol.id">{{ idol.name }} · {{ idol.unitName }}</option>
            </select>
          </label>
          <button @click="emit('save-preferred', preferredDraft || null)">保存</button>
        </div>
        <button class="clear-button" @click="emit('clear-preferences')">清除启动与我的偶像设置</button>
      </footer>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { ArrowLeft, Library, Shuffle, Sparkles } from '@lucide/vue'

const props = defineProps({
  idols: { type: Array, default: () => [] },
  preferences: { type: Object, default: () => ({}) },
  notice: { type: String, default: '' },
  dataReady: { type: Boolean, default: false },
  selectionOnly: { type: Boolean, default: false },
  targetLabel: { type: String, default: '游戏风首页' },
})
const emit = defineEmits(['choose-light', 'choose-later', 'choose-idol', 'save-preferred', 'clear-preferences'])
const heading = ref(null)
const step = ref(props.selectionOnly ? 'idol' : 'mode')
const selectedIdol = ref('')
const setPreferred = ref(false)
const preferredDraft = ref(props.preferences.preferredIdol || '')

watch(() => props.selectionOnly, value => { step.value = value ? 'idol' : 'mode' })
watch(() => props.preferences.preferredIdol, value => { preferredDraft.value = value || '' })
watch(() => props.idols, idols => {
  if (idols.some(idol => idol.id === selectedIdol.value)) return
  const remembered = props.preferences.startupIdol
  selectedIdol.value = idols.some(idol => idol.id === remembered) ? remembered : ''
}, { immediate: true })
onMounted(() => heading.value?.focus({ preventScroll: true }))

function idolIcon(idolCode) {
  return `/assets/idols/icons/image_chara_icon_${idolCode}.png`
}
function chooseRandom() {
  if (!props.idols.length) return
  selectedIdol.value = props.idols[Math.floor(Math.random() * props.idols.length)].id
}
function chooseIdol() {
  if (!selectedIdol.value) return
  emit('choose-idol', {
    idolCode: selectedIdol.value,
    rememberStartup: !props.selectionOnly,
    setPreferred: setPreferred.value,
  })
}
</script>

<style scoped>
.archive-welcome { min-height: 100%; overflow-y: auto; padding: 42px 24px 70px; background: radial-gradient(circle at 15% 0%, #dff7f3 0, transparent 36%), linear-gradient(150deg,#f7fbfb,#edf1f8); color: #173c48; font-family: Inter,"Noto Sans SC","Noto Sans JP",system-ui,sans-serif; }
.welcome-card { width: min(920px,100%); margin: 0 auto; padding: 34px; border: 1px solid #d7e6e7; border-radius: 28px; background: rgba(255,255,255,.92); box-shadow: 0 24px 60px rgba(32,73,83,.1); }
.welcome-brand { color: #168f87; font-size: 13px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
header h1 { margin: 10px 0 8px; font-size: clamp(30px,5vw,52px); line-height: 1.12; outline: none; }
header p { max-width: 680px; margin: 0; color: #607982; font-size: 16px; line-height: 1.7; }
.welcome-notice { padding: 10px 13px; border-radius: 10px; background: #fff4d9; color: #6d5420; font-size: 14px; }
.mode-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; margin-top: 32px; }
.mode-card { display: flex; min-height: 190px; flex-direction: column; align-items: flex-start; gap: 13px; padding: 26px; border: 1px solid #cfe1e3; border-radius: 22px; background: #f5fbfa; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.mode-card.immersive { background: #eef2fb; }
.mode-card strong { font-size: 20px; }.mode-card span { color: #637982; line-height: 1.6; }
.mode-card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(28,83,92,.09); }
.idol-step { margin-top: 28px; }.idol-step-heading { display: flex; justify-content: space-between; gap: 16px; min-height: 36px; color: #67818a; font-size: 13px; }
.text-button,.later-button,.clear-button { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: #176f69; cursor: pointer; font: inherit; }
.idol-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; max-height: 390px; overflow-y: auto; padding: 3px; }
.idol-choice { display: grid; grid-template-columns: 52px minmax(0,1fr); align-items: center; gap: 10px; min-height: 68px; padding: 8px; border: 1px solid #dce7e8; border-radius: 14px; background: #fff; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.idol-choice.selected { border-color: #168f87; outline: 2px solid #bce7e2; }.idol-choice img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; }
.idol-choice span { display: flex; min-width: 0; flex-direction: column; gap: 3px; }.idol-choice strong,.idol-choice small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.idol-choice strong { font-size: 14px; }.idol-choice small { color: #71858c; font-size: 11px; }
.idol-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 18px; }.idol-actions label { margin-right: auto; color: #526d76; font-size: 13px; }
.random-button,.primary-button,.preferred-setting button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 16px; border: 1px solid #bcd9d7; border-radius: 22px; background: #fff; color: #176f69; cursor: pointer; font: inherit; font-weight: 700; }
.primary-button { border-color: #168f87; background: #168f87; color: #fff; }.primary-button:disabled,.random-button:disabled { cursor: default; opacity: .45; }
footer { display: grid; gap: 14px; margin-top: 28px; padding-top: 22px; border-top: 1px solid #e0e9ea; }.later-button { justify-self: start; min-height: 44px; }
.preferred-setting { display: flex; align-items: end; gap: 8px; }.preferred-setting label { display: flex; flex: 1; flex-direction: column; gap: 5px; color: #657b83; font-size: 12px; }.preferred-setting select { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid #cfdee0; border-radius: 10px; background: #fff; color: #203f48; font: inherit; }
.clear-button { justify-self: start; color: #8b4e4e; font-size: 13px; }
button:focus-visible,select:focus-visible,input:focus-visible { outline: 3px solid #37a9a1; outline-offset: 3px; }
@media (max-width:700px){.archive-welcome{padding:18px 12px 76px}.welcome-card{padding:22px 16px;border-radius:20px}.mode-grid{grid-template-columns:1fr}.mode-card{min-height:140px}.idol-grid{grid-template-columns:1fr;max-height:430px}.idol-actions{align-items:stretch;flex-direction:column}.idol-actions label{margin-right:0}.preferred-setting{align-items:stretch;flex-direction:column}.preferred-setting button{align-self:flex-start}}
@media (prefers-reduced-motion:reduce){.mode-card{transition:none}}
</style>
