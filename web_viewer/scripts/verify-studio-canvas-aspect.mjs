import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The studio picture is always 16:9. Any rule that caps the canvas height by the screen must derive
// its width from the same cap (× 1.777778); a fixed `width: 100%` beside a capped height squashed the
// picture on short phones with the bottom-sheet menu open (390×667: 2.27 instead of 1.78).
const css = readFileSync(new URL('../src/styles/picture-studio.css', import.meta.url), 'utf8')
const rules = [...css.matchAll(/([^{}]*\.studio-canvas[^{}]*)\{([^}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(rule => /\bheight:\s*min\(/.test(rule.body))
assert.ok(rules.length >= 3, 'studio canvas sizing rules found')
for (const { selector, body } of rules) {
  const width = /(?:^|;)\s*width:\s*([^;]+)/.exec(body)?.[1] || ''
  assert.ok(/1\.777778/.test(width), `${selector} caps the height but its width does not follow the same 16:9 cap: width: ${width || '(none)'}`)
}
console.log(`Studio canvas aspect: ${rules.length} height-capped canvas rules all derive width from the 16:9 cap`)
