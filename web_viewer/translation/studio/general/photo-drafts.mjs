export const photoStickerNames = {
  'アイドルマスター SideM':'偶像大师 SideM','315プロダクション':'315 事务所','グローイングスターズ':'GROWING STARS',
  'イーグルマーク':'鹰形标志','フィジカル':'体能','インテリ':'智力','メンタル':'精神','水滴':'水滴','汗':'汗滴',
  'ハート':'爱心','キラキラ':'闪耀','音符':'音符','メモ':'便签','星':'星星','太陽':'太阳','怒り':'生气',
  '眠い':'困倦','車':'汽车','電車':'电车','飛行機':'飞机','ピース！':'胜利手势！','ギター':'吉他','マイク':'麦克风',
  'CD':'CD','スマートフォン':'智能手机','メール':'邮件','ぐるぐる':'转圈圈','食器':'餐具','ショートケーキ':'奶油蛋糕',
  'ドーナッツ':'甜甜圈','ドカン':'轰隆','グー':'握拳','うさぎ':'兔子','ねこ':'猫咪','クラッカー':'拉炮',
  '炎':'火焰','おいしい':'好吃','どや':'得意','感動':'感动','怖い':'害怕','むかむか':'气恼','悲しい':'难过',
  '考える':'思考','にこにこ':'笑眯眯','？':'？','！?':'！？','！！':'！！','！':'！','サンタ帽子':'圣诞帽',
  'チョコレートクラウン':'巧克力皇冠','パッションチョコ':'激情巧克力','パッションチョコDX':'激情巧克力 DX',
  'チョコレートハット':'巧克力礼帽','パッション！':'激情！','マカロンフランボワーズ':'覆盆子马卡龙',
  'マカロンアプリコット':'杏子马卡龙','リトルハピネス':'小小幸福','バンナムフェス2nd':'万代南梦宫音乐节 2nd',
  'フラワークラウン':'花冠','ウェディングフラワー':'婚礼花束','ビーチサングラス':'海滩太阳镜','祝彩！':'祝彩！',
  'ヒトダマ':'鬼火','イナズマロック フェス':'闪电摇滚音乐节','サンタのヒゲ':'圣诞老人胡须','新春梅飾り':'新春梅花装饰',
  'ゴゴ':'轰轰','がぶがぶしゃーく君':'咬咬鲨鱼君','ネオンサングラス':'霓虹太阳镜','うさみみカチューシャ':'兔耳发箍',
  'ファントムマスク':'幻影面具','ハグベア':'拥抱熊','アカデミックキャップ':'学位帽',
};
export const photoUnitNames = new Map(['Jupiter','DRAMATIC STARS','Altessimo','Beit','W','FRAME','彩','High×Joker','神速一魂','Café Parade',
  'S.E.M','THE 虎牙道','F-LAGS','Legenders','C.FIRST'].map(name => [name,name]));
photoUnitNames.set('もふもふえん','毛茸茸园');
export const backgroundVariantNames = {
  '通常':'通常','通常1':'通常 1','通常2':'通常 2','日中':'白天','日中1':'白天 1','日中2':'白天 2',
  '昼':'白天','朝':'早晨','夜':'夜晚','夕方':'傍晚','曇り':'阴天','雨':'雨天','豪雨':'大雨',
  '朝焼け':'朝霞','日の出':'日出','点灯':'亮灯','点灯1':'亮灯 1','点灯2':'亮灯 2','点灯3':'亮灯 3',
  '握手会用':'握手会','装飾前':'装饰前','装飾後':'装饰后','クロマキー':'色键背景',
};
// Song / concert / event names are retained as identifying proper names, not guessed official Chinese titles.
const photoProperNames = new Set(['Not Alone','想いはETERNITY','Plus 1 Good Day!','Study Equal Magic!','Pavé Étoiles',
  'OUR SONG -それは世界でひとつだけ-','Time Before Time','LEADING YOUR DREAM','いとをかし！〜一彩×合彩〜','MOON NIGHTのせいにして',
  'はるかぜバトン','PRODUCER MEETING 2022','ANYWHERE','Infinite Octave!','RED HOT BEAT!!','K.now O.nly','Made in「 ♪ 」',
  'Swing Your Leaves','ROUTE77','String of Fate','Inner Dignity','Multiple Entertainment Show!','はんどめいど・きみはーと！',
  'Change to Chance','Reversed Masquerade','VIVA!!ファミリーリズム','THE IDOLM@STER ORCHESTRA CONCERT','PROOF OF ONESELF',
  'Platinum MASK',"Tone's Destiny",'JOYFUL HEART MAKER','オモイノウタ','FLASH LIGHT','With...STORY','precious love','運命光年',
  'M@STERS OF IDOL WORLD!!!!! 2023','PRS 超常事変～対立スル正義～']);

export function photoStickerDraft(source, idolName) {
  if (photoStickerNames[source]) return photoStickerNames[source];
  if (source === 'ピクチャースタジオで加工に\n使用できるステッカー。') return '可在摄影工作台使用的贴纸。';
  const prefix = source.match(/^(?:ステッカー\s+|ピクチャースタジオ加工用ステッカー\n)(.+)$/);
  if (!prefix) return null;
  const name = prefix[1].trim().replace(/\s+/g,' ');
  if (photoStickerNames[name]) return photoStickerNames[name];
  if (photoUnitNames.has(name)) return photoUnitNames.get(name);
  if (photoProperNames.has(name)) return name;
  let match = name.match(/^SideMini (.+)$/);
  if (match && idolName(match[1])) return `SideMini ${idolName(match[1])}`;
  match = name.match(/^6thツアー(?: (北海道|神戸|東京)公演)?$/);
  if (match) return `6th 巡演${match[1] ? ` · ${{北海道:'北海道',神戸:'神户',東京:'东京'}[match[1]]}公演` : ''}`;
  match = name.match(/^7th STAGE (愛知|神奈川)公演$/);
  if (match) return `7th STAGE · ${{愛知:'爱知',神奈川:'神奈川'}[match[1]]}公演`;
  match = name.match(/^復刻 (Not Alone|Plus 1 Good Day!)$/);
  if (match) return `复刻 ${match[1]}`;
  return null;
}
