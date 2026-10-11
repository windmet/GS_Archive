import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contrastRatio, idolStageLight, idolStageLightProperties, STAGE_LIGHT_TOKENS } from '../src/presentation/idolStageLight.js'
import { normalizeArchiveUserPreferences } from '../src/data/archiveUserPreferences.js'

// The 担当 stage light: every official idol colour must yield readable roles, and the
// app must apply them where the role tokens resolve (the root element).
const root = new URL('..', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const INK = '#13213a', PAPER = '#f5f6f8'

assert.equal(idolStageLight(''), null)
assert.equal(idolStageLight('red'), null, 'only six-digit hex reaches a style token')
assert.deepEqual(idolStageLightProperties(''), {})
assert.equal(idolStageLight('#00081a').silver, true, 'near-black has no hue: silver light')
assert.equal(idolStageLight('#ffe200').silver, false)

const dictionary = JSON.parse(read('public/data/masterdata/idol_unit_dictionary.json'))
const colours = [...new Set(dictionary.idols.map(idol => idol.color).filter(Boolean))]
assert.ok(colours.length >= 40, `expected the full idol roster, got ${colours.length} colours`)
for (const colour of colours) {
  const { light, ink, wash } = idolStageLight(colour)
  assert.ok(contrastRatio(ink, wash) >= 4.5, `${colour}: selected text on its wash ${contrastRatio(ink, wash).toFixed(2)}`)
  assert.ok(contrastRatio(ink, PAPER) >= 4.5, `${colour}: link text on paper ${contrastRatio(ink, PAPER).toFixed(2)}`)
  assert.ok(contrastRatio(light, INK) >= 4.5, `${colour}: play glyph on the light ${contrastRatio(light, INK).toFixed(2)}`)
  assert.deepEqual(Object.keys(idolStageLightProperties(colour)), STAGE_LIGHT_TOKENS)
}

// Opt-in preference, defaulting to the archive mint.
assert.equal(normalizeArchiveUserPreferences({ version: 3 }).stageLight, 'mint')
assert.equal(normalizeArchiveUserPreferences({ version: 3, stageLight: 'idol' }).stageLight, 'idol')
assert.equal(normalizeArchiveUserPreferences({ version: 3, stageLight: '#fff' }).stageLight, 'mint')

// Role tokens are declared on :root from the mint tokens, so the override must be on the root element.
const tokens = read('src/styles/GS_UI_TOKENS.css')
for (const role of ['--gs-selected-bg: var(--gs-mint-wash)', '--gs-selected-ink: var(--gs-mint-ink)', '--gs-play-bg: var(--gs-mint)']) assert.ok(tokens.includes(role), role)
const app = read('src/App.vue')
assert.match(app, /stageLight === 'idol' \? preferredArchiveIdol\.value : null/)
assert.match(app, /document\.documentElement[\s\S]{0,200}for \(const token of STAGE_LIGHT_TOKENS\)[\s\S]{0,200}removeProperty\(token\)/)
// The 担当 in the sidebar is its own switch (colour on/off, change 担当) and shows as the avatar
// ring only; the sidebar carries no coloured strip (too bright on navy).
assert.match(app, /<template #sidebar-identity>[\s\S]{0,200}<ArchiveStageIdolSwitch[\s\S]{0,400}:stage-light="Boolean\(stageLightIdol\)"[\s\S]{0,300}@save-preferred="savePreferredIdol"[\s\S]{0,100}@save-startup="storeUserPreferences"/)
const shell = read('src/components/archive/ArchiveShell.vue')
assert.match(shell, /<slot name="sidebar-identity" \/>/)
assert.doesNotMatch(shell, /\.archive-sidebar[^{]*\{[^}]*(box-shadow|border-top|background)[^}]*var\(--gs-mint/)
const stageSwitch = read('src/components/archive/ArchiveStageIdolSwitch.vue')
assert.match(stageSwitch, /:accent-color="ring"/)
assert.match(stageSwitch, /props\.stageLight \? idolStageLight\(props\.idol\?\.color\)/)
assert.match(stageSwitch, /stageLight: \$event\.target\.checked \? 'idol' : 'mint'/)
assert.match(stageSwitch, /<ArchiveIdolPickerPanel[\s\S]{0,200}@update:model-value="emit\('save-preferred', \$event\)/)
assert.match(read('src/components/archive/ArchiveProducerSettings.vue'), /stageLight:\$event\.target\.checked \? 'idol' : 'mint'/)

// Errors never rely on the critical colour alone.
for (const [file, cls] of [['src/components/ChibiStageViewer.vue', 'audio-error'], ['src/components/SpineViewer.vue', 'audio-error'],
  ['src/components/archive/ArchiveSongLineupPlayer.vue', 'lineup-error'], ['src/components/archive/ArchiveSongExperimentalPlayer.vue', 'experimental-error'],
  ['src/components/archive/ArchiveSongLyrics.vue', 'song-lyrics-error'], ['src/components/archive/ArchiveSongSinglePlayer.vue', 'single-song-error']]) {
  assert.match(read(file), new RegExp(`<ArchiveErrorNote [^>]*class="${cls}"`), `${file}: ${cls} uses ArchiveErrorNote`)
}
assert.match(read('src/components/archive/ArchiveErrorNote.vue'), /<CircleAlert[^>]*aria-hidden="true"/)

console.log(`Idol stage light: ${colours.length} idol colours readable; root override, sidebar, settings and error icons wired`)
