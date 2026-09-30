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
export function rewardCondition(row) {
  const values=[];
  if (row.totalPoint!==undefined) values.push(`${number(row.totalPoint)} PT`);
  if (row.upperRank!==undefined || row.lowerRank!==undefined) values.push(`第 ${number(row.upperRank ?? row.lowerRank)}–${number(row.lowerRank ?? row.upperRank)} 名`);
  if (row.level!==undefined) values.push(`等级 ${row.level}`);
  if (row.intervalPoint!==undefined) values.push(`每 ${number(row.intervalPoint)} PT`);
  if (row.offsetPoint!==undefined) values.push(`起点 ${number(row.offsetPoint)} PT`);
  if (row.limitPoint!==undefined) values.push(`上限 ${number(row.limitPoint)} PT`);
  if (row.totalCount!==undefined) values.push(`累计 ${number(row.totalCount)} 次`);
  if (row.dayCount!==undefined) values.push(`第 ${number(row.dayCount)} 天`);
  if (row.sumFanAmount!==undefined) values.push(`累计粉丝 ${number(row.sumFanAmount)}`);
  if (row.episodeId) values.push('阅读对应分段');
  if (row.sectionId) values.push('阅读对应章节');
  return values.join(' · ') || (row.relation==='event-material' ? '活动所用材料' : row.relation==='card-awakening-cost' ? '卡片觉醒消耗' : '条件未完整收录');
}
