import index from '../../public/data/editorial/gasha-pools/index.json' with {type:'json'}

// Rules and art per gasha (scripts/generate-gasha-pool-details.mjs). The index is small and travels with the
// catalogue; each detail file is fetched once, when its gasha opens.
const cache=new Map()

export function gashaPoolArt(id) {
 return index.ids[String(id)]?.art||null
}

export function hasGashaPoolDetail(id) {
 return Boolean(index.ids[String(id)])
}

export function loadGashaPoolDetail(id) {
 const key=String(id)
 if(!hasGashaPoolDetail(key))return Promise.resolve(null)
 if(!cache.has(key)){
  const request=fetch(`/data/editorial/gasha-pools/${encodeURIComponent(key)}.json`).then(response=>{
   if(!response.ok)throw new Error(`Gasha detail ${key}: HTTP ${response.status}`)
   return response.json()
  }).then(detail=>{
   if(detail?.id!==key)throw new Error(`Gasha detail ${key}: unexpected payload`)
   return detail
  })
  // A failed request is not cached, so reopening the gasha retries it.
  cache.set(key,request.catch(error=>{cache.delete(key);throw error}))
 }
 return cache.get(key)
}
