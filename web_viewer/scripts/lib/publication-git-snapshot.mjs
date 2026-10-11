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
export function publicationGitSnapshot(paths,cwd){
  const keys=paths.flatMap(path=>[`:${path}`,`HEAD:${path}`])
  const output=execFileSync('git',['cat-file','--batch'],{cwd,input:keys.join('\n')+'\n',maxBuffer:512*1024*1024})
  const blobs=parseBatchBlobs(output,keys)
  const attrs=execFileSync('git',['check-attr','-z','--stdin','eol'],{cwd,input:paths.join('\0')+'\0',encoding:'utf8',maxBuffer:16*1024*1024}).split('\0')
  const eols=new Map();for(let i=0;i+2<attrs.length;i+=3)eols.set(attrs[i],attrs[i+2])
  return path=>({indexBytes:blobs.get(`:${path}`),headBytes:blobs.get(`HEAD:${path}`),eol:eols.get(path)})
}
