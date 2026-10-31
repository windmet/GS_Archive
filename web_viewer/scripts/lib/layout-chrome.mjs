import {existsSync,readdirSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export function findChrome() {
  const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
  const names = existsSync(cache) ? readdirSync(cache) : []
  const candidates = [
    ...names.filter(name => /^chromium_headless_shell-\d+$/.test(name)).sort().reverse().map(dir => path.join(cache, dir, 'chrome-headless-shell-win64/chrome-headless-shell.exe')),
    ...names.filter(name => /^chromium-\d+$/.test(name)).sort().reverse().map(dir => path.join(cache, dir, 'chrome-win64/chrome.exe')),
  ]
  const found = candidates.find(existsSync)
  if (!found) throw new Error('No cached Playwright Chromium or chrome-headless-shell found under ' + cache)
  return found
}
