// Each collection domain's entity key: `<type>:<id>` with the id shape its catalog publishes.
export const COLLECTION_IDENTITIES=Object.freeze({
  items:{type:'item',id:/^\d+$/}, honors:{type:'honor',id:/^\d+$/},
  currencies:{type:'currency',id:/^[a-z]+(?:-[a-z]+)*$/}, costumes:{type:'costume',id:/^[0-9]{3}[a-z]{3}_[0-9]{3}_[0-9]{2}$/},
});
export function collectionEntityDomain(key){
  const [type,...rest]=String(key||'').split(':'),id=rest.join(':');
  const match=Object.entries(COLLECTION_IDENTITIES).find(([,identity])=>identity.type===type&&identity.id.test(id));
  return match?match[0]:'';
}
/** One live directory per mounted collection page; detail requests never hide it. */
export function createCollectionCatalogSession(repository, onChange) {
  let revision=0, controller=null, disposed=false, catalogDomain='';
  const state={domain:'',rows:[],detail:null,selectedId:'',catalogBusy:false,detailBusy:false,error:'',errorScope:''};
  const publish=values=>{Object.assign(state,values);if(!disposed)onChange({...state})};
  async function open(domain,key='',{selectDefault=true}={}) {
    if(disposed)return false;
    controller?.abort();controller=new AbortController();
    const run=++revision,options={signal:controller.signal};
    const current=()=>!disposed && run===revision && !options.signal.aborted;
    const cached=catalogDomain===domain;
    if(!cached)catalogDomain='';
    publish({domain,rows:cached?state.rows:[],detail:null,selectedId:'',catalogBusy:!cached,detailBusy:cached,error:'',errorScope:''});
    let phase='catalog';
    try {
      if(!COLLECTION_IDENTITIES[domain])throw Error('Invalid collection domain');
      if(!cached) {
        const rows=await repository.catalog(domain,options);
        if(!current())return false;
        catalogDomain=domain;
        publish({rows,catalogBusy:false,detailBusy:true});
      }
      phase='detail';
      const {type}=COLLECTION_IDENTITIES[domain];
      const match=key && collectionEntityDomain(key)===domain ? [key,key.slice(type.length+1)] : null;
      if(key && !match)throw Error('Invalid collection identity');
      if(!key && !selectDefault){publish({detailBusy:false});return true}
      const selected=key?state.rows.find(row=>String(row.id)===match[1]):state.rows[0];
      if(!selected) {
        if(!key){publish({detailBusy:false});return true}
        throw Error('Unavailable collection identity');
      }
      publish({selectedId:String(selected.id)});
      const detail=await repository.detail(domain,selected,options);
      if(!current())return false;
      if(String(detail.entry?.id)!==String(selected.id) || detail.entry?.key!==`${type}:${selected.id}`)
        throw Error('Collection identity mismatch');
      publish({detail,detailBusy:false});return true;
    } catch(error) {
      if(current())publish({catalogBusy:false,detailBusy:false,errorScope:phase,error:phase==='catalog'?'藏品目录暂时无法读取，请重试。':'这件藏品的资料暂时无法读取，请重试或选择其他资料。'});
      return false;
    }
  }
  return {state,open,dispose(){disposed=true;revision++;controller?.abort();state.rows=[];state.detail=null;catalogDomain=''}};
}
