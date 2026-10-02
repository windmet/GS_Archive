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
      if(!['items','honors'].includes(domain))throw Error('Invalid collection domain');
      if(!cached) {
        const rows=await repository.catalog(domain,options);
        if(!current())return false;
        catalogDomain=domain;
        publish({rows,catalogBusy:false,detailBusy:true});
      }
      phase='detail';
      const type=domain==='items'?'item':'honor';
      const match=key?new RegExp(`^${type}:(\\d+)$`).exec(key):null;
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
