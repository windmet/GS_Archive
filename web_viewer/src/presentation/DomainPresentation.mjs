export const eventKindLabels={theater:'THEATER',collection:'315 CARNIVAL',tour:'TOUR',valentine:'情人节',whiteday:'白色情人节'};
export const rewardScopeLabels={point:'累计点数',ranking:'排名奖励','idol-ranking':'偶像排名',repeated:'重复点数奖励',panel:'歌曲面板',
  'story-section':'剧情章节','story-archive':'存档剧情','story-in-event-term':'活动期内剧情','seasonal-story':'季节剧情','valentine-level':'情人节等级'};
export const sourceDomainLabels={40:'制作人等级',41:'制作人阶级',66:'主线剧情',68:'偶像剧情',72:'第零话',79:'生日剧情',83:'登录奖励',117:'企划登录奖励',183:'首页剧情'};
export const number=value=>new Intl.NumberFormat('zh-CN').format(value);
export function historicalDate(seconds) {
  if (!Number.isFinite(seconds) || seconds<=0) return '未记录';
  const date=new Date(seconds*1000);
  if (date.getUTCFullYear()<=2000 || date.getUTCFullYear()>=2099) return '配置占位日期';
  return new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeZone:'Asia/Tokyo'}).format(date);
}
// '' when the date is missing or only a placeholder, so callers can hide the row.
export function knownHistoricalDate(seconds) {
  const text=historicalDate(seconds);
  return text==='未记录' || text==='配置占位日期' ? '' : text;
}
export function historicalPeriod(entry) {
  const open = entry.termInfo?.open, close = entry.termInfo?.close;
  const from = open?.sentinelCandidate ? null : entry.term?.openAt;
  const to = close?.sentinelCandidate ? null : entry.term?.closeAt;
  if (from == null && to == null) return '未限定配置期';
  if (from == null) return `至 ${historicalDate(to)}`;
  if (to == null) return `${historicalDate(from)} 起`;
  return `${historicalDate(from)} — ${historicalDate(to)}`;
}
// One rank prints as "第 2 名"; a real range as "第 1–3 名". Shared by reward rows and idol honor labels.
export const rankText=(upper,lower)=>{
  const from=upper ?? lower, to=lower ?? upper;
  return from===to ? `第 ${number(from)} 名` : `第 ${number(from)}–${number(to)} 名`;
};
// Permanent entries have no period worth printing; callers hide the row on ''.
export function historicalPeriodNote(entry) {
  const text=historicalPeriod(entry);
  return text==='未限定配置期' ? '' : text;
}
// "2022年6月29日 — 7月12日": the close drops its year when it repeats the open's.
export function campaignPeriod(term) {
  const parts=seconds=>{
    if (!Number.isFinite(seconds) || seconds<=0) return null;
    const date=new Date(seconds*1000);
    if (date.getUTCFullYear()<=2000 || date.getUTCFullYear()>=2099) return null;
    const jst=new Date(seconds*1000+9*3600*1000);
    return {year:jst.getUTCFullYear(),month:jst.getUTCMonth()+1,day:jst.getUTCDate()};
  };
  const open=parts(term?.openAt), close=parts(term?.closeAt);
  if (!open) return '';
  const full=value=>`${value.year}年${value.month}月${value.day}日`;
  if (!close) return `${full(open)} 起`;
  return `${full(open)} — ${close.year===open.year ? `${close.month}月${close.day}日` : full(close)}`;
}
// A group of event rewards reads "30 场活动 · 每场 100,000" when every event pays the same, else "… · 共 3,000,000".
export function acquisitionSummary(group) {
  const events=group.events || [];
  if (!events.length) {
    const range=group.levelRange ? ` · Lv.${group.levelRange[0]}–${group.levelRange[1]}` : '';
    return `共 ${number(group.totalAmount)}${range}`;
  }
  const same=events.every(row=>row.totalAmount===events[0].totalAmount);
  return `${events.length} 场活动 · ${same ? `每场 ${number(events[0].totalAmount)}` : `共 ${number(group.totalAmount)}`}`;
}
export function rewardConditions(row) {
  const values=[];
  if (row.totalPoint!==undefined) values.push(`${number(row.totalPoint)} PT`);
  if (row.upperRank!==undefined || row.lowerRank!==undefined) values.push(rankText(row.upperRank,row.lowerRank));
  if (row.level!==undefined) values.push(`等级 ${row.level}`);
  if (row.intervalPoint!==undefined) values.push(`每 ${number(row.intervalPoint)} PT`);
  if (row.offsetPoint!==undefined) values.push(`起点 ${number(row.offsetPoint)} PT`);
  if (row.limitPoint!==undefined) values.push(`上限 ${number(row.limitPoint)} PT`);
  if (row.totalCount!==undefined) values.push(`累计 ${number(row.totalCount)} 次`);
  if (row.dayCount!==undefined) values.push(`第 ${number(row.dayCount)} 天`);
  if (row.sumFanAmount!==undefined) values.push(`累计粉丝 ${number(row.sumFanAmount)}`);
  if (row.episodeId) values.push('阅读对应分段');
  if (row.sectionId) values.push('阅读对应章节');
  return values.length ? values : row.relation==='event-material' ? ['活动所用材料'] : row.relation==='card-awakening-cost' ? ['卡片觉醒消耗'] : [];
}
export const rewardCondition=row=>rewardConditions(row).join(' · ');
export const rewardProductName=product=>product?.presentation?.name || product?.nameJa || product?.typeNameJa || `未解析奖励 ${product?.productId ?? ''}`;
export const rewardRelationLabel=row=>rewardScopeLabels[row.scope] || (row.relation==='card-awakening-cost'?'觉醒消耗':row.relation==='event-material'?'活动材料':sourceDomainLabels[row.sourceTable] || '其他');
export function rewardProductLabel(product) {
  if (product?.kind==='scalar' && product.currencyKey) return '货币';
  return ({item:'道具',honor:'称号',card:'卡片',cardFragment:'卡片碎片',photoFilter:'摄影滤镜',photoSticker:'摄影贴纸',photoSpot:'摄影地点',photoScene:'摄影场景',photoFrame:'摄影相框'})[product?.kind] || product?.typeNameJa || '其他';
}
// A product-type reward (Star Gems, Money) opens its currency entry; items and honors open their own.
export const rewardCollectionKey=product=>product?.kind==='scalar' ? (/^currency:[a-z]+(?:-[a-z]+)*$/.test(product.currencyKey || '') ? product.currencyKey : '') :
  product?.referenceStatus==='resolved-entity' &&
  ['item','honor'].includes(product.kind) && new RegExp(`^${product.kind}:\\d+$`).test(product.entityKey || '') ? product.entityKey : '';
// Editorial navigation labels reviewed against source descriptions; not official enums.
export const itemBrowseGroups=[
  {key:'recovery',label:'体力恢复',codes:[1]},
  {key:'tickets',label:'招募与自选票券',codes:[3,18]},
  {key:'card-materials',label:'觉醒与突破材料',codes:[4,5]},
  {key:'skill-training',label:'技能培养',codes:[7]},
  {key:'live-boost',label:'演出增幅',codes:[10]},
  {key:'story-unlock',label:'剧情解锁',codes:[12]},
  {key:'exchange',label:'兑换资源',codes:[14]},
  {key:'event-materials',label:'活动专属物品',codes:[15,16,17]},
  {key:'other',label:'其他',codes:[]},
];
export const itemBrowseGroup=code=>itemBrowseGroups.find(group=>group.codes.includes(code)) || itemBrowseGroups.at(-1);
