import { computed } from 'vue'
import { createStoryLocalization } from '../../localization/story/StoryLocalizationContext.js'
import { producerName } from '../../utils/LanguageStore.js'
import { readingPresentationSpeaker } from '../../../shared/reading/ReadingDocument.js'
import { readingSpeakerAvatarEntity } from '../../presentation/ReadingSpeakerAvatar.js'
import { projectReadingFrontMatter } from '../../presentation/ReadingFrontMatter.js'
import { projectReadingChoiceRows } from '../../presentation/ReadingChoiceMetadata.js'

export function useReadingPresentation(document, mode) {
  const input = computed(() => document.value ? { scenario_id: document.value.scenario_id, text_catalog_id: document.value.text_catalog_id,
    steps: document.value.rows.map(row => ({ dialogue: { speaker_identity: { kind: row.speaker.kind,
      entity_type: row.speaker.entityType, entity_id: row.speaker.entityId, source_name: row.speaker.sourceName } } })) } : null)
  const preferences = computed(() => ({ story_content_mode: mode.value, story_translation_locale: 'zh-CN', bilingual_primary: 'original', producer_name: producerName.value }))
  const localization = createStoryLocalization({ compiledData: input, storyPreferences: preferences })
  const sourceTitle = computed(() => document.value?.presentation?.title || document.value?.rows.find(row => row.kind === 'title')?.source_text || '剧情阅读')
  const frontMatter = computed(() => projectReadingFrontMatter(document.value?.rows, sourceTitle.value))
  const presentedRows = computed(() => projectReadingChoiceRows(document.value).map(({ row, branch, anchorAliases }) => ({ row, branch, anchorAliases,
    frontMatter: frontMatter.value.frontMatterIds.has(row.anchor.row_id), mergedTitle: frontMatter.value.mergedTitleIds.has(row.anchor.row_id),
    avatar: readingSpeakerAvatarEntity(row), view: localization.resolveUnit({ source: row.source_text, textRef: row.text_ref,
      speaker: readingPresentationSpeaker(row), inlineEntry: row.inline_translation }) })))
  return { localization, sourceTitle, presentedRows }
}
