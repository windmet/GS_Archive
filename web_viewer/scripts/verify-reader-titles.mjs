import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { createReaderTitleRepository } from '../src/data/ReaderTitleRepository.js'
import { createBoundedTextTransport } from '../src/utils/BoundedTextTransport.js'
import { readerStoryTitle, readerTitle, validateReaderTitles, validateReaderTitleShard, READER_TITLE_BYTE_BUDGET } from '../src/presentation/ReaderTitle.js'
const indexBytes = fs.readFileSync(new URL('../public/translations/zh-CN/reader-titles.json',import.meta.url))
const index = validateReaderTitles(JSON.parse(indexBytes))
const payloads = new Map([['/reader-titles.json', indexBytes]])
assert.ok(indexBytes.length < READER_TITLE_BYTE_BUDGET, 'optional title index stays below 128 KiB')
for (const [key, descriptor] of Object.entries(index.shards || {})) {
  const bytes = fs.readFileSync(new URL(`../public/translations/zh-CN/${descriptor.file}`,import.meta.url))
  payloads.set(`/${descriptor.file}`,bytes)
  assert.ok(bytes.length < READER_TITLE_BYTE_BUDGET, 'each optional binding shard stays below 128 KiB')
  assert.equal(bytes.length, descriptor.bytes)
  assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`,descriptor.sha256)
  const shard = validateReaderTitleShard(JSON.parse(bytes),index,key)
  for (const [id, binding] of Object.entries(shard.documents)) {
    assert.ok(!Object.hasOwn(index.documents,id),'a document has only one binding')
    index.documents[id]=binding
  }
}
const manifest = JSON.parse(fs.readFileSync(new URL('../public/data/reading/manifest.json',import.meta.url)))
for (const id of Object.keys(index.documents)) {
  const entry = manifest.entries.find(item=>item.document_id===id)
  const translated = index.titles[index.documents[id].title]
  assert.equal(readerTitle(index,entry,entry.title),translated.text)
  assert.equal(readerTitle(index,entry,entry.title,'ja-JP'),entry.title,'Japanese metadata uses the source heading without changing story reading mode')
  assert.equal(readerTitle(index,{...entry,sha256:'sha256:'+'0'.repeat(64)},entry.title),entry.title,'new document revision does not reuse stale metadata')
  assert.equal(readerTitle(index,entry,'different source'),'different source','same ID cannot translate a different title')
}
assert.equal(readerTitle(index,{document_id:'untranslated'},'原文'),'原文')
assert.throws(()=>validateReaderTitles({...index,documents:{bad:{revision:'invalid',title:0}}}))
// Pages that know only the story file (the portal) bind by story id plus the exact source title.
for (const title of index.titles) {
  const story = title.unit_id.split(':')[2]
  assert.equal(readerStoryTitle(index, `${story}.json`, title.source), title.text, `${story}: story-file binding`)
  assert.equal(readerStoryTitle(index, `${story}.json`, `${title.source}x`), `${title.source}x`, 'a different source title keeps its text')
  assert.equal(readerStoryTitle(index, 'other_story.json', title.source), title.source, 'another story does not borrow the title')
  assert.equal(readerStoryTitle(index, `${story}.json`, title.source, 'ja-JP'), title.source, 'the Japanese UI keeps the source')
}
console.log(`Reader translated headings: ${index.titles.length} titles, ${Object.keys(index.documents).length} exact revision bindings, conservative fallback`)

// Real transport + real repository: the portal loads no document-binding shards;
// reading pages load only their needed buckets and preserve integrity/fallback.
const calls = [], url = 'https://titles.test/reader-titles.json?rev=fixture'
let corrupt = false, held = false, release
const transport = createBoundedTextTransport({ maxBytes: READER_TITLE_BYTE_BUDGET,
  fetchImpl: async request => {
    const pathname = new URL(request).pathname
    calls.push(pathname)
    if (held && pathname !== '/reader-titles.json') await new Promise(resolve => { release = resolve })
    const bytes = payloads.get(pathname)
    assert.ok(bytes, `unexpected title request ${pathname}`)
    return new Response(corrupt ? Buffer.concat([bytes,Buffer.from(' ')]) : bytes,
      {headers:{'content-type':'application/json'}})
  },
})
const makeRepository = () => createReaderTitleRepository({url,transport,
  digest: async bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`})
const repository = makeRepository()
const shell = await repository.loadIndex()
assert.deepEqual(calls,['/reader-titles.json'])
assert.equal(Object.keys(shell.documents).length,0,'story-only consumers do not eagerly load all bindings')
const ids = Object.keys(index.documents)
const first = ids[0]
const bound = await repository.loadDocument(first)
assert.deepEqual(bound.documents[first],index.documents[first])
assert.equal(calls.length,2,'a reading entry loads exactly one binding shard')
await repository.loadDocument(first)
assert.equal(calls.length,2,'the same binding is reused')
const other = ids.find(id => repository.needsDocument(id))
assert.ok(other,'real corpus spans multiple shards')
const combined = await repository.loadDocument(other)
assert.deepEqual(combined.documents[first],index.documents[first],'loading another shard retains prior bindings')
assert.deepEqual(combined.documents[other],index.documents[other])
const concurrent = makeRepository()
await concurrent.loadIndex()
await Promise.all([concurrent.loadDocument(first),concurrent.loadDocument(other)])
const concurrentIndex = await concurrent.loadDocument(first)
assert.deepEqual(concurrentIndex.documents[first],index.documents[first])
assert.deepEqual(concurrentIndex.documents[other],index.documents[other],'concurrent shards cannot overwrite each other')

transport.clear(); corrupt = true
const retry = makeRepository()
// Corrupt only the shard; the root remains a valid descriptor.
corrupt = false; await retry.loadIndex(); corrupt = true
await assert.rejects(retry.loadDocument(first),/integrity mismatch/)
assert.equal(retry.needsDocument(first),true,'bad bytes do not publish a loaded shard')
corrupt = false
assert.deepEqual((await retry.loadDocument(first)).documents[first],index.documents[first],'failed metadata can be retried')

transport.clear(); held = true
const shared = makeRepository(); await shared.loadIndex()
const owner = new AbortController()
const cancelled = shared.loadDocument(first,{signal:owner.signal}), retained = shared.loadDocument(first)
await new Promise(resolve=>setTimeout(resolve,0))
owner.abort(); release()
await assert.rejects(cancelled,{name:'AbortError'})
assert.deepEqual((await retained).documents[first],index.documents[first],'one consumer leaving does not abort another')
held = false
assert.throws(()=>validateReaderTitles({...JSON.parse(indexBytes),shards:{}}),/shards/)
const unsafe = JSON.parse(indexBytes)
unsafe.shards['00'].file='../outside.json'
assert.throws(()=>validateReaderTitles(unsafe),/shard binding/)
const wrongBucket = JSON.parse(payloads.get('/reader-titles/00.json'))
wrongBucket.key='01'
assert.throws(()=>validateReaderTitleShard(wrongBucket,JSON.parse(indexBytes),'01'),/Misrouted/)
const oversized = createReaderTitleRepository({url,transport:createBoundedTextTransport({maxBytes:READER_TITLE_BYTE_BUDGET,
  fetchImpl:async()=>new Response(' ',{headers:{'content-length':String(READER_TITLE_BYTE_BUDGET+1)}})})})
await assert.rejects(oversized.loadIndex(),/byte budget/)
console.log('Reader title shards: lazy fetch, exact bytes, retry, shared cancellation, preserved bindings and byte budgets passed')
