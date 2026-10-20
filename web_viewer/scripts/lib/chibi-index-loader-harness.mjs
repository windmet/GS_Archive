import fs from 'node:fs/promises'

// Execute the production index entry points without initializing Pixi in Node.
export async function createActualChibiIndexLoaders(indexTransport) {
  const source=await fs.readFile(new URL('../../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
  const section=source.slice(source.indexOf('async function liveJson('),source.indexOf('export function sampleLiveChibiLipSync(')).replaceAll('export ','')
  const dependencies={indexTransport,LIVE_CHIBI_BASE:'/assets/live-chibi'}
  for(const match of source.matchAll(/import \{([^}]+)\} from '(\.\.\/core\/[^']+)'/g)) {
    const module=await import(new URL('../../src/utils/'+match[2],import.meta.url))
    for(const name of match[1].split(',').map(name=>name.trim()).filter(Boolean))dependencies[name]=module[name]
  }
  const names=[...section.matchAll(/(?:async function|const) (fetchLiveChibi\w+)/g)].map(match=>match[1])
  return new Function(...Object.keys(dependencies),section+';return {'+names.join(',')+'}')(...Object.values(dependencies))
}
