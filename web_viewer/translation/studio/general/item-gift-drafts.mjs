import {photoUnitNames} from './photo-drafts.mjs';
const names = Object.fromEntries(`
『Not Alone』練習セット	《Not Alone》练习套装
『7 in LIVE！』ステッカー	《7 in LIVE！》贴纸
ビジューブローチ	宝石胸针
あの冬の思い出	那个冬天的回忆
『結-yui-』セレクションBOX	《結-yui-》精选礼盒
ゆめにむかうバトン	迈向梦想的接力棒
届けたい旋律	想传达的旋律
ゲームコントローラー	游戏手柄
ハピネスボウタイ	幸福领结
イカしたキーホルダー	帅气钥匙扣
『Jupiter』マフラータオル	Jupiter 长条毛巾
未来への招待状	通往未来的邀请函
思い出の一番星バッジ	回忆的启明星徽章
Wとお揃い！サンバイザー	与 W 同款！遮阳帽
グラス&チャームセット	玻璃杯与挂饰套装
『New year 315live』ラバーバンド	New year 315live 橡胶手环
想いを告げるチョコレート	传达心意的巧克力
想いに応えるマカロン	回应心意的马卡龙
パッションシール	热情贴纸
315ステッカー	315 贴纸
パッションチョコ	热情巧克力
パッションチョコDX	热情巧克力 DX
`.trim().split('\n').map(line=>line.split('\t')));
export function itemGiftNameDraft(source,idolName) {
  if(Object.hasOwn(names,source)) return names[source];
  const match=source.match(/^(.+)の(バレンタインのお返し|感謝のきもち)$/);
  if(match) {
    const chinese=idolName(match[1]) || ({'山村 賢':'山村贤','齋藤社長':'斋藤社长'})[match[1]];
    if(chinese) return `${chinese}的${match[2]==='感謝のきもち'?'感谢心意':'情人节回礼'}`;
  }
  const ema=source.match(/^ありがた絵馬 (.+)$/);
  return ema && photoUnitNames.has(ema[1]) ? `感恩绘马 · ${photoUnitNames.get(ema[1])}` : null;
}
