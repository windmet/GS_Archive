import {createHash} from 'node:crypto'

export const sourceHash = text => createHash('sha256').update(text).digest('hex')
export const normalizeGashaName = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[\s～~…・＆&]/gu,'')

// Names only. Guaranteed rarity, bonus bundles and draw counts stay on each ticket.
export function ticketGashaName(source) {
 if(!/(?:ガシャ|GROWING\s+FES)/u.test(source)||!source.includes('チケット'))return null
 if(source.includes('セレクション'))return null
 let name=source.replace(/\s*(?:\d+回\s*)?チケット$/u,'').trim()
 name=name.replace(/^(?:おまけ|育成アイテム|アンコールスター[IVX]+|ゴーゴーゼリーDX)付き！\s*/u,'')
 name=name.replace(/^彩光の欠片\s*SSR付き！\s*/u,'')
 if(!name.startsWith('SSR確定10連'))name=name.replace(/^(?:SSR確定[！!]?|SR以上確定)\s*/u,'')
 return name.replace(/\(SSR確定\)/u,'').replace(/\s+/gu,' ').trim()
}

export function ticketTranslatedGashaName(text) {
 let name=String(text).replace(/\s*(?:\d+次)?券$/u,'').trim()
 name=name.replace(/^(?:附赠奖励|附带养成道具|附带返场之星[IVX]+|附带GoGo果冻DX|附带冲冲果冻DX)[！!]\s*/u,'')
 name=name.replace(/^附带彩光碎片SSR！\s*/u,'')
 if(!name.startsWith('SSR确定10连'))name=name.replace(/^(?:SSR确定[！!]?|SR以上确定)\s*/u,'')
 return name.replace(/[（(]SSR确定[)）]/u,'').replace(/\s+/gu,' ').trim()
}

export function buildGashaTicketEvidence(items,index,translations,aliases={}) {
 const primary=index.gashas.filter(g=>g.phase==='primary'),groups=new Map(),unresolved=[]
 for(const item of items){
  const source=ticketGashaName(item.nameJa)
  if(!source)continue
  const key=normalizeGashaName(aliases[source]||source)
  const candidates=primary.filter(g=>normalizeGashaName(g.display_name)===key)
  // Multiple STAGE announcements keep their separate identities; never choose one by position.
  const id=candidates.length===1?String(candidates[0].id):'ticket-'+sourceHash(key).slice(0,16)
  const group=groups.get(id)||{id,source_name:candidates.length?candidates[0].display_name:(aliases[source]||source),source_hash:null,matched_ids:candidates.map(g=>String(g.id)),source_type:'item-masterdata',tickets:[],translation_candidates:[]}
  group.source_hash=sourceHash(group.source_name)
  group.matched_periods=candidates.map(g=>({id:String(g.id),start_at:g.start_at||null,end_at:g.end_at||null}))
  const translated=translations.item?.name?.[item.nameJa]
  const translation=translated?ticketTranslatedGashaName(translated):''
  const priority=/^(?:SSR|SR以上)|付き！/u.test(item.nameJa)?1:0
  group.tickets.push({id:String(item.id),key:item.key,source_name:item.nameJa,source_description:item.descriptionText?.plain||'',source_hash:sourceHash(item.nameJa),description_hash:sourceHash(item.descriptionText?.plain||''),translation:translated||'',item_type:item.itemType})
  if(translation)group.translation_candidates.push({text:translation,priority,item_id:String(item.id)})
  groups.set(id,group)
 }
 const rows=[...groups.values()].map(group=>{
  group.translation_candidates.sort((a,b)=>a.priority-b.priority||Number(a.item_id)-Number(b.item_id))
  const selected=group.translation_candidates[0]
  const conflicts=[...new Set(group.translation_candidates.map(c=>c.text))].filter(text=>normalizeGashaName(text)!==normalizeGashaName(selected?.text))
  if(conflicts.length)unresolved.push({id:group.id,type:'translation-variants',selected:selected?.text,alternatives:conflicts})
  return {...group,translation:selected?.text||'',translation_item_id:selected?.item_id||null,status:selected?'draft':'missing',not_final:true}
 })
 const excluded=items.filter(item=>/ガシャ.*セレクション/u.test(item.nameJa)&&item.nameJa.includes('チケット')).map(item=>({id:String(item.id),source_name:item.nameJa,reason:'选择券未指明具体抽取卡池，不建立卡池记录。'}))
 return {schema_version:1,rows,unresolved,excluded_tickets:excluded,summary:{existing_primary:primary.length,ticket_groups:rows.length,matched_groups:rows.filter(r=>r.matched_ids.length===1).length,ambiguous_groups:rows.filter(r=>r.matched_ids.length>1).length,supplemental_groups:rows.filter(r=>!r.matched_ids.length).length,tickets:rows.reduce((n,r)=>n+r.tickets.length,0),unlinked_selection_tickets:excluded.length}}
}
