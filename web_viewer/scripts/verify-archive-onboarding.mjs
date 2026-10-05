import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { resolveArchiveStartup } from '../src/core/archiveStartup.js'
import { DEFAULT_ARCHIVE_USER_PREFERENCES } from '../src/data/archiveUserPreferences.js'

// A new visitor starts in the archive with the onboarding sheet over it; finishing records the
// favourite idol and may open that idol's home. Runs App.vue's own completeOnboarding.
const unset = { ...DEFAULT_ARCHIVE_USER_PREFERENCES }
const start = resolveArchiveStartup('http://localhost/', unset, ['001tom'])
assert.deepEqual([start.route.view, start.source], ['portal', 'new-user'])
assert.equal(resolveArchiveStartup('http://localhost/', { ...unset, onboardingComplete: true }, []).route.view, 'portal')

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
assert.match(app, /<ArchiveOnboarding\n\s+v-if="view === 'portal' && !userPreferences\.onboardingComplete/, 'the sheet only covers the archive, only until onboarding is complete')
const begin = app.indexOf('function completeOnboarding(')
assert.ok(begin >= 0, 'completeOnboarding exists')
const source = app.slice(begin, app.indexOf('\n}\n', begin) + 2)

function finish(input, { startupPage = 'unset' } = {}) {
  const stored = [], opened = []
  const context = vm.createContext({
    archivePickerIdols: { value: [{ id: '001tom' }, { id: '049nom' }] },
    validArchiveHomeIdols: { value: ['001tom'] },
    userPreferences: { value: { ...unset, startupPage } },
    storeUserPreferences: value => stored.push(value),
    openGameHome: idol => opened.push(idol),
  })
  vm.runInContext(`${source}\ncompleteOnboarding(${JSON.stringify(input)})`, context)
  assert.equal(stored.length, 1, 'one write')
  return JSON.parse(JSON.stringify({ stored: stored[0], opened }))
}

assert.deepEqual(finish({ preferredIdol: '001tom', openHome: true }),
  { stored: { onboardingComplete: true, startupPage: 'portal', preferredIdol: '001tom', startupIdol: '001tom' }, opened: ['001tom'] })
assert.deepEqual(finish({ preferredIdol: '001tom', openHome: false }).opened, [], 'staying in the archive opens nothing')
assert.deepEqual(finish({ preferredIdol: '049nom', openHome: true }),
  { stored: { onboardingComplete: true, startupPage: 'portal', preferredIdol: '049nom' }, opened: [] }, 'an idol without a home is a favourite but not a home')
assert.deepEqual(finish({}).stored, { onboardingComplete: true, startupPage: 'portal' }, 'skipping completes onboarding')
assert.deepEqual(finish({ preferredIdol: 'nobody', openHome: true }), { stored: { onboardingComplete: true, startupPage: 'portal' }, opened: [] }, 'an unknown idol is ignored')
assert.equal(finish({}, { startupPage: 'home' }).stored.startupPage, undefined, 'an existing startup choice is kept')
console.log('Archive onboarding: new visitors start in the archive; finishing stores the favourite, home only when it exists, skip and unknown idols complete safely')
