// Own both the initial result and late refinements. Cached refinements may
// finish before the loader returns; never overwrite them with its base result.
export function createSongIndexSession({load,isCurrent,install,onRefinement,onError}) {
  let generation=0
  return {
    invalidate(){generation++},
    async load(options) {
      const ticket=++generation,id=options.song.id
      const owned=()=>ticket===generation && !options.signal?.aborted && isCurrent(id)
      let ready=false,latest
      try {
        const base=await load({...options,onOptional:value=>{
          latest=value
          if(ready && owned()){install(value);onRefinement?.()}
        }})
        if(!owned())return false
        ready=true;install(latest ?? base);onRefinement?.()
        return true
      } catch(error) {
        if(!owned())return false
        if(onError){onError(error);return false}
        throw error
      }
    },
  }
}
