// Only the explicit source ticket grammar is accepted; this never runs against dialogue.
const labels = Object.fromEntries(`
Welcome Sunlight Liveガシャ	Welcome Sunlight Live 招募
Growing Twilight Liveガシャ	Growing Twilight Live 招募
夜空きらめく花火Liveガシャ	夜空闪耀的烟花 Live 招募
幻影のMasqueradeガシャ	幻影的 Masquerade 招募
錦秋のアートフェスティバルガシャ	锦秋艺术节招募
雪積もる 夕暮れの銀世界ガシャ	积雪纷纷·暮色银白世界招募
聖なる夜にギフト・フォー・ユー！ガシャ	圣夜献给你的礼物！招募
年末スペシャルBest MusicTVガシャ	年末特别 Best MusicTV 招募
10連ガシャ	十连招募
迎春のニューイヤーライブガシャ	迎春新年演出招募
新春！初夢ガシャ	新春！初梦招募
6thLIVE TOUR ～NEXT DESTIN@TION!～ガシャ	6thLIVE TOUR ～NEXT DESTIN@TION!～招募
不撓不屈のスチーム・バトラーズ！ガシャ	不屈不挠的蒸汽管家们！招募
弾けろ！スナック山盛りLIVEガシャ	欢腾吧！零食满满 LIVE 招募
鬼の住処へおいでませ！ 節分祭ガシャ	欢迎来到鬼的住处！节分祭招募
Chocolate Night～チョコ怪盗にご用心！～ガシャ	Chocolate Night～小心巧克力怪盗！～招募
漆黒のWonderlandガシャ	漆黑的 Wonderland 招募
焼きたてを召し上がれ！アップルパイフェアガシャ	请享用刚出炉的美味！苹果派展销会招募
感謝を込めて…笑顔のMessageガシャ	满怀感谢……微笑的 Message 招募
寒さ吹き飛ばすウィンタースポーツガシャ	驱散寒冷的冬季运动招募
朱く染まる湯の街 温泉旅館物語ガシャ	染上朱红的温泉街·温泉旅馆物语招募
星が降り注ぐミュージアムガシャ	星光洒落的博物馆招募
熱狂！アイドル大運動会ライブガシャ	狂热！偶像大运动会演出招募
ホイップたっぷり！スイーツパーティガシャ	满满奶油！甜点派对招募
みんなにエールを！晴天のマーチングガシャ	为大家声援！晴天行进乐招募
流麗のファッションショーガシャ	流丽时装秀招募
プラチナガシャ	白金招募
315 BE@T OF PASSION FESTIVAL!!!ガシャ	315 BE@T OF PASSION FESTIVAL!!! 招募
心躍る雨音♪梅雨を楽しむキャンペーンガシャ	令人心动的雨声♪享受梅雨企划招募
祝福の花が舞う Blue Sky Weddingガシャ	祝福之花飞舞·Blue Sky Wedding 招募
夏の夜を彩るキャンドルナイトガシャ	点缀夏夜的烛光之夜招募
願いを乗せて出発進行！天の川トレインガシャ	载上心愿出发！银河列车招募
ひんやり爽やかColorful Ice Decorationガシャ	冰凉清爽 Colorful Ice Decoration 招募
自然を満喫！サマーキャンプガシャ	尽享自然！夏日露营招募
夏の一瞬を切り取るリゾートショットガシャ	定格夏日瞬间的度假摄影招募
青嵐に舞うBlue Balloonガシャ	青岚中飞舞的 Blue Balloon 招募
戦慄する恐怖の館 お化け屋敷PRガシャ	令人战栗的恐怖馆·鬼屋宣传招募
セレクション	自选
プラチナSRセレクション	白金 SR 自选
7th STAGE セレクション	7th STAGE 自选
スタンプガシャセレクション	集章招募自选
街角探偵の事件簿～闇に潜む怪人～ガシャ	街角侦探事件簿～潜伏暗处的怪人～招募
魅惑のファッショナブルランウェイガシャ	魅惑的时尚伸展台招募
激闘！オーバーライン-未来を切り拓く光炎-ガシャ	激战！Over Line－开拓未来的光焰－招募
みんなでわいわい！315パジャマパーティーガシャ	大家一起热闹玩！315 睡衣派对招募
共に歌おう！夜を彩るハロウィンパレードガシャ	一起歌唱！点缀夜色的万圣节巡游招募
未知なる世界へ… 神秘のAquariumガシャ	迈向未知世界……神秘的 Aquarium 招募
最高の執事を目指して 執事アカデミーガシャ	以最优秀管家为目标·管家学院招募
闘魂燃える挑戦者 熱血バラエティガシャ	斗志燃烧的挑战者·热血综艺招募
TALK＆LIVE 一夜限りのダイナーSHOWガシャ	TALK＆LIVE·仅此一夜的餐馆 SHOW 招募
流星のように参上！プラネットシューターガシャ	如流星般登场！行星射手招募
静かな聖夜に輝くクリスマスライブガシャ	静谧圣夜闪耀的圣诞演出招募
楽しい締めくくりを一緒に カウントダウンLIVEガシャ	一起快乐收尾·倒数 LIVE 招募
GROWING FES -夜陰のルミネセンス-	GROWING FES－夜阴之光－
春爛漫！10回プラチナガシャ	春意烂漫！十次白金招募
限定復刻プラチナガシャ	限定复刻白金招募
バンナムフェス2nd開催記念！10回プラチナガシャ	Bandai Namco Festival 2nd 举办纪念！十次白金招募
ドラマチックライブステージ『アイドルマスター SideM』記念ガシャ	Dramatic Live Stage《偶像大师 SideM》纪念招募
アイドルマスター SideM 8周年記念！フィジカルガシャ	偶像大师 SideM 八周年纪念！体能招募
アイドルマスター SideM 8周年記念！インテリガシャ	偶像大师 SideM 八周年纪念！智力招募
アイドルマスター SideM 8周年記念！メンタルガシャ	偶像大师 SideM 八周年纪念！精神招募
今年も良い1年に！心を込めた年賀状ガシャ	今年也要美好！用心的新年贺卡招募
冬の食卓にオススメ！ぽかぽかHappy Milkガシャ	冬日餐桌推荐！暖暖 Happy Milk 招募
みんなで楽しく学ぼう！キッズバラエティガシャ	大家快乐学习！儿童综艺招募
イナズマロック フェス出演記念 打ち上げガシャ	INAZUMA ROCK FES 出演纪念·庆功招募
SSR出現率UP!! スペシャルプラチナガシャ	SSR 出现率提升！！特别白金招募
GROWING FES -終夜のアストロロジー-	GROWING FES－长夜占星－
THE IDOLM@STER SideM 7thSTAGEステップアップガシャ	THE IDOLM@STER SideM 7thSTAGE 阶梯招募
1st Anniversaryプラチナガシャ 第1弾	一周年白金招募·第一弹
1st Anniversaryプラチナガシャ 第2弾	一周年白金招募·第二弹
315!!!SHOPコラボ記念ガシャ	315!!!SHOP 联动纪念招募
GROWING FES -窮月のグロリアスナイト-	GROWING FES－岁末荣光之夜－
甘酸っぱい想いを包んで Chocolate×Fruitsガシャ	包裹酸甜心意·Chocolate×Fruits 招募
Chocolate Night ～魅惑のバレンタインナイト～ガシャ	Chocolate Night～魅惑的情人节之夜～招募
トリックを決めろ！Street Skateboardガシャ	秀出技巧！Street Skateboard 招募
トリックを決めろ！Street Skateboardスタンプガシャ	秀出技巧！Street Skateboard 集章招募
伝えたい想いを運んで Teddy bear&Letterガシャ	送去想传达的心意·Teddy bear&Letter 招募
お腹もココロもまんぷくフェスティバルガシャ	身心满满的饱腹庆典招募
新生活を彩る一品 文房具コラボガシャ	点缀新生活的一品·文具联动招募
新生活を彩る一品 文房具コラボスタンプガシャ	点缀新生活的一品·文具联动集章招募
グローリーモノクロームガシャ	荣光单色招募
PRS 超常事変～対立スル正義～ガシャ	PRS 超常事变～相互对立的正义～招募
GROWING FES -光彩のポートレート-	GROWING FES－光彩肖像－
プラチナガシャ10回無料キャンペーン	白金招募十次免费企划
`.trim().split('\n').map(line=>line.split('\t')));
const normalized = value => value.replace(/[\r\n\u00a0]/g,' ').replace(/\s+/g,' ').trim();
const byCompact = new Map(Object.entries(labels).map(([source,target])=>[source.replace(/\s/g,''),target]));
const prefixes = [
  ['SR以上確定','保证 SR 或以上'],['SSR確定','保证 SSR'],['アンコールスターV付き！','附赠安可之星 V！'],
  ['おまけ付き！','附赠赠品！'],['彩光の欠片 SSR付き！','附赠彩光碎片 SSR！'],
  ['ゴーゴーゼリーDX付き！','附赠 Go Go 果冻 DX！'],['育成アイテム付き！','附赠培养道具！'],
];
function ticketLabel(source) {
  let base = normalized(source), prefix = '', suffix = '';
  for (const [key,target] of prefixes) if (base.startsWith(key)) {
    prefix = `${target} `; base = base.slice(key.length).replace(/^[！! ]+/, ''); break;
  }
  if (base.endsWith('(SSR確定)')) {base=base.slice(0,-7);suffix='（保证 SSR）';}
  const label=byCompact.get(base.replace(/\s/g,''));
  return label ? prefix+label+suffix : null;
}
export function itemTicketDraft(source,field) {
  const value=normalized(source);
  if (field==='name') {
    const match=value.match(/^(.*?)(\d+回)?チケット$/);
    if (!match) return null;
    const label=ticketLabel(match[1]);
    return label ? `${label}${match[2] ? ` · ${match[2].replace('回','次')}` : ''}票券` : null;
  }
  const match=value.match(/^(.*?)を ?(\d+)回引けるチケット。$/);
  if (!match) return null;
  const label=ticketLabel(match[1]);
  return label ? `可进行 ${match[2]} 次「${label}」的票券。` : null;
}
