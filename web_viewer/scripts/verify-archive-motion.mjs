import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installImageReveal, IMAGE_LOADED_ATTRIBUTE } from '../src/presentation/imageReveal.js'

// Archive motion contract (docs/GS_UI_CONSTITUTION.md, 动效): restrained, never delaying input,
// exits shorter than entrances, reduced motion keeps fades only, and every layer that animates in
// keeps its content while it animates out.
const root = fileURLToPath(new URL('..', import.meta.url))
const read = file => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')
const motion = read('src/styles/gs-motion.css')

// Durations: one ladder, nothing past the sheet ceiling, page <= exit < enter <= sheet.
const ms = name => Number(motion.match(new RegExp(`--gs-motion-${name}:\\s*(\\d+)ms`))?.[1])
const [exit, page, enter, sheet] = ['exit', 'page', 'enter', 'sheet'].map(ms)
assert.ok(page <= exit && exit < enter && enter <= sheet && sheet <= 240, `motion ladder ${exit}/${page}/${enter}/${sheet}`)
for (const [, value] of motion.matchAll(/(\d+)ms/g)) assert.ok(Number(value) <= 240, `no motion step above 240ms (${value}ms)`)
assert.ok(!/infinite/.test(motion), 'no looping motion')

// Reduced motion drops travel and keeps the fades; it must come after the defaults it overrides.
const reduced = motion.slice(motion.indexOf('@media (prefers-reduced-motion: reduce)'))
assert.ok(reduced.length < motion.length, 'reduced-motion block exists')
assert.match(reduced, /\.gs-enter-panel, \.gs-enter-popover, \.gs-enter-drawer, \.gs-enter-sheet \{ --gs-enter-from: none; \}/)
assert.match(reduced, /\.gs-dialog-motion \{ --gs-dialog-from: none; \}/)
assert.ok(motion.lastIndexOf('--gs-enter-from: var(') < motion.indexOf('@media (prefers-reduced-motion: reduce)'), 'defaults precede the reduced-motion override')

// Components change travel through the override variables only, so reduced motion still wins.
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const file = path.join(dir, name)
    return statSync(file).isDirectory() ? walk(file) : /\.(vue|css)$/.test(name) ? [file] : []
  })
}
for (const file of walk(path.join(root, 'src'))) {
  if (file.endsWith('gs-motion.css')) continue
  const source = readFileSync(file, 'utf8')
  assert.ok(!/--gs-(?:enter|dialog)-from\s*:/.test(source), `${path.relative(root, file)} sets --gs-*-travel, not --gs-*-from`)
}

// Press feedback and image reveal stay at zero specificity so components keep the last word.
assert.match(motion, /^:where\(button, a\[href\], summary, \[role="button"\], \[role="tab"\], \[role="option"\]\) \{\n  transition:/m)
assert.match(motion, /@media \(hover: none\) \{\n  :where\(button[^{]*:where\(:active:not\(:disabled, \[aria-disabled="true"\]\)\) \{\n    transform: scale\(\.97\);\n    filter: brightness\(\.92\);/)
assert.match(motion, /:where\(#story-viewer, body > :not\(#app\)\) :where\(img:not\(\[data-gs-loaded\]\)\) \{ opacity: 0; \}/)

const main = read('src/main.js')
assert.ok(main.includes("import './styles/gs-motion.css'"), 'motion styles load with the tokens')
assert.ok(main.indexOf('installImageReveal()') > -1 && main.indexOf('installImageReveal()') < main.indexOf('.mount('), 'images are watched before the app renders any')

// Image reveal: load and error both mark (failed images keep their alt text and fallbacks), and
// anything already complete when the watcher starts is marked at once.
{
  const listeners = {}
  const image = (complete = false) => {
    const attributes = new Map()
    return { tagName: 'IMG', complete, hasAttribute: name => attributes.has(name), setAttribute: (name, value) => attributes.set(name, value) }
  }
  const early = image(true), late = image(), broken = image()
  const doc = {
    addEventListener: (type, fn, capture) => { assert.equal(capture, true, `${type} is captured; it does not bubble`); listeners[type] = fn },
    removeEventListener: type => { delete listeners[type] },
    querySelectorAll: () => [early, late],
  }
  const uninstall = installImageReveal(doc)
  assert.ok(early.hasAttribute(IMAGE_LOADED_ATTRIBUTE), 'an image complete before the watcher is not left hidden')
  assert.ok(!late.hasAttribute(IMAGE_LOADED_ATTRIBUTE))
  listeners.load({ target: late }); listeners.error({ target: broken }); listeners.load({ target: { tagName: 'SCRIPT' } })
  assert.ok(late.hasAttribute(IMAGE_LOADED_ATTRIBUTE) && broken.hasAttribute(IMAGE_LOADED_ATTRIBUTE))
  uninstall()
  assert.deepEqual(Object.keys(listeners), [])
}

// Page change: a fade only. A transform on the page root would re-anchor its fixed bars mid-fade.
const shell = read('src/components/archive/ArchiveShell.vue')
const pageRule = shell.match(/\.archive-content > :deep\(\*\) \{([^}]*)\}/)?.[1] || ''
assert.match(pageRule, /animation: gs-page-in var\(--gs-motion-page\)/)
assert.match(motion, /--gs-page-from: \.[1-5]\d*;/, 'a page never starts fully transparent')
assert.ok(!/transform/.test(pageRule))

// Layers: each enters with the shared motion and keeps its content while leaving.
const dialog = read('src/components/archive/terminal/ArchiveTerminalDialog.vue')
assert.ok(dialog.includes('class="terminal-dialog gs-dialog-motion"'))
assert.ok(dialog.includes('<slot v-if="contentOpen" />'), 'the dialog body outlives the close fade')
assert.match(dialog, /if \(!open\) releaseTimer = setTimeout\(\(\) => \{ if \(!props\.open\) contentOpen\.value = false \}, EXIT_MS\)/)
assert.ok(Number(dialog.match(/EXIT_MS = (\d+)/)?.[1]) > exit, 'the body unmounts only after the exit fade')
const reader = read('src/components/archive/ReaderWorkspaceControls.vue')
assert.ok(reader.includes('class="reader-sheet gs-dialog-motion"') && reader.includes('--gs-dialog-travel:translateY(100%)'))
assert.ok(reader.includes("v-if=\"shownPanel === 'directory' || shownPanel === 'chapters'\"") && !/<template v-if="panel ===/.test(reader), 'a closing reader sheet keeps showing its panel')
assert.ok(Number(reader.match(/SHEET_EXIT_MS = (\d+)/)?.[1]) > exit)
assert.ok(read('src/components/archive/ArchiveFilterSheet.vue').includes('--gs-dialog-travel: translateY(100%); --gs-dialog-duration: var(--gs-motion-sheet);'), 'the phone filter sheet rises from the bottom edge')
assert.ok(read('src/components/archive/ArchiveOnboarding.vue').includes('class="onboarding gs-dialog-motion"'))
const seasonal = read('src/components/archive/ArchiveSeasonalCampaign.vue')
assert.match(seasonal, /<Transition name="gs-overlay">\n\s+<div v-if="drawer" class="seasonal-drawer-backdrop gs-enter-backdrop"/)
assert.ok(seasonal.includes('class="seasonal-drawer gs-enter-drawer"') && seasonal.includes('--gs-enter-travel: translateY(100%)'), 'drawer on wide screens, bottom sheet on phones')
assert.match(read('src/components/archive/ArchiveImageLightbox.vue'), /<Transition name="gs-overlay">\n\s+<div\n\s+v-if="open && currentItem"\n\s+class="lightbox-backdrop gs-enter-backdrop"/)
assert.ok(read('src/components/archive/CollectionQuickView.vue').includes('collection-quick-dialog gs-enter-drawer'))
assert.ok(read('src/components/archive/CollectionDetailPanel.vue').includes("'gs-enter-panel':modal"))
assert.ok(read('src/components/archive/ArchivePortalOverview.vue').includes('class="overview-search-results gs-enter-popover"'))

console.log(`Archive motion: ${exit}/${page}/${enter}/${sheet}ms ladder, reduced motion, zero-specificity press and image reveal, opacity-only page change, nine layers wired (six also leave with a fade, keeping their content) passed. Source/contract evidence; feel on real touch devices is separate.`)
