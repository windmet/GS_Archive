<template>
  <label v-if="dropdown" class="archive-language-dropdown"><Languages :size="17" aria-hidden="true" /><select aria-label="资料语言" :value="uiLocale" @change="saveArchiveLocale($event.target.value)"><option value="zh-CN">中文</option><option value="ja-JP">日本語</option></select></label>
  <div v-else class="archive-language-switch" :class="{ 'on-dark': onDark }" role="group" aria-label="资料语言 / 表示言語">
    <button class="locale-toggle" type="button" :aria-label="uiLocale === 'zh-CN' ? '切换至日本語原文' : '切换至中文译文'" @click="saveArchiveLocale(uiLocale === 'zh-CN' ? 'ja-JP' : 'zh-CN')"><span :class="{ selected: uiLocale === 'zh-CN' }" lang="zh-CN">中</span><span class="locale-divider" aria-hidden="true">/</span><span :class="{ selected: uiLocale === 'ja-JP' }" lang="ja">日</span></button>
  </div>
</template>
<script setup>
import {uiLocale, saveArchiveLocale} from '../../utils/LanguageStore.js'
import {Languages} from '@lucide/vue'
// A-level language (names and descriptions across the archive): one 48×44 text toggle 「中 / 日」 at every
// width and on every bar, the current language in bold ink (线框减法册 L1). It used to be a two-segment
// GsSegmented, a filled groove that crowded the phone title; GsSegmented stays for mode switches in panels.
// Story body text is a separate, B-level choice (原文 / 译文 / 双语) made where the text is.
// onDark: the tools' chrome top bar (stage, Spine, photo studio).
// compactMobile and inline are kept so existing callers keep compiling; the control has one shape.
defineProps({ compactMobile: { type: Boolean, default: true }, dropdown:Boolean, onDark:Boolean, inline:Boolean })
</script>
<style scoped>
.archive-language-dropdown{display:flex;align-items:center;gap:5px;padding:0 8px;color:inherit}.archive-language-dropdown select{max-width:88px;min-height:40px;border:0;background:transparent;color:inherit;font:inherit;font-size:var(--gs-text-meta);cursor:pointer}.archive-language-dropdown select:focus-visible{outline:2px solid #258a8a;outline-offset:2px}
.archive-language-switch { display:inline-flex; flex:none; align-items:center; }
.locale-toggle { display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:48px;min-height:44px;padding:0 6px;border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink-3);font:inherit;font-size:var(--gs-text-ui);cursor:pointer; }
.locale-toggle .selected { color:var(--gs-ink);font-weight:var(--gs-weight-bold); }
.locale-toggle .locale-divider { color:var(--gs-rule); }
.locale-toggle:focus-visible { outline:var(--gs-focus-ring) solid var(--gs-mint); outline-offset:var(--gs-focus-offset); }
.on-dark .locale-toggle { color:var(--gs-stage-ink-2); }
.on-dark .locale-toggle .selected { color:var(--gs-stage-ink); }
.on-dark .locale-toggle .locale-divider { color:var(--gs-stage-line); }
@media (hover: hover) { .locale-toggle:hover { background:var(--gs-hover); } .on-dark .locale-toggle:hover { background:var(--gs-media-hover); } }
@media(max-width:760px) { .archive-language-dropdown select { font-size:var(--gs-text-subtitle); } }
</style>
