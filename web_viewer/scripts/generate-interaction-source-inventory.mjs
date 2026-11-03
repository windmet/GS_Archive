import {readFileSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {buildInteractionInventory,refreshSourceRefs} from './lib/interaction-source-inventory.mjs'

// Rewrites scripts/qa/interaction-source-inventory.json from the Vue templates (keeping each
// binding's status) and moves scenario sourceRefs to their binding's current line. A scenario
// ref whose binding no longer exists is reported, not guessed: fix its handler by hand.
const root=path.resolve(import.meta.dirname,'..')
const inventoryFile=path.join(root,'scripts/qa/interaction-source-inventory.json')
const scenariosFile=path.join(root,'scripts/qa/interaction-scenarios.json')
const previous=JSON.parse(readFileSync(inventoryFile,'utf8'))
const inventory=buildInteractionInventory(root,previous)
const scenarios=JSON.parse(readFileSync(scenariosFile,'utf8'))
const {moved,missing}=refreshSourceRefs(root,scenarios)
writeFileSync(inventoryFile,JSON.stringify(inventory,null,2)+'\n')
writeFileSync(scenariosFile,JSON.stringify(scenarios,null,2)+'\n')
const key=row=>`${row.file}:${row.event}="${row.handler}"`
const before=new Set(previous.map(key)),after=new Set(inventory.map(key))
console.log(`Interaction inventory: ${inventory.length} bindings (${[...after].filter(k=>!before.has(k)).length} new, ${[...before].filter(k=>!after.has(k)).length} removed); ${moved} scenario refs moved`)
if(missing.length) { console.error(`Scenario refs without a current binding:\n${missing.join('\n')}`); process.exitCode=1 }
