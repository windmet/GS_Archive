<template>
  <span class="archive-brand-lockup">
    <img :src="getBrandMarkUrl()" alt="" />
    <span class="archive-brand-text"><span class="archive-brand-name">{{ ARCHIVE_BRAND.mark }}</span><span class="archive-brand-sub">{{ ARCHIVE_BRAND.sub }}</span></span>
  </span>
</template>

<script setup>
import { getBrandMarkUrl } from '../../utils/AssetResolver.js'
import { ARCHIVE_BRAND } from '../../core/archiveSections.js'
</script>

<style scoped>
/* One lockup for the sidebar and the first-run dialog; the shell may hide .archive-brand-text on the rail. */
.archive-brand-lockup { display: inline-flex; align-items: center; gap: var(--gs-space-3); min-width: 0; }
.archive-brand-lockup img { flex: none; width: 26px; height: 20px; object-fit: contain; filter: brightness(0); }
.archive-brand-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.archive-brand-name { font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-style: italic; font-weight: var(--gs-weight-bold); letter-spacing: .02em; line-height: 1; white-space: nowrap; }
.archive-brand-sub { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1; white-space: nowrap; }
</style>
