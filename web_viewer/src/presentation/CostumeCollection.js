import {archiveText} from '../components/archive/useArchiveCostumeText.js'
// Shared by the costume catalogue and its detail; slot names match the card page's costume labels.
export const costumeSlotLabels=Object.freeze({live_initial:'Live 普通',live_limitbreak:'Live 突破',story_initial:'剧情普通',story_awakened:'剧情特训',story_limitbreak:'剧情突破'})
// A model LiveCostumes names is a Live costume as well; one only StoryCostumes names is worn in stories alone.
export const costumeCategory=row=>row?.uses?.includes('live') ? 'live' : 'story-only'
export const costumeUseLabel=row=>costumeCategory(row)==='live' ? 'Live 与剧情衣装' : '剧情衣装'
// Some story-only models carry no name in the client; they are shown by model code.
export const costumeName=row=>row?.nameJa ? archiveText('costume',row.nameJa) : '未命名衣装'
