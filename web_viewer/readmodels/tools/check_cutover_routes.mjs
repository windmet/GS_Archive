import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assert } from '../lib/common.mjs';
import { summarizeRoutes, validateRouteEvidence } from '../lib/cutover.mjs';
import { VALID_VIEWS } from '../../src/core/archiveRoute.js';

const args = process.argv.slice(2);
const progress = args.includes('--progress');
assert(args.every(arg => !arg.startsWith('--') || ['--progress', '--final'].includes(arg)), 'Unknown route-check option');
assert(!(progress && args.includes('--final')), 'Choose progress or final mode');
const files = args.filter(arg => !arg.startsWith('--'));
assert(files.length <= 1, 'Usage: check_cutover_routes.mjs [routes.json] [--progress|--final]');
const ledger = JSON.parse(await fs.readFile(files[0] || new URL('../contracts/routes.json', import.meta.url), 'utf8'));
const result = summarizeRoutes(ledger, VALID_VIEWS);
await validateRouteEvidence(ledger, fileURLToPath(new URL('../..', import.meta.url)));
console.log(JSON.stringify({ mode: progress ? 'progress' : 'final', ...result }, null, 2));
if (!progress) assert(result.allPublicRoutesMigrated && result.deviceReviewAccepted, 'Unfinished cutover: implementation/parity/device requirements remain');
