<template>
        <article class="reader-transcript" aria-label="剧情正文">
          <section v-for="item in rows" :key="item.row.anchor.row_id" :id="`reading-${item.row.anchor.row_id}`" tabindex="-1" class="reader-row" :aria-hidden="item.mergedTitle ? 'true' : undefined" :class="[`kind-${item.row.kind}`, { selected: anchor === item.row.anchor.row_id || item.anchorAliases?.includes(anchor), 'search-match': searchMatchIds.has(item.row.anchor.row_id), 'front-matter': item.frontMatter, 'merged-title': item.mergedTitle }]">
            <template v-if="!item.mergedTitle">
            <span v-for="alias in item.anchorAliases" :key="alias" :id="`reading-${alias}`" class="reader-anchor-alias" tabindex="-1" aria-hidden="true"></span>
            <p v-if="item.branch?.first" class="reader-branch-label">选项 {{ item.branch.index + 1 }}（{{ item.branch.shared ? '共用下方后续正文' : item.branch.terminal ? '该分支结束后本段完结' : '独立分支；下方汇合后继续' }}）</p>
            <ArchiveIdolAvatar v-if="item.avatar" class="reader-avatar" :idol-code="item.avatar" :size="40" :accent-color="idolDirectory.find(idol => idol.id === item.avatar)?.color" decorative />
            <div class="reader-content">
            <p v-if="item.view.speaker.display" class="reader-speaker">{{ item.view.speaker.display }}</p>
            <span v-if="item.row.kind === 'choice'" class="reader-kind">选项</span>
            <span v-if="item.row.kind === 'choice_detail'" class="reader-kind">选项附文</span>
            <span v-if="item.row.presentation" class="reader-kind">{{ item.row.presentation === 'call' ? '通话' : '短信' }}</span>
            <StorySynopsisCard v-if="item.row.kind === 'synopsis'" :view="item.view" />
            <MobileStamp v-else-if="item.row.kind === 'stamp'" :id="item.row.media.id" />
            <p v-else class="reader-primary" :lang="item.view.primary.locale">{{ reflowReadingText(item.view.primary.text, item.view.primary.locale) }}</p>
            <p v-if="item.row.kind !== 'synopsis' && item.view.secondary" class="reader-secondary" :lang="item.view.secondary.locale">{{ reflowReadingText(item.view.secondary.text, item.view.secondary.locale) }}</p>
            <span v-if="mode !== 'original' && item.view.translation.stale" class="reader-kind">译文待更新</span>
            </div>
            </template>
          </section>
        </article>
</template>
<script setup>
import MobileStamp from '../mobile/MobileStamp.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import StorySynopsisCard from './StorySynopsisCard.vue'
import { reflowReadingText } from '../../../shared/reading/ReadingTypography.js'
defineProps({ rows: Array, mode: String, anchor: String, idolDirectory:{type:Array,default:()=>[]}, searchMatchIds: { type: Set, default: () => new Set() } })
</script>
<style scoped>
.reader-branch-label { grid-column:1 / -1; margin:0 0 8px; border-left:3px solid var(--reader-accent); padding:10px 14px; background:var(--reader-bg-card); color:var(--reader-accent-text); font-size:14px; font-weight:700; }
.reader-transcript { margin-top:18px; }
.reader-row { position:relative; display:grid; grid-template-columns:40px minmax(0,1fr); column-gap:14px; margin:0; padding:16px 4px; border-bottom:1px solid var(--reader-border); scroll-margin-top:20px; outline:none; }
.reader-content { grid-column:2; min-width:0; }
.reader-anchor-alias { position:absolute; top:0; width:0; height:0; overflow:hidden; scroll-margin-top:20px; outline:none; }
.reader-avatar { grid-column:1; grid-row:auto; margin-top:3px; }
.reader-row.selected, .reader-row.search-match { background:var(--reader-bg-card); box-shadow:inset 3px 0 var(--reader-accent); }
.reader-row.merged-title { display:block; height:0; margin:0; padding:0; border:0; overflow:hidden; }
.reader-primary, .reader-secondary { max-width:min(100%,52em); margin:4px 0; white-space:pre-wrap; overflow-wrap:break-word; line-break:strict; word-break:normal; font-size:17px; line-height:1.8; }
.reader-secondary { color:var(--reader-text-sub); font-size:16px; }
.reader-speaker { color:var(--reader-accent-text); font-size:14px; font-weight:700; margin:0 0 5px; }
.kind-title { display:block; padding:18px 0 12px; border:0; }
.kind-title .reader-primary { font-weight:700; font-size:21px; line-height:1.6; }
.kind-caption, .kind-narration { display:block; margin:8px 0; padding:12px 16px; background:var(--reader-bg-card); border:0; border-radius:4px; color:var(--reader-text-sub); }
.kind-caption .reader-primary, .kind-narration .reader-primary { font-size:15px; }
.kind-synopsis { display:block; padding:0; margin:12px 0 20px; border:0; }
.kind-choice, .kind-choice_detail { display:block; margin:8px 0; padding:12px 18px; border:0; border-left:3px solid var(--reader-accent); background:var(--reader-bg-card); }
.reader-kind { display: inline-block; margin-inline-end: 8px; font-size: 12px; color: var(--reader-text-sub); }
@media (max-width:760px) { .reader-row { column-gap:10px; } .reader-primary { font-size:16px; } .reader-secondary { font-size:15px; } .kind-title .reader-primary { font-size:19px; } }

</style>
