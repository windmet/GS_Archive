<template>
  <label class="costume-category-filter" :class="{'is-compact':compact}"><span>衣装类别</span><select :value="modelValue" :aria-label="label" @change="emit('update:modelValue', $event.target.value)">
    <option value="">全部衣装 · {{ costumes.length }}</option>
    <option v-for="group in counts" :key="group.id" :value="group.id">{{ group.label }} · {{ group.count }}</option>
  </select></label>
</template>
<script setup>
import {computed} from 'vue'
import {costumeCategoryCounts} from '../../presentation/CostumeCategories.js'
const props=defineProps({modelValue:{type:String,default:''},costumes:{type:Array,default:()=>[]},label:{type:String,default:'衣装类别'},compact:Boolean})
const emit=defineEmits(['update:modelValue'])
const counts=computed(()=>costumeCategoryCounts(props.costumes))
</script>
<style scoped>
.costume-category-filter { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: var(--gs-text-ui); }
.costume-category-filter > span { flex-shrink: 0; color: var(--gs-ink-2); }
.costume-category-filter select { min-width: 0; min-height: 44px; flex: 1; padding: 6px 8px; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); color: var(--gs-ink); background: var(--gs-surface); font: inherit; }
.costume-category-filter select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.is-compact > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.is-compact select { width: 125px; min-height: 40px; border: 0; background: transparent; padding: 0 8px; }
</style>
