// Unlock conditions in 通信 are the game's mission titles, five templates in 393 strings. With the
// Chinese UI the template is rendered in Chinese; the subject in 『』 keeps its source text unless
// `name` resolves it (an idol's name in the reader's language). Song and unit names stay as they are.
const TEMPLATES = [
  [/^『(.+)』の信頼度を([0-9０-９,万千]+)にしよう$/u, (x, n) => `将「${x}」的信赖度提升到 ${n}`],
  [/^『(.+)』と累計([0-9０-９,万千]+)回お仕事しよう$/u, (x, n) => `与「${x}」累计完成 ${n} 次工作`],
  [/^『(.+)』を編成して累計([0-9０-９,万千]+)回ライブしよう$/u, (x, n) => `编入「${x}」累计进行 ${n} 次 Live`],
  [/^『(.+)』で累計スコア([0-9０-９,万千]+)を達成しよう$/u, (x, n) => `在「${x}」中累计得分达到 ${n}`],
  [/^『(.+)』に所属するアイドルの合計ファン数を([0-9０-９,万千]+)人にしよう$/u, (x, n) => `「${x}」所属偶像的粉丝总数达到 ${n} 人`],
]

export function presentMissionText(text, { locale = 'zh-CN', name = source => source } = {}) {
  const source = String(text ?? '')
  if (locale !== 'zh-CN') return source
  for (const [pattern, render] of TEMPLATES) {
    const match = source.match(pattern)
    if (match) return render(name(match[1]) || match[1], match[2].normalize('NFKC'))
  }
  return source
}
