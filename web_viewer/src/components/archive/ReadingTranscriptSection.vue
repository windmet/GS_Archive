<template>
        <article class="reader-transcript" aria-label="剧情正文">
          <section v-for="item in rows" :key="item.row.anchor.row_id" :id="`reading-${item.row.anchor.row_id}`" tabindex="-1" class="reader-row" :aria-hidden="item.mergedTitle ? 'true' : undefined" :class="[`kind-${item.row.kind}`, { selected: anchor === item.row.anchor.row_id, 'search-match': searchMatchIds.has(item.row.anchor.row_id), 'front-matter': item.frontMatter, 'merged-title': item.mergedTitle }]">
            <template v-if="!item.mergedTitle">
            <p v-if="item.branch?.first" class="reader-branch-label">选项 {{ item.branch.index + 1 }} 的分支（与其他选项互斥；下方汇合后继续）</p>
            <img v-if="item.avatar" class="reader-avatar" :src="getCharaIconUrl(item.avatar)" alt="" loading="lazy" @error="$event.target.hidden = true" />
            <p v-if="item.view.speaker.display" class="reader-speaker">{{ item.view.speaker.display }}</p>
            <span v-if="item.row.kind === 'choice'" class="reader-kind">选项</span>
            <span v-if="item.row.kind === 'choice_detail'" class="reader-kind">选项附文</span>
            <span v-if="item.row.presentation" class="reader-kind">{{ item.row.presentation === 'call' ? '通话' : '短信' }}</span>
            <MobileStamp v-if="item.row.kind === 'stamp'" :id="item.row.media.id" />
            <p v-else class="reader-primary" :lang="item.view.primary.locale">{{ reflowReadingText(item.view.primary.text, item.view.primary.locale) }}</p>
            <p v-if="item.view.secondary" class="reader-secondary" :lang="item.view.secondary.locale">{{ reflowReadingText(item.view.secondary.text, item.view.secondary.locale) }}</p>
            <span v-if="mode !== 'original' && item.view.translation.stale" class="reader-kind">译文待更新</span>
            </template>
          </section>
        </article>
</template>
<script setup>
import MobileStamp from '../mobile/MobileStamp.vue'
import { reflowReadingText } from '../../../shared/reading/ReadingTypography.js'
import { getCharaIconUrl } from '../../utils/AssetResolver.js'
defineProps({ rows: Array, mode: String, anchor: String, searchMatchIds: { type: Set, default: () => new Set() } })
</script>
<style scoped>
.reader-branch-label { border-left:3px solid #0a8878; padding:10px 14px; background:#edf7f4; color:#176f69; font-size:14px; font-weight:700; }
.reader-transcript { margin-top:24px; }
.reader-row.search-match { background:#f0faf8; }
.reader-row { position: relative; margin: 14px 0; padding: 24px 32px; background: #fff; border: 1px solid #e1eaea; border-radius: 12px; scroll-margin-top: 20px; outline: none; }
.reader-row.front-matter:not(.merged-title) { margin-block: 0 8px; padding: 14px 24px; border-color: #e4ecec; background: #f8fbfb; }
.reader-row.merged-title { height: 0; margin: 0; padding: 0; border: 0; overflow: hidden; }
.reader-row.selected { border-color: #168f98; box-shadow: inset 3px 0 #168f98; }
.reader-primary, .reader-secondary { max-width: min(100%, 52em); margin: 5px 0; white-space: pre-wrap; overflow-wrap: break-word; line-break: strict; word-break: normal; font-size: 17px; line-height: 1.9; }
.reader-secondary { color: #657986; font-size: 16px; }
.reader-speaker { color: #167e89; font-size: 15px; font-weight: 700; margin: 0 0 4px; }
.kind-title .reader-primary { font-weight: 700; font-size: 21px; line-height: 1.6; }
.kind-caption, .kind-narration, .kind-synopsis { background: #edf3f3; padding: 24px 32px; border-block: 1px solid #e3e9ed; color: #607a88; }
.kind-choice, .kind-choice_detail { border-left: 2px solid #9acbd0; padding-left: 32px; }
.reader-kind { display: inline-block; margin-inline-end: 8px; font-size: 12px; color: #607a88; }
.reader-avatar { width: 36px; height: 36px; border-radius: 50%; float: left; margin: 0 12px 4px 0; object-fit: cover; }
@media (max-width: 760px) { .reader-row { padding: 20px 18px; } .reader-primary { font-size: 16px; } .reader-secondary { font-size: 15px; } .kind-title .reader-primary { font-size: 19px; } }

</style>
