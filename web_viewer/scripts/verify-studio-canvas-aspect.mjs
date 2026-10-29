import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The studio picture is always 16:9. Every rule that sizes the canvas keeps aspect-ratio 16 / 9 (from the base
// rule) and, where it fits the frame's height too, derives the width from that height × 1.777778; a width that
// ignores the height cap squashed the picture on short phones before (390×667: 2.27 instead of 1.78).
const css = readFileSync(new URL('../src/styles/picture-studio.css', import.meta.url), 'utf8')
const rules = [...css.matchAll(/([^{}]*\.studio-canvas\s*)\{([^}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim().split('\n').pop().trim(), body }))
  .filter(rule => /(?:^|;)\s*(?:width|height)\s*:/.test(rule.body))
assert.ok(rules.length >= 2, 'studio canvas sizing rules found')
const base = rules.find(rule => rule.selector === '.studio-canvas')
assert.ok(base && /aspect-ratio:\s*16\s*\/\s*9/.test(base.body), 'the base canvas rule keeps aspect-ratio 16 / 9')
for (const { selector, body } of rules) {
  assert.ok(!/(?:^|;)\s*height\s*:/.test(body), `${selector} sets a height; the aspect ratio must decide it`)
  const width = /(?:^|;)\s*width:\s*([^;]+)/.exec(body)?.[1]?.trim() || ''
  if (/cqh/.test(width)) assert.ok(/calc\(100cqh \* 1\.777778\)/.test(width), `${selector} caps by the frame height but not at 16:9: width: ${width}`)
  else assert.ok(/^(?:100cqw|100%)$/.test(width), `${selector} sets a width that neither fills the frame nor follows the 16:9 height cap: width: ${width}`)
}
console.log(`Studio canvas aspect: ${rules.length} canvas sizing rules keep 16:9 (height from the ratio, width capped by height × 16/9)`)
