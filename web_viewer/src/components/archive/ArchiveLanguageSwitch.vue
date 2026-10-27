<template>
  <label v-if="dropdown" class="archive-language-dropdown"><Languages :size="17" aria-hidden="true" /><select aria-label="资料语言" :value="uiLocale" @change="saveArchiveLocale($event.target.value)"><option value="zh-CN">中文</option><option value="ja-JP">日本語</option></select></label>
  <div v-else-if="inline" class="archive-language-switch inline" role="group" aria-label="资料语言 / 表示言語">
    <button class="locale-toggle" type="button" :aria-label="uiLocale === 'zh-CN' ? '切换至日本語原文' : '切换至中文译文'" @click="saveArchiveLocale(uiLocale === 'zh-CN' ? 'ja-JP' : 'zh-CN')"><span :class="{ selected: uiLocale === 'zh-CN' }">中</span><span class="locale-divider" aria-hidden="true">/</span><span :class="{ selected: uiLocale === 'ja-JP' }">日</span></button>
  </div>
  <GsSegmented v-else class="archive-language-switch" :model-value="uiLocale" :options="LOCALES" aria-label="资料语言 / 表示言語" :on-dark="onDark" @update:model-value="saveArchiveLocale" />
</template>
<script setup>
import {uiLocale, saveArchiveLocale} from '../../utils/LanguageStore.js'
import {Languages} from '@lucide/vue'
import GsSegmented from '../gs/GsSegmented.vue'
// A-level language (names and descriptions across the archive): fixed "中 | 日" at every width.
// Story body text is a separate, B-level choice (原文 / 译文 / 双语) made where the text is.
// onDark: for the tools' chrome top bar (stage, Spine, photo studio).
// inline: the one-button 中 / 日 toggle for a header row (the home dialogue; P2 retires it).
// compactMobile is kept so existing callers keep compiling; the control no longer changes shape.
defineProps({ compactMobile: { type: Boolean, default: true }, dropdown:Boolean, onDark:Boolean, inline:Boolean })
const LOCALES = [
  { value: 'zh-CN', label: '中', ariaLabel: '中文（名称与说明用译文）', lang: 'zh-CN' },
  { value: 'ja-JP', label: '日', ariaLabel: '日本語（名称と説明は原文）', lang: 'ja' },
]
</script>
<style scoped>
.archive-language-dropdown{display:flex;align-items:center;gap:5px;padding:0 8px;color:inherit}.archive-language-dropdown select{max-width:88px;min-height:40px;border:0;background:transparent;color:inherit;font:inherit;font-size:var(--gs-text-meta);cursor:pointer}.archive-language-dropdown select:focus-visible{outline:2px solid #258a8a;outline-offset:2px}
.archive-language-switch { flex: none; }
.archive-language-switch.inline { display:inline-flex;align-items:center; }
.archive-language-switch .locale-toggle { display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:48px;min-height:44px;padding:0 6px;border:0;background:transparent;color:var(--gs-ink-3);font:inherit;font-size:var(--gs-text-meta);cursor:pointer; }
.archive-language-switch .locale-toggle .selected { color:var(--gs-mint-ink);font-weight:var(--gs-weight-bold); }
.archive-language-switch .locale-toggle .locale-divider { color:var(--gs-line); }
.archive-language-switch .locale-toggle:focus-visible { outline:var(--gs-focus-ring) solid var(--gs-mint); outline-offset:var(--gs-focus-offset); }
/* Phone header is 48px tall: 44px touch segments in a 2px track fit it, and the pair keeps off the screen edge. */
@media(max-width:760px) { .archive-language-dropdown select { font-size:var(--gs-text-subtitle); } .archive-language-switch.archive-language-switch:not(.inline) { --gs-seg-pad:2px; margin-inline-end:var(--gs-space-3); } }
</style>
