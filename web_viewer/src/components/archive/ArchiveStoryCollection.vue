<template>
  <article v-if="collection" class="story-collection">
    <header class="collection-hero">
      <div class="collection-visual" :class="`domain-${collection.domain}`">
        <img v-if="collection.visualUrl" :src="collection.visualUrl" :alt="collection.title" />
        <div v-else class="visual-fallback"><BookOpen :size="42" /></div>
      </div>
      <div class="collection-copy">
        <span>{{ collection.eyebrow }}</span>
        <h2>{{ collection.title }}</h2>
        <p>{{ collection.description }}</p>
        <dl>
          <div><dt>{{ collection.domain === 'birthday' ? '独立生日档案' : '正式话目' }}</dt><dd>{{ collection.domain === 'birthday' ? collection.independentChapterCount : `${collection.playableChapterCount} / ${collection.chapterCount}` }}</dd></div>
          <div><dt>{{ collection.domain === 'birthday' ? '个人故事共享' : '剧情分段' }}</dt><dd>{{ collection.domain === 'birthday' ? collection.sharedChapterCount : `${collection.playableEpisodeCount} / ${collection.episodeCount}` }}</dd></div>
          <div v-if="collection.domain === 'birthday' && collection.officialBirthdayLabel"><dt>官方生日</dt><dd>{{ collection.officialBirthdayLabel }}</dd></div>
          <div v-if="releaseDate"><dt>开放时间</dt><dd>{{ releaseDate }}</dd></div>
        </dl>
        <aside v-if="collection.domain === 'birthday'" class="domain-boundary-note">
          <BookOpen :size="17" />
          <p v-if="collection.subject?.kind === 'shared'"><strong>归档边界</strong><span>该篇由山村贤登场引导，但表 80 没有绑定角色；因此按制作人生日公共篇建档，不复制到山村贤的个人生日集合。</span></p>
          <p v-else><strong>归档边界</strong><span>生日问候属于本页；生日同期开放的正式个人章节归入 Idol Episode。共享文件只保留一个关系入口，不重复定义章节。</span></p>
        </aside>
        <div v-if="collection.gasha || collection.sourceUrl" class="collection-relations">
          <button v-if="collection.gasha" type="button" @click="emit('open-gasha', collection.gasha)">
            <img v-if="collection.gasha.banner_url" :src="collection.gasha.banner_url" alt="" />
            <span>
              <small>RELATED GASHA · {{ collection.gasha.code }}</small>
              <strong>{{ collection.gasha.display_name }}</strong>
              <em>{{ collection.gasha.derived_pickup_cards?.length || 0 }} pickup SSR</em>
            </span>
            <ChevronRight :size="18" />
          </button>
          <a v-if="collection.sourceUrl" :href="collection.sourceUrl" target="_blank" rel="noopener noreferrer external">
            <ExternalLink :size="15" />
            分类核对来源
          </a>
        </div>
      </div>
    </header>

    <section class="chapter-section">
      <div class="section-heading">
        <div><span>CHAPTERS</span><h3>{{ collection.domainLabel }}</h3></div>
        <strong>{{ collection.chapterCount }} chapters</strong>
      </div>

      <div class="chapter-list">
        <section
          v-for="(chapter, chapterIndex) in collection.chapters"
          :key="chapter.id"
          class="chapter-row"
          :class="{ expanded: expandedChapterId === chapter.id, unavailable: !chapter.exists, canonical: chapter.canonicalRelation }"
        >
          <div class="chapter-summary">
            <button class="chapter-toggle" :aria-expanded="expandedChapterId === chapter.id" @click="toggleChapter(chapter.id)">
              <span class="chapter-number">{{ String(chapterIndex + 1).padStart(2, '0') }}</span>
              <span class="chapter-identity">
                <small>{{ chapter.label }}</small>
                <strong>{{ chapter.title }}</strong>
              </span>
              <span class="chapter-stats">
                <small>{{ chapter.episodeCount }} episodes</small>
                <small>{{ chapter.voiceCount }} voices</small>
              </span>
              <ChevronUp v-if="expandedChapterId === chapter.id" :size="18" />
              <ChevronDown v-else :size="18" />
            </button>
            <div class="chapter-actions" aria-label="章节观看方式">
              <a
                v-for="resource in externalResourcesForChapter(chapter.id)"
                :key="resource.external_id"
                class="chapter-community"
                :href="resource.platform.canonical_url"
                target="_blank"
                rel="noopener noreferrer external"
                :title="`在 Bilibili 观看 ${resource.uploader.name} 投稿的社区中文资源`"
              >
                <ExternalLink :size="17" />
                <span><strong>社区中文</strong><small>{{ resource.uploader.name }}</small></span>
              </a>
              <button
                v-if="chapter.canonicalRelation"
                class="chapter-canonical"
                title="前往正式个人故事章节"
                @click="emit('open-idol-story', chapter.canonicalRelation)"
              >
                <BookOpen :size="17" />
                <span><strong>Idol Episode</strong><small>{{ chapter.canonicalRelation.sectionName }}</small></span>
              </button>
              <button
                v-else
                class="chapter-play"
                :disabled="!chapter.exists"
                :title="chapter.exists ? '使用实验性剧情播放器播放整话' : '剧情文件未实装'"
                @click="emit('play-chapter', chapter)"
              >
                <Play :size="17" fill="currentColor" />
                <span><strong>{{ chapter.exists ? '剧情播放器' : '未实装' }}</strong><small>实验功能</small></span>
              </button>
            </div>
          </div>

          <div v-if="expandedChapterId === chapter.id" class="chapter-panel">
            <div v-if="chapter.canonicalRelation" class="canonical-note">
              <div>
                <span>CANONICAL PERSONAL STORY</span>
                <strong>{{ chapter.canonicalRelation.sectionName }}「{{ chapter.canonicalRelation.sectionTitle }}」</strong>
                <p>本文件对应 {{ chapter.canonicalRelation.episodeNames.join('、') }}，在生日档案中仅作为同期关系保留；完整章节结构、连续播放与后续通信统一由个人故事页承担。</p>
              </div>
              <button @click="emit('open-idol-story', chapter.canonicalRelation)">前往正式章节 <ChevronRight :size="15" /></button>
            </div>
            <div v-if="chapter.synopsis" class="chapter-synopsis">
              <span>STORY</span>
              <strong>{{ chapter.synopsis.title || chapter.title }}</strong>
              <p>{{ chapter.synopsis.text }}</p>
            </div>
            <p v-else-if="!chapter.exists" class="chapter-unavailable">该话目保留于 masterdata，但没有可播放的编译剧情。</p>

            <div v-if="!chapter.canonicalRelation" class="episode-grid">
              <button
                v-for="(episode, episodeIndex) in chapter.episodes"
                :key="episode.id"
                :disabled="!episode.exists"
                @click="emit('play-episode', { chapter, episode })"
              >
                <span class="episode-number">{{ String(episodeIndex + 1).padStart(2, '0') }}</span>
                <span class="episode-copy">
                  <strong>{{ episode.label }}</strong>
                  <small>{{ episode.dialogueCount }} dialogues · {{ episode.voiceCount }} voices</small>
                </span>
                <Play v-if="episode.exists" :size="15" fill="currentColor" />
                <span v-else class="episode-lock">－</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { BookOpen, ChevronDown, ChevronRight, ChevronUp, ExternalLink, Play } from '@lucide/vue'

const props = defineProps({
  collection: { type: Object, default: null },
  externalResources: { type: Array, default: () => [] },
  initialChapterId: { type: String, default: '' },
})
const emit = defineEmits(['play-chapter', 'play-episode', 'open-gasha', 'open-idol-story'])
const expandedChapterId = ref('')

const releaseDate = computed(() => {
  const timestamp = Number(props.collection?.releaseAt || 0)
  if (timestamp < 1577836800) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(timestamp * 1000))
})

watch(() => [props.collection?.id, props.initialChapterId], () => {
  const initialChapter = props.collection?.chapters?.find(chapter =>
    chapter.id === props.initialChapterId && chapter.exists,
  )
  expandedChapterId.value = initialChapter?.id ||
    props.collection?.chapters?.find(chapter => chapter.exists)?.id ||
    props.collection?.chapters?.[0]?.id || ''
}, { immediate: true })

function toggleChapter(chapterId) {
  expandedChapterId.value = expandedChapterId.value === chapterId ? '' : chapterId
}

function externalResourcesForChapter(chapterId) {
  return props.externalResources
    .filter(entry => entry.chapterId === chapterId)
    .map(entry => entry.resource)
}
</script>

<style scoped>
.story-collection { height: 100%; overflow-x: hidden; overflow-y: auto; background: #f5f7f8; color: #26343c; }
.collection-hero { display: grid; grid-template-columns: minmax(390px, 1.2fr) minmax(300px, .8fr); gap: 30px; padding: 28px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #dfe5e7; background: #fff; }
.collection-visual { align-self: start; overflow: hidden; border: 1px solid #dce3e5; border-radius: 6px; background: #eef2f3; }
.collection-visual.domain-main { aspect-ratio: 906 / 210; }
.collection-visual.domain-unit_story { aspect-ratio: 446 / 150; }
.collection-visual.domain-extra { aspect-ratio: 1456 / 548; }
.collection-visual.domain-birthday { min-height: 210px; }
.collection-visual img { display: block; width: 100%; height: 100%; object-fit: contain; }
.visual-fallback { display: grid; place-items: center; width: 100%; height: 100%; background: url('/assets/stories/story_background.png') center / cover; color: #16877f; }
.collection-copy { align-self: center; min-width: 0; }
.collection-copy > span, .section-heading span, .chapter-synopsis > span { color: #168a82; font-size: .59rem; font-weight: 800; }
.collection-copy h2 { margin: 5px 0 10px; font-size: 1.45rem; line-height: 1.35; }
.collection-copy > p { margin: 0 0 18px; color: #53636b; font-size: .7rem; line-height: 1.75; }
.collection-copy dl { margin: 0; }
.collection-copy dl div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px; padding: 7px 0; border-bottom: 1px solid #edf0f1; font-size: .64rem; }
.collection-copy dt { color: #89959b; }.collection-copy dd { margin: 0; color: #33464f; }
.domain-boundary-note { display: grid; grid-template-columns: 22px minmax(0,1fr); gap: 8px; margin-top: 14px; padding: 10px 11px; border: 1px solid #eadde1; border-radius: 6px; background: #fff8fa; color: #9d4761; }.domain-boundary-note p { display: flex; flex-direction: column; gap: 2px; margin: 0; }.domain-boundary-note strong { font-size: .59rem; }.domain-boundary-note span { color: #705f65; font-size: .54rem; line-height: 1.55; }
.collection-relations { display: grid; gap: 7px; margin-top: 15px; }
.collection-relations button { display: grid; grid-template-columns: 78px minmax(0,1fr) 18px; align-items: center; gap: 10px; overflow: hidden; padding: 0 10px 0 0; border: 1px solid #cfe1df; border-radius: 5px; background: #f3faf9; color: #28443f; cursor: pointer; font: inherit; text-align: left; }
.collection-relations button:hover { border-color: #52aaa3; background: #ebf7f5; }
.collection-relations button img { width: 78px; height: 52px; object-fit: cover; }
.collection-relations button span { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 7px 0; }
.collection-relations button small { color: #188078; font-size: .52rem; font-weight: 800; }
.collection-relations button strong { overflow: hidden; font-size: .64rem; text-overflow: ellipsis; white-space: nowrap; }
.collection-relations button em { color: #78898e; font-size: .52rem; font-style: normal; }
.collection-relations > a { display: inline-flex; align-items: center; gap: 6px; width: max-content; color: #357c77; font-size: .58rem; text-decoration: none; }
.chapter-section { padding: 24px max(24px, calc((100% - 1120px) / 2)) 40px; background: #f7f9fa; }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 13px; }
.section-heading h3 { margin: 3px 0 0; font-size: 1rem; }.section-heading > strong { color: #7d8b92; font-size: .61rem; }
.chapter-list { border-top: 1px solid #dbe2e4; background: #fff; }
.chapter-row { border-bottom: 1px solid #dbe2e4; }.chapter-row.expanded { box-shadow: inset 3px 0 #38a89f; }.chapter-row.unavailable { background: #fafbfb; }.chapter-row.canonical { background: #fbf9fc; }.chapter-row.canonical.expanded { box-shadow: inset 3px 0 #79609b; }
.chapter-summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; min-height: 72px; }
.chapter-toggle { display: grid; grid-template-columns: 44px minmax(0, 1fr) 150px 22px; align-items: center; gap: 12px; min-width: 0; padding: 10px 16px; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.chapter-toggle:hover { background: #f4faf9; }.chapter-number { color: #159087; font-size: .72rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.chapter-identity { display: flex; flex-direction: column; gap: 4px; min-width: 0; }.chapter-identity small { color: #16837c; font-size: .57rem; }.chapter-identity strong { overflow: hidden; font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }
.chapter-stats { display: flex; gap: 12px; color: #849097; font-size: .58rem; }.chapter-toggle > svg { color: #75858c; }
.chapter-actions { display: flex; align-items: stretch; gap: 8px; margin: 12px 14px 12px 0; }
.chapter-actions > a,.chapter-actions > button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 128px; min-height: 48px; padding: 7px 12px; border-radius: 5px; font: inherit; text-decoration: none; }
.chapter-actions > a span,.chapter-actions > button span { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; line-height: 1.15; }
.chapter-actions strong { font-size: .62rem; }.chapter-actions small { font-size: .49rem; font-weight: 500; }
.chapter-community,.chapter-play { border: 1px solid #7dbfb9; background: #f4fbfa; color: #14766f; }
.chapter-canonical { border: 1px solid #b8a9ca; background: #f7f3fb; color: #654f83; cursor: pointer; }
.chapter-community:hover,.chapter-play:hover:not(:disabled) { border-color: #159087; background: #e9f7f5; color: #0f665f; }.chapter-canonical:hover { border-color: #8065a2; background: #f1eafa; }
.chapter-community small,.chapter-play small { color: #617c79; }
.chapter-play { cursor: pointer; }
.chapter-play:disabled { border-color: #d3dade; background: #e4e9eb; color: #78858b; cursor: not-allowed; }
.chapter-panel { padding: 5px 16px 18px 72px; border-top: 1px solid #edf1f2; background: #fbfcfc; }
.canonical-note { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 16px; margin: 13px 0 5px; padding: 13px 14px; border: 1px solid #ddd4e8; border-radius: 6px; background: #fff; }.canonical-note > div { display: flex; flex-direction: column; gap: 4px; }.canonical-note span { color: #765b98; font-size: .51rem; font-weight: 800; }.canonical-note strong { font-size: .68rem; }.canonical-note p { margin: 0; color: #706579; font-size: .55rem; line-height: 1.55; }.canonical-note button { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 0 10px; border: 1px solid #8065a2; border-radius: 5px; background: #765b98; color: #fff; cursor: pointer; font: inherit; font-size: .57rem; font-weight: 700; white-space: nowrap; }
.chapter-synopsis { padding: 14px 0 16px; }.chapter-synopsis strong { display: block; margin: 5px 0 6px; font-size: .75rem; }.chapter-synopsis p { max-width: 820px; margin: 0; color: #4b5d65; font-size: .66rem; line-height: 1.75; white-space: pre-line; }
.chapter-unavailable { margin: 14px 0; color: #78858b; font-size: .65rem; }
.episode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #dfe6e8; }
.episode-grid button { display: grid; grid-template-columns: 34px minmax(0, 1fr) 18px; align-items: center; gap: 8px; min-height: 54px; padding: 8px 11px; border: 0; background: #fff; color: #2d3d45; cursor: pointer; font: inherit; text-align: left; }
.episode-grid button:hover:not(:disabled) { background: #edf8f7; }.episode-grid button:disabled { background: #f4f6f7; color: #929da2; cursor: not-allowed; }
.episode-number { color: #16877f; font-size: .59rem; font-weight: 800; font-variant-numeric: tabular-nums; }.episode-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.episode-copy strong { font-size: .67rem; }.episode-copy small { color: #87949a; font-size: .53rem; }.episode-grid svg { color: #159087; }.episode-lock { text-align: center; }
@media (max-width: 840px) { .collection-hero { grid-template-columns: 1fr; gap: 18px; }.collection-visual { max-width: 720px; }.chapter-toggle { grid-template-columns: 38px minmax(0, 1fr) 22px; }.chapter-stats { display: none; } }
@media (max-width: 620px) { .collection-hero { padding: 15px 12px 18px; }.collection-copy h2 { font-size: 1.14rem; }.chapter-section { padding: 18px 10px 30px; }.chapter-summary { grid-template-columns: 1fr; }.chapter-toggle { grid-template-columns: 30px minmax(0, 1fr) 18px; gap: 7px; padding: 9px 8px; }.chapter-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); margin: 0 8px 12px; }.chapter-actions > a,.chapter-actions > button { min-width: 0; }.chapter-panel { padding: 4px 8px 12px; }.canonical-note { grid-template-columns: 1fr; }.canonical-note button { justify-content: center; }.episode-grid { grid-template-columns: 1fr; }.section-heading > strong { display: none; } }
</style>
