<template><span class="domain-inline-text"><template v-for="(part,i) in parts" :key="i"><span v-if="part.kind === 'stamina'" class="domain-inline-glue"><span class="domain-inline-stamina"><Zap :size="15" aria-hidden="true" />体力</span>{{ part.tail }}</span><template v-else>{{ part.text }}</template></template></span></template>
<script setup>
import {computed} from 'vue'
import {Zap} from '@lucide/vue'
import {domainInlineParts} from '../../presentation/DomainInlineText.mjs'
const props=defineProps({text:{type:String,default:''}})
// Closing punctuation after an inline icon stays on the icon's line (no orphan 「。」 on its own row).
const TAIL=/^\s*([。、，．！？）」』,.!?)]+)/u
const parts=computed(()=>{
  const list=domainInlineParts(props.text).map(part=>({...part}))
  list.forEach((part,i)=>{
    const next=list[i+1]
    if(part.kind!=='stamina' || !next || next.kind==='stamina' || typeof next.text!=='string')return
    const match=next.text.match(TAIL)
    if(match){part.tail=match[1];next.text=next.text.slice(match[0].length)}
  })
  return list
})
</script>
<style scoped>
.domain-inline-text{white-space:pre-line}.domain-inline-glue{white-space:nowrap}.domain-inline-stamina{display:inline-flex;align-items:baseline;gap:2px;font-weight:600}.domain-inline-stamina svg{align-self:center;vertical-align:middle}
</style>
