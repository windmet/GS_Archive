import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, sha256, listFiles, safeRead } from '../lib/common.mjs';
export async function verifyArtifacts(root) {
  const report = JSON.parse(await fs.readFile(path.join(root, 'artifact-report.json'), 'utf8'));
  const complete = JSON.parse(await fs.readFile(path.join(root, 'BUILD_COMPLETE.json'), 'utf8'));
  assert(report.release === complete.release, 'Completion marker mismatch');
  const boot = JSON.parse(await fs.readFile(path.join(root, 'pages/_catalog/bootstrap.json'), 'utf8'));
  assert(boot.release === report.release, 'Bootstrap release mismatch');
  const inline = await fs.readFile(path.join(root, 'bootstrap.inline.json'));
  const staticBoot = await fs.readFile(path.join(root, 'pages/_catalog/bootstrap.json'));
  assert(inline.equals(staticBoot), 'Inline bootstrap differs from the verified static bootstrap');
  assert(inline.length === report.bootstrapDecodedBytes && inline.length <= 64 * 1024, 'Bootstrap size/budget mismatch');
  const expected = new Set(['_catalog/bootstrap.json']);
  const known = new Map(report.artifacts.map(r => [r.url, r]));
  let verified = 0;
  function checkLinks(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.url === 'string' && value.url.startsWith('/_catalog/')) {
      const target = known.get(value.url); assert(target, `Unclosed read-model dependency: ${value.url}`);
      if (value.sha256) assert(value.sha256 === target.sha256, `Descriptor hash mismatch: ${value.url}`);
    }
    for (const child of Object.values(value)) if (child && typeof child === 'object') checkLinks(child);
  }
  checkLinks(boot);
  for (const item of report.artifacts) {
    const name = item.url.slice(1); expected.add(name);
    const bytes = await safeRead(path.join(root, 'pages'), name);
    assert(bytes.length === item.bytes && sha256(bytes) === item.sha256, `Artifact drift: ${item.url}`);
    const envelope = JSON.parse(bytes.toString('utf8'));
    assert(envelope.release === boot.release && envelope.kind === item.kind && envelope.schema_version === 1, `Envelope mismatch: ${item.url}`);
    checkLinks(envelope); verified++;
  }
  const actual = await listFiles(path.join(root, 'pages'));
  assert(actual.length === expected.size && actual.every(name => expected.has(name)), 'Unexpected files in Pages read-model output');
  return { verified, release: report.release, bootstrapDecodedBytes: report.bootstrapDecodedBytes, scope: 'data bytes, descriptors and schema envelopes only' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv[2], 'Usage: node tools/verify_artifacts.mjs <model-output>');
  console.log(JSON.stringify(await verifyArtifacts(await fs.realpath(process.argv[2])), null, 2));
}
