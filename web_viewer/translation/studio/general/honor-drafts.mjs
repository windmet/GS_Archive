export const honorNames = {
  '仕事熱心':'工作热心','一流の仕事人':'一流工作达人','フィジカルワーカー':'体能工作达人','インテリワーカー':'智力工作达人',
  'メンタルワーカー':'精神工作达人','思い出の紡ぎ手':'回忆的编织者','数えきれない思い出':'数不尽的回忆',
  '理由あってアイドル！':'事出有因，成为偶像！','輝きの向こう側へ':'走向光芒的彼端','衣装コレクター':'衣装收藏家',
  '真・衣装コレクター':'真·衣装收藏家','極・衣装コレクター':'极·衣装收藏家','もうひとつの姿':'另一种姿态',
  '異彩を放つラインナップ':'别具一格的阵容','極彩色のコレクション':'绚丽多彩的收藏','ムードメーカー':'气氛制造者',
  '心のよりどころ':'心灵的依靠','相談相手':'倾诉对象','頼れる存在':'可靠的存在','心のオアシス':'心灵绿洲',
  '315プロ専属カメラマン':'315 事务所专属摄影师','シャッター越しの煌き':'镜头彼端的闪耀','継続は力なり':'坚持就是力量',
  '積み重ねた日々':'日积月累的岁月','たゆみない歩み':'永不停歇的脚步','気鋭の興行師':'新锐演出策划者',
  '熟練の興行師':'资深演出策划者','ワールドエンターテイナー':'世界级表演者','ずっとずっとその先へ':'不断迈向更远的彼端',
  '夢の向こうへ':'走向梦想的彼端','始まるんだ最高のStage！':'最棒的 Stage 即将开始！',
  '君にSTARLIGHT CELEBRATE！':'为你献上 STARLIGHT CELEBRATE！','最高の瞬間へとエスコート':'引领你走向最棒的瞬间',
  'みんなで作るVictory！':'共同创造 Victory！','可能性は∞':'可能性无限','色彩！彩！彩！':'色彩！彩！彩！',
  'ずっと叶えたかった未来':'始终渴望实现的未来','今日もハートがアツい！':'今天的心也火热！',
  'ようこそ、Cafe Paradeへ！':'欢迎来到 Cafe Parade！','この歌が君に届くのならば':'若这首歌能传达到你身边',
  '強く尊き獣':'强大而高贵的野兽','さいこうのテーマパーク！':'最棒的主题乐园！','さあ 出航！夢色VOYAGER':'出航吧！梦色 VOYAGER',
  '胸に刻まれてる言葉それは…':'铭刻于心的话语，那就是……','想いならエタニティ':'心意即是永恒',
  '始めようぜ Lessonを!':'开始 Lesson 吧！','それがダイヤモンド':'那就是钻石','ダミーテキスト':'占位文本',
  '一人前':'独当一面','315プロのカリスマ':'315 事务所的领军人物','業界のレジェンド':'业界传奇',
  '国民的プロデューサー':'国民制作人','世界的プロデューサー':'世界级制作人','見習いプロデューサー':'见习制作人',
  '駆け出しプロデューサー':'初出茅庐的制作人','新米プロデューサー':'新手制作人','普通プロデューサー':'普通制作人',
  '中堅プロデューサー':'中坚制作人','敏腕プロデューサー':'能干的制作人','一流プロデューサー':'一流制作人',
  '超一流プロデューサー':'超一流制作人','テクニシャン':'技巧达人','超絶技巧':'超凡技巧','無欠のオールラウンダー':'无懈可击的全能选手',
  '情熱のフィジカルマスター':'热情的体能大师','不敵のインテリマスター':'无畏的智力大师','愉楽のメンタルマスター':'欢愉的精神大师',
  '玄人級':'行家级','名人級':'名人级','達人級':'达人级','ベストパフォーマンス':'最佳表现','サイコーのステージ！':'最棒的舞台！',
  '齋藤孝司担当':'斋藤孝司担当',
};

// Series/song proper names intentionally retained in metadata labels.
export const honorProperNames = new Set(['Brand new field','We Can, High Jump！',"We're the one","You're Not Alone",'Have a good day!',
  'GROWING SIGN@L Not Alone','GROWING SELECTION 想いはETERNITY','GROWING SIGN@L Plus 1 Good Day!','GROWING SELECTION Study Equal Magic!']);

export function honorNameDraft(source, idolName) {
  if (honorNames[source]) return honorNames[source];
  if (honorProperNames.has(source)) return source;
  let match = source.match(/^(\d{4})\/VDCPの(.+)の渡したチョコ数(\d+)個達成$/);
  if (match && idolName(match[2])) return `${match[1]} 情人节企划 · ${idolName(match[2])} · 赠送巧克力数达到 ${match[3]} 个`;
  match = source.match(/^(\d{4})\/VDCPの(.+)のランキングで(\d+)(?:～(\d+))?位にランクイン$/);
  if (match && idolName(match[2])) return `${match[1]} 情人节企划 · ${idolName(match[2])} · 排名第 ${match[3]}${match[4] ? `–${match[4]}` : ''} 名`;
  match = source.match(/^(\d+\/\d+)FES限定フォトを(チェンジさせる|最大まで限界突破させる)_(.+)$/);
  if (match && idolName(match[3])) return `${match[1]} FES 限定卡片 · ${idolName(match[3])} · ${match[2]==='チェンジさせる'?'完成特训':'完成最高限界突破'}`;
  match = source.match(/^メインストーリー(\d+)章をすべて読もう$/);
  if (match) return `阅读主线剧情第 ${match[1]} 章全部内容`;
  match = source.match(/^(\d+\/\d+)月(上旬|下旬)$/);
  if (match) return `${match[1]} ${match[2]}`;
  match = source.match(/^(\d+\/\d+)ストーリー実装$/);
  if (match) return `${match[1]} 剧情上线`;
  match = source.match(/^(\d+\/\d+)月追加楽曲$/);
  if (match) return `${match[1]} 新增乐曲`;
  match = source.match(/^(\d+\/\d+)月一周年(\d+)$/);
  if (match) return `${match[1]} 一周年 ${match[2]}`;
  match = source.match(/^(\d+\/\d+)月(\d+)章ED曲$/);
  if (match) return `${match[1]} 第 ${match[2]} 章片尾曲`;
  // Event labels are client titles, not reconstructed acquisition conditions.
  match = source.match(/^((?:\d+\/)?\d+)月(上旬|下旬)イベント(?: のイベントpt報酬を全て獲得しよう| のランキングで(\d+)(?:～(\d+))?位にランクイン|(\d+)(?:～(\d+))?位)$/);
  if (match) {
    const rank = match[3] || match[5], end = match[4] || match[6];
    const date = match[1].includes('/') ? `${match[1]} ` : `${match[1]}月`;
    return `${date}${match[2]}活动 · ${rank ? `第 ${rank}${end ? `–${end}` : ''} 名` : '获得全部活动点数奖励'}`;
  }
  match = source.match(/^(\d+)復刻 (Not Alone|Plus 1 Good Day!)(?: の?)? ?(?:イベントpt報酬を全て獲得しよう|(\d+)(?:～(\d+))?位)$/);
  if (match) return `${match[1]} 复刻 ${match[2]} · ${match[3] ? `第 ${match[3]}${match[4] ? `–${match[4]}` : ''} 名` : '获得全部活动点数奖励'}`;
  match = source.match(/^(Not Alone|想いはETERNITY|Plus 1 Good Day!|Study Equal Magic!) (\d+)位$/);
  if (match) return `${match[1]} · 第 ${match[2]} 名`;
  return null;
}
