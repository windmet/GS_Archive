<template>
  <dialog ref="dialog" class="onboarding gs-dialog-motion" aria-labelledby="onboarding-title" @cancel.prevent="finish(false)">
    <form class="onboarding-sheet" method="dialog" @submit.prevent="next">
      <header class="onboarding-header">
        <span class="onboarding-brand">SideM <b>资料馆</b></span>
        <ol class="onboarding-steps" aria-label="设置步骤">
          <li v-for="(item, index) in STEPS" :key="item" :aria-current="index === step ? 'step' : undefined" :class="{ done: index < step }"><span>{{ index + 1 }}</span>{{ item }}</li>
        </ol>
        <button class="onboarding-skip" type="button" @click="finish(false)">跳过</button>
      </header>

      <section v-if="step === 0" class="onboarding-body">
        <h1 id="onboarding-title" ref="heading" tabindex="-1">欢迎回到 315 事务所</h1>
        <p class="onboarding-lede">很多台词是对着制作人说的。先告诉偶像们怎么称呼你——剧情、首页与卡面里的「〇〇〇〇P」都会换成你的名字。</p>
        <ProducerNameSetting class="onboarding-name" />
      </section>

      <section v-else-if="step === 1" class="onboarding-body">
        <h1 id="onboarding-title" ref="heading" tabindex="-1">选一位担当</h1>
        <p class="onboarding-lede">资料馆首页会围绕担当展开：他的故事、卡片、歌曲，以及随时能去的主页。以后可以在设置里更换。</p>
        <ArchiveIdolPickerPanel v-model="favorite" class="onboarding-picker" :idols="idols" :idol-name="idolName" :idol-search="idolSearch" />
      </section>

      <section v-else class="onboarding-body onboarding-ready">
        <ArchiveIdolAvatar v-if="favoriteIdol" :idol-code="favoriteIdol.id" :accent-color="favoriteIdol.color" :size="96" decorative />
        <h1 id="onboarding-title" ref="heading" tabindex="-1">{{ favoriteIdol ? `${favoriteName}在事务所等你` : '准备好了' }}</h1>
        <p class="onboarding-lede">{{ canOpenHome
          ? `在${favoriteName}的主页，可以听他打招呼、换衣装、点他说话。之后从资料馆首页的「我的担当」随时回来。`
          : '资料馆里有全部故事、歌曲、卡片与活动。偶像主页在左侧导航的最上方，选一位偶像就能听他说话。' }}</p>
      </section>

      <footer class="onboarding-actions">
        <button v-if="step > 0" class="onboarding-back" type="button" @click="step--">上一步</button>
        <template v-if="step < STEPS.length - 1">
          <button class="onboarding-primary" type="submit">{{ step === 1 && !favorite ? '暂不选择' : '下一步' }}</button>
        </template>
        <template v-else>
          <button v-if="canOpenHome" class="onboarding-secondary" type="button" @click="finish(false)">先逛逛资料馆</button>
          <button class="onboarding-primary" type="button" @click="finish(canOpenHome)">{{ canOpenHome ? `去见${favoriteName}` : '进入资料馆' }}</button>
        </template>
      </footer>
    </form>
  </dialog>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
import ProducerNameSetting from './ProducerNameSetting.vue'

// First visit: the archive opens behind this sheet, which asks for the producer name (many lines
// address the producer) and a favourite idol, then points at that idol's home.
const STEPS = ['称呼', '担当', '出发']
const props = defineProps({
  idols: { type: Array, default: () => [] },
  homeIdolIds: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' },
  idolSearch: { type: Function, default: () => '' },
  initialFavorite: { type: String, default: '' },
})
const emit = defineEmits(['finish'])
const dialog = ref(null), heading = ref(null), step = ref(0), favorite = ref(props.initialFavorite)
const favoriteIdol = computed(() => props.idols.find(idol => idol.id === favorite.value) || null)
const favoriteName = computed(() => favoriteIdol.value ? props.idolName(favoriteIdol.value.id) || favoriteIdol.value.name : '')
const canOpenHome = computed(() => Boolean(favoriteIdol.value) && props.homeIdolIds.includes(favoriteIdol.value.id))

function next() { if (step.value < STEPS.length - 1) step.value++ }
function finish(openHome) {
  dialog.value?.close()
  emit('finish', { preferredIdol: favoriteIdol.value?.id || '', openHome })
}
watch(step, () => nextTick(() => heading.value?.focus({ preventScroll: true })))
onMounted(() => { dialog.value?.showModal(); heading.value?.focus({ preventScroll: true }) })
</script>

<style scoped>
.onboarding { width: min(680px, calc(100vw - 32px)); max-height: min(760px, calc(100dvh - 48px)); padding: 0; border: 0; border-radius: var(--gs-radius-surface); background: var(--gs-paper); color: var(--gs-ink); box-shadow: var(--gs-shadow-float); font-family: var(--gs-font-body); }
.onboarding::backdrop { background: rgb(14 26 46 / 48%); backdrop-filter: blur(3px); }
.onboarding-sheet { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; max-height: inherit; }
.onboarding-header { display: flex; align-items: center; gap: var(--gs-space-5); padding: var(--gs-space-5) var(--gs-space-7); border-bottom: 1px solid var(--gs-line); }
.onboarding-brand { font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-style: italic; font-weight: var(--gs-weight-bold); white-space: nowrap; }
.onboarding-brand b { margin-left: 4px; font-family: var(--gs-font-body); font-size: var(--gs-text-meta); font-style: normal; color: var(--gs-ink-3); }
.onboarding-steps { display: flex; gap: var(--gs-space-5); flex: 1; justify-content: center; margin: 0; padding: 0; list-style: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.onboarding-steps li { display: flex; align-items: center; gap: 6px; }
.onboarding-steps span { display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid currentColor; border-radius: var(--gs-radius-pill); font-family: var(--gs-font-stage); font-size: var(--gs-text-caption); }
.onboarding-steps [aria-current] { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.onboarding-steps [aria-current] span, .onboarding-steps .done span { border-color: var(--gs-mint); background: var(--gs-mint); color: var(--gs-surface); }
.onboarding-skip { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-3); border: 0; background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
.onboarding-body { display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: var(--gs-space-5); min-height: 0; overflow-y: auto; padding: var(--gs-space-8) var(--gs-space-7); }
.onboarding-body h1 { margin: 0; font-size: var(--gs-text-title); line-height: 1.3; }
.onboarding-body h1:focus { outline: none; }
.onboarding-lede { margin: 0; max-width: 46em; color: var(--gs-ink-2); line-height: 1.75; }
.onboarding-ready { justify-items: center; text-align: center; padding-block: var(--gs-space-9); }
.onboarding-actions { display: flex; justify-content: flex-end; gap: var(--gs-space-3); padding: var(--gs-space-5) var(--gs-space-7); border-top: 1px solid var(--gs-line); }
.onboarding-actions button { min-height: var(--gs-control-normal); padding: 0 var(--gs-space-6); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-weight: var(--gs-weight-semibold); cursor: pointer; }
.onboarding-actions .onboarding-back { margin-right: auto; border-color: transparent; background: none; color: var(--gs-ink-3); }
.onboarding-actions .onboarding-primary { border-color: var(--gs-mint-ink); background: var(--gs-mint-ink); color: var(--gs-surface); }
.onboarding button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: 2px; }

/* The shared name field, restated in the archive's quieter voice. */
.onboarding-name { padding: 0; border: 0; background: none; color: var(--gs-ink); }
.onboarding-name :deep(input) { min-height: var(--gs-control-touch); border-color: var(--gs-line); border-radius: var(--gs-radius-field); font-size: var(--gs-text-subtitle); }
.onboarding-name :deep(.producer-preview) { padding: var(--gs-space-4) var(--gs-space-5); border-left: 3px solid var(--gs-mint); background: var(--gs-surface); }

@media (max-width: 760px) {
  .onboarding { width: 100vw; max-width: none; max-height: 92dvh; margin: auto 0 0; border-radius: var(--gs-radius-surface); border-bottom-left-radius: 0; border-bottom-right-radius: 0; --gs-dialog-travel: translateY(100%); --gs-dialog-duration: var(--gs-motion-sheet); }
  .onboarding-header { flex-wrap: wrap; padding: var(--gs-space-4) var(--gs-space-5); gap: var(--gs-space-3); }
  .onboarding-steps { order: 3; flex-basis: 100%; justify-content: start; }
  .onboarding-skip { margin-left: auto; min-height: var(--gs-control-touch); }
  .onboarding-body { padding: var(--gs-space-6) var(--gs-space-5); }
  .onboarding-body h1 { font-size: var(--gs-text-section); }
  .onboarding-actions { padding: var(--gs-space-4) var(--gs-space-5) calc(var(--gs-space-4) + env(safe-area-inset-bottom, 0px)); }
  .onboarding-actions button { min-height: var(--gs-control-touch); flex: 1; }
  .onboarding-actions .onboarding-back { flex: 0 0 auto; }
}
</style>
