import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [
  storyViewer,
  storyNavigation,
  spineStage,
  advUi,
  iconButton,
  controlDock,
  topBar,
  backlog,
  tokens,
  motion,
  zh,
  ja,
] = await Promise.all([
  read('src/core/StoryViewer.vue'),
  read('src/core/useStoryNavigation.js'),
  read('src/components/SpineStage.vue'),
  read('src/components/AdvUI.vue'),
  read('src/components/player/PlayerIconButton.vue'),
  read('src/components/player/PlayerControlDock.vue'),
  read('src/components/player/PlayerTopBar.vue'),
  read('src/components/StoryBacklog.vue'),
  read('src/styles/player-tokens.css'),
  read('src/styles/player-motion.css'),
  read('src/localization/ui/locales/zh-CN.js'),
  read('src/localization/ui/locales/ja-JP.js'),
])

assert.match(storyViewer, /<PlayerTopBar[\s\S]*<PlayerControlDock/, 'StoryViewer must delegate shell presentation')
assert.doesNotMatch(storyViewer, /\{\{\s*currentStep\.type\s*\}\}/, 'production UI must not expose the raw step type')
assert.doesNotMatch(storyViewer, /:episode-label=/, 'top bar must not claim an unaudited episode label')
assert.doesNotMatch(storyNavigation, /currentEpisodeLabel|`EP\$\{/, 'navigation must preserve boundaries without fabricating EP labels')
assert.match(storyViewer, /:debug-controls="RUNTIME_DEBUG"/, 'Spine debug controls must require runtimeDebug=1')
assert.match(spineStage, /debugControls:\s*\{\s*type:\s*Boolean,\s*default:\s*false\s*\}/, 'Spine debug controls must default off')

assert.match(advUi, /bottom:\s*var\(--player-dialogue-bottom\)/, 'ADV must use the shared dialogue safe area')
assert.match(advUi, /max-height:\s*34vh/, 'desktop ADV must retain a bounded adaptive height')
assert.match(advUi, /@media \(max-width:\s*699px\)/, 'ADV must include the mobile layout contract')

assert.match(iconButton, /:aria-pressed="toggle \? active : undefined"/, 'toggle controls must expose pressed state')
assert.match(controlDock, /toggle @click="\$emit\('auto'\)"/, 'AUTO must opt into toggle semantics')
assert.match(controlDock, /toggle @click="\$emit\('skip'\)"/, 'SKIP must opt into toggle semantics')
assert.match(controlDock, /var\(--player-control-surface\)/, 'control dock must use the accepted light surface')
assert.match(topBar, /role="progressbar"/, 'top bar must expose progress semantics')
assert.match(topBar, /var\(--player-control-surface\)/, 'top bar must use the accepted light surface')
assert.match(advUi, /var\(--player-nameplate-surface\)/, 'ADV nameplate must use the sampled bright aqua surface')
assert.match(tokens, /--player-nameplate-ink:\s*#ffffff/, 'ADV nameplate must preserve the accepted in-game white text')
assert.match(backlog, /var\(--player-log-surface\)/, 'story log must use the shared light surface')
assert.match(backlog, /var\(--player-log-entry-current\)/, 'story log must expose a light current-entry state')

for (const token of [
  '--player-dialogue-bottom',
  '--player-control-surface',
  '--player-control-ink',
  '--player-active-surface',
  '--player-active-text',
  '--player-nameplate-surface',
  '--player-log-surface',
  '--player-log-entry-current',
  '--player-shadow-control',
]) {
  assert.ok(tokens.includes(token), `missing player token ${token}`)
}
assert.match(motion, /prefers-reduced-motion:\s*reduce/, 'player motion must respect reduced-motion preferences')

for (const [name, locale] of [['zh-CN', zh], ['ja-JP', ja]]) {
  for (const key of ['player.progress', 'player.controls', 'player.language']) {
    assert.ok(locale.includes(`'${key}'`), `${name} is missing ${key}`)
  }
}

console.log('Story Player UI PR1: debug gate, light shell, responsive ADV, toggle semantics and motion verified')
