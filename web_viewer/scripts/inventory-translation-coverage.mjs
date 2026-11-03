import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import {sourceUnits,corpusHash} from './lib/general-translation-batches.mjs'
import {readMemory} from './lib/translation-memory.mjs'
import {parseStudioResult} from './lib/ai-studio-markdown.mjs'

// Read-only inventory of sources and historical working files. This does not import,
// approve, or run a historical batch checker against a different source_commit.
const root=fileURLToPath(new URL('../',import.meta.url))
const args=process.argv.slice(2), option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback
const localRoot=path.resolve(option('--local-root',root))
const out=path.resolve(option('--out',path.join(root,'.analysis/translation-coverage')))
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim()
const sourceCommit=git('rev-parse','HEAD')
const relative=(base,file)=>path.relative(base,file).replaceAll('\\','/')
function walk(folder) {
  if(!fs.existsSync(folder))return []
  return fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
    const file=path.join(folder,entry.name)
    return entry.isSymbolicLink()?[]:entry.isDirectory()?walk(file):entry.isFile()?[file]:[]
  })
}
const summary=read(path.join(root,'config/translation-audit/summary.json'))
const stories=read(path.join(root,'config/translation-audit/stories.json'))
const storyEvidence=new Map(stories.map(doc=>[doc.id,doc]))
const current=new Map(),overlays=new Map()
for(const doc of stories) {
  const file=path.join(root,'public/translations/zh-CN/scenarios',`${doc.catalog}.json`)
  if(!overlays.has(doc.catalog))overlays.set(doc.catalog,fs.existsSync(file)?read(file):null)
}
for(const entry of read(path.join(root,'public/data/reading/manifest.json')).entries) {
  assert.equal(entry.sha256,storyEvidence.get(entry.document_id)?.sourceHash,'Reader audit is outdated')
  const doc=read(path.join(root,'public/data/reading',entry.file))
  const overlay=overlays.get(doc.text_catalog_id||doc.scenario_id)
  for(const row of doc.rows)if(row.source_text) {
    const target=overlay?.entries[row.text_ref.unit_id]
    current.set(row.text_ref.unit_id,{hash:row.text_ref.source_hash,
      translated:!!target?.text?.trim()&&target.source_hash===row.text_ref.source_hash&&overlay.source_raw_hash===storyEvidence.get(entry.document_id).rawHash,
      text:target?.text||''})
  }
}
const units=sourceUnits(root), memory=readMemory(root), liveGeneral=new Map(units.map(u=>[u.key,u]))
assert.equal(current.size,summary.reader.units,'Regenerate audit:translations before inventory')
assert.equal(units.length,summary.general.unique,'General source inventory changed')
assert.equal(corpusHash(units),summary.sourceDigest,'Regenerate audit for current general sources')
const roots=['.analysis/translation-studio','.analysis/general-translation-batches',
  '.analysis/general-translation-batches-20261002','.analysis/general-translation-batches-20261002-ready',
  '.analysis/general-translation-compact-20261002','.analysis/general-translation-compact-20261002-ready']
const localFiles=roots.flatMap(folder=>walk(path.join(localRoot,folder)))
const batches=[],errors=[],mappedOutputs=new Set()
for(const file of localFiles.filter(file=>path.basename(file)==='batch-map.json')) {
  try {
    const map=read(file), folder=path.dirname(file).endsWith(`${path.sep}local`)?path.dirname(path.dirname(file)):path.dirname(file)
    const outputs=fs.readdirSync(folder).filter(name=>/^output.*\.(md|json)$/.test(name)&&!name.includes('template'))
      .sort().map(name=>path.join(folder,name))
    outputs.forEach(file=>mappedOutputs.add(file))
    const rows=map.rows||[], story=map.schema==='GS-STUDIO-MD-V1'
    const counts={currentSource:0,alreadyTranslated:0,missing:0,changedOrAbsent:0}
    for(const row of rows) {
      const live=story?current.get(row.unit_id):liveGeneral.get(row.key)
      const matches=story?live?.hash===row.source_hash:live?.sourceHash===row.sourceHash
      if(!matches){counts.changedOrAbsent++;continue}
      counts.currentSource++
      if(story?live.translated:memory.has(row.key))counts.alreadyTranslated++;else counts.missing++
    }
    const result={map:relative(localRoot,file),schema:map.schema,batch:map.batch_id,
      sourceCommit:map.source_commit||null,sameCommit:map.source_commit?map.source_commit===sourceCommit:null,
      sourceDigest:map.source_digest||null,rows:rows.length,...counts,outputs:[]}
    for(const output of outputs) {
      const item={file:relative(localRoot,output),sha256:sha(output)}
      if(story&&output.endsWith('.md')) {
        const parsed=parseStudioResult(fs.readFileSync(output,'utf8'),rows.map(row=>row.rid))
        item.parsedRows=parsed.translations.size;item.formatErrors=parsed.errors.length
        item.missingWithReturn=rows.filter(row=>{
          const live=current.get(row.unit_id)
          return live?.hash===row.source_hash&&!live.translated&&parsed.translations.has(row.rid)
        }).length
      }
      result.outputs.push(item)
    }
    const check=path.join(folder,'check-report.json')
    result.historicalCheck=fs.existsSync(check)?read(check).structure||'unknown':null
    batches.push(result)
  } catch(error){errors.push({file:relative(localRoot,file),error:error.message})}
}
const orphanOutputs=localFiles.filter(file=>/^output.*\.(md|json)$/.test(path.basename(file))
  &&!path.basename(file).includes('template')&&!mappedOutputs.has(file)).map(file=>({file:relative(localRoot,file),sha256:sha(file)}))

// Candidate source lines, never a count of missing translations: includes Chinese
// literals needing ja-JP support, proper names and false positives. No Browser claims.
const sourceFiles=git('ls-files','src').split(/\r?\n/).filter(file=>/\.(vue|js|ts)$/.test(file)
  &&!file.startsWith('src/data/')&&!file.includes('/locales/'))
const candidates=[],fileStats=[]
for(const file of sourceFiles) {
  const lines=fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/)
  let template=false,style=false,comment=false,count=0
  for(const [index,line]of lines.entries()) {
    if(/^<template(?:\s|>)/.test(line))template=true
    if(/^<style(?:\s|>)/.test(line))style=true
    if(line.includes('<!--')||line.trim().startsWith('/*'))comment=true
    const skipped=comment||style||/^\s*(?:\/\/|\*)/.test(line)
    if(!skipped&&/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(line)) {
      const literal=template?/>[^<{]*[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}][^<{]*(?:<|$)|(?:title|placeholder|aria-label|alt)=["'][^"']*[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(line)
        :/["'`][^"'`\n]*[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}][^"'`\n]*["'`]/u.test(line)
      if(literal){candidates.push({file,line:index+1,kind:template?'template-candidate':'script-candidate',excerpt:line.trim()});count++}
    }
    if(line.includes('-->')||line.includes('*/'))comment=false
    if(/^<\/template>/.test(line))template=false
    if(/^<\/style>/.test(line))style=false
  }
  fileStats.push({file,candidates:count})
}
const receipts=walk(path.join(root,'translation/studio/reviews')).filter(file=>path.basename(file)==='receipt.json').map(file=>{
  const r=read(file)
  return {file:relative(root,file),batch:r.batch_id,status:r.status,notFinal:r.not_final,
    humanStatus:r.human_status||null,units:r.units,sourceCommit:r.source_commit}
})
const sum=groups=>Object.fromEntries(['total','draft','reviewed','final','missing','stale'].map(key=>[key,groups.reduce((n,g)=>n+(g[key]||0),0)]))
const speakers=read(path.join(root,'public/translations/zh-CN/entities/speakers.json'))
const speakerStatuses={}
for(const entry of Object.values(speakers.entries))speakerStatuses[entry.status]=(speakerStatuses[entry.status]||0)+1
const policy=name=>read(path.join(root,'translation/studio/policy',name))
const terms=policy('term-decisions.template.json'),trial=policy('trial-policy.v2.3.json'),voices=policy('voice-profiles.trial.v1.1.json'),names=policy('idol-names.v1.json')
const manifest=read(path.join(root,'public/translations/manifest.json')),release=read(path.join(root,'config/translation-release.json'))
const manifestErrors=[]
for(const entry of manifest.entries) {
  const file=path.resolve(root,'public/translations',entry.file)
  assert(file.startsWith(path.resolve(root,'public/translations')+path.sep),'Translation manifest path escapes root')
  if(!fs.existsSync(file)||sha(file)!==entry.sha256||fs.statSync(file).size!==entry.bytes)manifestErrors.push(entry.file)
}
const computedRelease=createHash('sha256').update(JSON.stringify(manifest.entries)).digest('hex')
const generalKinds=new Set(units.map(u=>u.kind))
const report={schema:'GS-TRANSLATION-COVERAGE-INVENTORY-V1',sourceCommit,scriptSha256:sha(fileURLToPath(import.meta.url)),
  auditSummarySha256:sha(path.join(root,'config/translation-audit/summary.json')),
  scope:'Source inventory only; no import authorization, quality approval, Browser or deployment acceptance',
  general:summary.general,reader:summary.reader,storyTotals:sum(summary.groups.filter(g=>g.id.startsWith('story:'))),
  generalTotals:sum(summary.groups.filter(g=>generalKinds.has(g.id))),groups:summary.groups,pending:summary.pending,
  supplemental:{speakerLabels:{entries:Object.keys(speakers.entries).length,statuses:speakerStatuses,
    limitation:'Not included in audit:translations; run verify-speaker-label-dictionary.mjs for source and runtime contract validation'},
    policy:{termTemplate:{status:terms.status,items:terms.items.length,unselected:terms.items.filter(t=>!t.chosen_zh).length},
      trial:{status:trial.editorial_status,publicApproval:trial.public_approval,items:trial.items.length,pendingTerms:trial.pending_terms},
      voices:{status:voices.editorial_status,publicApproval:voices.public_approval,profiles:voices.profiles.length},
      names:{entries:names.entries.length,statuses:[...new Set(names.entries.map(e=>e.status))],
        userSelected:names.entries.filter(e=>e.status==='user-selected').map(e=>({id:e.entity_id,name:e.name,evidence:e.evidence}))}}},
  publication:{release:release.release,files:manifest.entries.length,manifestErrors,
    matches:computedRelease===manifest.release&&computedRelease===release.release&&release.files===manifest.entries.length&&!manifestErrors.length,
    limitation:'Tracked local translation release only; no deployed read-model, HTTP or site verification'},
  missingDocuments:stories.filter(doc=>doc.missing||doc.stale),receipts,
  ui:{scannedFiles:sourceFiles.length,candidateLines:candidates.length,files:fileStats.filter(f=>f.candidates),
    limitation:'Heuristic CJK literals only; excludes src/data and dictionaries, misses dynamic and English strings; candidates are not confirmed missing translations'},
  local:{searchedRoots:roots.map(folder=>({folder,exists:fs.existsSync(path.join(localRoot,folder))})),
    batches,unmappedOutputs:orphanOutputs,errors,
    limitation:'Only named roots in --local-root; no other worktrees, downloads, external sessions or deleted files searched. RID parsing is not full source/policy/placeholder/quality validation.'}}
fs.mkdirSync(out,{recursive:true})
fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(report,null,2)+'\n')
const csv=value=>'"'+String(value).replaceAll('"','""')+'"'
fs.writeFileSync(path.join(out,'ui-candidates.csv'),['file,line,kind,excerpt',...candidates.map(row=>Object.values(row).map(csv).join(','))].join('\n')+'\n')
const withOutput=batches.filter(b=>b.outputs.length)
const baseline={...report,local:{searchedRoots:report.local.searchedRoots,maps:batches.length,
  mapsWithOutput:withOutput.length,outputs:withOutput.reduce((n,b)=>n+b.outputs.length,0),
  outputMapRowOccurrences:Object.fromEntries(['rows','currentSource','alreadyTranslated','missing','changedOrAbsent'].map(key=>[key,withOutput.reduce((n,b)=>n+b[key],0)])),
  missingWithReturn:withOutput.flatMap(b=>b.outputs).reduce((n,o)=>n+(o.missingWithReturn||0),0),
  outputMapsWithChangedSources:withOutput.filter(b=>b.changedOrAbsent),
  outputsWithFormatErrors:withOutput.flatMap(b=>b.outputs).filter(o=>o.formatErrors),
  seasonalMaps:batches.filter(b=>/^B0(?:3[6-9]|4[01])/.test(b.batch)),
  sameCommitOutputMaps:withOutput.filter(b=>b.sameCommit).length,
  unmappedOutputs:orphanOutputs,errors,limitation:report.local.limitation}}
assert.equal(report.storyTotals.total,current.size)
assert.equal(report.generalTotals.total,units.length)
for(const totals of [report.storyTotals,report.generalTotals])assert.equal(totals.total,totals.draft+totals.reviewed+totals.final+totals.missing+totals.stale)
fs.writeFileSync(path.join(out,'baseline.json'),JSON.stringify(baseline,null,2)+'\n')
console.log(JSON.stringify({sourceCommit:report.sourceCommit,storyTotals:report.storyTotals,generalTotals:report.generalTotals,
  ui:{files:report.ui.scannedFiles,candidateLines:candidates.length},local:{maps:batches.length,
    mapsWithOutput:batches.filter(b=>b.outputs.length).length,unmappedOutputs:orphanOutputs.length,errors:errors.length},out},null,2))
if(errors.length||!report.publication.matches)process.exitCode=1
