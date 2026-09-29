import fs from 'node:fs/promises';
import path from 'node:path';
import { assert } from './common.mjs';

export const migrationDimensions = ['entry', 'data', 'actions'];
const implemented = state => state === 'migrated' || state === 'not-applicable';

// Reviewed implementation claims do not automatically prove full parity.
// Local Browser samples and physical-device acceptance are separate fields.
export function summarizeRoutes(ledger, expectedViews) {
  assert(ledger.schema_version === 2, 'Expected route ledger schema_version 2');
  assert(/^[a-f0-9]{40}$/.test(ledger.reviewedSourceRevision || ''), 'Missing reviewed source revision');
  assert(/^[a-f0-9]{64}$/.test(ledger.release || ''), 'Missing reviewed data release');
  assert(Array.isArray(ledger.routes), 'Missing routes array');
  const expected = new Set(expectedViews), seen = new Set();
  const counts = { routes: 0, entryMigrated: 0, dataMigrated: 0, actionsMigrated: 0, componentReady: 0,
    playerReady: 0, parityPassed: 0, localBrowserEvidence: 0, deviceAccepted: 0 };
  const unfinished = [];
  for (const route of ledger.routes) {
    assert(expected.has(route.view) && !seen.has(route.view), `Unknown/duplicate route: ${route.view}`);
    seen.add(route.view); counts.routes++;
    for (const key of [...migrationDimensions, 'player', 'component', 'parity']) {
      const states = key === 'component' ? ['dynamic', 'shell', 'static']
        : key === 'parity' ? ['passed', 'partial', 'pending']
        : key === 'player' ? ['migrated', 'partial', 'pending', 'not-applicable']
        : ['migrated', 'partial', 'legacy', 'pending'];
      assert(states.includes(route[key]?.status), `${route.view}: invalid ${key} status`);
      assert(Array.isArray(route[key].evidence) && route[key].evidence.length > 0, `${route.view}: ${key} needs evidence or a pending-work reference`);
    }
    assert(typeof route.component.module === 'string' && route.component.module.startsWith('src/'), `${route.view}: missing component module`);
    assert(Array.isArray(route.legacyRemaining) && Array.isArray(route.blockedReasons), `${route.view}: missing residual/blocked inventory`);
    assert(Array.isArray(route.browserEvidence) && route.browserEvidence.every(item => item.kind === 'local-browser' && item.path && item.scope), `${route.view}: invalid local Browser evidence`);
    assert(['pending', 'accepted'].includes(route.device?.status) && Array.isArray(route.device.evidence), `${route.view}: invalid device status`);
    if (route.device.status === 'accepted') {
      assert(/^[a-f0-9]{64}$/.test(ledger.reviewedSourceDigest || ''), `${route.view}: missing reviewed runtime source fingerprint`);
      assert(route.device.evidence.length > 0 && route.device.evidence.every(item => item.kind === 'physical-device' && item.path), `${route.view}: physical-device receipt required`);
    }
    const reasons = [];
    for (const key of migrationDimensions) {
      if (route[key].status === 'migrated') counts[`${key}Migrated`]++;
      else reasons.push(key);
    }
    if (implemented(route.player.status)) counts.playerReady++; else reasons.push('player');
    if (['dynamic', 'shell'].includes(route.component.status)) counts.componentReady++; else reasons.push('component');
    if (route.parity.status === 'passed') counts.parityPassed++; else reasons.push('parity');
    if (route.browserEvidence.length) counts.localBrowserEvidence++;
    if (route.device.status === 'accepted') counts.deviceAccepted++; else reasons.push('device');
    if (route.legacyRemaining.length) reasons.push('legacy');
    if (route.blockedReasons.length) reasons.push('blocked');
    if (reasons.length) unfinished.push({ view: route.view, reasons, legacyRemaining: route.legacyRemaining, blockedReasons: route.blockedReasons });
    if (reasons.some(reason => !['parity', 'device'].includes(reason))) {
      assert(route.legacyRemaining.length || route.blockedReasons.length, `${route.view}: unfinished implementation needs a concrete reason`);
    }
  }
  assert(expected.size === seen.size, 'Some public routes disappeared');
  return { counts, unfinished,
    allPublicRoutesMigrated: unfinished.every(row => row.reasons.every(reason => reason === 'device')),
    deviceReviewAccepted: counts.deviceAccepted === counts.routes };
}

export async function validateRouteEvidence(ledger, root) {
  const read = async relative => {
    assert(typeof relative === 'string' && relative && !path.isAbsolute(relative) && !relative.split(/[\\/]/).includes('..'), `Unsafe evidence path: ${relative}`);
    const file = path.resolve(root, relative);
    assert((await fs.stat(file)).isFile(), `Missing evidence: ${relative}`);
    return file;
  };
  for (const route of ledger.routes) {
    for (const key of [...migrationDimensions, 'player', 'component', 'parity']) for (const evidence of route[key].evidence) await read(evidence);
    await read(route.component.module);
    for (const item of route.browserEvidence) await read(item.path);
    for (const item of route.device.evidence) {
      assert(item.kind === 'physical-device', `${route.view}: Browser evidence is not device acceptance`);
      const receipt = JSON.parse(await fs.readFile(await read(item.path), 'utf8'));
      assert(receipt.kind === 'physical-device' && receipt.accepted === true && receipt.release === ledger.release &&
        receipt.sourceRevision === ledger.reviewedSourceRevision && receipt.sourceDigest === ledger.reviewedSourceDigest && receipt.routes?.includes(route.view) &&
        receipt.device && receipt.browser && receipt.reviewer && receipt.checkedAt,
      `${route.view}: device receipt does not match the reviewed source/release`);
    }
  }
}
