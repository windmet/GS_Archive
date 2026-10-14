import { Languages, UserRound, Briefcase, Cake, Sparkles, CalendarRange } from '@lucide/vue'
// Phone calls (the card_scenarios domain) belong to 通信, not here; they stay searchable as 电话.
export const storyGateways = Object.freeze([
  {id:'external_story_resources',label:'社区中文剧情',icon:Languages,unit:'条',action:'external-resources'},
  {id:'idol_story',label:'个人故事',icon:UserRound,action:'idol-story'},
  {id:'work',label:'工作剧情',icon:Briefcase,unit:'人',action:'work'},
  {id:'birthday',label:'生日剧情',icon:Cake,action:'birthday'},
  {id:'extra',label:'额外剧情',icon:Sparkles},
  {id:'seasonal_campaign',label:'季节企划',icon:CalendarRange,unit:'组',action:'seasonal'},
])
export function storyGatewayCount(gateway, entries, counts={}) {
  const field={'external-resources':'externalResourceCount',seasonal:'seasonalCount',work:'workCount','idol-story':'idolStoryCount',birthday:'birthdayCount'}[gateway.action]
  // Birthday counts its logical records; without the count it falls back to its own published files.
  if (gateway.action === 'birthday' && !counts.birthdayCount) return entries.filter(row=>row.domain===gateway.id).length
  return field ? counts[field] ?? null : entries.filter(row=>row.domain===gateway.id).length
}
/** A gateway's caveat: the birthday records that open a personal-story Small Talk. */
export function storyGatewayNote(gateway, counts={}) {
  return gateway.action === 'birthday' && counts.birthdayCount && counts.birthdaySharedCount
    ? `其中 ${counts.birthdaySharedCount} 篇与个人故事共享` : ''
}
