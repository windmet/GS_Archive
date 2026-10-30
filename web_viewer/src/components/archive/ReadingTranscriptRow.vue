<template>
          <section :id="`reading-${item.row.anchor.row_id}`" tabindex="-1" class="reader-row" :aria-hidden="item.mergedTitle ? 'true' : undefined" :class="[`kind-${item.row.kind}`, { selected: anchor === item.row.anchor.row_id || item.anchorAliases?.includes(anchor), 'search-match': searchMatchIds.has(item.row.anchor.row_id), 'front-matter': item.frontMatter, 'merged-title': item.mergedTitle, continued }]">
            <template v-if="!item.mergedTitle">
            <span v-for="alias in item.anchorAliases" :key="alias" :id="`reading-${alias}`" class="reader-anchor-alias" tabindex="-1" aria-hidden="true"></span>
            <ArchiveIdolAvatar v-if="item.avatar && !continued" class="reader-avatar" :idol-code="item.avatar" :size="40" :accent-color="idolDirectory.find(idol => idol.id === item.avatar)?.color" decorative />
            <!-- Speakers without an icon (P, passers-by) keep the text axis with a plain disc, not a hole. -->
            <span v-else-if="!item.avatar && !continued && item.row.kind === 'dialogue' && item.view.speaker.display" class="reader-avatar reader-avatar-plain" aria-hidden="true">{{ [...item.view.speaker.display][0] }}</span>
            <div class="reader-content">
            <p v-if="item.view.speaker.display && !continued" class="reader-speaker">{{ item.view.speaker.display }}</p>
            <span v-if="item.row.kind === 'choice'" class="reader-kind">选项</span>
            <span v-if="item.row.kind === 'choice_detail'" class="reader-kind">选项附文</span>
            <span v-if="item.row.presentation" class="reader-kind">{{ item.row.presentation === 'call' ? '通话' : '短信' }}</span>
            <StorySynopsisCard v-if="item.row.kind === 'synopsis'" :view="item.view" collapsible />
            <MobileStamp v-else-if="item.row.kind === 'stamp'" :id="item.row.media.id" />
            <p v-else class="reader-primary" :lang="item.view.primary.locale"><ReadingInlineText :text="item.view.primary.text" :locale="item.view.primary.locale" /></p>
            <p v-if="item.row.kind !== 'synopsis' && item.view.secondary" class="reader-secondary" :lang="item.view.secondary.locale"><ReadingInlineText :text="item.view.secondary.text" :locale="item.view.secondary.locale" /></p>
            <span v-if="mode !== 'original' && item.view.translation.stale" class="reader-kind">译文待更新</span>
            </div>
            </template>
          </section>

</template>
<script setup>
import MobileStamp from '../mobile/MobileStamp.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import StorySynopsisCard from './StorySynopsisCard.vue'
import ReadingInlineText from './ReadingInlineText.vue'
defineProps({ item: Object, continued: Boolean, mode: String, anchor: String, idolDirectory:{type:Array,default:()=>[]}, searchMatchIds: { type: Set, default: () => new Set() } })
</script>
<style scoped>
.reader-row { --reader-avatar-column:40px; --reader-column-gap:14px; position:relative; display:grid; grid-template-columns:var(--reader-avatar-column) minmax(0,1fr); column-gap:var(--reader-column-gap); margin:0; padding:12px 4px; border-bottom:1px solid color-mix(in oklab, var(--reader-border) 60%, transparent); scroll-margin-top:20px; outline:none; }
/* One speaker block: the next line by the same speaker follows without face, name or rule. */
.reader-row:has(+ .reader-row.continued) { padding-bottom:2px; border-bottom-color:transparent; }
.reader-row.continued { padding-top:2px; }
.reader-avatar-plain { display:grid; place-items:center; width:var(--reader-avatar-column); height:var(--reader-avatar-column); border-radius:50%; background:color-mix(in oklab, var(--reader-text-main) 7%, var(--reader-bg-page)); color:var(--reader-text-sub); font-size:var(--gs-text-ui); font-weight:var(--gs-weight-semibold); }
.reader-content { grid-column:2; min-width:0; }
.reader-anchor-alias { position:absolute; top:0; width:0; height:0; overflow:hidden; scroll-margin-top:20px; outline:none; }
.reader-avatar { grid-column:1; grid-row:auto; margin-top:3px; }
.reader-row.selected, .reader-row.search-match { background:var(--reader-bg-card); box-shadow:inset 3px 0 var(--reader-accent); }
.reader-row.merged-title { display:block; height:0; margin:0; padding:0; border:0; overflow:hidden; }
.reader-primary, .reader-secondary { max-width:min(100%,52em); margin:4px 0; white-space:pre-wrap; overflow-wrap:break-word; line-break:strict; word-break:normal; font-size:17px; line-height:1.8; }
.reader-secondary { color:var(--reader-text-sub); font-size:16px; }
.reader-speaker { color:var(--reader-text-sub); font-size:var(--gs-text-meta); font-weight:var(--gs-weight-semibold); margin:0 0 2px; }
.kind-title { display:block; padding:18px 0 12px; border:0; }
.kind-title .reader-primary { font-weight:700; font-size:21px; line-height:1.6; }
/* Narration reads as plain text on the speakers' text axis; a time / place telop is a small chip. */
.kind-narration { display:block; margin:0; padding:12px 4px 12px calc(4px + var(--reader-avatar-column) + var(--reader-column-gap)); color:var(--reader-text-sub); }
.kind-narration .reader-primary { font-size:15px; }
.kind-caption { display:block; margin:0; padding:14px 4px 10px calc(4px + var(--reader-avatar-column) + var(--reader-column-gap)); border:0; }
.kind-caption .reader-content { display:inline-flex; flex-wrap:wrap; align-items:baseline; gap:2px 8px; max-width:100%; padding:2px 10px; border-radius:var(--gs-radius-control); background:color-mix(in oklab, var(--reader-text-main) 6%, var(--reader-bg-page)); color:var(--reader-text-sub); }
.kind-caption .reader-primary, .kind-caption .reader-secondary { margin:0; font-size:var(--gs-text-ui); line-height:1.6; }
.kind-synopsis { display:block; padding:0; margin:12px 0 20px; border:0; }
.kind-choice, .kind-choice_detail { display:block; margin:8px 0; padding:12px 18px; border:0; border-left:3px solid var(--reader-accent); background:var(--reader-bg-card); }
.reader-kind { display: inline-block; margin-inline-end: 8px; font-size: 12px; color: var(--reader-text-sub); }
@media (max-width:760px) { .reader-row { --reader-avatar-column:34px; --reader-column-gap:10px; padding-block:10px; } .reader-avatar { --idol-avatar-override-size:34px; } .reader-primary { font-size:15px; } .reader-secondary { font-size:14px; } .kind-title .reader-primary { font-size:19px; } }

</style>
