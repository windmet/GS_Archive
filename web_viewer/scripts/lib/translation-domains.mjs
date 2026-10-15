// The one registry of general translation kinds. A new corpus source adds its rows in
// archive-general-text-corpus.mjs and one line here; shards, batch prompts and audit labels follow.
//   label:  audit group name    model: heading the translator sees    shard: published lazy/root file
//   prompt: 'general' (names and descriptions), 'character' (one speaker's lines), 'chat' (conversations)
export const KINDS = {
  card:                 {label:'卡面标题',            model:'卡面',         shard:'cards',      prompt:'general'},
  costume:              {label:'衣装名称与说明',      model:'衣装',         shard:'costumes',   prompt:'general'},
  item:                 {label:'道具',                model:'道具',         shard:'items',      prompt:'general'},
  currency:             {label:'货币',                model:'货币',         shard:'items',      prompt:'general'},
  honor:                {label:'称号',                model:'称号',         shard:'honors',     prompt:'general'},
  skill:                {label:'技能',                model:'技能',         shard:'skills',     prompt:'general'},
  'skill-category':     {label:'技能分类',            model:'技能类别',     shard:'skills',     prompt:'general'},
  'center-skill':       {label:'中心技能',            model:'中心效果',     shard:'skills',     prompt:'general'},
  background:           {label:'背景',                model:'背景',         shard:'photos',     prompt:'general'},
  'background-variant': {label:'背景差分',            model:'背景时段',     shard:'photos',     prompt:'general'},
  'photo-filters':      {label:'摄影滤镜',            model:'摄影滤镜',     shard:'photos',     prompt:'general'},
  'photo-stickers':     {label:'摄影贴纸',            model:'摄影贴纸',     shard:'photos',     prompt:'general'},
  'photo-spots':        {label:'摄影地点',            model:'摄影场景',     shard:'photos',     prompt:'general'},
  'photo-scenes':       {label:'摄影场景',            model:'摄影背景',     shard:'photos',     prompt:'general'},
  'photo-frames':       {label:'摄影相框',            model:'摄影相框',     shard:'photos',     prompt:'general'},
  'idol-profile':       {label:'偶像资料',            model:'偶像资料',     shard:'profiles',   prompt:'general'},
  'unit-profile':       {label:'组合简介',            model:'组合简介',     shard:'profiles',   prompt:'general'},
  'mobile-status':      {label:'通信签名',            model:'通信签名',     shard:'profiles',   prompt:'general'},
  work:                 {label:'工作剧情名称',        model:'工作剧情',     shard:'profiles',   prompt:'general'},
  'card-line':          {label:'卡面文本·台词',       model:'卡面台词',     shard:'card-lines', prompt:'character'},
  'card-touch':         {label:'卡面文本·触摸语音',   model:'首页触摸语音', shard:'card-lines', prompt:'character'},
  'home-voice':         {label:'首页语音·通用',       model:'首页通用语音', shard:'card-lines', prompt:'character'},
  'office-voice':       {label:'事务所·系统语音',     model:'事务所系统语音', shard:'card-lines', prompt:'character'},
  'call-title':        {label:'卡面文本·电话标题',   model:'电话标题',     shard:'card-lines', prompt:'character'},
  'chat-line':          {label:'通信·聊天对白',       model:'对白',         shard:'chats',      prompt:'chat'},
  'chat-choice':        {label:'通信·制作人回复',     model:'制作人回复',   shard:'chats',      prompt:'chat'},
}
// Lazy shards are fetched by the pages that show them; every other shard is also merged into the bundled root overlay.
export const LAZY_SHARDS = ['card-lines','chats']
export const kindInfo = kind => {
  const info = KINDS[kind]
  if (!info) throw Error(`Unregistered translation kind ${kind}; add it to scripts/lib/translation-domains.mjs`)
  return info
}
export const shardOf = kind => kindInfo(kind).shard
// Batch numbering and export order follow this list.
export const SHARD_NAMES = ['photos','costumes','cards','skills','items','honors','profiles','card-lines','chats']
for (const info of Object.values(KINDS)) if (!SHARD_NAMES.includes(info.shard)) throw Error(`Unknown shard ${info.shard}`)
export const kindsWithPrompt = prompt => Object.keys(KINDS).filter(kind => KINDS[kind].prompt === prompt)
