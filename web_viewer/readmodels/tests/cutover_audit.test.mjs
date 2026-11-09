import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { summarizeRoutes } from '../lib/cutover.mjs';
import { initialChunkClosure, forbiddenInitialModules } from '../../scripts/lib/archive-build-audit.mjs';
import { VALID_VIEWS } from '../../src/core/archiveRoute.js';

const ledger = JSON.parse(await fs.readFile(new URL('../contracts/routes.json', import.meta.url), 'utf8'));
const policy = JSON.parse(await fs.readFile(new URL('../contracts/startup-policy.json', import.meta.url), 'utf8'));
test('Progress ledger covers actual public routes without promoting local samples', () => {
  const result = summarizeRoutes(ledger, VALID_VIEWS);
  assert.equal(result.counts.routes, VALID_VIEWS.size);
  assert.ok(result.counts.entryMigrated > 0);
  assert.equal(result.allPublicRoutesMigrated, false);
  assert.equal(result.deviceReviewAccepted, false);
  assert.ok(result.unfinished.find(route => route.view === 'chibi_stage')?.legacyRemaining.length);
});
test('Deleting/duplicating a public route cannot make the ledger complete', () => {
  const missing = structuredClone(ledger); missing.routes.pop();
  assert.throws(() => summarizeRoutes(missing, VALID_VIEWS), /disappeared/);
  const duplicate = structuredClone(ledger); duplicate.routes.push(duplicate.routes[0]);
  assert.throws(() => summarizeRoutes(duplicate, VALID_VIEWS), /duplicate/);
});
test('Local Browser records cannot be stamped as device acceptance', () => {
  const forged = structuredClone(ledger);
  forged.reviewedSourceDigest = 'f'.repeat(64);
  forged.routes[0].device = { status: 'accepted', evidence: forged.routes[0].browserEvidence };
  assert.throws(() => summarizeRoutes(forged, VALID_VIEWS), /physical-device/);
});
test('Static closure includes shared imports once, excludes dynamic route imports, and fails on missing chunks', () => {
  const chunks = [
    { fileName: 'entry.js', isEntry: true, imports: ['shared.js'], dynamicImports: ['player.js'] },
    { fileName: 'shared.js', isEntry: false, imports: ['cycle.js'], dynamicImports: [] },
    { fileName: 'cycle.js', isEntry: false, imports: ['shared.js'], dynamicImports: [] },
    { fileName: 'player.js', isEntry: false, imports: ['heavy.js'], dynamicImports: [] },
    { fileName: 'heavy.js', isEntry: false, imports: [], dynamicImports: [] },
  ];
  assert.deepEqual(initialChunkClosure(chunks), ['cycle.js', 'entry.js', 'shared.js']);
  assert.throws(() => initialChunkClosure(chunks.filter(chunk => chunk.fileName !== 'shared.js')), /Unresolved/);
});
test('A small entry still fails forbidden-module policy; route labels do not exempt static feature imports', () => {
  const modules = ['src/main.js', 'src/data/ArchiveDataRepository.js', 'src/components/archive/ArchiveUnitDetail.vue'];
  assert.deepEqual(forbiddenInitialModules(modules, policy, ledger), modules.slice(1).sort());
  assert.deepEqual(forbiddenInitialModules(['src/main.js', 'src/components/archive/ArchiveShell.vue'], policy, ledger), []);
});
test('Release gate counts public routes only, and a feature-local boundary must be declared', () => {
  const result = summarizeRoutes(ledger, VALID_VIEWS);
  assert.equal(result.publicRoutesReady, true);
  assert.ok(result.counts.publicRoutes > 0 && result.publicBlocking.length === 0);
  const undeclared = structuredClone(ledger);
  delete undeclared.routes.find(route => route.view === 'chibi_stage').featureLocal;
  const blocked = summarizeRoutes(undeclared, VALID_VIEWS);
  assert.equal(blocked.publicRoutesReady, false);
  assert.deepEqual(blocked.publicBlocking, [{ view: 'chibi_stage', reasons: ['data'] }]);
  const entry = structuredClone(ledger);
  entry.routes.find(route => route.class === 'public').entry.status = 'partial';
  assert.equal(summarizeRoutes(entry, VALID_VIEWS).publicRoutesReady, false);
  const none = structuredClone(ledger);
  for (const route of none.routes) route.class = 'internal';
  assert.equal(summarizeRoutes(none, VALID_VIEWS).publicRoutesReady, false, 'no public route is not a ready release');
  const unclassified = structuredClone(ledger); delete unclassified.routes[0].class;
  assert.throws(() => summarizeRoutes(unclassified, VALID_VIEWS), /invalid class/);
});
