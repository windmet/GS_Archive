<template>
  <div class="episode-picker" data-testid="player-episode-picker">
    <button @click="emit('back')">{{ uiText('player.picker.back') }}</button>
    <p v-if="pending" role="status">{{ uiText('player.picker.loading') }}</p>
    <template v-if="status === 'ready' && snapshot?.entries.length">
      <button v-for="entry in snapshot.entries" :key="entry.entryKey" :disabled="!entry.available" :aria-current="entry.entryKey === snapshot.currentKey ? 'true' : undefined" :aria-label="`${uiText('player.picker.select')} ${entry.label}`" @click="select(entry)">{{ entry.label }} <small>{{ entry.entryKey === snapshot.currentKey ? uiText('player.picker.current') : entry.available ? '' : uiText('player.picker.missing') }}</small></button>
      <button @click="emit('select', { queueRevision:snapshot.revision, entryKey:snapshot.currentKey, restart:true })">{{ uiText('player.picker.restart') }}</button>
      <button v-if="pending" @click="emit('select', { queueRevision:snapshot.revision, entryKey:snapshot.currentKey })">{{ uiText('player.picker.cancel') }}</button>
    </template>
    <template v-else><p>{{ status === 'error' ? uiText('player.picker.failed') : uiText('player.queue.loading') }}</p><button v-if="status === 'error'" @click="emit('retry')">{{ uiText('player.queue.retry') }}</button></template>
  </div>
</template>
<script setup>
import { resolveUiText as uiText } from '../../localization/ui/UiTextResolver.js'
const props = defineProps({ snapshot:Object, status:String, pending:Boolean })
const emit = defineEmits(['back','select','retry'])
function select(entry) { emit('select', { queueRevision:props.snapshot.revision, entryKey:entry.entryKey }) }
</script>
<style scoped>
.episode-picker button { display:flex; align-items:center; justify-content:space-between; width:100%; min-height:44px; margin:8px 0; padding:10px 12px; border:1px solid #dce3e6; border-radius:5px; background:white; color:#26343c; font:inherit; text-align:left; cursor:pointer; }
.episode-picker button[aria-current] { background:#e9f8f4; border-color:#33aa92; color:#167a67; }
.episode-picker button:disabled { opacity:.55; cursor:default; }
small { margin-left:8px; }
</style>
