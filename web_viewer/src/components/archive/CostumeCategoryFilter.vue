<template>
  <GsFilterMenu class="costume-category-filter" :label="label" :model-value="modelValue" :options="options" neutral="" @update:model-value="emit('update:modelValue', $event)" />
</template>
<script setup>
import {computed} from 'vue'
import GsFilterMenu from '../gs/GsFilterMenu.vue'
import {costumeCategoryCounts} from '../../presentation/CostumeCategories.js'
const props=defineProps({modelValue:{type:String,default:''},costumes:{type:Array,default:()=>[]},label:{type:String,default:'衣装类别'},compact:Boolean})
const emit=defineEmits(['update:modelValue'])
const counts=computed(()=>costumeCategoryCounts(props.costumes))
const options=computed(()=>[{value:'',label:'全部衣装',count:props.costumes.length},...counts.value.map(group=>({value:group.id,label:group.label,count:group.count}))])
</script>
