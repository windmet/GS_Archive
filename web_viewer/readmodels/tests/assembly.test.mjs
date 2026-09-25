import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFileSync}from'node:child_process';
import {fileURLToPath}from'node:url';import{writeReadModels}from'../lib/projections.mjs';import{jsonBytes}from'../lib/common.mjs';import{fixture}from'./fixture.mjs';
const script=fileURLToPath(new URL('../tools/assemble_pages.mjs',import.meta.url)),release='a'.repeat(64);
async function setup(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'gs-assembly-test-')),models=path.join(root,'models'),bundle=path.join(root,'bundle');
 await fs.mkdir(models);await writeReadModels(models,release,fixture(),{fixture:true});await fs.writeFile(path.join(models,'BUILD_COMPLETE.json'),jsonBytes({release}));
 await fs.mkdir(path.join(bundle,'_app'),{recursive:true});await fs.mkdir(path.join(bundle,'audit'));
 await fs.writeFile(path.join(bundle,'index.html'),'<html><head></head><body>assembly fixture only</body></html>');await fs.writeFile(path.join(bundle,'_app/entry.js'),'console.log("assembly fixture only");');
 await fs.writeFile(path.join(bundle,'audit/startup-budget.json'),jsonBytes({initialChunks:['_app/entry.js'],initialJsGzipEstimate:100,forbiddenModules:[]}));
 const acceptance={schema_version:1,release,globalArchiveLoadRemoved:true,allPublicRoutesMigrated:true,deviceReviewAccepted:true,evidence:['SYNTHETIC TEST, NOT PRODUCTION SIGNOFF']};
 await fs.writeFile(path.join(bundle,'audit/readmodel-cutover.json'),jsonBytes(acceptance));return{root,models,bundle,acceptance};}
test('Assembler injects verified bootstrap and excludes read models from Functions',async()=>{const x=await setup();try{
 const out=path.join(x.root,'out');execFileSync(process.execPath,[script,'--bundle',x.bundle,'--models',x.models,'--out',out],{stdio:'pipe'});
 const html=await fs.readFile(path.join(out,'index.html'),'utf8');assert.match(html,/id="archive-bootstrap"/);assert.match(html,new RegExp(release));
 const routes=JSON.parse(await fs.readFile(path.join(out,'_routes.json'),'utf8'));assert.ok(routes.exclude.includes('/_catalog/*'));assert.deepEqual(routes.include,['/assets/*','/data/*']);
 await assert.rejects(fs.access(path.join(out,'audit')));await assert.rejects(fs.access(path.join(out,'data')));
}finally{await fs.rm(x.root,{recursive:true,force:true})}});
test('Assembler accepts the matching inline bootstrap and rejects a mismatched one before output',async()=>{const x=await setup();try{
 const boot=JSON.parse(await fs.readFile(path.join(x.models,'bootstrap.inline.json'),'utf8'));
 const inline=JSON.stringify(boot).replace(/</g,'\\u003c');
 const html=`<html><head><script type="application/json" id="archive-bootstrap">${inline}</script></head><body>fixture</body></html>`;
 await fs.writeFile(path.join(x.bundle,'index.html'),html);
 const out=path.join(x.root,'matching');execFileSync(process.execPath,[script,'--bundle',x.bundle,'--models',x.models,'--out',out],{stdio:'pipe'});
 assert.equal(await fs.readFile(path.join(out,'index.html'),'utf8'),html);
 await fs.writeFile(path.join(x.bundle,'index.html'),html.replace(release,'b'.repeat(64)));
 const rejected=path.join(x.root,'mismatched');
 assert.throws(()=>execFileSync(process.execPath,[script,'--bundle',x.bundle,'--models',x.models,'--out',rejected],{stdio:'pipe'}),/Code bundle bootstrap differs/);
 await assert.rejects(fs.access(rejected));
}finally{await fs.rm(x.root,{recursive:true,force:true})}});
test('Assembler rejects unfinished cutover and never creates a misleading candidate',async()=>{const x=await setup();try{
 await fs.writeFile(path.join(x.bundle,'audit/readmodel-cutover.json'),jsonBytes({...x.acceptance,allPublicRoutesMigrated:false}));
 const out=path.join(x.root,'blocked');assert.throws(()=>execFileSync(process.execPath,[script,'--bundle',x.bundle,'--models',x.models,'--out',out],{stdio:'pipe'}),/Cutover gate missing/);
 await assert.rejects(fs.access(out));
}finally{await fs.rm(x.root,{recursive:true,force:true})}});
