<template>
  <Teleport to="body">
    <div class="collection-quick-backdrop" @click.self="emit('close')">
      <section ref="dialog" class="domain-page collection-quick-dialog" role="dialog" aria-modal="true" aria-label="藏品快捷查看" @keydown.esc.stop.prevent="emit('close')" @keydown.tab="cycleFocus">
        <header><h2>藏品快捷查看</h2><button ref="closeButton" type="button" aria-label="关闭藏品快捷查看" @click="emit('close')"><X :size="20" /></button></header>
        <p v-if="state.busy" role="status" class="domain-muted">正在读取藏品资料…</p>
        <p v-else-if="state.error" role="alert" class="domain-error">{{ state.error }}<button type="button" @click="preview.open(entityKey)">重试</button></p>
        <template v-else-if="state.detail">
          <CollectionEntryDetails :detail="state.detail" :kind="state.domain" :display-idol-name="displayIdolName" @open-card="emit('open-card',$event)" />
          <button type="button" class="domain-action collection-quick-full" @click="emit('open-entity',state.key)">在{{ state.domain === 'honors' ? '称号' : '道具' }}页查看来源与用途 <ChevronRight :size="16" /></button>
        </template>
      </section>
    </div>
  </Teleport>
</template>
<script setup>
import {nextTick,onMounted,onBeforeUnmount,ref,shallowRef,watch} from 'vue'
import {ChevronRight,X} from '@lucide/vue'
import {DomainRepository} from '../../../readmodels/runtime/DomainRepository.mjs'
import {createCollectionPreview} from '../../../readmodels/runtime/CollectionPreview.mjs'
import CollectionEntryDetails from './CollectionEntryDetails.vue'
import '../../styles/archive-domains.css'
const props=defineProps({client:Object,bootstrap:Object,entityKey:{type:String,required:true},displayIdolName:{type:Function,default:()=>''}})
const emit=defineEmits(['close','open-entity','open-card'])
const dialog=ref(null),closeButton=ref(null),opener=document.activeElement;
const background=opener?.closest('#story-viewer'),wasInert=background?.inert;
const state=shallowRef({busy:true,detail:null,error:''});
const preview=createCollectionPreview(new DomainRepository(props.client,props.bootstrap),value=>{state.value=value});
watch(()=>props.entityKey,key=>{void preview.open(key)},{immediate:true});
onMounted(async()=>{if(background)background.inert=true;await nextTick();closeButton.value?.focus()});
onBeforeUnmount(()=>{preview.dispose();if(background)background.inert=wasInert;if(opener?.isConnected)opener.focus({preventScroll:true})});
function cycleFocus(event) {
  const choices=[...dialog.value.querySelectorAll('button:not([disabled]),a[href],input,select,[tabindex="0"]')].filter(element=>element.getClientRects().length);
  const first=choices[0],last=choices.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus()}
}
</script>
<style scoped>
.collection-quick-backdrop { position: fixed; inset: 0; z-index: 3000; background: #152b4373; display: flex; justify-content: flex-end; }
.domain-page.collection-quick-dialog {
  --quick-safe-top: var(--gs-safe-top, env(safe-area-inset-top, 0px));
  --quick-safe-right: var(--gs-safe-right, env(safe-area-inset-right, 0px));
  --quick-safe-bottom: var(--gs-safe-bottom, env(safe-area-inset-bottom, 0px));
  --quick-safe-left: var(--gs-safe-left, env(safe-area-inset-left, 0px));
  width: min(var(--gs-surface-drawer-width, 480px), 100%);
  height: 100dvh;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: var(--gs-space-5) max(var(--gs-space-5), var(--quick-safe-right)) calc(var(--gs-space-5) + var(--quick-safe-bottom)) max(var(--gs-space-5), var(--quick-safe-left));
  overscroll-behavior: contain;
  box-shadow: -12px 0 50px #102a4033;
  font-family: var(--gs-font-directory);
  font-size: var(--gs-text-body);
  font-weight: var(--gs-weight-regular);
}
.collection-quick-dialog > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gs-space-4);
  position: sticky;
  /* Keep the entire header inside the scrollport after it sticks. */
  top: 0;
  z-index: 2;
  background: #f1f7fc;
  padding: calc(var(--gs-space-4) + var(--quick-safe-top)) 0 var(--gs-space-4);
  margin-bottom: var(--gs-space-4);
}
/* The existing 20px window title is distinct from the 22px entity title. */
.collection-quick-dialog > header h2 { min-width: 0; margin: 0; font-size: 20px; font-weight: var(--gs-weight-bold); overflow-wrap: anywhere; }
.collection-quick-dialog > header button { display: grid; place-items: center; width: var(--gs-control-touch); min-height: var(--gs-control-touch); flex: none; border: 1px solid #c5dfd6; border-radius: var(--gs-radius-field); background: #fff; color: #08745b; }
.collection-quick-full { max-width: 100%; min-height: var(--gs-control-touch); margin: var(--gs-space-5) 0 var(--gs-space-4); padding: var(--gs-space-3) var(--gs-space-4); gap: var(--gs-space-3); border-radius: var(--gs-radius-control); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); line-height: 1.6; text-align: left; overflow-wrap: anywhere; }
.collection-quick-full svg { flex: 0 0 auto; }
.collection-quick-dialog > .domain-error { padding: var(--gs-space-5); border-radius: var(--gs-radius-field); }
.collection-quick-dialog > .domain-error button { min-height: var(--gs-control-normal); margin-left: var(--gs-space-4); padding: var(--gs-space-3) var(--gs-space-4); border-radius: var(--gs-radius-control); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }

/* Local roles for the existing shared entry; media geometry remains unchanged. */
.collection-quick-dialog :deep(.collection-entry-details) { padding: var(--gs-space-6); border-radius: var(--gs-radius-panel); }
.collection-quick-dialog :deep(.domain-detail-title) { gap: var(--gs-space-5); margin-bottom: var(--gs-space-6); }
.collection-quick-dialog :deep(.collection-entry-details .domain-detail-title h3) { margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.45; overflow-wrap: anywhere; }
.collection-quick-dialog :deep(.collection-original) { margin: var(--gs-space-3) 0; font-size: var(--gs-text-meta); line-height: 1.5; white-space: pre-line; overflow-wrap: anywhere; }
.collection-quick-dialog :deep(.domain-description) { margin: 0 0 var(--gs-space-5); font-size: var(--gs-text-body); }
.collection-quick-dialog :deep(.domain-meta) { margin: var(--gs-space-6) 0; }
.collection-quick-dialog :deep(.domain-meta > div) { gap: var(--gs-space-4); padding: var(--gs-space-3) 0; }
.collection-quick-dialog :deep(.domain-meta dt) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.collection-quick-dialog :deep(.domain-meta dd) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); }
.collection-quick-dialog :deep(.collection-source-meta) { margin-top: var(--gs-space-6); }
.collection-quick-dialog :deep(.collection-source-meta > summary) { min-height: var(--gs-control-normal); padding: var(--gs-space-3) 0; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); line-height: 1.5; cursor: pointer; }
.collection-quick-dialog :deep(.collection-entry-details > .domain-muted) { margin: var(--gs-space-5) 0; font-size: var(--gs-text-body); }
.collection-quick-dialog :deep(.domain-media-preview) { margin-bottom: var(--gs-space-6); padding: var(--gs-space-5); border-radius: var(--gs-radius-field); }
.collection-quick-dialog :deep(.domain-media-preview figcaption) { margin-top: var(--gs-space-4); font-size: var(--gs-text-meta); }
.collection-quick-dialog :deep(.domain-media-preview button) { min-height: var(--gs-control-normal); padding: var(--gs-space-3) var(--gs-space-4); border-radius: var(--gs-radius-control); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.collection-quick-dialog button:focus-visible,
.collection-quick-dialog :deep(.collection-entry-details button:focus-visible),
.collection-quick-dialog :deep(.collection-source-meta > summary:focus-visible) { outline: var(--gs-focus-ring) solid #048a6d; outline-offset: var(--gs-focus-offset); }
@media (max-width: 760px) {
  .collection-quick-dialog :deep(.collection-entry-details) { padding: var(--gs-space-5); }
  .collection-quick-dialog :deep(.domain-meta > div) { gap: var(--gs-space-3); }
}
@media (max-width: 760px), (pointer: coarse) {
  .collection-quick-dialog > .domain-error button,
  .collection-quick-dialog :deep(.collection-source-meta > summary),
  .collection-quick-dialog :deep(.domain-media-preview button) { min-height: var(--gs-control-touch); }
}
</style>
