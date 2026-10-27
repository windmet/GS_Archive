// B-level language (story body text): 原文 / 译文 / 双语, short 原 / 译 / 双. "仅原文" is a C-level
// status (a state, not a choice): the chosen mode has no translation for this passage.
export function playerLanguageStatus(preferences, textView) {
  const mode = preferences.story_content_mode
  const fallback = mode !== 'original' && textView?.translation?.fallbackUsed === true
  const label = mode === 'translation' ? '译文' : mode === 'bilingual' ? '双语' : '原文'
  const short = mode === 'translation' ? '译' : mode === 'bilingual' ? '双' : '原'
  return {
    label: fallback ? '仅原文' : label,
    compact: short + (fallback ? '*' : ''),
    description: fallback ? `${label}模式，本段暂无可用译文，当前显示原文。点击切换正文语言。` : `${label}模式，点击切换正文语言。`,
  }
}
