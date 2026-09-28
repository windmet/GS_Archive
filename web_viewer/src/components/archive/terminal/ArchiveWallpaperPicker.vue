<template>
  <ArchiveTerminalDialog :open="open" title="SSR 卡面壁纸" title-id="wallpaper-title" @close="emit('close')">
    <p class="terminal-help">手机竖屏使用竖图，桌面及横屏使用横图。只列出两种图片都已核验的 SSR 卡面。</p>
    <button type="button" class="terminal-text-button" @click="choose('')">使用默认背景</button>
    <p v-if="loading" role="status">正在读取壁纸目录…</p>
    <div v-else-if="error" role="status">{{ error }} <button type="button" class="terminal-text-button" @click="load(true)">重试</button></div>
    <template v-else>
      <label class="terminal-search"><span>查找卡名或偶像</span><input v-model="query" type="search" placeholder="卡名 / 偶像姓名" /></label>
      <div class="terminal-wallpaper-grid">
        <button v-for="entry in visible" :key="entry.id" type="button" :aria-pressed="preferences.wallpaperKey === entry.id" @click="choose(entry.id)">
          <img :src="entry.thumbnail || entry.portrait.url" alt="" loading="lazy" decoding="async" />
          <strong>{{ entry.label }}</strong><small>{{ entry.idolName }} · {{ entry.variantLabel }}</small>
        </button>
      </div>
      <p v-if="!matches.length" class="terminal-help">没有可用的 SSR 配对；请先生成并发布壁纸目录。</p>
      <button v-if="matches.length > limit" type="button" class="terminal-secondary" @click="limit += 12">继续浏览</button>
    </template>
    <p v-if="notice" role="status">{{ notice }}</p>
  </ArchiveTerminalDialog>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import ArchiveTerminalDialog from './ArchiveTerminalDialog.vue'
import { useTerminalWallpaper } from '../../../data/terminal/useTerminalWallpaper.js'
const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const { catalogue, preferences, error, notice, loading, load, choose: select } = useTerminalWallpaper()
const query = ref(''), limit = ref(12)
watch(query, () => { limit.value = 12 })
watch(() => props.open, open => { if (open) load() }, { immediate: true })
const matches = computed(() => (catalogue.value?.entries || []).filter(e => `${e.label} ${e.idolName}`.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())))
const visible = computed(() => matches.value.slice(0, limit.value))
function choose(id) { if (select(id)) emit('close') }
</script>
