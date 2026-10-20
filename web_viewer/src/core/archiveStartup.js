import { isArchiveLocatorPath, readArchiveRoute } from './archiveRoute.js'

const TRACKING_KEYS = new Set(['gclid', 'fbclid', 'msclkid'])

function isTrackingKey(key) {
  return TRACKING_KEYS.has(key) || key.startsWith('utm_')
}

// A path that is not a locator (/idols/xyz/, /office/) addresses nothing, so it starts like `/`.
export function isBareArchiveEntry(input) {
  const url = new URL(input, 'http://localhost/')
  if (!['/', '/index.html'].includes(url.pathname) && isArchiveLocatorPath(url.pathname)) return false
  for (const key of url.searchParams.keys()) {
    if (!isTrackingKey(key)) return false
  }
  return !url.hash
}

export function canResolveArchiveStartupBeforeData(input, preferences) {
  return !(isBareArchiveEntry(input) && preferences?.startupPage === 'home')
}

function validIdol(idolCode, validHomeIdols) {
  return typeof idolCode === 'string' && validHomeIdols.includes(idolCode)
}

export function resolveArchiveStartup(input, preferences, validHomeIdols = [], { history = false } = {}) {
  if (!isBareArchiveEntry(input)) {
    const route = readArchiveRoute(input, { history })
    return {
      route,
      lightweight: route.view === 'welcome' || route.view === 'portal' ||
        (route.view === 'home' && !route.homeIdol),
      source: 'explicit',
    }
  }
  if (preferences?.startupPage === 'home') {
    const idol = [preferences.startupIdol, preferences.preferredIdol].find(id => validIdol(id, validHomeIdols))
    return { route: idol ? { view: 'home', homeIdol: idol } : { view: 'home' }, lightweight: !idol, source: idol ? 'preference' : 'invalid-home-idol' }
  }
  if (preferences?.startupPage === 'portal' || preferences?.onboardingComplete) {
    return { route: { view: 'portal', ...(preferences?.portalDefaultScope === 'all' ? {portalScope:'all'} : {}) }, lightweight: true, source: 'preference' }
  }
  // A new visitor starts in the archive; App shows the onboarding sheet over it.
  return { route: { view: 'portal' }, lightweight: true, source: 'new-user' }
}

export function resolveArchiveHomeAction(preferences, validHomeIdols = []) {
  const idol = [preferences?.startupIdol, preferences?.preferredIdol].find(id => validIdol(id, validHomeIdols))
  return idol ? { view: 'home', homeIdol: idol } : { view: 'home' }
}
