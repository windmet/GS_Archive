<template>
  <article class="about-page" data-archive-scroll-container>
    <!-- Same lockup, site line and service period as the boot screen. -->
    <header class="about-intro">
      <ArchiveBrandLockup class="about-lockup" />
      <p class="about-site-line">{{ SITE_LINE }}</p>
      <p class="about-period"><span>{{ SERVICE_PERIOD.start }} — {{ SERVICE_PERIOD.end }}</span>游戏服务期</p>
    </header>

    <section class="about-section" aria-labelledby="about-owner">
      <h2 id="about-owner">{{ owner.heading }}</h2>
      <div class="about-owner">
        <ArchiveIdolAvatar class="about-owner-avatar" :src="getOwnerAvatarUrl()" :size="72" :ring-width="3" :gap="3" :scale="1"
          :accent-color="idolColor(owner.ringIdol)" :alt="`${owner.name}的头像`" fallback-text="P" />
        <div class="about-owner-head">
          <p class="about-owner-name">{{ owner.name }}<span>{{ owner.handle }}</span></p>
          <p class="about-owner-intro">{{ owner.intro }}</p>
        </div>
        <dl class="about-oshi">
          <div v-for="row in owner.oshi" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>
              <span v-for="code in row.idols" :key="code" class="about-oshi-idol" :title="idolName(code)">
                <ArchiveIdolAvatar :idol-code="code" :size="28" :ring-width="2" :gap="1" :accent-color="idolColor(code)" decorative />
                <span v-if="row.idols.length === 1">{{ idolName(code) }}</span>
              </span>
              <span v-if="row.note" class="about-oshi-note">{{ row.note }}</span>
              <span v-else-if="row.idols.length > 1" class="about-visually-hidden">{{ row.idols.map(idolName).join('、') }}</span>
            </dd>
          </div>
        </dl>
        <div class="about-owner-body">
          <p v-for="(text, index) in owner.paragraphs" :key="index">{{ text }}</p>
        </div>
        <ul class="about-contact">
          <li v-for="link in owner.links" :key="link.label">
            <a v-if="link.url" :href="link.url" :target="link.url.startsWith('mailto:') ? undefined : '_blank'" rel="noopener noreferrer">
              <svg v-if="link.icon === 'github'" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
              <component :is="CONTACT_ICONS[link.icon]" v-else-if="CONTACT_ICONS[link.icon]" :size="15" aria-hidden="true" />
              <span>{{ link.label }}</span>
            </a>
            <span v-else class="about-link-pending"><span>{{ link.label }}</span><small>{{ link.note || '待补充' }}</small></span>
          </li>
        </ul>
        <div v-if="owner.group" class="about-group">
          <img :src="getQqGroupQrUrl()" :alt="`${owner.group.label}二维码：${owner.group.name}`" width="112" height="112" loading="lazy" />
          <div>
            <p class="about-group-label"><Users :size="15" aria-hidden="true" />{{ owner.group.label }} · {{ owner.group.name }}</p>
            <p class="about-group-number">{{ owner.group.number }}</p>
            <button type="button" class="about-copy" @click="copyGroupNumber">
              <component :is="copied ? Check : Copy" :size="14" aria-hidden="true" />{{ copied ? '已复制' : '复制群号' }}
            </button>
            <span class="about-visually-hidden" role="status">{{ copied ? '群号已复制' : '' }}</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="content.linkGroups.length" class="about-section" aria-labelledby="about-links">
      <h2 id="about-links">传送门</h2>
      <div class="about-link-groups">
        <div v-for="group in content.linkGroups" :key="group.heading">
          <h3>{{ group.heading }}</h3>
          <ul class="about-links">
            <li v-for="link in group.links" :key="link.label"><AboutLink :link="link" /></li>
          </ul>
        </div>
      </div>
    </section>

    <section v-for="section in content.sections" :key="section.id" class="about-section" :aria-labelledby="`about-${section.id}`">
      <h2 :id="`about-${section.id}`">{{ section.heading }}</h2>
      <p v-for="(text, index) in section.paragraphs" :key="index">{{ text }}</p>
    </section>

    <section v-if="content.thanks.paragraphs.length" class="about-section" aria-labelledby="about-thanks">
      <h2 id="about-thanks">{{ content.thanks.heading }}</h2>
      <p v-for="(text, index) in content.thanks.paragraphs" :key="index">{{ text }}</p>
    </section>

    <section class="about-section" aria-labelledby="about-notices">
      <h2 id="about-notices">{{ content.notices.heading }}</h2>
      <p>{{ content.notices.paragraph }} <a :href="noticesUrl" target="_blank" rel="noopener">{{ content.notices.linkLabel }}</a>。</p>
    </section>
  </article>
</template>

<script setup>
import { h, onUnmounted, ref } from 'vue'
import { ArrowUpRight, Bug, Check, Copy, Mail, Users, Video } from '@lucide/vue'
import ArchiveBrandLockup from './ArchiveBrandLockup.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import { ABOUT_CONTENT, SITE_LINE, SERVICE_PERIOD } from '../../content/aboutContent.js'
import { isMaintainerMode } from '../../core/maintainerMode.js'
import { getOwnerAvatarUrl, getQqGroupQrUrl } from '../../utils/AssetResolver.js'
import { normalizeIdolAccentColor } from '../../presentation/idolAccentColor.js'
import { readBootstrap } from '../../../readmodels/runtime/readBootstrap.mjs'
import noticesUrl from '../../../THIRD_PARTY_NOTICES.txt?url'

const CONTACT_ICONS = { issue: Bug, mail: Mail, video: Video }

// Unfinished entries (a 【待填写…】 paragraph, a link without url) stay visible to maintainers, so
// the gaps are easy to find; readers see only what is written, and a section left empty is dropped.
const isPending = text => /^【待填写/.test(text)
function readerContent(source) {
  const paragraphs = list => list.filter(text => !isPending(text))
  const links = list => list.filter(link => link.url)
  return {
    ...source,
    owner: { ...source.owner, links: links(source.owner.links) },
    sections: source.sections.map(section => ({ ...section, paragraphs: paragraphs(section.paragraphs) })).filter(section => section.paragraphs.length),
    linkGroups: source.linkGroups.map(group => ({ ...group, links: links(group.links) })).filter(group => group.links.length),
    thanks: { ...source.thanks, paragraphs: paragraphs(source.thanks.paragraphs) },
  }
}
const content = isMaintainerMode() ? ABOUT_CONTENT : readerContent(ABOUT_CONTENT)
const owner = content.owner

// Idol names and identity colors from the same build bootstrap the shell reads.
let idols = new Map()
try { idols = new Map(readBootstrap().idols.map(idol => [idol.id, idol])) } catch { /* no bootstrap: names fall back to codes */ }
const idolName = code => idols.get(code)?.name || code
const idolColor = code => normalizeIdolAccentColor(idols.get(code)?.color)

const copied = ref(false)
let copiedTimer
async function copyGroupNumber() {
  try { await navigator.clipboard.writeText(owner.group.number) } catch { return }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 2000)
}
onUnmounted(() => clearTimeout(copiedTimer))

const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
// Each portal row names the site, says what is there, and shows the domain before you leave.
// For maintainers a link with an empty url is still listed, as "待补充".
const AboutLink = {
  props: { link: Object },
  setup: props => () => props.link.url
    ? h('a', { href: props.link.url, target: '_blank', rel: 'noopener noreferrer' }, [
      h('span', { class: 'about-link-text' }, [
        h('span', { class: 'about-link-label' }, props.link.label),
        props.link.description ? h('span', { class: 'about-link-description' }, props.link.description) : null,
        h('span', { class: 'about-link-host' }, hostOf(props.link.url)),
      ]),
      h(ArrowUpRight, { size: 15, 'aria-hidden': 'true' }),
    ])
    : h('span', { class: 'about-link-pending' }, [h('span', props.link.label), h('small', props.link.note || '待补充')]),
}
</script>

<style scoped>
/* About: one reading column on paper, like the booklet pages. */
.about-page { display: grid; align-content: start; gap: var(--gs-space-section); height: 100%; padding: var(--gs-space-8); overflow-y: auto; box-sizing: border-box; background: var(--gs-paper); color: var(--gs-ink); }
.about-page > * { width: 100%; max-width: 72ch; margin-inline: auto; }
.about-intro { display: grid; justify-items: start; gap: var(--gs-space-3); padding-bottom: var(--gs-space-7); border-bottom: 1px solid var(--gs-line); }
.about-lockup { margin-bottom: var(--gs-space-2); }
.about-site-line { margin: 0; font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); line-height: 1.6; }
.about-period { display: flex; align-items: baseline; gap: var(--gs-space-3); margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.about-period span { color: var(--gs-ink-2); font-family: var(--gs-font-stage); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); letter-spacing: .1em; font-variant-numeric: tabular-nums; }
.about-section h2 { margin: 0 0 var(--gs-space-4); padding-bottom: var(--gs-space-2); border-bottom: 1px solid var(--gs-line); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.about-section h3 { margin: 0 0 var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.about-section p { margin: 0 0 var(--gs-space-3); color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.9; }
.about-section p a { color: var(--gs-mint-ink); }

/* Owner: avatar in the 担当's identity ring, name, 推し row, words, then every way to reach the owner. */
.about-owner { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: var(--gs-space-4) var(--gs-space-5); align-items: start; }
.about-owner-avatar { grid-row: 1 / 3; }
.about-owner-head { display: grid; gap: var(--gs-space-1); align-self: end; }
.about-section .about-owner-name { display: flex; align-items: baseline; gap: var(--gs-space-3); margin: 0; color: var(--gs-ink); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); line-height: 1.3; }
.about-owner-name span { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); letter-spacing: .04em; }
.about-section .about-owner-intro { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-ui); line-height: 1.5; }
.about-oshi { display: flex; flex-wrap: wrap; gap: var(--gs-space-3) var(--gs-space-6); margin: 0; }
.about-oshi > div { display: flex; align-items: center; gap: var(--gs-space-3); }
.about-oshi dt { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.about-oshi dd { display: flex; align-items: center; gap: var(--gs-space-2); margin: 0; font-size: var(--gs-text-ui); }
.about-oshi-idol { display: inline-flex; align-items: center; gap: var(--gs-space-2); }
.about-oshi-note { margin-left: var(--gs-space-1); color: var(--gs-ink-2); }
.about-owner-body, .about-contact, .about-group { grid-column: 2; }
.about-owner-body p:last-child { margin-bottom: 0; }
.about-contact { display: flex; flex-wrap: wrap; gap: var(--gs-space-3); margin: 0; padding: 0; list-style: none; }
.about-contact a, .about-contact .about-link-pending { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: 36px; padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink); font-size: var(--gs-text-ui); text-decoration: none; }
.about-contact .about-link-pending { border-style: dashed; color: var(--gs-ink-3); }
.about-contact .about-link-pending small { font-size: var(--gs-text-caption); }
.about-group { display: flex; align-items: center; gap: var(--gs-space-5); padding: var(--gs-space-4); border-radius: var(--gs-radius-panel); background: var(--gs-surface); }
.about-group img { flex: none; width: 112px; height: 112px; image-rendering: pixelated; }
.about-section .about-group-label { display: flex; align-items: center; gap: var(--gs-space-2); margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-ui); line-height: 1.5; }
.about-section .about-group-number { margin: var(--gs-space-1) 0 var(--gs-space-3); color: var(--gs-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); letter-spacing: .06em; line-height: 1.2; font-variant-numeric: tabular-nums; }
.about-copy { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: 32px; padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-paper); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }

/* Portal rows: site, what is there, domain. */
.about-link-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--gs-space-5) var(--gs-space-7); }
.about-links { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.about-links :deep(a), .about-links :deep(.about-link-pending) { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-3); min-height: var(--gs-control-touch); padding: var(--gs-space-3) var(--gs-space-2) var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); border-radius: 0; background: none; color: var(--gs-ink); font-size: var(--gs-text-ui); text-decoration: none; }
.about-links :deep(.about-link-text) { display: grid; gap: var(--gs-space-1); min-width: 0; }
.about-links :deep(.about-link-label) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.about-links :deep(.about-link-description) { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.5; }
.about-links :deep(.about-link-host) { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); letter-spacing: .02em; }
.about-links :deep(a svg) { flex: none; color: var(--gs-mint-ink); }
.about-links :deep(.about-link-pending) { border-bottom-style: dashed; color: var(--gs-ink-3); }
.about-links :deep(.about-link-pending small) { font-size: var(--gs-text-caption); }
@media (hover: hover) and (pointer: fine) {
  .about-links :deep(a:hover), .about-contact a:hover, .about-copy:hover { background: var(--gs-hover); }
}
.about-contact a:focus-visible, .about-copy:focus-visible, .about-links :deep(a:focus-visible) { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.about-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 760px) {
  .about-page { gap: var(--gs-space-8); padding: var(--gs-space-5) var(--gs-space-4); }
  .about-owner { grid-template-columns: 78px minmax(0, 1fr); }
  .about-oshi, .about-owner-body, .about-contact, .about-group { grid-column: 1 / -1; }
}
</style>
