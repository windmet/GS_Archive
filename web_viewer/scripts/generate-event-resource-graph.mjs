import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {createArchiveAssetResolver} from './lib/archive-assets.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const sources={}
const assets=createArchiveAssetResolver()
async function json(relative){
  const bytes=await readFile(path.join(root,relative))
  sources[relative]=createHash('sha256').update(bytes).digest('hex')
  return JSON.parse(bytes)
}
async function image(url){
  try {
    const file=url.startsWith('/assets/domain-images/')?assets.domainImagePath(url.slice('/assets/domain-images/'.length)):path.join(root,'public',url)
    const bytes=await readFile(file)
    if(bytes.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error(`Not PNG: ${url}`)
    return {url,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:createHash('sha256').update(bytes).digest('hex')}
  } catch(error){if(error.code==='ENOENT')return null;throw error}
}
const supplements=await json('public/data/masterdata/domains/event_supplement_index.json')
const media=await json('public/data/masterdata/domains/event_media.json')
const master=await json('public/data/masterdata/event_index.json')
const manifest=await json('public/data/archive_manifest.json')
const catalog=await json('public/data/masterdata/story_catalog.json')
const exchanges=await json('public/data/editorial/event-exchange-evidence.json')
const cards=await json('public/data/masterdata/card_index.json')
const idols=await json('public/data/masterdata/idol_unit_dictionary.json')
const reading=await json('public/data/reading/manifest.json')
const legacy=new Map(manifest.unit_event_relations.map(e=>[String(e.event_code),e]))
const events=[]
for(const e of supplements.entries){
  const m=master.events.find(row=>String(row.event_code)===e.eventCode)
  const rawMedia=media.entries[`event:${e.id}`]
  const originalRelation=e.storyChapterRelations.find(r=>r.relation==='reprint')
  const original=originalRelation?supplements.entries.find(row=>row.storyChapterRelations.some(r=>r.chapterId===originalRelation.chapterId&&r.relation==='original')):null
  const storyCode=original?.eventCode||e.eventCode
  const story=catalog.entries.find(row=>row.domain==='event'&&row.sectionId===storyCode)
  const storyMedia=original?media.entries[`event:${original.id}`]:rawMedia
  const storyCover=story&&storyMedia?.background?.url?await image(storyMedia.background.url):null
  const firstReading=story?reading.entries.find(row=>row.parent_file===story.file&&row.domain==='event'&&row.status==='ready'):null
  const announcement=await image(`/assets/events/banners/image_home_announce_event_${e.eventCode}_01.png`)
  const originalAnnouncement=!announcement&&original?await image(`/assets/events/banners/image_home_announce_event_${original.eventCode}_01.png`):null
  const hero=announcement||originalAnnouncement||(rawMedia.background?.url?await image(rawMedia.background.url):null)
  const thumbnail=rawMedia.banner?.url?await image(rawMedia.banner.url):null
  const routeId=String(legacy.get(e.eventCode)?.event_id||`event:${e.eventCode}`)
  const exchange=exchanges.events.find(row=>row.eventCode===e.eventCode)
  let exchangeRewards=null
  if(exchange){
    if(e.eventKind!=='collection'||exchange.title!==e.name||exchange.startAt!==e.term.openAt||exchange.eventDetailId!==e.eventDetailId)throw Error(`Exchange event mismatch ${e.eventCode}`)
    const detail=await json(`public/data/masterdata/domains/event_details/${e.eventCode}.json`)
    const resolved=[]
    for(const row of exchange.cards){
      const card=cards.cards.find(card=>card.resource_id===row.resourceId)
      const item=detail.items.find(item=>item.itemId===row.cost.itemId)
      if(!card||card.title!==row.title||card.character_id!==row.characterId||card.rarity!==row.rarity||card.release_at!==exchange.startAt||!item)throw Error(`Exchange card mismatch ${row.resourceId}`)
      const cardImage=await image(`/assets/cards/icons/image_card_icon_${row.resourceId}.png`)
      if(!cardImage)throw Error(`Missing exchange card image ${row.resourceId}`)
      resolved.push({card_resource_id:card.resource_id,card_title:card.title,character_id:card.character_id,
        character_name:idols.by_idol_code[card.character_id]?.display_name,rarity:card.rarity,image:cardImage,
        cost:row.cost,exchangeLimit:row.exchangeLimit})
    }
    exchangeRewards={source:exchange.source,cards:resolved,exchangeRows:exchange.exchangeRows||[]}
  }
  events.push({id:routeId,eventCode:e.eventCode,title:e.name,kind:e.eventKind,startAt:e.term.openAt,endAt:e.term.closeAt,
    isReprint:Boolean(originalRelation),storyCode:story?.sectionId||null,storyAvailable:Boolean(story?.exists),episodeCount:story?.rowCount||0,
    rewardCardCount:m?.reward_card_ids?.length||0,exchangeRewards,
    storyCover,storyCast:(story?.characters||[]).filter(code=>idols.by_idol_code[code]?.idol_id<=49),
    storyFile:story?.file||null,firstReadingId:firstReading?.document_id||null,
    series:story?.officialTitle?.match(/^GROWING (SIGN@L|SELECTION)/)?.[0]||'',
    hero,heroRole:announcement?'announcement':originalAnnouncement?'original-announcement':hero?'background':null,thumbnail})
}
const output={schemaVersion:1,sources,roster:idols.idols.filter(idol=>idol.idol_id<=49).map(idol=>({code:idol.idol_code,name:idol.display_name})),summary:{events:events.length,heroes:events.filter(e=>e.hero).length,thumbnails:events.filter(e=>e.thumbnail).length},events}
const target=path.join(root,'public/data/editorial/event-resource-graph.json')
await mkdir(path.dirname(target),{recursive:true})
await writeFile(target,JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify(output.summary))
