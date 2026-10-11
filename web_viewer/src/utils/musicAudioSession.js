// Web Audio defaults to ambient on WebKit. Music should use the same playback
// category as an HTML audio element, including when the device is in silent mode.
// Claim only on an explicit play gesture and relinquish when no music is playing.
const owners = new Set()
let activeSession = null
let previousType = 'auto'
export function claimMusicAudioSession(owner, navigatorObject = globalThis.navigator) {
  if (owners.has(owner)) return
  const session = navigatorObject?.audioSession
  if (!session) return
  try {
    if (!owners.size) { activeSession = session; previousType = session.type }
    session.type = 'playback'
    owners.add(owner)
  } catch { if (!owners.size) activeSession = null }
}
export function releaseMusicAudioSession(owner) {
  if (!owners.delete(owner) || owners.size) return
  try { if (activeSession?.type === 'playback') activeSession.type = previousType } catch {}
  activeSession = null
}
