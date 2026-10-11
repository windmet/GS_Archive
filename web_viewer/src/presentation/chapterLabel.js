import { uiLocale } from '../localization/ui/UiLocaleStore.js'

// Chapter labels arrive in source form (第1話, プロローグ / PROLOGUE, エピローグ, 最終話, and
// "第1話 - 副題"). With the Chinese UI the leading label word is shown in Chinese; the subtitle
// after it is left alone, and the Japanese UI keeps the source text.
const LEADING = [
  [/^第([0-9０-９]+)話/u, (_, n) => `第${n.normalize('NFKC')}话`],
  [/^最終話/u, () => '最终话'],
  [/^(?:プロローグ|PROLOGUE(?![A-Za-z]))/u, () => '序章'],
  [/^(?:エピローグ|EPILOGUE(?![A-Za-z]))/u, () => '尾声'],
]

export function presentChapterLabel(text, locale = 'zh-CN') {
  const source = String(text ?? '')
  if (locale !== 'zh-CN') return source
  for (const [pattern, replace] of LEADING) if (pattern.test(source)) return source.replace(pattern, replace)
  return source
}

// Template helper: follows the archive language switch.
export const chapterLabel = text => presentChapterLabel(text, uiLocale.value)
