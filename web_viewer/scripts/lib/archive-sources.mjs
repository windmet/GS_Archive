import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB_VIEWER_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)
const DEFAULT_LOCAL_CONFIG = path.join(
  WEB_VIEWER_ROOT,
  'config',
  'archive_sources.local.json',
)
const DEFAULT_EXAMPLE_CONFIG = path.join(
  WEB_VIEWER_ROOT,
  'config',
  'archive_sources.example.json',
)

// A linked git worktree (its .git is a file, `gitdir: <main>/.git/worktrees/<name>`) returns the main checkout's
// root; the main checkout and CI checkouts return null.
export function mainCheckoutRoot(repoRoot = path.dirname(WEB_VIEWER_ROOT)) {
  const marker = path.join(repoRoot, '.git')
  let text
  try {
    if (!statSync(marker).isFile()) return null
    text = readFileSync(marker, 'utf8')
  } catch {
    return null
  }
  const gitdir = /^gitdir:\s*(.+)$/m.exec(text)?.[1]?.trim()
  if (!gitdir) return null
  const common = path.resolve(repoRoot, gitdir, '..', '..')
  return path.basename(common) === '.git' ? path.dirname(common) : null
}

// The ignored local config lives in the main checkout only; a worktree reads that one, so its scripts and dev
// server see the same corpus (published files, legacy roots, read-model candidates) without copying anything.
export function localConfigPath(webViewerRoot = WEB_VIEWER_ROOT) {
  const own = path.join(webViewerRoot, 'config', 'archive_sources.local.json')
  if (existsSync(own)) return own
  const main = mainCheckoutRoot(path.dirname(webViewerRoot))
  const shared = main && path.join(main, 'web_viewer', 'config', 'archive_sources.local.json')
  return shared && existsSync(shared) ? shared : null
}

function resolveConfigPath(configPath, environment) {
  const explicit = configPath || environment.SIDEM_ARCHIVE_SOURCES_CONFIG
  if (explicit) {
    const resolved = path.resolve(explicit)
    if (!existsSync(resolved)) throw new Error(`Archive source config not found: ${resolved}`)
    return resolved
  }
  return localConfigPath() || DEFAULT_EXAMPLE_CONFIG
}

function requiredPath(value, base, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty path string`)
  }
  return path.resolve(base, value)
}

function optionalPath(value, base, field) {
  if (value == null) return null
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty path string or null`)
  }
  return path.resolve(base, value)
}

export function loadArchiveSources({
  configPath,
  environment = process.env,
} = {}) {
  const resolvedConfig = resolveConfigPath(configPath, environment)
  const payload = JSON.parse(readFileSync(resolvedConfig, 'utf8'))
  if (payload?.schema_version !== 1) {
    throw new Error('Archive source configuration schema_version must be 1')
  }
  const archiveRoot = requiredPath(
    payload.archive_root,
    path.dirname(resolvedConfig),
    'archive_root',
  )
  const configuredLegacyRoot = optionalPath(
    payload.legacy_root,
    archiveRoot,
    'legacy_root',
  )
  const legacyRoot = configuredLegacyRoot || path.join(
    archiveRoot,
    'sources',
    'legacy_curated',
  )
  return {
    configPath: resolvedConfig,
    archiveRoot,
    // The checkout whose public/ holds the full published corpus (git ignores most of it).
    publishRoot: requiredPath(payload.publish_root || 'web_viewer/public', archiveRoot, 'publish_root'),
    // Optional: a folder of build_readmodels outputs; the dev server picks the one matching the checked-in release.
    readmodelCandidatesRoot: optionalPath(payload.readmodel_candidates_root, archiveRoot, 'readmodel_candidates_root'),
    // RAW game files and the converted media derived from them (ignored by git; see archive_sources.example.json).
    rawRoot: requiredPath(payload.raw_root || 'RAW', archiveRoot, 'raw_root'),
    derivedRoot: requiredPath(payload.derived_root || 'web_viewer/.analysis/derived', archiveRoot, 'derived_root'),
    legacyRoot,
    legacyConfigured: configuredLegacyRoot !== null,
    legacyPath: (...parts) => path.resolve(legacyRoot, ...parts),
  }
}

export const archiveSourceConfigDefaults = {
  example: DEFAULT_EXAMPLE_CONFIG,
  local: DEFAULT_LOCAL_CONFIG,
}
