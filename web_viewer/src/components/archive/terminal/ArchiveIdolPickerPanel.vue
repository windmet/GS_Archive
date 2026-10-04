<template>
  <section class="terminal-idol-picker" :class="{'is-compact':compact}">
    <label class="terminal-search"><span>查找偶像或组合</span><input v-model="query" type="search" placeholder="输入姓名或组合名" autocomplete="off" /></label>
    <p class="terminal-help" role="status">{{ matches.length }} 位偶像<span v-if="selectedName"> · 已选：{{ selectedName }}</span></p>
    <template v-if="compact">
      <div class="picker-unit-tools"><div class="picker-unit-pills" role="group" aria-label="按组合筛选"><button type="button" :aria-pressed="!unitFilter" @click="unitFilter=''">全部 {{ idols.length }}</button><button v-for="unit in units" :key="unit.id" type="button" :aria-pressed="unitFilter===unit.id" @click="unitFilter=unit.id">{{ unit.name }}</button></div><select v-model="unitFilter" aria-label="选择组合"><option value="">全部组合</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.name }}</option></select></div>
      <div class="picker-unit-groups"><section v-for="group in groups" :key="group.id"><h3>{{ group.name }}</h3><div class="picker-avatar-grid"><button v-for="idol in group.idols" :key="idol.id" type="button" :aria-label="`${displayName(idol)} · ${group.name}`" :aria-pressed="modelValue===idol.id" :data-idol-code="idol.id" @click="emit('update:modelValue',idol.id)"><ArchiveIdolAvatar :idol-code="idol.id" :accent-color="idol.color" :size="48" decorative /><strong>{{ displayName(idol) }}</strong></button></div></section></div>
    </template>
    <div v-else class="terminal-idol-list" role="group" aria-label="偶像名单">
      <button v-for="idol in visible" :key="idol.id" type="button" :aria-pressed="modelValue === idol.id" :data-idol-code="idol.id" @click="emit('update:modelValue', idol.id)">
        <ArchiveIdolAvatar :idol-code="idol.id" :accent-color="idol.color" :size="44" decorative :fallback-text="displayName(idol).slice(0, 1) || '?'" />
        <span><strong>{{ displayName(idol) }}</strong><small>{{ idol.unitName || '315 STARS' }}</small></span>
      </button>
    </div>
    <p v-if="!matches.length" class="terminal-help">没有找到符合条件的偶像。</p>
    <button v-if="!compact && matches.length > limit" class="terminal-text-button" type="button" @click="limit += 12">显示更多</button>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import ArchiveIdolAvatar from '../ArchiveIdolAvatar.vue'
const props = defineProps({
  idols: { type: Array, default: () => [] }, modelValue: { type: String, default: '' },
  idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' },
  compact: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const query = ref(''), limit = ref(12)
const unitFilter=ref('')
const unitId=idol=>idol.unitCode || idol.unitName || '315'
const units=computed(()=>[...new Map(props.idols.map(idol=>[unitId(idol),{id:unitId(idol),name:idol.unitName || '315 STARS'}])).values()])
const groups=computed(()=>units.value.map(unit=>({...unit,idols:matches.value.filter(idol=>unitId(idol)===unit.id)})).filter(unit=>unit.idols.length))
watch(query, () => { limit.value = 12 })
function displayName(idol) { return props.idolName(idol.id) || idol.name || '' }
const normalize=value=>String(value).normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu,'')
const matches = computed(() => props.idols.filter(idol => (!props.compact || !unitFilter.value || unitId(idol)===unitFilter.value) && normalize(`${props.idolSearch(idol.id, idol.name)} ${displayName(idol)} ${idol.name || ''} ${idol.kana || ''} ${idol.unitName || ''}`).includes(normalize(query.value))))
const visible = computed(() => matches.value.slice(0, limit.value))
const selectedName = computed(() => {
  const idol = props.idols.find(idol => idol.id === props.modelValue)
  return idol ? displayName(idol) : ''
})
</script>
<style scoped>
.picker-unit-tools{display:flex;gap:12px;align-items:center;margin-bottom:16px}.picker-unit-pills{display:flex;gap:6px;overflow:auto;min-width:0;flex:1;scrollbar-width:thin;padding-block:4px}.picker-unit-pills button{flex:none;min-height:34px;border:1px solid #d9e5e8;border-radius:999px;background:#fff;color:#5a737b;padding:5px 10px;font:inherit;font-size:11px;cursor:pointer}.picker-unit-pills button[aria-pressed=true]{background:#e0f1ef;border-color:#74b8b4;color:#226966}.picker-unit-tools select{max-width:140px;min-width:0;min-height:36px;padding:5px;border:1px solid #d1e1e4;border-radius:7px;color:#34545d;background:white;font:inherit;font-size:11px}.picker-unit-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 22px}.picker-unit-groups h3{margin:0 0 8px;font-size:12px;color:#66838d;font-weight:500}.picker-avatar-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(65px,1fr));gap:6px}.picker-avatar-grid button{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;padding:8px 3px;border:1px solid transparent;border-radius:10px;background:transparent;color:#34545d;font:inherit;cursor:pointer}.picker-avatar-grid button strong{font-size:11px;font-weight:500;overflow-wrap:anywhere}.picker-avatar-grid button[aria-pressed=true]{background:#e2f3f0;border-color:#5ba7a1}.picker-avatar-grid button:focus-visible,.picker-unit-pills button:focus-visible{outline:2px solid #258a8a;outline-offset:2px}@media(hover:hover){.picker-avatar-grid button:hover{background:#edf5f5}}@media(max-width:550px){.picker-unit-groups{grid-template-columns:1fr}.picker-unit-tools select{max-width:110px}}
</style>
