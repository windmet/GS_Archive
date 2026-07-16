<template>
  <div class="archive-shell" :class="{ 'has-inspector': hasInspector, 'is-home': activeSection === 'home' }">
    <aside class="archive-sidebar" aria-label="资料馆导航">
      <div class="archive-brand">
        <img :src="getBrandMarkUrl()" alt="" />
        <span>SideM<br />Archive</span>
      </div>
      <nav class="archive-nav">
        <button
          v-for="item in navigation"
          :key="item.id"
          :class="{ active: activeSection === item.id }"
          :aria-current="activeSection === item.id ? 'page' : undefined"
          @click="emit('navigate', item.id)"
        >
          <component :is="item.icon" :size="19" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <header class="archive-topbar">
      <button v-if="showBack" class="archive-back" title="返回" @click="emit('back')">
        <ArrowLeft :size="18" />
        <span>返回</span>
      </button>
      <div class="archive-mobile-brand">
        <img :src="getBrandMarkUrl()" alt="" />
        <span>SideM Archive</span>
      </div>
      <h1>{{ title }}</h1>
      <label v-if="searchable" class="archive-search">
        <Search :size="17" aria-hidden="true" />
        <input
          :value="modelValue"
          :placeholder="searchPlaceholder"
          @input="emit('update:modelValue', $event.target.value)"
        />
      </label>
    </header>

    <main class="archive-content">
      <slot />
    </main>

    <aside v-if="hasInspector" class="archive-inspector">
      <slot name="inspector" />
    </aside>

    <nav class="archive-mobile-nav" aria-label="移动资料馆导航">
      <button
        v-for="item in mobileNavigation"
        :key="item.id"
        :class="{ active: activeSection === item.id }"
        :aria-current="activeSection === item.id ? 'page' : undefined"
        @click="emit('navigate', item.id)"
      >
        <component :is="item.icon" :size="21" :stroke-width="1.8" />
        <span>{{ item.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import {
  ArrowLeft,
  BookMarked,
  FolderOpen,
  Home,
  Images,
  MessageSquare,
  Search,
  Sparkles,
  Users,
} from '@lucide/vue'
import { ARCHIVE_NAVIGATION } from '../../core/archiveRoute.js'
import { getBrandMarkUrl } from '../../utils/AssetResolver.js'

defineProps({
  activeSection: { type: String, default: 'home' },
  title: { type: String, default: '' },
  searchable: { type: Boolean, default: false },
  searchPlaceholder: { type: String, default: '搜索剧情、偶像或资源 ID' },
  modelValue: { type: String, default: '' },
  showBack: { type: Boolean, default: false },
  hasInspector: { type: Boolean, default: false },
})

const emit = defineEmits(['navigate', 'back', 'update:modelValue'])

const iconBySection = { home: Home, stories: BookMarked, idols: Users, cards: Images, gashas: Sparkles, interactions: MessageSquare, resources: FolderOpen }
const navigation = ARCHIVE_NAVIGATION.map(item => ({ ...item, icon: iconBySection[item.id] }))
const mobileNavigation = navigation
</script>

<style scoped>
.archive-shell {
  --archive-sidebar: 156px;
  --archive-inspector: 0px;
  --archive-topbar: 60px;
  --archive-accent: #18a79d;
  --archive-accent-soft: #eaf8f6;
  --archive-ink: #18212b;
  --archive-muted: #68727d;
  --archive-border: #dfe4e8;
  display: grid;
  grid-template-columns: var(--archive-sidebar) minmax(0, 1fr) var(--archive-inspector);
  grid-template-rows: var(--archive-topbar) minmax(0, 1fr);
  width: 100%;
  height: 100%;
  background: #fff;
  color: var(--archive-ink);
  font-family: Inter, "Noto Sans JP", "Noto Sans SC", system-ui, sans-serif;
}
.archive-shell.has-inspector { --archive-inspector: min(340px, 28vw); }
.archive-shell.is-home { --archive-topbar: 0px; }
.archive-shell.is-home .archive-topbar { display: none; }
.archive-shell.is-home .archive-content { grid-row: 1 / 3; }
:global(html[data-archive-home-theme="day"]) .archive-shell.is-home .archive-sidebar { background: #102632; }
:global(html[data-archive-home-theme="day"]) .archive-shell.is-home .archive-nav button.active { background: rgba(33,183,197,.13); }
:global(html[data-archive-home-theme="day"]) .archive-shell.is-home .archive-nav button.active::before { background: #21b7c5; }
:global(html[data-archive-home-theme="night"]) .archive-shell.is-home .archive-sidebar { background: #101b27; }
.archive-sidebar {
  grid-row: 1 / -1;
  background: #17212b;
  color: #dbe2e7;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.archive-brand {
  height: 76px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 18px;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.05;
}
.archive-brand img { width: 34px; height: 26px; object-fit: contain; filter: brightness(0) invert(1); }
.archive-nav { display: flex; flex-direction: column; gap: 4px; padding: 6px; }
.archive-nav button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #aeb8c0;
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  text-align: left;
}
.archive-nav button:hover { background: #222f3a; color: #fff; }
.archive-nav button.active { background: #2a3742; color: #fff; }
.archive-nav button.active::before {
  content: "";
  position: absolute;
  left: -6px;
  top: 7px;
  bottom: 7px;
  width: 3px;
  background: #35c2b8;
}
.archive-topbar {
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(260px, 460px);
  align-items: center;
  gap: 16px;
  min-width: 0;
  padding: 0 18px;
  border-bottom: 1px solid var(--archive-border);
  background: #fff;
}
.archive-topbar h1 {
  min-width: 0;
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.archive-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: #168f87;
  padding: 7px 4px;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}
.archive-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  min-width: 0;
  padding: 0 11px;
  border: 1px solid #d7dde2;
  border-radius: 6px;
  color: #8a949e;
  background: #fff;
}
.archive-search:focus-within { border-color: #34b9b0; box-shadow: 0 0 0 2px rgba(24,167,157,0.12); }
.archive-search input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--archive-ink);
  font: inherit;
  font-size: 0.8rem;
}
.archive-content { grid-column: 2; min-width: 0; min-height: 0; overflow: hidden; background: #fff; }
.archive-content :deep(.list-screen), .archive-content :deep(.home-screen) { height: 100%; }
.archive-inspector {
  grid-column: 3;
  grid-row: 2;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  border-left: 1px solid var(--archive-border);
  background: #fbfcfc;
}
.archive-mobile-brand, .archive-mobile-nav { display: none; }

@media (max-width: 760px) {
  .archive-shell, .archive-shell.has-inspector {
    --archive-sidebar: 0px;
    --archive-inspector: 0px;
    --archive-topbar: 112px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--archive-topbar) minmax(0, 1fr) 66px;
  }
  .archive-shell.is-home { --archive-topbar: 0px; }
  .archive-sidebar { display: none; }
  .archive-topbar {
    grid-column: 1;
    grid-row: 1;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: 52px 48px;
    gap: 0 10px;
    padding: 0 16px 8px;
  }
  .archive-mobile-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    font-size: 1.05rem;
    font-weight: 750;
  }
  .archive-mobile-brand img { width: 31px; height: 24px; object-fit: contain; }
  .archive-back { grid-row: 1; grid-column: 1; }
  .archive-back + .archive-mobile-brand { grid-column: 2; }
  .archive-topbar h1 { grid-row: 2; grid-column: 1; font-size: 1.25rem; }
  .archive-search { grid-row: 2; grid-column: 2; height: 36px; }
  .archive-topbar:not(:has(.archive-search)) h1 { grid-column: 1 / -1; }
  .archive-content { grid-column: 1; grid-row: 2; padding-bottom: 0; }
  .archive-inspector { display: none; }
  .archive-mobile-nav {
    grid-column: 1;
    grid-row: 3;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    border-top: 1px solid var(--archive-border);
    background: #fff;
    z-index: 20;
  }
  .archive-mobile-nav button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    border: 0;
    background: transparent;
    color: #69747e;
    font: inherit;
    font-size: 0.64rem;
  }
  .archive-mobile-nav button.active { color: var(--archive-accent); }
}
</style>
