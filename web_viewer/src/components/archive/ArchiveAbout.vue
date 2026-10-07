<template>
  <article class="about-page" data-archive-scroll-container>
    <header class="about-intro">
      <p class="about-lead">{{ content.lead }}</p>
    </header>

    <section v-for="section in content.sections" :key="section.id" class="about-section" :aria-labelledby="`about-${section.id}`">
      <h2 :id="`about-${section.id}`">{{ section.heading }}</h2>
      <p v-for="(text, index) in section.paragraphs" :key="index">{{ text }}</p>
    </section>

    <section class="about-section" aria-labelledby="about-contact">
      <h2 id="about-contact">{{ content.contact.heading }}</h2>
      <p v-for="(text, index) in content.contact.paragraphs" :key="index">{{ text }}</p>
      <ul class="about-links">
        <li v-for="link in content.contact.links" :key="link.label"><AboutLink :link="link" /></li>
      </ul>
    </section>

    <section class="about-section" aria-labelledby="about-links">
      <h2 id="about-links">友情链接</h2>
      <div class="about-link-groups">
        <div v-for="group in content.linkGroups" :key="group.heading">
          <h3>{{ group.heading }}</h3>
          <ul class="about-links">
            <li v-for="link in group.links" :key="link.label"><AboutLink :link="link" /></li>
          </ul>
        </div>
      </div>
    </section>

    <section class="about-section" aria-labelledby="about-thanks">
      <h2 id="about-thanks">{{ content.thanks.heading }}</h2>
      <p v-for="(text, index) in content.thanks.paragraphs" :key="index">{{ text }}</p>
    </section>
  </article>
</template>

<script setup>
import { h } from 'vue'
import { ArrowUpRight } from '@lucide/vue'
import { ABOUT_CONTENT as content } from '../../content/aboutContent.js'

// A link with an empty url is still listed, as "待补充", so missing entries stay visible.
const AboutLink = {
  props: { link: Object },
  setup: props => () => props.link.url
    ? h('a', { href: props.link.url, target: props.link.url.startsWith('mailto:') ? undefined : '_blank', rel: 'noopener noreferrer' },
      [h('span', props.link.label), h(ArrowUpRight, { size: 15, 'aria-hidden': 'true' })])
    : h('span', { class: 'about-link-pending' }, [h('span', props.link.label), h('small', props.link.note || '待补充')]),
}
</script>

<style scoped>
/* About: one reading column on paper, like the booklet pages. */
.about-page { display: grid; align-content: start; gap: var(--gs-space-section); height: 100%; padding: var(--gs-space-8); overflow-y: auto; box-sizing: border-box; background: var(--gs-paper); color: var(--gs-ink); }
.about-page > * { width: 100%; max-width: 72ch; margin-inline: auto; }
.about-lead { margin: 0; font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); line-height: 1.7; }
.about-section h2 { margin: 0 0 var(--gs-space-3); padding-bottom: var(--gs-space-2); border-bottom: 1px solid var(--gs-line); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.about-section h3 { margin: 0 0 var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.about-section p { margin: 0 0 var(--gs-space-3); color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.9; }
.about-link-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--gs-space-5); }
.about-links { display: grid; gap: var(--gs-space-2); margin: 0; padding: 0; list-style: none; }
.about-links :deep(a), .about-links :deep(.about-link-pending) { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-3); min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font-size: var(--gs-text-ui); text-decoration: none; }
.about-links :deep(a:hover) { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); }
.about-links :deep(a svg) { flex: none; color: var(--gs-mint-ink); }
.about-links :deep(.about-link-pending) { border-style: dashed; color: var(--gs-ink-3); }
.about-links :deep(.about-link-pending small) { font-size: var(--gs-text-caption); }
@media (max-width: 760px) {
  .about-page { gap: var(--gs-space-6); padding: var(--gs-space-5) var(--gs-space-4); }
}
</style>
