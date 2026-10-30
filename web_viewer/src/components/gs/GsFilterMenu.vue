<template>
  <div ref="root" class="gs-filter-menu" :class="`is-${variant}`" @keydown.esc.stop="close(true)">
    <button ref="trigger" type="button" class="gs-filter-trigger" :class="{ 'is-filtered': variant === 'chip' && filtered, 'is-open': open }" :disabled="disabled" aria-haspopup="listbox" :aria-expanded="open" :aria-label="`${label}：${selectedLabel}`" @click="toggle">
      <span class="gs-filter-label">{{ label }}</span><span class="gs-filter-value">{{ selectedLabel }}</span><ChevronRight v-if="variant === 'row'" class="gs-filter-caret" :size="17" aria-hidden="true" /><ChevronDown v-else class="gs-filter-caret" :size="14" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <div v-if="open" class="gs-filter-layer" @pointerdown.self="close(false)">
        <ul ref="list" class="gs-filter-list" role="listbox" :aria-label="label" :style="position" @keydown="onKey">
          <li v-for="(option, index) in options" :key="option.value" role="presentation">
            <p v-if="option.group && option.group !== options[index - 1]?.group" class="gs-filter-group" aria-hidden="true">{{ option.group }}</p>
            <button type="button" role="option" class="gs-filter-option" :aria-selected="option.value === modelValue" @click="choose(option)">
              <span>{{ option.label }}</span><small v-if="option.count !== undefined">{{ option.count }}</small><Check v-if="option.value === modelValue" :size="16" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { Check, ChevronDown, ChevronRight } from '@lucide/vue'

// Filter with many values: a chip-shaped trigger 「资源：全部 ▾」 and a list of 44px choosable rows. Fewer than seven values
// belong in filter chips instead. options: [{ value, label, count?, group? }]; on a phone the list is a bottom sheet.
// variant row: a settings row 「标签 · 当前值 ›」 that opens the same list (线框减法册 rule 1, the stage panel);
// options carrying a group label get a 12px grey heading where the group changes (in place of <optgroup>).
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true },
  label: { type: String, required: true },
  // The value that means "no filter"; the trigger is plain while it is chosen.
  neutral: { type: [String, Number], default: undefined },
  variant: { type: String, default: 'chip', validator: value => ['chip', 'row'].includes(value) },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const root = ref(null), trigger = ref(null), list = ref(null)
const open = ref(false), position = ref({})
const selected = computed(() => props.options.find(option => option.value === props.modelValue))
const selectedLabel = computed(() => selected.value?.label || '全部')
const filtered = computed(() => props.neutral !== undefined ? props.modelValue !== props.neutral : props.modelValue !== (props.options[0]?.value ?? ''))

function toggle() { open.value ? close(true) : show() }
async function show() {
  const rect = trigger.value.getBoundingClientRect()
  const phone = matchMedia('(max-width: 760px)').matches
  position.value = phone ? {} : { left: `${Math.min(rect.left, innerWidth - 260)}px`, top: `${rect.bottom + 4}px`, minWidth: `${Math.max(rect.width, 200)}px` }
  open.value = true
  document.addEventListener('keydown', onDocumentKey, true)
  await nextTick()
  list.value?.querySelector('[aria-selected=true], .gs-filter-option')?.focus()
}
function close(returnFocus) {
  open.value = false
  document.removeEventListener('keydown', onDocumentKey, true)
  if (returnFocus) nextTick(() => trigger.value?.focus())
}
function onDocumentKey(event) { if (event.key === 'Escape') { event.stopPropagation(); close(true) } }
function choose(option) { close(true); if (option.value !== props.modelValue) emit('update:modelValue', option.value) }
function onKey(event) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const items = [...list.value.querySelectorAll('.gs-filter-option')], at = items.indexOf(document.activeElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  event.preventDefault()
  items[next]?.focus()
}
onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKey, true))
</script>

<style scoped>
.gs-filter-menu { display: inline-flex; min-width: 0; }
.gs-filter-trigger { display: inline-flex; align-items: center; gap: var(--gs-space-3); max-width: 100%; min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); white-space: nowrap; cursor: pointer; }
.gs-filter-label { color: var(--gs-ink-3); }
.gs-filter-value { overflow: hidden; text-overflow: ellipsis; }
.gs-filter-trigger.is-filtered { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); font-weight: var(--gs-weight-semibold); }
.gs-filter-trigger.is-filtered .gs-filter-label, .gs-filter-caret { color: inherit; opacity: .7; }
.gs-filter-trigger:focus-visible, .gs-filter-option:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (hover: hover) { .gs-filter-trigger:not(.is-filtered):hover { background: var(--gs-hover); } }
@media (pointer: coarse) { .gs-filter-trigger { min-height: var(--gs-control-touch); } }
/* Row: the label column, the value, ›; no frame and no fill, the row's hairline belongs to the parent. */
.gs-filter-menu.is-row { display: flex; }
.is-row .gs-filter-trigger { display: grid; grid-template-columns: 72px minmax(0, 1fr) auto; gap: 8px; width: 100%; min-height: 44px; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--gs-ink); text-align: left; white-space: normal; }
.is-row .gs-filter-label { color: var(--gs-ink-2); }
.is-row .gs-filter-value { overflow: hidden; font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.is-row .gs-filter-caret { color: var(--gs-ink-3); opacity: 1; }
.is-row .gs-filter-trigger:disabled { opacity: .45; cursor: default; }
@media (hover: hover) { .is-row .gs-filter-trigger:not(:disabled):hover { background: var(--gs-paper); } }
.gs-filter-group { margin: var(--gs-space-2) var(--gs-space-4) var(--gs-space-1); color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-semibold); }
.gs-filter-layer { position: fixed; inset: 0; z-index: 1200; }
.gs-filter-list { position: fixed; margin: 0; padding: var(--gs-space-2); max-height: min(60vh, 420px); overflow: auto; list-style: none; border-radius: var(--gs-radius-panel); background: var(--gs-surface); box-shadow: var(--gs-shadow-console); }
.gs-filter-option { display: flex; align-items: center; gap: var(--gs-space-4); box-sizing: border-box; width: 100%; min-height: 44px; padding: 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); text-align: left; cursor: pointer; }
.gs-filter-option span { flex: 1; min-width: 0; }
.gs-filter-option small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.gs-filter-option[aria-selected=true] { font-weight: var(--gs-weight-semibold); }
@media (hover: hover) { .gs-filter-option:hover { background: var(--gs-hover); } }
@media (max-width: 760px) {
  .gs-filter-layer { background: rgb(11 20 36 / 18%); }
  .gs-filter-list { right: 0; bottom: 0; left: 0; max-height: 70dvh; padding-bottom: calc(var(--gs-space-3) + env(safe-area-inset-bottom, 0px)); border-bottom-right-radius: 0; border-bottom-left-radius: 0; }
}
</style>
