<template>
  <div class="archive-drawer-backdrop" @click.self="emit('close')">
    <nav ref="sheet" class="archive-drawer" aria-label="全部栏目" @keydown.esc.prevent="emit('close')">
      <section v-for="tier in tiers" :key="tier.id" class="archive-drawer-tier" :class="`is-${tier.id}`">
        <div v-for="group in tier.groups" :key="group.id" class="archive-drawer-group">
          <h2>{{ group.label }}</h2>
          <div class="archive-drawer-rows">
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              :class="{ active: item.id === activeSection }"
              :aria-current="item.id === activeSection ? 'page' : undefined"
              @click="emit('navigate', item.id)"
            >
              <component :is="item.icon" class="archive-drawer-icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
              <span class="archive-drawer-label">{{ item.label }}</span>
              <template v-if="tier.id === 'tools'"><small v-if="item.blurb">{{ item.blurb }}</small><ArrowUpRight class="archive-drawer-go" :size="16" aria-hidden="true" /></template>
            </button>
            <span v-for="n in group.blanks" :key="`blank-${n}`" class="archive-drawer-blank" aria-hidden="true"></span>
          </div>
        </div>
      </section>
      <p class="archive-drawer-footer">
        <template v-for="item in footerItems" :key="item.id">
          <button type="button" :aria-current="item.id === activeSection ? 'page' : undefined" @click="emit('navigate', item.id)">{{ item.label }}</button>
          <span aria-hidden="true">·</span>
        </template>
        <button type="button" class="archive-drawer-top" :disabled="!canScrollTop" @click="scrollToTop">回到页顶</button>
        <span aria-hidden="true">·</span>
        <button type="button" :aria-current="activeSection === 'about' ? 'page' : undefined" @click="emit('navigate', 'about')">{{ sectionLabel('about') }}</button>
      </p>
    </nav>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ArrowUpRight } from '@lucide/vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { ARCHIVE_SECTIONS, sectionLabel } from '../../core/archiveSections.js'

// The phone's whole-site navigation, opened from the bar's third cell: the sidebar's destination groups as
// rows in a table of contents. A fixed icon column starts every name on one vertical line, so names of two
// to four characters stay aligned without boxes; each row is 44px over a 1px rule, and a short group gets
// blank ruled rows so the rules run straight across its column pair. Groups are told apart by 12px titles.
// The catalogues sit two groups to a line, 图鉴 three rows to a line, and the tools one to a line with
// what they open and ↗. 回到页顶 and 关于本站 close it as a footer line. 事务所 and 资料馆 are the bar's own
// cells, so the drawer does not repeat them. 资源 (maintainer mode only) joins the footer line.
const TIER_OF_GROUP = { collection: 'collection', live: 'tools', studio: 'tools', resources: 'footer' }
const TOOLS_TITLE = '工具'
const props = defineProps({
  groups: { type: Array, required: true },
  activeSection: { type: String, default: '' },
})
const emit = defineEmits(['navigate', 'close'])
const sheet = ref(null)

const tierGroups = id => props.groups.filter(group => (TIER_OF_GROUP[group.id] || 'core') === id)
  .map(group => ({ ...group, items: group.items.map(item => ({ ...item, icon: archiveNavigationIcons[item.id] || group.icon, blurb: ARCHIVE_SECTIONS[item.id]?.blurb || '' })) }))
// Catalogue groups pair up side by side: each pair pads to the longer one. 图鉴 pads to whole lines of three.
// The two tools (one section each) read as one group titled 工具.
function padded(groups, perLine) {
  return groups.map((group, index) => {
    const partner = groups[index ^ 1]
    const rows = perLine === 2 ? Math.max(group.items.length, partner?.items.length || 0) : Math.ceil(group.items.length / perLine) * perLine
    return { ...group, blanks: rows - group.items.length }
  })
}
const tiers = computed(() => [
  { id: 'core', groups: padded(tierGroups('core'), 2) },
  { id: 'collection', groups: padded(tierGroups('collection'), 3) },
  { id: 'tools', groups: [{ id: 'tools', label: TOOLS_TITLE, blanks: 0, items: tierGroups('tools').flatMap(group => group.items) }] },
].filter(tier => tier.groups.some(group => group.items.length)))
const footerItems = computed(() => tierGroups('footer').flatMap(group => group.items))

// The page scrolls inside the one archive scroll area (the same one view restoration reads).
const scrollArea = () => document.querySelector('[data-archive-scroll-container]')
const canScrollTop = ref(false)
function scrollToTop() {
  const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  scrollArea()?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  emit('close')
}

onMounted(() => {
  canScrollTop.value = (scrollArea()?.scrollTop || 0) > 0
  const target = sheet.value?.querySelector('[aria-current="page"]') || sheet.value?.querySelector('button')
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({ block: 'nearest' })
})
</script>

<style scoped>
/* Sits above the content and below the bar, so the bar's 收起 stays where the reader tapped. */
.archive-drawer-backdrop {
  position: fixed;
  inset: 0 0 calc(74px + env(safe-area-inset-bottom, 0px));
  z-index: 19;
  display: flex;
  align-items: flex-end;
  background: rgb(21 43 67 / 32%);
}
.archive-drawer {
  box-sizing: border-box;
  width: 100%;
  max-height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  padding: var(--gs-space-4) max(var(--gs-space-4), env(safe-area-inset-right, 0px)) var(--gs-space-2) max(var(--gs-space-4), env(safe-area-inset-left, 0px));
  border-radius: var(--gs-radius-panel); /* a floating layer; its foot meets the bar */
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  background: var(--gs-surface);
  color: var(--gs-ink);
  box-shadow: 0 -8px 32px rgb(16 42 64 / 12%);
}
/* Titles: 12px grey, 22px tall, sitting on the first rule. */
.archive-drawer h2 { display: flex; align-items: flex-end; height: 22px; margin: var(--gs-space-4) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-semibold); letter-spacing: .04em; }
.archive-drawer-tier:first-child .archive-drawer-group h2 { margin-top: 0; }
/* The grid gives the column lines; the 1px rules give the row lines, drawn across blank rows too. */
.archive-drawer-tier.is-core { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 18px; }
.archive-drawer-rows { display: grid; border-top: 1px solid var(--gs-line); }
.is-collection .archive-drawer-rows { grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 12px; }
.archive-drawer-blank { min-height: var(--gs-control-touch); border-bottom: 1px solid var(--gs-line); }
.archive-drawer button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: var(--gs-control-touch);
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  color: var(--gs-ink);
  font: inherit;
  font-size: var(--gs-text-ui);
  text-align: left;
  cursor: pointer;
}
.archive-drawer-rows > button { border-bottom: 1px solid var(--gs-line); isolation: isolate; }
.archive-drawer-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.archive-drawer button svg { flex: none; color: var(--gs-ink-3); }
/* Tools: the name, what it opens, and ↗ at the row's end. */
.archive-drawer .is-tools small { min-width: 0; overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-meta); text-overflow: ellipsis; white-space: nowrap; }
.archive-drawer-go { margin-left: auto; }
/* Where the reader is: a light block behind the row, the desktop sidebar's rule; no bar, no bold. */
.archive-drawer-rows > button::before { content: ""; position: absolute; inset: 3px -8px; z-index: -1; border-radius: var(--gs-radius-control); }
.archive-drawer-rows > button.active::before { background: var(--gs-current-bg-inset); }
.archive-drawer-rows > button:not(:disabled):active::before { background: var(--gs-hover); }
/* The focus ring outlines the same block, not the bare row. */
.archive-drawer .archive-drawer-rows > button:focus-visible { outline: none; }
.archive-drawer-rows > button:focus-visible::before { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
.archive-drawer button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
/* Footer line: quiet and centred, each link still a full touch target. */
.archive-drawer-footer { display: flex; align-items: center; justify-content: center; gap: var(--gs-space-1); margin: var(--gs-space-2) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.archive-drawer .archive-drawer-footer button { padding: 0 var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.archive-drawer .archive-drawer-footer button:disabled { opacity: .5; cursor: default; }
.archive-drawer .archive-drawer-footer button[aria-current='page'] { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
/* The drawer belongs to the phone bar; a wider window has the sidebar instead. */
@media (min-width: 761px) { .archive-drawer-backdrop { display: none; } }
</style>
