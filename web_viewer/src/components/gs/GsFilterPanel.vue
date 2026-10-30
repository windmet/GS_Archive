<template>
  <div class="gs-filter-panel">
    <button ref="trigger" type="button" class="gs-filter-panel-trigger" aria-haspopup="dialog" :aria-expanded="open" @click="open ? close(true) : show()">
      <SlidersHorizontal :size="17" aria-hidden="true" />{{ label }}<span v-if="active.length" class="gs-filter-panel-count" :aria-label="`${active.length} 项生效`">{{ active.length }}</span>
    </button>
    <button v-for="item in active" :key="item.key" type="button" class="gs-filter-panel-token" :aria-label="`移除筛选：${item.label}`" @click="set(item.key, neutral)">
      <i v-if="item.swatch" class="gs-filter-panel-swatch" :style="{ backgroundImage: item.swatch }" aria-hidden="true"></i>{{ item.label }}<X :size="14" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <div v-if="open" class="gs-filter-panel-layer" :class="{ 'is-sheet': sheet }" @pointerdown.self="close(false)">
        <div ref="panel" class="gs-filter-panel-surface" role="dialog" aria-modal="true" :aria-label="label" :style="position" @keydown="onKey">
          <header v-if="sheet" class="gs-filter-panel-head">
            <strong>{{ label }}</strong>
            <button type="button" class="gs-filter-panel-close" aria-label="关闭" @click="close(true)"><X :size="20" aria-hidden="true" /></button>
          </header>
          <div class="gs-filter-panel-body">
            <template v-if="sheet && $slots.sheet"><slot name="sheet" /><hr /></template>
            <section v-for="section in sections" :key="section.key" class="gs-filter-panel-section" :aria-label="section.label">
              <h3>{{ section.label }}</h3>
              <div class="gs-filter-panel-options">
                <button v-for="option in section.options" :key="String(option.value)" type="button" class="gs-filter-panel-option"
                  :aria-pressed="(modelValue[section.key] ?? neutral) === option.value" @click="set(section.key, option.value)">
                  <i v-if="option.swatch" class="gs-filter-panel-swatch" :style="{ backgroundImage: option.swatch }" aria-hidden="true"></i>{{ option.label }}
                </button>
              </div>
            </section>
          </div>
          <footer class="gs-filter-panel-foot">
            <button type="button" class="gs-filter-panel-clear" :disabled="!active.length" @click="clear">清除</button>
            <button type="button" class="gs-filter-panel-done" @click="close(true)">{{ resultLabel || '完成' }}</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { SlidersHorizontal, X } from '@lucide/vue'

// Several filters behind one 「筛选」 button: a floating panel under it on wide screens, a bottom sheet on phones
// (手机端通用模式 1). Every section's values lie open as chips, so a long list such as the units never scrolls sideways.
// The filters in force follow the button as removable chips. sections: [{ key, label, options: [{ value, label, swatch? }] }];
// modelValue: { [key]: value }, where `neutral` means no filter. The sheet slot holds what only the sheet carries (on
// wide screens a table sorts by its column headers; a phone list sorts here). Choices apply at once; the last button
// only closes, and names the result count it is given.
const props = defineProps({
  modelValue: { type: Object, required: true },
  sections: { type: Array, required: true },
  label: { type: String, default: '筛选' },
  neutral: { type: [String, Number], default: 'all' },
  resultLabel: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const trigger = ref(null), panel = ref(null)
const open = ref(false), sheet = ref(false), position = ref({})
const active = computed(() => props.sections.flatMap(section => {
  const value = props.modelValue[section.key] ?? props.neutral
  const option = value === props.neutral ? null : section.options.find(entry => entry.value === value)
  return option ? [{ key: section.key, label: option.label, swatch: option.swatch }] : []
}))

function set(key, value) { emit('update:modelValue', { ...props.modelValue, [key]: value }) }
function clear() { emit('update:modelValue', Object.fromEntries(props.sections.map(section => [section.key, props.neutral]))) }
async function show() {
  sheet.value = matchMedia('(max-width: 760px)').matches
  if (!sheet.value) {
    const rect = trigger.value.getBoundingClientRect()
    const width = Math.min(720, innerWidth - 32)
    position.value = { left: `${Math.max(16, Math.min(rect.left, innerWidth - width - 16))}px`, top: `${rect.bottom + 8}px`, width: `${width}px` }
  } else position.value = {}
  open.value = true
  document.addEventListener('keydown', onDocumentKey, true)
  await nextTick()
  const chosen = panel.value?.querySelector('.gs-filter-panel-option[aria-pressed=true]')
  const target = chosen || panel.value?.querySelector('button')
  target?.focus()
}
function close(returnFocus) {
  open.value = false
  document.removeEventListener('keydown', onDocumentKey, true)
  if (returnFocus) nextTick(() => trigger.value?.focus())
}
function onDocumentKey(event) { if (event.key === 'Escape') { event.stopPropagation(); close(true) } }
// Tab stays inside the panel while it is open.
function onKey(event) {
  if (event.key !== 'Tab') return
  const items = [...panel.value.querySelectorAll('button:not(:disabled)')]
  const first = items[0], last = items.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKey, true))
</script>

<style scoped>
.gs-filter-panel { display: contents; }
.gs-filter-panel-trigger { display: inline-flex; flex: none; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); white-space: nowrap; cursor: pointer; }
.gs-filter-panel-trigger[aria-expanded=true] { border-color: var(--gs-selected-line); color: var(--gs-selected-ink); }
.gs-filter-panel-count { display: inline-grid; place-items: center; box-sizing: border-box; min-width: 20px; height: 20px; padding: 0 var(--gs-space-2); border-radius: var(--gs-radius-pill); background: var(--gs-action-bg); color: var(--gs-action-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.gs-filter-panel-token { display: inline-flex; flex: none; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-compact); padding: 0 var(--gs-space-3) 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-pill); background: var(--gs-selected-bg); color: var(--gs-selected-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); white-space: nowrap; cursor: pointer; }
.gs-filter-panel-swatch { flex: none; width: 14px; height: 14px; background-position: center; background-repeat: no-repeat; background-size: contain; }
@media (hover: hover) {
  .gs-filter-panel-trigger:not([aria-expanded=true]):hover, .gs-filter-panel-option:not([aria-pressed=true]):hover, .gs-filter-panel-clear:not(:disabled):hover { background: var(--gs-mint-wash); }
}
@media (pointer: coarse) { .gs-filter-panel-trigger, .gs-filter-panel-token { min-height: var(--gs-control-touch); } }
.gs-filter-panel-layer { position: fixed; inset: 0; z-index: 1200; }
.gs-filter-panel-surface { position: fixed; display: flex; flex-direction: column; box-sizing: border-box; max-height: min(70vh, 560px); border-radius: var(--gs-radius-panel); background: var(--gs-surface); box-shadow: var(--gs-shadow-float); color: var(--gs-ink); font-family: var(--gs-font-body); }
.gs-filter-panel-head { display: flex; align-items: center; justify-content: space-between; padding: var(--gs-space-2) var(--gs-space-2) 0 var(--gs-space-5); }
.gs-filter-panel-head strong { font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.gs-filter-panel-close { display: inline-grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); cursor: pointer; }
.gs-filter-panel-body { display: flex; flex: 1; flex-direction: column; gap: var(--gs-space-6); min-height: 0; overflow-y: auto; padding: var(--gs-space-5); overscroll-behavior: contain; }
.gs-filter-panel-body hr { width: 100%; margin: 0; border: 0; border-top: 1px solid var(--gs-line); }
.gs-filter-panel-section h3, .gs-filter-panel-body :slotted(h3) { margin: 0 0 var(--gs-space-3); color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.gs-filter-panel-options { display: flex; flex-wrap: wrap; gap: var(--gs-space-3); }
.gs-filter-panel-option { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: transparent; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); white-space: nowrap; cursor: pointer; }
.gs-filter-panel-option[aria-pressed=true] { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); font-weight: var(--gs-weight-semibold); }
.gs-filter-panel-foot { display: flex; justify-content: flex-end; gap: var(--gs-space-3); padding: var(--gs-space-4) var(--gs-space-5); border-top: 1px solid var(--gs-line); }
.gs-filter-panel-foot button { min-height: var(--gs-control-touch); padding: 0 var(--gs-space-5); border-radius: var(--gs-radius-control); font: inherit; font-size: var(--gs-text-body); white-space: nowrap; cursor: pointer; }
.gs-filter-panel-clear { border: 1px solid var(--gs-line); background: transparent; color: var(--gs-ink); }
.gs-filter-panel-clear:disabled { opacity: .45; cursor: default; }
.gs-filter-panel-done { border: 0; background: var(--gs-action-bg); color: var(--gs-action-ink); font-weight: var(--gs-weight-semibold); }
.gs-filter-panel :focus-visible, .gs-filter-panel-surface :focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
/* Phone: a sheet over the dimmed page, chips at touch height, the done button the width of the sheet. */
.is-sheet { background: rgb(11 20 36 / 18%); }
.is-sheet .gs-filter-panel-surface { right: 0; bottom: 0; left: 0; height: 78dvh; max-height: none; border-bottom-right-radius: 0; border-bottom-left-radius: 0; }
.is-sheet .gs-filter-panel-option { min-height: var(--gs-control-touch); }
.is-sheet .gs-filter-panel-foot { padding-bottom: calc(var(--gs-space-4) + env(safe-area-inset-bottom, 0px)); }
.is-sheet .gs-filter-panel-done { flex: 1; }
</style>
