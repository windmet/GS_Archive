import { existsSync, readFileSync } from 'node:fs'
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

function resolveConfigPath(configPath, environment) {
  const explicit = configPath || environment.SIDEM_ARCHIVE_SOURCES_CONFIG
  if (explicit) {
    const resolved = path.resolve(explicit)
    if (!existsSync(resolved)) throw new Error(`Archive source config not found: ${resolved}`)
    return resolved
  }
  return existsSync(DEFAULT_LOCAL_CONFIG)
    ? DEFAULT_LOCAL_CONFIG
    : DEFAULT_EXAMPLE_CONFIG
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
    legacyRoot,
    legacyConfigured: configuredLegacyRoot !== null,
    legacyPath: (...parts) => path.resolve(legacyRoot, ...parts),
  }
}

export const archiveSourceConfigDefaults = {
  example: DEFAULT_EXAMPLE_CONFIG,
  local: DEFAULT_LOCAL_CONFIG,
}
