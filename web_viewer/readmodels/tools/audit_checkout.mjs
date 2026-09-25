import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { parseArgs, assert, safeRead, sha256 } from '../lib/common.mjs';
const args=parseArgs(process.argv.slice(2),['--repo','--out']);
assert(args['--repo']&&args['--out'],'Usage: --repo <GS checkout> --out <new external JSON>');
const repo=await fs.realpath(args['--repo']),viewer=path.join(repo,'web_viewer');
const parent=await fs.realpath(path.dirname(path.resolve(args['--out']))),out=path.join(parent,path.basename(args['--out']));
const rel=path.relative(repo,out);assert(rel.startsWith('..'+path.sep)||path.isAbsolute(rel),'Output must be outside checkout');
const git=(...a)=>execFileSync('git',['-C',repo,...a],{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const source=(await safeRead(viewer,'src/data/ArchiveDataRepository.js')).toString('utf8');
const block=/const ARCHIVE_SOURCES\s*=\s*\{([\s\S]*?)\n\}/.exec(source);assert(block,'Current legacy source registry changed: inspect manually');
const rows=[];
for(const match of block[1].matchAll(/(\w+)\s*:\s*['"]([^'"]+)['"]/g)) {
 const [,key,url]=match;
 if(key==='externalStoryResources') {rows.push({key,url,startup:false,reason:'Current publication policy is OFF; verify separately before enabling'});continue;}
 try {const bytes=await safeRead(path.join(viewer,'public'),url.replace(/^\//,''));rows.push({key,url,startup:true,sourceBytes:bytes.length,gzipEstimate:gzipSync(bytes).length,sha256:sha256(bytes)});}
 catch(error){rows.push({key,url,startup:true,unavailable:true,error:error.message});}
}
const knownFiles=['src/App.vue','src/data/ArchiveDataRepository.js','src/data/archiveHomeState.js','src/data/archiveSelectors.js','functions/_shared/r2-resource.js','scripts/build-preview.mjs'];
const hashes={};for(const name of knownFiles){try{hashes[name]=sha256(await safeRead(viewer,name))}catch(e){hashes[name]={unavailable:true,error:e.message}}}
const report={kind:'read-only-source-startup-audit',head:git('rev-parse','HEAD'),workingTreeStatus:git('status','--porcelain'),
 sourceRegistryPresent:true,files:hashes,rows,
 totals:{knownStartupSourceBytes:rows.reduce((n,r)=>n+(r.sourceBytes||0),0),gzipEstimateBytes:rows.reduce((n,r)=>n+(r.gzipEstimate||0),0),
 startupRequests:rows.filter(r=>r.startup).length,missingLocalInputs:rows.filter(r=>r.unavailable).length},
 notes:['Source bytes and local gzip estimates are NOT measured network transfer.','No checkout, reset, fetch, build, upload or media writes were performed.','Ignored compiled/index.json is included only if present locally.']};
await fs.writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,...report.totals},null,2));
