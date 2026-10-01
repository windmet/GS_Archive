<template>
  <section class="producer-setting" aria-label="P 名字设置">
    <label :for="inputId">P 名字 <small>剧情、首页与卡面共用</small></label>
    <input :id="inputId" :value="producerName" type="text" autocomplete="off" placeholder="例如 windmet（不用加 P）" @input="saveProducerName($event.target.value)" />
    <p class="producer-preview" aria-live="polite">{{ preview }}</p>
    <small>输入即保存到此浏览器。留空保留原文占位；语音不变。</small>
  </section>
</template>
<script setup>
import { computed, useId } from 'vue'
import { producerName, saveProducerName } from '../../utils/LanguageStore.js'
import { PRODUCER_NAME_WITH_P_TOKEN, renderProducerAddressing } from '../../localization/story/ProducerAddressing.js'
const inputId = useId()
const preview = computed(() => renderProducerAddressing(`${PRODUCER_NAME_WITH_P_TOKEN}、いつもありがとな！ この調子でトップアイドルを目指すぜ！`, producerName.value))
</script>
<style scoped>
.producer-setting { display: grid; gap: 9px; padding: 16px; border: 1px solid #ccdfe6; border-radius: 8px; background: #f5fbfc; color: #244558; }
label { font-weight: 750; }
label small { margin-left: 8px; font-weight: 400; }
input { width: 100%; min-height: 44px; box-sizing: border-box; padding: 10px 12px; border: 1px solid #a6c4cd; border-radius: 5px; background: white; color: #183548; font: inherit; }
input:focus-visible { outline: 3px solid #007caa; outline-offset: 2px; }
p { margin: 0; overflow-wrap: anywhere; line-height: 1.7; font-size: 14px; }
small { color: #536d7a; font-size: 12px; line-height: 1.6; }
</style>
