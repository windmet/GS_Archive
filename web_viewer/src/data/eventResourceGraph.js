import graph from '../../public/data/editorial/event-resource-graph.json' with {type:'json'}

const byCode=new Map(graph.events.map(event=>[event.eventCode,event]))
export const storyIdolRoster=graph.roster
/** Event code and route identity must agree before applying local presentation. */
export function eventResources(identity){
  const code=String(identity?.eventCode||identity?.event_code||'')
  const event=byCode.get(code)
  if(!event)return null
  const title=identity.title||identity.nameJa
  const id=identity.id||identity.event_id
  if(identity.release_at!==undefined&&identity.release_at!==event.startAt)return null
  return (!id||String(id)===event.id)&&(!title||title===event.title)?event:null
}
// The banner for an event row (idol and card pages), under the same identity check as eventResources.
export function eventBannerUrl(event){
  return eventResources({eventCode:event?.event_code,id:event?.event_id,title:event?.title,release_at:event?.release_at})?.hero?.url||''
}
export function storyEventResources(entry){
  const code=String(entry?.eventRelation?.event_code||entry?.sectionId||'')
  const event=byCode.get(code)
  if(entry?.sectionId&&String(entry.sectionId)!==code)return null
  return event&&(!entry?.eventRelation?.event_id||String(entry.eventRelation.event_id)===event.id)?event:null
}
/** The series is shown beside the title, so the title drops its "GROWING …" prefix. */
export function storyEventTitle(entry){
  return String(entry?.title||'').replace(/^GROWING (SIGN@L|SELECTION)\s*-\s*/,'').replace(/-$/,'')
}
export function storyEventCast(resource){
  return (resource?.storyCast||[]).map(code=>storyIdolRoster.find(idol=>idol.code===code)).filter(Boolean)
}
