import {archiveText} from '../components/archive/useArchiveCostumeText.js'
import {storyCostumeLabel} from './costumeSeries.js'
import costumeRenders from '../data/costumeRenderThumbs.json'
// Shared by the costume catalogue and its detail; slot names match the card page's costume labels.
export const costumeSlotLabels=Object.freeze({live_initial:'Live 普通',live_limitbreak:'Live 突破',story_initial:'剧情普通',story_awakened:'剧情特训',story_limitbreak:'剧情突破'})
// A model LiveCostumes names is a Live costume as well; one only StoryCostumes names is worn in stories alone.
export const costumeCategory=row=>row?.uses?.includes('live') ? 'live' : 'story-only'
export const costumeUseLabel=row=>costumeCategory(row)==='live' ? 'Live 与剧情衣装' : '剧情衣装'
// Some story-only models carry no name in the client; an identified one gets a site label, the rest stay unnamed.
export const costumeName=row=>row?.nameJa ? archiveText('costume',row.nameJa) : storyCostumeLabel(row?.id) ? `${storyCostumeLabel(row.id)}（未命名）` : '未命名衣装'
// The client has no icon for 30 story-only models (and a wrong one for 037jir_108_00); those use a site
// render of the spine model (scripts/render-costume-thumbnails.mjs).
export const costumeImage=(id,image)=>{
  const render=costumeRenders.thumbs[id]
  return render && (!image?.url || render.replacesIcon) ? {status:'site-render',url:render.url,width:render.width,height:render.height,replacesIcon:Boolean(render.replacesIcon)} : image
}
