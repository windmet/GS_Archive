<template><span class="domain-inline-text"><template v-for="(part,i) in parts" :key="i"><span v-if="part.kind === 'stamina'" class="domain-inline-stamina"><Zap :size="15" aria-hidden="true" />体力</span><template v-else>{{ part.text }}</template></template></span></template>
<script setup>
import {computed} from 'vue'
import {Zap} from '@lucide/vue'
import {domainInlineParts} from '../../presentation/DomainInlineText.mjs'
const props=defineProps({text:{type:String,default:''}})
const parts=computed(()=>domainInlineParts(props.text))
</script>
<style scoped>
.domain-inline-text{white-space:pre-line}.domain-inline-stamina{display:inline-flex;align-items:baseline;gap:2px;font-weight:600}.domain-inline-stamina svg{align-self:center;vertical-align:middle}
</style>
