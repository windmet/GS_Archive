import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// Opened from the Home Screen the site must run without browser bars (the only full screen iPhone Safari offers
// 沉浸查看), start at the root, and use an icon the site actually serves.
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
function check(html, manifestText) {
  const link = /<link rel="manifest" href="\/(src\/[^"]+\.webmanifest)" \/>/.exec(html)
  assert.ok(link, 'index.html links the manifest from src/ so Vite emits it with the code')
  const manifest = JSON.parse(manifestText ?? read(link[1]))
  assert.equal(manifest.display, 'standalone', 'manifest opens without browser bars')
  assert.equal(manifest.start_url, '/'); assert.equal(manifest.scope, '/')
  assert.ok(manifest.icons?.length && manifest.icons.every(icon => existsSync(new URL(`../public${icon.src}`, import.meta.url))), 'manifest icons are served files')
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/, 'iOS opens the Home Screen site without Safari bars')
  const touchIcon = /<link rel="apple-touch-icon" href="([^"]+)" \/>/.exec(html)
  assert.ok(touchIcon && existsSync(new URL(`../public${touchIcon[1]}`, import.meta.url)), 'iOS Home Screen icon is a served file')
}
const html = read('index.html'), manifest = read('src/site.webmanifest')
check(html)
for (const [name, mutate] of Object.entries({
  'browser display': () => check(html, manifest.replace('"standalone"', '"browser"')),
  'no iOS capable meta': () => check(html.replace('apple-mobile-web-app-capable', 'x-apple'), manifest),
  'missing icon': () => check(html, manifest.replace('image_chara_icon_producer.png', 'missing.png')),
})) assert.throws(mutate, undefined, `mutation not detected: ${name}`)
console.log('Home Screen app: standalone manifest emitted with the code, root start/scope, served icons, iOS capable meta; 3 mutations detected')
