import {readFileSync,readdirSync} from 'node:fs'
import path from 'node:path'

// Every Vue template event binding (@event="handler"), one row per binding, in file and line
// order. scripts/qa/interaction-source-inventory.json is this scan plus each row's evidence
// status; scripts/generate-interaction-source-inventory.mjs rewrites it and
// verify-interaction-contracts compares against the same scan.
export const PENDING_REASON='Source inventory only; requires rendered state transition evidence'
const BINDING=/(@[\w:.-]+)="([^"]*)"/g

function vueFiles(dir,root) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(item=>{
    const file=path.join(dir,item.name)
    if(item.isDirectory()) return vueFiles(file,root)
    return item.name.endsWith('.vue')?[path.relative(root,file).replaceAll('\\','/')]:[]
  })
}

export function scanInteractionBindings(root) {
  const rows=[]
  // Shallower files first, then code-point path order, as the audit inventory was first written.
  const order=(a,b)=>(a.split('/').length-b.split('/').length)||(a<b?-1:a>b?1:0)
  for(const file of vueFiles(path.join(root,'src'),root).sort(order)) {
    const lines=readFileSync(path.join(root,file),'utf8').split(/\r?\n/)
    // Only the top-level template (it may follow a BOM and close mid-line): script and style
    // blocks can hold @-strings too.
    const start=lines.findIndex(line=>/^\uFEFF?<template\b/.test(line))
    if(start<0) continue
    const next=lines.findIndex((line,n)=>n>start&&/^<(script|style)\b/.test(line)), end=next<0?lines.length:next
    for(let n=start;n<end;n++) for(const [,event,handler] of lines[n].matchAll(BINDING))
      rows.push({component:path.basename(file,'.vue'),file,line:n+1,event,handler,template:lines[n].trim().slice(0,900)})
  }
  return rows
}

// Keep each binding's recorded status across line moves: match on file + event + handler, in order.
export function buildInteractionInventory(root,previous=[]) {
  const carried=new Map()
  for(const row of previous) {
    const key=`${row.file}\0${row.event}\0${row.handler}`
    carried.set(key,[...(carried.get(key)||[]),row])
  }
  return scanInteractionBindings(root).map(row=>{
    const prior=carried.get(`${row.file}\0${row.event}\0${row.handler}`)?.shift()
    return {...row,status:prior?.status||'PENDING',reason:prior?.reason||PENDING_REASON}
  })
}

// Scenario steps cite bindings by file + line + event + handler. Moves each cited line to the
// nearest current occurrence of that binding; returns the refs whose binding is gone.
export function refreshSourceRefs(root,scenarios) {
  const cache=new Map(), read=file=>cache.get(file)||cache.set(file,readFileSync(path.join(root,file),'utf8').split(/\r?\n/)).get(file)
  let moved=0
  const missing=[]
  for(const flow of scenarios.flows) for(const step of flow.steps) for(const ref of step.sourceRefs||[]) {
    const needle=`${ref.event}="${ref.handler}"`, hits=read(ref.file).flatMap((line,n)=>line.includes(needle)?[n+1]:[])
    if(!hits.length) { missing.push(`${flow.id}: ${ref.file}:${ref.line} ${needle}`); continue }
    if(hits.includes(ref.line)) continue
    ref.line=hits.reduce((best,line)=>Math.abs(line-ref.line)<Math.abs(best-ref.line)?line:best)
    moved++
  }
  return {moved,missing}
}
