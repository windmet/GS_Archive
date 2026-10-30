#!/usr/bin/env node
// The song page's playback has one owner per job (GS_ARCHIVE_SONG_PLAYER_GOVERNANCE_20261030.md):
// the stage entry lives only at the console's foot, versions are chosen only in the version panel,
// the panel's tab row never disappears, and the audition state is created once and held by no view.
// Source-only, so it runs in CI without the corpus.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const read = file => readFileSync(new URL(file, root), 'utf8')
const archive = 'src/components/archive/'
const songFiles = readdirSync(new URL(archive, root)).filter(name => /^ArchiveSong.*\.vue$/.test(name)).map(name => archive + name)
const detail = read(`${archive}ArchiveSongDetail.vue`)
const panel = read(`${archive}ArchiveSongVersionPanel.vue`)
const consoleView = read(`${archive}ArchiveSongAuditionConsole.vue`)
const audition = read('src/composables/useSongAudition.js')
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

// 1. One stage entry: only SongDetail emits open-stage, from openStage(), and only the console foot calls it.
for (const file of songFiles) {
  const source = read(file)
  const emits = source.match(/emit\(\s*'open-stage'/g) || []
  if (file.endsWith('ArchiveSongDetail.vue')) check(emits.length === 1, `${file}: open-stage must be emitted once, from openStage() (found ${emits.length})`)
  else check(emits.length === 0, `${file}: only the console foot opens the stage; found ${emits.length} open-stage emit(s)`)
  check(!/进入 Chibi 舞台|openStageWithLineup|lineup-stage-handoff/.test(source), `${file}: the retired lineup stage button is back`)
}
const footer = detail.match(/<div[^>]*class="song-console-links"[^]*?<\/div>/)?.[0] || ''
check((footer.match(/openStage\(/g) || []).length === 1, 'the console foot holds the one stage button')
check((detail.match(/openStage\(/g) || []).length === 2, 'openStage() is defined once and called only from the console foot')
check(/openStage\(lineupStageTarget \|\|/.test(footer), 'the stage button carries a loaded lineup (audition.stageTarget)')

// 2. One place chooses versions: no shortcut bar or list actions on the page itself.
check(!/version-pill|song-version-bar|playUnit|playSolo|addToLineup|playAllStars|playBacking|revealPlayer/.test(detail),
  'SongDetail must not offer a second way to choose what plays (版本试听 bar, 音源收录 actions or their bridges)')
check(!/chooseMode|selectSolo|assignStagePosition|unitKey|trackKey/.test(consoleView), 'the console plays; it does not choose versions')

// 3. The tab row is always there: it is not conditional, and no mode swaps it for an indicator.
const tabs = panel.match(/<div[^>]*class="version-tabs"[^>]*>/)?.[0]
check(Boolean(tabs), 'the version panel has a tab row')
check(tabs && !/\sv-(if|else|else-if|show)\b/.test(tabs), 'the tab row is never hidden')
check(!/unitSelectorOpen|unit-preset-indicator/.test(panel + audition), 'no mode replaces the tab row with an indicator')
const sectionOpen = panel.match(/<section[^>]*class="song-block song-version-panel"[^>]*>/)?.[0] || ''
check(sectionOpen && !/\sv-(if|show)\b/.test(sectionOpen), 'the panel itself is not toggled by mode')

// 4. No native dropdowns in the audition. (The Center line <select> in ArchiveSongSinglePlayer is the
//    separate P6 remainder recorded in PORTAL_REDESIGN_PROGRESS; it is not part of the stem audition.)
for (const [name, source] of [['ArchiveSongDetail', detail], ['ArchiveSongVersionPanel', panel], ['ArchiveSongAuditionConsole', consoleView],
  ['ArchiveSongBalance', read(`${archive}ArchiveSongBalance.vue`)]]) {
  check(!/<select\b/.test(source), `${name}: choices are tabs, pills, value rows or the idol drawer, never <select>`)
}

// 5. One state owner: the composable is instantiated once (SongDetail) and the views hold no session.
const owners = [...songFiles, 'src/App.vue'].filter(file => /useSongAudition\(/.test(read(file)))
check(owners.length === 1 && owners[0].endsWith('ArchiveSongDetail.vue'), `useSongAudition must be created once, in SongDetail (found: ${owners.join(', ') || 'none'})`)
for (const [name, source] of [['ArchiveSongVersionPanel', panel], ['ArchiveSongAuditionConsole', consoleView]]) {
  check(!/useSongPerformanceSession|new Audio|createElement\('audio'\)/.test(source), `${name}: a view must not hold its own audio engine`)
}
check((audition.match(/useSongPerformanceSession\(\)/g) || []).length === 2, 'the audition owns exactly the Solo and lineup sessions')

// 6. Playback never reflows the page: the console's status is one line, who sings is shown on the slots
//    (the spelled-out list is for screen readers only), and on wide screens a growing console adds space
//    under the panel instead of pushing the head row and the five slots down (measured 400 → 771px without it).
check(/\.song-detail-layout\.has-version-panel \{ grid-template-rows: auto 1fr auto; \}/.test(detail), 'row 2 absorbs console growth (grid-template-rows: auto 1fr auto)')
check(/\.audition-now \{[^}]*flex-wrap: nowrap/.test(consoleView) && /\.audition-now strong \{[^}]*white-space: nowrap/.test(consoleView), 'the now-playing line never wraps')
check(/\.audition-singers \{[^}]*position: absolute;[^}]*clip: rect\(0 0 0 0\)/.test(consoleView), 'the current-singers list is announced, not laid out')

assert.deepEqual(failures, [], `Song console ownership:\n${failures.join('\n')}`)
console.log(`Song console ownership: one stage entry, one version chooser with a permanent tab row, no native selects, one audition owner (${songFiles.length} song components scanned)`)
