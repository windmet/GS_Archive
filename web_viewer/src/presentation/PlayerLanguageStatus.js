export function playerLanguageStatus(preferences, textView) {
  const mode = preferences.story_content_mode
  const fallback = mode !== 'original' && textView?.translation?.fallbackUsed === true
  const label = mode === 'translation' ? '中文' : mode === 'bilingual' ? '双语' : '日文'
  const short = mode === 'translation' ? '中' : mode === 'bilingual' ? '双' : '日'
  return {
    label: label + (fallback ? ' · 本段原文' : ''),
    compact: short + (fallback ? '*' : ''),
    description: fallback ? `${label}模式，本段暂无可用译文，当前显示原文。点击切换语言。` : `${label}模式，点击切换语言。`,
  }
}
