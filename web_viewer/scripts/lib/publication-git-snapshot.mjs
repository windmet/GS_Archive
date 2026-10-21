import {execFileSync} from 'node:child_process'
/** Parse cat-file's byte protocol; JSON newlines and embedded NULs are payload. */
export function parseBatchBlobs(output, keys) {
  let offset=0
  const result=new Map()
  for(const key of keys){
    const end=output.indexOf(10,offset)
    if(end<0)throw Error('Truncated Git blob header')
    const header=output.subarray(offset,end).toString('utf8');offset=end+1
    if(header.endsWith(' missing')){result.set(key,null);continue}
    const match=/^[a-f0-9]+ blob (\d+)$/.exec(header)
    if(!match)throw Error('Unexpected Git object kind')
    const size=Number(match[1])
    if(offset+size>=output.length || output[offset+size]!==10)throw Error('Truncated Git blob payload')
    result.set(key,output.subarray(offset,offset+size));offset+=size+1
  }
  if(offset!==output.length)throw Error('Unexpected Git blob trailer')
  return result
}
export function publicationGitSnapshot(paths,cwd,{maxBatchBytes=16*1024*1024}={}){
  if(!Number.isSafeInteger(maxBatchBytes)||maxBatchBytes<1)throw Error('Invalid Git snapshot batch budget')
  const keys=paths.flatMap(path=>[`:${path}`,`HEAD:${path}`])
  if(!paths.length)return ()=>({indexBytes:undefined,headBytes:undefined,eol:undefined})
  // Size metadata is small. Do not materialize the entire publication history
  // in one stdout buffer: the ledger can exceed 512 MiB even for valid assets.
  const metadata=execFileSync('git',['cat-file','--batch-check'],{cwd,input:keys.join('\n')+'\n',encoding:'utf8',maxBuffer:16*1024*1024}).trimEnd().split('\n')
  if(metadata.length!==keys.length)throw Error('Truncated Git snapshot size metadata')
  const sizes=metadata.map(row=>{
    if(row.endsWith(' missing'))return 0
    const match=/^[a-f0-9]+ blob (\d+)$/.exec(row)
    if(!match)throw Error('Unexpected Git snapshot object kind')
    return Number(match[1])+128
  })
  const batches=[],byPath=new Map()
  let batch={keys:[],bytes:0}
  for(const [i,path] of paths.entries()){
    const bytes=sizes[i*2]+sizes[i*2+1]
    if(batch.keys.length&&batch.bytes+bytes>maxBatchBytes){batches.push(batch);batch={keys:[],bytes:0}}
    byPath.set(path,batches.length)
    batch.keys.push(...keys.slice(i*2,i*2+2));batch.bytes+=bytes
  }
  if(batch.keys.length)batches.push(batch)
  const attrs=execFileSync('git',['check-attr','-z','--stdin','eol'],{cwd,input:paths.join('\0')+'\0',encoding:'utf8',maxBuffer:16*1024*1024}).split('\0')
  const eols=new Map();for(let i=0;i+2<attrs.length;i+=3)eols.set(attrs[i],attrs[i+2])
  let active=-1,blobs=new Map()
  return path=>{
    const id=byPath.get(path)
    if(id===undefined)return {indexBytes:undefined,headBytes:undefined,eol:eols.get(path)}
    if(id!==active){
      const selected=batches[id]
      const output=execFileSync('git',['cat-file','--batch'],{cwd,input:selected.keys.join('\n')+'\n',maxBuffer:Math.max(maxBatchBytes,selected.bytes)+65536})
      blobs=parseBatchBlobs(output,selected.keys);active=id
    }
    return {indexBytes:blobs.get(`:${path}`),headBytes:blobs.get(`HEAD:${path}`),eol:eols.get(path)}
  }
}
