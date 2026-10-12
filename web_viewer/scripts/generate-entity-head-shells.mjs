// Entity head shells: a copy of the built index.html per idol (/idols/<id>/index.html) and unit
// (/units/<code>/index.html) whose <head> carries that entity's title, description, canonical and Open Graph
// tags. The body and scripts are untouched, so the SPA boots as usual and reads the path locator. Link
// previews (X, Discord, LINE) and crawlers that do not run JavaScript see the entity instead of the generic page.
//   node scripts/generate-entity-head-shells.mjs [--dist=.analysis/build-check] [--origin=https://…] [--check]
// Static HTML is zh-CN (docs/GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md §0.1). Names come from the same
// sources the app uses: bootstrap idols for identity and units, zh-CN entity translations for display names.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { archiveEntityTitle } from '../src/presentation/ArchiveDocumentTitle.js'

export const DEFAULT_ORIGIN = 'https://gs-archive-preview.pages.dev'
const SITE = 'GS Archive'
const IDOL_ID = /^[0-9]{3}[a-z]{3}$/
const UNIT_CODE = /^[0-9]{2}[a-z0-9]{3}$/  // W is 05w00

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
}

function headTags({ title, description, url, image, type }) {
  const e = escapeHtml
  return [
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(description)}" />`,
    `<link rel="canonical" href="${e(url)}" />`,
    `<meta property="og:type" content="${e(type)}" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:title" content="${e(title)}" />`,
    `<meta property="og:description" content="${e(description)}" />`,
    `<meta property="og:url" content="${e(url)}" />`,
    `<meta property="og:image" content="${e(image)}" />`,
    `<meta name="twitter:card" content="summary" />`,
  ].map(tag => `    ${tag}`).join('\n')
}

function withHead(template, tags) {
  const titles = template.match(/<title>[\s\S]*?<\/title>/g) || []
  if (titles.length !== 1) throw new Error(`index.html must have exactly one <title>, found ${titles.length}`)
  if ((template.match(/<\/head>/g) || []).length !== 1) throw new Error('index.html must have exactly one </head>')
  return template.replace(/[ \t]*<title>[\s\S]*?<\/title>\r?\n?/, '').replace('</head>', `${tags}\n  </head>`)
}

// idols: bootstrap `idols[]` ({ id, name, kana, unitCode, unitName }); idolNames: { [id]: zh-CN display name }.
export function renderEntityHeadShells({ template, idols, idolNames = {}, origin = DEFAULT_ORIGIN }) {
  const base = origin.replace(/\/$/, '')
  const display = idol => idolNames[idol.id] || idol.name
  const shells = []
  const units = new Map()
  for (const idol of idols) {
    if (!IDOL_ID.test(idol.id)) throw new Error(`Unexpected idol id ${idol.id}`)
    const name = display(idol)
    const aside = [idol.name && idol.name.replace(/\s+/g, '') !== name.replace(/\s+/g, '') ? idol.name : '', idol.unitName || ''].filter(Boolean)
    const location = `/idols/${idol.id}/`
    shells.push({
      path: `idols/${idol.id}/index.html`,
      kind: 'idol', id: idol.id, url: base + location,
      html: withHead(template, headTags({
        title: archiveEntityTitle(name),
        description: `${name}${aside.length ? `（${aside.join('，')}）` : ''}的卡牌、剧情、歌曲与相关档案。`,
        url: base + location,
        image: `${base}/assets/idols/icons/image_chara_icon_${idol.id}.png`,
        type: 'profile',
      })),
    })
    if (idol.unitCode) {
      if (!units.has(idol.unitCode)) units.set(idol.unitCode, { code: idol.unitCode, name: idol.unitName || idol.unitCode, members: [] })
      units.get(idol.unitCode).members.push(name)
    }
  }
  for (const unit of units.values()) {
    if (!UNIT_CODE.test(unit.code)) throw new Error(`Unexpected unit code ${unit.code}`)
    const location = `/units/${unit.code}/`
    shells.push({
      path: `units/${unit.code}/index.html`,
      kind: 'unit', id: unit.code, url: base + location,
      html: withHead(template, headTags({
        title: archiveEntityTitle(unit.name),
        description: `${unit.name}（${unit.members.join('、')}）的成员、卡牌、剧情与歌曲档案。`,
        url: base + location,
        image: `${base}/assets/units/logos/image_unit_logo_${unit.code}.png`,
        type: 'website',
      })),
    })
  }
  return shells
}

export function loadEntitySources(root) {
  const bootstrap = JSON.parse(readFileSync(path.join(root, 'readmodels/bootstrap.inline.json'), 'utf8'))
  const translations = JSON.parse(readFileSync(path.join(root, 'public/translations/zh-CN/entities/idols.json'), 'utf8'))
  const idolNames = Object.fromEntries(Object.entries(translations.entries || {}).map(([id, entry]) => [id, entry?.name]).filter(([, name]) => name))
  return { idols: bootstrap.idols, idolNames, release: bootstrap.release }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const option = name => process.argv.slice(2).find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  const dist = path.resolve(root, option('dist') || '.analysis/build-check')
  const origin = option('origin') || DEFAULT_ORIGIN
  const check = process.argv.includes('--check')
  const templatePath = path.join(dist, 'index.html')
  if (!existsSync(templatePath)) throw new Error(`No built index.html at ${templatePath}; run npm run build:check first`)
  const template = readFileSync(templatePath, 'utf8')
  const shells = renderEntityHeadShells({ template, ...loadEntitySources(root), origin })
  let stale = 0
  for (const shell of shells) {
    const file = path.join(dist, shell.path)
    if (check) { if (!existsSync(file) || readFileSync(file, 'utf8') !== shell.html) stale++; continue }
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, shell.html)
  }
  const idols = shells.filter(s => s.kind === 'idol').length
  if (check && stale) { console.error(`${stale}/${shells.length} entity head shells are missing or stale in ${dist}`); process.exitCode = 1 }
  else console.log(`Entity head shells ${check ? 'up to date' : 'written'}: ${idols} idols + ${shells.length - idols} units in ${path.relative(root, dist) || dist} (origin ${origin})`)
}
