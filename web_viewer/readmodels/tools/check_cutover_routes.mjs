import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assert } from '../lib/common.mjs';
import { summarizeRoutes, validateRouteEvidence } from '../lib/cutover.mjs';
import { VALID_VIEWS } from '../../src/core/archiveRoute.js';

const args = process.argv.slice(2);
const progress = args.includes('--progress');
assert(!args.includes('--final'), '--final was retired with the all-views device gate; use --release');
assert(args.every(arg => !arg.startsWith('--') || ['--progress', '--release'].includes(arg)), 'Unknown route-check option');
assert(!(progress && args.includes('--release')), 'Choose progress or release mode');
const files = args.filter(arg => !arg.startsWith('--'));
assert(files.length <= 1, 'Usage: check_cutover_routes.mjs [routes.json] [--progress|--release]');
const ledger = JSON.parse(await fs.readFile(files[0] || new URL('../contracts/routes.json', import.meta.url), 'utf8'));
const result = summarizeRoutes(ledger, VALID_VIEWS);
await validateRouteEvidence(ledger, fileURLToPath(new URL('../..', import.meta.url)));
console.log(JSON.stringify({ mode: progress ? 'progress' : 'release', ...result }, null, 2));
// Release mode gates public routes only; parity and device remain progress (docs/RELEASE_CONTRACT.md).
if (!progress) assert(result.publicRoutesReady, `Public routes not ready: ${result.publicBlocking.map(row => `${row.view} (${row.reasons.join(', ')})`).join('; ')}`);
