import evidence from '../../public/data/editorial/gasha-ticket-evidence.json' with {type:'json'}

const bySource=new Map(evidence.rows.map(row=>[row.source_name,row]))
const byId=new Map(evidence.rows.flatMap(row=>row.matched_ids.map(id=>[id,row])))
const byItem=new Map(evidence.rows.flatMap(row=>row.tickets.map(ticket=>[ticket.id,row])))
export function gashaTicketPeriodLabel(timestamp) {
 return Number.isFinite(timestamp)?new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeZone:'Asia/Tokyo'}).format(new Date(timestamp*1000)):''
}

export function translatedGashaName(source,locale='zh-CN') {
 return locale==='zh-CN' ? bySource.get(source)?.translation || source || '' : source || ''
}
export function gashaTicketLinks(itemId) {
 const row=byItem.get(String(itemId))
 if(!row)return []
 return (row.matched_ids.length?row.matched_ids:[row.id]).map(id=>({id,display_name:row.source_name,ambiguous:row.matched_ids.length>1,start_at:row.matched_periods?.find(period=>period.id===id)?.start_at||null}))
}
export function attachGashaTickets(gasha) {
 if(!gasha)return gasha
 const row=byId.get(String(gasha.id))
 // Exact curated name protects readmodels from a stale local overlay.
 if(!row||row.source_name!==gasha.display_name)return gasha
 return {...gasha,ticket_evidence:row,tickets:row.tickets,ticket_link_ambiguous:row.matched_ids.length>1}
}
export function supplementGashaCatalog(rows,summary={}) {
 const additions=evidence.rows.filter(row=>!row.matched_ids.length).map(row=>({
  id:row.id,code:row.id,logical_id:row.id,display_name:row.source_name,title:row.source_name,
  category:'ticket_named',phase:'ticket_record',source_type:'item-masterdata',
  start_at:null,end_at:null,banner_url:null,derived_pickup_cards:[],related_pickup_count:0,
  ticket_evidence:row,tickets:row.tickets,
 }))
 return {rows:[...rows.map(attachGashaTickets),...additions],summary:{...summary,ticket_supplement_count:additions.length,ticket_count:evidence.summary.tickets,category_counts:{...summary.category_counts,ticket_named:additions.length}}}
}
