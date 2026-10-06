import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Vertical scroll areas keep their scrollbar's room, so switching between short and long content
// (studio tabs, pages, dialogs) never shifts the layout by a scrollbar's width. A root that does
// not scroll (the focused studio) must not reserve it, or it shows an empty strip.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const tokens = read('src/styles/GS_UI_TOKENS.css')
const rule = tokens.match(/([^{}]+)\{\s*scrollbar-gutter:\s*stable;\s*\}/)
assert.ok(rule, 'the archive-wide stable gutter rule exists')
for (const selector of ['[data-archive-scroll-container]', '.studio-focus-drawer', '.terminal-dialog-body', '.settings-body', '.reader-sheet-content'])
  assert.ok(rule[1].includes(selector), `stable gutter covers ${selector}`)
const studio = read('src/styles/picture-studio.css')
assert.match(studio, /\.studio-page\.is-focused \{[^}]*overflow: hidden;[^}]*scrollbar-gutter: auto;/, 'the focused studio page reserves no gutter')
console.log('Scroll gutter: page roots, studio drawer and dialog bodies keep a stable gutter; the focused studio does not')
