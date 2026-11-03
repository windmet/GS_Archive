import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Browser acceptance profiles live on the workspace drive (web_viewer/.analysis/browser-profiles), not in the system
// Temp. A Chrome profile is tens to hundreds of MB, and Windows keeps it locked until every Chrome child process has
// exited: killing only the main process and deleting at once, with the failure swallowed, left 752 profiles (21 GiB)
// on C: by 2026-11-04. GS_BROWSER_PROFILE_ROOT overrides the location.
export const BROWSER_PROFILE_ROOT = path.resolve(process.env.GS_BROWSER_PROFILE_ROOT
  || fileURLToPath(new URL('../../.analysis/browser-profiles/', import.meta.url)))
const STALE_MS = 6 * 60 * 60 * 1000

export function createBrowserProfile(name) {
  mkdirSync(BROWSER_PROFILE_ROOT, { recursive: true })
  sweepStaleProfiles()
  return mkdtempSync(path.join(BROWSER_PROFILE_ROOT, `gs-${name}-`))
}

// Profiles an interrupted run left behind. Removal is best effort here: one a live browser still holds is retried
// by the next run's sweep.
function sweepStaleProfiles() {
  for (const name of readdirSync(BROWSER_PROFILE_ROOT)) {
    const dir = path.join(BROWSER_PROFILE_ROOT, name)
    try {
      if (Date.now() - statSync(dir).mtimeMs > STALE_MS) rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
    } catch { /* still locked: the next sweep tries again */ }
  }
}

// Stops the browser with its whole process tree, waits until it has exited, then removes the profile, retrying while
// Windows still holds its files. A profile that cannot be removed is reported, never ignored.
export async function closeBrowser(chrome, profile) {
  if (chrome.exitCode === null && chrome.signalCode === null) {
    const exited = new Promise(resolve => chrome.once('exit', resolve))
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
    else chrome.kill()
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 10000))])
  }
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  } catch (error) {
    console.error(`Browser profile left behind (${error.code}): ${profile}`)
  }
}
