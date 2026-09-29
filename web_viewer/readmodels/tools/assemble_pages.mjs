import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, parseArgs, createOutput, safeRead, listFiles, jsonBytes, sha256 } from '../lib/common.mjs';
import { verifyArtifacts } from './verify_artifacts.mjs';
import { readBuildAudit } from '../../scripts/lib/archive-build-audit.mjs';

const checkOnly = process.argv.includes('--check-only');
const a = parseArgs(process.argv.slice(2).filter(arg => arg !== '--check-only'), ['--bundle','--models','--out','--previous']);
assert(a['--bundle'] && a['--models'] && (checkOnly || a['--out']), 'Usage: --bundle <copyPublicDir=false build> --models <verified model output> [--check-only | --out <new external stage>] [--previous <previous verified model output>]');
assert(!checkOnly || !a['--out'], 'Check-only mode must not specify an output');
const bundle = await fs.realpath(a['--bundle']), models = await fs.realpath(a['--models']);
await verifyArtifacts(models);
const { budget, acceptance } = await readBuildAudit(bundle);
assert(!budget.sourceDirty, 'Build audit source was uncommitted');
assert(Array.isArray(budget.initialChunks) && budget.initialChunks.length > 0, 'Missing entry import-graph proof');
assert(Array.isArray(budget.forbiddenModules) && budget.forbiddenModules.length === 0, 'Legacy/heavy entry imports still present');
assert(budget.initialJsGzipEstimate > 0 && budget.initialJsGzipEstimate <= 200 * 1024, 'Startup JS budget not met');
assert(acceptance.schema_version === 1 && acceptance.globalArchiveLoadRemoved === true && acceptance.allPublicRoutesMigrated === true && acceptance.deviceReviewAccepted === true, 'Cutover gate missing: do not publish new data behind the unchanged global-loading App');
assert(acceptance.release === JSON.parse(await fs.readFile(path.join(models,'bootstrap.inline.json'),'utf8')).release, 'Cutover proof is for another data release');
const files = await listFiles(bundle);
assert(files.includes('index.html'), 'Bundle lacks index.html');
assert(!files.some(f => f.startsWith('assets/') || f.startsWith('data/')), 'Refuse a full-media build; use assetsDir=_app and copyPublicDir=false');
assert(!files.some(f => ['_headers','_routes.json','_redirects','_worker.js'].includes(f)), 'Existing serving policy/worker found. Review and merge manually rather than overwrite it with a generic policy.');
assert(files.length <= 500, 'Bundle file count suggests accidental media/public copy');
const boot = JSON.parse(await fs.readFile(path.join(models, 'bootstrap.inline.json'), 'utf8'));
const inline = JSON.stringify(boot).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const bundleHtml = (await safeRead(bundle, 'index.html')).toString('utf8');
const existing = /<script type="application\/json" id="archive-bootstrap">([^<]*)<\/script>/.exec(bundleHtml);
if (existing) assert(existing[1] === inline, 'Code bundle bootstrap differs from read-model candidate');
else {
  assert(!bundleHtml.includes('id="archive-bootstrap"'), 'Unexpected archive bootstrap markup');
  assert(bundleHtml.includes('</head>'), 'HTML lacks head');
}
if (checkOnly) {
  // Apply the same remaining size/retention checks without creating an output.
  let total = 0, count = 0;
  const combined = new Map();
  const inspect = async (source, name) => {
    const bytes = await safeRead(source, name);
    assert(bytes.length <= 25 * 1024 * 1024, `Pages single-file limit: ${name}`);
    const hash = sha256(bytes);
    if (combined.has(name)) { assert(combined.get(name) === hash, `Conflicting versioned path: ${name}`); return; }
    combined.set(name, hash); count++;
  };
  for (const name of files.filter(name => !name.startsWith('.vite/') && !name.startsWith('audit/'))) {
    total += (await safeRead(bundle, name)).length; await inspect(bundle, name);
  }
  assert(total <= 30 * 1024 * 1024, 'Code bundle too large; inspect publicDir and import graph');
  for (const name of await listFiles(path.join(models, 'pages'))) await inspect(path.join(models, 'pages'), name);
  if (a['--previous']) {
    const previous = await fs.realpath(a['--previous']); await verifyArtifacts(previous);
    for (const name of await listFiles(path.join(previous, 'pages'))) if (name.startsWith('_catalog/v/')) await inspect(path.join(previous, 'pages'), name);
  }
  assert(count + 2 <= 18000, 'Combined retained versions exceed the 18,000-file safety budget');
  console.log(JSON.stringify({ checkOnly: true, release: boot.release, files: count + 2, outputCreated: false, deployed: false }, null, 2));
  process.exit(0);
}
const root = await createOutput(a['--out'], [bundle, models, fileURLToPath(new URL('..', import.meta.url))]);
let totalBytes = 0, totalFiles = 0;
const hashes = {};
async function copy(source, relative, { identicalOkay = false } = {}) {
  const bytes = await safeRead(source, relative);
  assert(bytes.length <= 25 * 1024 * 1024, `Pages single-file limit: ${relative}`);
  if (Object.hasOwn(hashes, relative)) { assert(identicalOkay && hashes[relative] === sha256(bytes), `Conflicting versioned path: ${relative}`); return; }
  const target = path.join(root, relative); await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes, { flag: 'wx' }); hashes[relative] = sha256(bytes); totalBytes += bytes.length; totalFiles++;
}
for (const name of files) {
  if (name.startsWith('.vite/') || name.startsWith('audit/')) continue;
  await copy(bundle, name);
}
assert(totalBytes <= 30 * 1024 * 1024, 'Code bundle too large; inspect publicDir and import graph');
for (const name of await listFiles(path.join(models, 'pages'))) await copy(path.join(models, 'pages'), name);
if (a['--previous']) {
  const previous = await fs.realpath(a['--previous']); await verifyArtifacts(previous);
  for (const name of await listFiles(path.join(previous, 'pages'))) if (name.startsWith('_catalog/v/')) await copy(path.join(previous, 'pages'), name, { identicalOkay: true });
}
assert(totalFiles + 2 <= 18000, 'Combined retained versions exceed the 18,000-file safety budget');
let html = existing ? bundleHtml : bundleHtml.replace('</head>', `<script type="application/json" id="archive-bootstrap">${inline}</script>\n</head>`);
await fs.writeFile(path.join(root, 'index.html'), html); // Only the newly created candidate is edited.
await fs.writeFile(path.join(root, '_routes.json'), jsonBytes({ version: 1, include: ['/assets/*','/data/*'], exclude: ['/_app/*','/_catalog/*','/translations/*'] }), { flag: 'wx' });
await fs.writeFile(path.join(root, '_headers'), `/_catalog/v/*\n  Cache-Control: public, max-age=31536000, immutable\n  X-Archive-Delivery: pages-readmodel-v1\n/_catalog/bootstrap.json\n  Cache-Control: no-cache\n  X-Archive-Delivery: pages-bootstrap-v1\n/_app/*\n  Cache-Control: public, max-age=31536000, immutable\n`, { flag: 'wx' });
console.log(JSON.stringify({ candidate: root, release: boot.release, files: totalFiles + 2, bytesBeforeInlineInjection: totalBytes,
  functions: 'Use the compatible checkout functions with Wrangler; this command does not compile/deploy them.',
  retainedPreviousReadModels: !!a['--previous'], r2Writes: 0, deployed: false }, null, 2));
