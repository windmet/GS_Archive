import { CreditCard, Languages, UserRound, Briefcase, Cake, Sparkles, CalendarRange } from '@lucide/vue'
export const storyGateways = Object.freeze([
  {id:'card_scenarios',label:'卡片剧情',icon:CreditCard},
  {id:'external_story_resources',label:'社区中文剧情',icon:Languages,unit:'条',action:'external-resources'},
  {id:'idol_story',label:'个人故事',icon:UserRound,action:'idol-story'},
  {id:'work',label:'工作剧情',icon:Briefcase,unit:'人',action:'work'},
  {id:'birthday',label:'生日剧情',icon:Cake},
  {id:'extra',label:'额外剧情',icon:Sparkles},
  {id:'seasonal_campaign',label:'季节企划',icon:CalendarRange,unit:'组',action:'seasonal'},
])
export function storyGatewayCount(gateway, entries, counts={}) {
  const field={'external-resources':'externalResourceCount',seasonal:'seasonalCount',work:'workCount','idol-story':'idolStoryCount'}[gateway.action]
  return field ? counts[field] ?? null : entries.filter(row=>row.domain===gateway.id).length
}
