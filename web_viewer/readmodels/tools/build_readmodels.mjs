import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs, assert, createOutput, jsonBytes, sha256, safeRead } from '../lib/common.mjs';
import { readCheckout } from '../lib/checkout_adapter.mjs';
import { writeReadModels } from '../lib/projections.mjs';

const args = parseArgs(process.argv.slice(2), ['--repo','--out','--data-revision','--media-epoch']);
assert(args['--repo'] && args['--out'], 'Usage: node tools/build_readmodels.mjs --repo <repo root> --out <new external directory> --data-revision <64 hex> --media-epoch <label>');
assert(/^[a-f0-9]{64}$/.test(args['--data-revision'] || ''), 'Supply the actual pinned legacy ARCHIVE_DATA_REVISION; do not invent a new value');
assert(/^[a-zA-Z0-9_.-]{1,80}$/.test(args['--media-epoch'] || ''), 'Supply an explicit media epoch label matching the present gzip/64k corpus');
const repo = await fs.realpath(args['--repo']);
const viewer = path.join(repo, 'web_viewer');
const head = execFileSync('git', ['-C', repo, 'rev-parse','HEAD'], { encoding: 'utf8' }).trim();
// Unrelated evidence and local notes do not affect this release. Inputs and the
// generator itself must be committed; public/data is ignored but hashed below.
const inputPaths = ['web_viewer/readmodels', 'web_viewer/src/data', 'web_viewer/src/presentation',
  'web_viewer/shared/story', 'web_viewer/public/data'];
const status = execFileSync('git', ['-C', repo, 'status', '--porcelain', '--untracked-files=all', '--', ...inputPaths],
  { encoding: 'utf8' }).trim();
assert(!status, `Read-model inputs or generator are uncommitted:\n${status}`);
// Build is intentionally independent of master. Starting from current compatible product ancestry is required.
execFileSync('git', ['-C', repo, 'merge-base','--is-ancestor','a6929d4054a8a9ce7da64b3d962c86eedd2cfb27',head]);
const kit = fileURLToPath(new URL('..', import.meta.url));
const root = await createOutput(args['--out'], [repo, kit]);
try {
  const { product, provenance } = await readCheckout(viewer, { dataRevision: args['--data-revision'], mediaEpoch: args['--media-epoch'] });
  // Only code that affects projection bytes belongs in the data release.
  // Assembler, audit and verification changes must not rotate immutable URLs.
  const generatorHashes = {};
  for (const relative of ['lib/common.mjs', 'lib/checkout_adapter.mjs', 'lib/mobile_projection.mjs', 'lib/projections.mjs', 'tools/build_readmodels.mjs']) {
    generatorHashes[relative] = sha256(await safeRead(kit, relative));
  }
  const release = sha256(jsonBytes({ format: 'gs-readmodels-v1', ...provenance, generatorHashes }));
  const result = await writeReadModels(root, release, product, { ...provenance, head, generatorHashes });
  // Verify source bytes stayed stable while the generation ran.
  for (const [relative, source] of Object.entries(provenance.sources)) assert(sha256(await safeRead(path.join(viewer, 'public'), relative)) === source.sha256, `Input changed during build: ${relative}`);
  for (const [relative, digest] of Object.entries(provenance.codeHashes)) assert(sha256(await safeRead(viewer, relative)) === digest, `Selector changed during build: ${relative}`);
  for (const [relative, digest] of Object.entries(generatorHashes)) assert(sha256(await safeRead(kit, relative)) === digest, `Generator changed during build: ${relative}`);
  await fs.writeFile(path.join(root, 'BUILD_COMPLETE.json'), jsonBytes({ release, head, generated: true, deployed: false }), { flag: 'wx' });
  console.log(JSON.stringify({ output: root, release, bootstrapDecodedBytes: result.report.bootstrapDecodedBytes,
    artifactFiles: result.report.artifactFiles, allReadModelDecodedBytes: result.report.allReadModelDecodedBytes,
    note: 'No repository files, R2 objects, or deployment were changed. Read docs for remaining UI producer cutovers.' }, null, 2));
} catch (error) {
  await fs.writeFile(path.join(root, 'BUILD_FAILED.txt'), String(error.stack || error) + '\n', { flag: 'wx' });
  throw error; // Preserve failed output for diagnosis; never delete user files.
}
