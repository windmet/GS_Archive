<template>
  <div class="archive-language-switch" :class="{ compact: compactMobile }" role="group" aria-label="资料语言 / 表示言語" title="名称与说明：中文译文 / 日本語原文；剧情正文按阅读设置显示">
    <button type="button" aria-label="中文" lang="zh-CN" :aria-pressed="uiLocale === 'zh-CN'" @click="saveArchiveLocale('zh-CN')"><span class="locale-name">中文</span><span class="locale-short">中</span><span class="locale-note">译</span></button>
    <button type="button" aria-label="日本語" lang="ja" :aria-pressed="uiLocale === 'ja-JP'" @click="saveArchiveLocale('ja-JP')"><span class="locale-name">日本語</span><span class="locale-short">日</span><span class="locale-note">原</span></button>
    <button v-if="compactMobile" class="locale-toggle" type="button" :aria-label="uiLocale === 'zh-CN' ? '切换至日本語原文' : '切换至中文译文'" @click="saveArchiveLocale(uiLocale === 'zh-CN' ? 'ja-JP' : 'zh-CN')"><span :class="{ selected: uiLocale === 'zh-CN' }">中</span><span class="locale-divider" aria-hidden="true">/</span><span :class="{ selected: uiLocale === 'ja-JP' }">日</span></button>
  </div>
</template>
<script setup>
import {uiLocale, saveArchiveLocale} from '../../utils/LanguageStore.js'
defineProps({ compactMobile: { type: Boolean, default: true } })
</script>
<style scoped>
.archive-language-switch { display:inline-flex; flex:none; align-items:center; gap:2px; padding:3px; border:1px solid #cbdedc; border-radius:9px; background:#f5faf9; color:#234f54; }
.archive-language-switch button { display:inline-flex; align-items:center; gap:4px; min-height:32px; padding:4px 8px; border:0; border-radius:6px; background:transparent; color:inherit; font:inherit; font-size:12px; cursor:pointer; white-space:nowrap; }
.archive-language-switch button[aria-pressed=true] { color:#fff; background:#177f78; }
.archive-language-switch .locale-note { font-size:10px; opacity:.75; }
.archive-language-switch .locale-short { display:none; }
.archive-language-switch .locale-toggle { display:none; }
@media(max-width:760px) {
  .archive-language-switch.compact { padding:0;gap:0;border:0;background:transparent; }
  .archive-language-switch.compact > button:not(.locale-toggle) { display:none; }
  .archive-language-switch.compact .locale-toggle { display:inline-flex;justify-content:center;gap:3px;width:48px;min-width:48px;padding:0;color:#89959b; }
  .locale-toggle .selected {color:#177f78;font-weight:800;}
  .locale-toggle .locale-divider {color:#b7c2c5;}
}
.archive-language-switch button:focus-visible { outline:3px solid #2eaca2; outline-offset:2px; }
@media(max-width:760px) { .archive-language-switch button { min-height:44px; min-width:44px; } }
@media(max-width:400px) { .archive-language-switch button { padding:4px 6px; } .archive-language-switch .locale-note { display:none; } }
</style>
