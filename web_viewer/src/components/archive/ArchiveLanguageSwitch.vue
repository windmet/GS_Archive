<template>
  <label v-if="dropdown" class="archive-language-dropdown"><Languages :size="17" aria-hidden="true" /><select aria-label="资料语言" :value="uiLocale" @change="saveArchiveLocale($event.target.value)"><option value="zh-CN">中文</option><option value="ja-JP">日本語</option></select></label>
  <div v-else class="archive-language-switch" :class="{ compact: compactMobile, 'on-dark': onDark }" role="group" aria-label="资料语言 / 表示言語" title="名称与说明：中文译文 / 日本語原文；剧情正文按阅读设置显示">
    <button type="button" aria-label="中文" lang="zh-CN" :aria-pressed="uiLocale === 'zh-CN'" @click="saveArchiveLocale('zh-CN')"><span class="locale-name">中文</span><span class="locale-short">中</span><span class="locale-note">译</span></button>
    <button type="button" aria-label="日本語" lang="ja" :aria-pressed="uiLocale === 'ja-JP'" @click="saveArchiveLocale('ja-JP')"><span class="locale-name">日本語</span><span class="locale-short">日</span><span class="locale-note">原</span></button>
    <button v-if="compactMobile" class="locale-toggle" type="button" :aria-label="uiLocale === 'zh-CN' ? '切换至日本語原文' : '切换至中文译文'" @click="saveArchiveLocale(uiLocale === 'zh-CN' ? 'ja-JP' : 'zh-CN')"><span :class="{ selected: uiLocale === 'zh-CN' }">中</span><span class="locale-divider" aria-hidden="true">/</span><span :class="{ selected: uiLocale === 'ja-JP' }">日</span></button>
  </div>
</template>
<script setup>
import {uiLocale, saveArchiveLocale} from '../../utils/LanguageStore.js'
import {Languages} from '@lucide/vue'
// onDark: for the tools' chrome top bar (stage, Spine, photo studio).
defineProps({ compactMobile: { type: Boolean, default: true }, dropdown:Boolean, onDark:Boolean })
</script>
<style scoped>
.archive-language-dropdown{display:flex;align-items:center;gap:5px;padding:0 8px;color:inherit}.archive-language-dropdown select{max-width:88px;min-height:40px;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}.archive-language-dropdown select:focus-visible{outline:2px solid #258a8a;outline-offset:2px}
.archive-language-switch { display:inline-flex; flex:none; align-items:center; gap:2px; padding:3px; border:1px solid var(--gs-line); border-radius:var(--gs-radius-control); background:var(--gs-surface); color:var(--gs-ink-2); }
.archive-language-switch button { display:inline-flex; align-items:center; gap:4px; min-height:32px; padding:4px 8px; border:0; border-radius:6px; background:transparent; color:inherit; font:inherit; font-size:12px; cursor:pointer; white-space:nowrap; }
.archive-language-switch button[aria-pressed=true] { color:var(--gs-selected-ink); background:var(--gs-selected-bg); }
.archive-language-switch button:active { background:var(--gs-mint-wash); }.archive-language-switch .locale-note { font-size:var(--gs-text-caption); opacity:.75; }
.archive-language-switch .locale-short { display:none; }
.archive-language-switch .locale-toggle { display:none; }
@media(max-width:760px) {
  .archive-language-switch.compact { padding:0;gap:0;border:0;background:transparent; }
  .archive-language-switch.compact > button:not(.locale-toggle) { display:none; }
  .archive-language-switch.compact .locale-toggle { display:inline-flex;justify-content:center;gap:3px;width:48px;min-width:48px;padding:0;color:var(--gs-ink-3); }
  .locale-toggle .selected {color:var(--gs-mint-ink);font-weight:var(--gs-weight-bold);}
  .locale-toggle .locale-divider {color:var(--gs-line);}
}
.archive-language-switch button:focus-visible { outline:var(--gs-focus-ring) solid var(--gs-mint); outline-offset:var(--gs-focus-offset); }
/* On the tools' dark chrome bar: no light box, light ink, the chosen language in white. */
.archive-language-switch.on-dark { border-color:transparent; background:var(--gs-chrome-hover); color:var(--gs-chrome-ink); }
.archive-language-switch.on-dark button[aria-pressed=true] { color:var(--gs-ink); background:var(--gs-surface); }
.archive-language-switch.on-dark button:active { background:var(--gs-chrome-hover); }
@media(max-width:760px) { .archive-language-switch.compact.on-dark { background:transparent; } .archive-language-switch.on-dark .locale-toggle { color:var(--gs-chrome-ink); } .archive-language-switch.on-dark .locale-toggle .selected { color:var(--gs-surface); } }
@media(max-width:760px) { .archive-language-switch button { min-height:44px; min-width:44px; } }
@media(max-width:400px) { .archive-language-switch button { padding:4px 6px; } .archive-language-switch .locale-note { display:none; } }
</style>
