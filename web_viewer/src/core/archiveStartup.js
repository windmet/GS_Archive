import { readArchiveRoute } from './archiveRoute.js'

const TRACKING_KEYS = new Set(['gclid', 'fbclid', 'msclkid'])

function isTrackingKey(key) {
  return TRACKING_KEYS.has(key) || key.startsWith('utm_')
}

export function isBareArchiveEntry(input) {
  const url = new URL(input, 'http://localhost/')
  if (!['/', '/index.html'].includes(url.pathname)) return false
  for (const key of url.searchParams.keys()) {
    if (!isTrackingKey(key)) return false
  }
  return !url.hash
}

export function canResolveArchiveStartupBeforeData(input, preferences) {
  return !(isBareArchiveEntry(input) && preferences?.startupMode === 'immersive')
}

function validIdol(idolCode, validHomeIdols) {
  return typeof idolCode === 'string' && validHomeIdols.includes(idolCode)
}

export function resolveArchiveStartup(input, preferences, validHomeIdols = []) {
  if (!isBareArchiveEntry(input)) {
    const route = readArchiveRoute(input)
    return {
      route,
      lightweight: route.view === 'welcome' || route.view === 'portal' ||
        (route.view === 'home' && !route.homeIdol),
      source: 'explicit',
    }
  }
  if (preferences?.startupMode === 'light') {
    return { route: { view: 'portal' }, lightweight: true, source: 'preference' }
  }
  if (preferences?.startupMode === 'immersive') {
    if (validIdol(preferences.startupIdol, validHomeIdols)) {
      return { route: { view: 'home', homeIdol: preferences.startupIdol }, lightweight: false, source: 'preference' }
    }
    return { route: { view: 'home' }, lightweight: true, source: 'invalid-immersive-idol' }
  }
  return { route: { view: 'welcome' }, lightweight: true, source: 'new-user' }
}

export function resolveArchiveHomeAction(preferences, validHomeIdols = []) {
  if (preferences?.startupMode === 'light') return { view: 'portal' }
  if (preferences?.startupMode === 'immersive' && validIdol(preferences.startupIdol, validHomeIdols)) {
    return { view: 'home', homeIdol: preferences.startupIdol }
  }
  return preferences?.startupMode === 'immersive' ? { view: 'home' } : { view: 'welcome' }
}
