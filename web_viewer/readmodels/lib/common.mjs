import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const entityKey = id => sha256(String(id)).slice(0, 32);
export const wire = value => JSON.parse(JSON.stringify(value)); // NaN -> null: explicit wire contract.
export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
export const jsonBytes = value => Buffer.from(JSON.stringify(stable(wire(value))) + '\n');
export function assert(condition, message) { if (!condition) throw new Error(message); }
export function parseArgs(argv, allowed) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    assert(allowed.includes(key), `Unknown argument: ${key}`);
    assert(!Object.hasOwn(result, key), `Duplicate argument: ${key}`);
    assert(argv[i + 1] && !argv[i + 1].startsWith('--'), `Missing value: ${key}`);
    result[key] = argv[++i];
  }
  return result;
}
export async function createOutput(out, forbidden = []) {
  assert(out, 'Supply an output directory');
  const candidate = path.resolve(out), parent = await fs.realpath(path.dirname(candidate));
  const resolved = path.join(parent, path.basename(candidate));
  for (const root of forbidden) {
    const real = await fs.realpath(root), relative = path.relative(real, resolved);
    assert(relative && !(!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)), `Output must be outside source tree: ${real}`);
    const reverse = path.relative(resolved, real);
    assert(reverse.startsWith('..' + path.sep) || reverse === '..' || path.isAbsolute(reverse), 'Output cannot be an ancestor of the source');
  }
  await fs.mkdir(resolved); // EEXIST intentional; never delete or overwrite a previous build.
  return resolved;
}
export async function safeRead(root, relative) {
  const realRoot = await fs.realpath(root), target = await fs.realpath(path.join(realRoot, relative));
  const rel = path.relative(realRoot, target);
  assert(rel && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel), `Outside source: ${relative}`);
  const stat = await fs.stat(target); assert(stat.isFile(), `Not a file: ${relative}`);
  return fs.readFile(target);
}
export async function listFiles(root, rel = '') {
  const found = [];
  for (const item of await fs.readdir(path.join(root, rel), { withFileTypes: true })) {
    assert(!item.isSymbolicLink(), `Symlink forbidden: ${rel}/${item.name}`);
    const key = path.posix.join(rel, item.name);
    if (item.isDirectory()) found.push(...await listFiles(root, key));
    else if (item.isFile()) found.push(key);
    else throw new Error(`Unsupported file: ${key}`);
  }
  return found.sort();
}
export class ArtifactWriter {
  constructor(root, release, limits = {}) {
    assert(/^[a-f0-9]{64}$/.test(release), 'Invalid release hash');
    this.root = root; this.release = release; this.records = [];
    this.limits = { maxRaw: 768 * 1024, maxGzip: 256 * 1024, maxFiles: 9000, ...limits };
  }
  async emit(name, kind, data, limits = {}) {
    assert(/^[a-z0-9_./-]+\.json$/.test(name) && !name.split('/').some(p => !p || p === '.' || p === '..'), `Unsafe output name: ${name}`);
    const payload = { schema_version: 1, release: this.release, kind, data };
    const bytes = jsonBytes(payload), gzipBytes = gzipSync(bytes, { level: 9 }).length;
    const budget = { ...this.limits, ...limits };
    assert(bytes.length <= budget.maxRaw, `RAW_BUDGET ${name}: ${bytes.length} > ${budget.maxRaw}. Partition this product; do not raise globally.`);
    assert(gzipBytes <= budget.maxGzip, `GZIP_BUDGET ${name}: ${gzipBytes} > ${budget.maxGzip}`);
    assert(this.records.length < budget.maxFiles, 'Pages read-model file budget exceeded');
    const relative = `_catalog/v/${this.release}/${name}`;
    const target = path.join(this.root, 'pages', relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: 'wx' });
    const record = { url: `/${relative}`, kind, sha256: sha256(bytes), bytes: bytes.length, gzip_estimate: gzipBytes };
    this.records.push(record); return record;
  }
  async pages(name, kind, rows, { maxRows = 64, maxRaw = 192 * 1024 } = {}) {
    const chunks = []; let current = [];
    for (const row of rows) {
      const trial = [...current, row];
      if (current.length && (trial.length > maxRows || jsonBytes(trial).length > maxRaw - 1024)) { chunks.push(current); current = []; }
      assert(jsonBytes(row).length <= maxRaw - 1024, `One row too large: ${name}; move details out of the directory.`);
      current.push(row);
    }
    if (current.length || !chunks.length) chunks.push(current);
    const pages = [];
    for (let i = 0; i < chunks.length; i++) pages.push(await this.emit(`${name}/page-${String(i).padStart(4, '0')}.json`, kind,
      { total: rows.length, page: i, rows: chunks[i] }, { maxRaw }));
    return pages;
  }
}
export function pick(record, keys) { return Object.fromEntries(keys.filter(k => record[k] !== undefined).map(k => [k, record[k]])); }
export function stripEvidence(value) {
  if (Array.isArray(value)) return value.map(stripEvidence);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== '_source').map(([key, item]) => [key, stripEvidence(item)]));
  return value;
}
