const EXTRA_STORY_WIKI_URL = 'https://wikiwiki.jp/sidem-gstars/%E3%82%A8%E3%82%AF%E3%82%B9%E3%83%88%E3%83%A9%E3%82%B9%E3%83%88%E3%83%BC%E3%83%AA%E3%83%BC'

const SERIES = Object.freeze({
  '601': {
    title: '謹賀新年2022',
    description: '315プロダクションで交わされる新年の挨拶と、それぞれの抱負。',
    official: true,
  },
  '602': {
    title: '2022年エイプリルフール',
    description: '2022年4月1日に公開された、前後編の特別ストーリー。',
    official: false,
  },
  '603': {
    title: '2022年3月プロミ連動ストーリー',
    description: 'プロデューサーミーティングと連動して公開された特別ストーリー。',
    official: false,
  },
  '604': {
    title: 'GROWING FES -夜陰のルミネセンス-',
    description: '大型ゲームイベントへの出演を控えたC.FIRSTを描くGROWING FES連動ストーリー。',
    official: true,
    gashaCode: '300011',
  },
  '605': {
    title: '1st Anniversary',
    description: '315プロダクションの記念ライブへ向けた、315 ALLSTARSの20日間。',
    official: true,
  },
  '606': {
    title: 'GROWING FES -終夜のアストロロジー-',
    description: '星座占いとのコラボに臨む若里春名、牙崎漣、葛之葉雨彦のGROWING FES連動ストーリー。',
    official: true,
    gashaCode: '300031',
    sourceUrl: 'https://wikiwiki.jp/sidem-gstars/%E3%80%90%E3%82%AC%E3%82%B7%E3%83%A3%E3%80%91%E3%80%8CGROWING%20FES%20-%E7%B5%82%E5%A4%9C%E3%81%AE%E3%82%A2%E3%82%B9%E3%83%88%E3%83%AD%E3%83%AD%E3%82%B8%E3%83%BC-%E3%80%8D',
  },
  '607': {
    title: 'GROWING FES -窮月のグロリアスナイト-',
    description: '年末合同ライブへ向かう伊集院北斗、天道輝、舞田類のGROWING FES連動ストーリー。',
    official: true,
    gashaCode: '300061',
  },
  '608': {
    title: '謹賀新年2023',
    description: '新年を迎えた315プロダクション。16ユニットとスタッフの挨拶を、公開順に収録。',
    official: true,
    sourceUrl: 'https://wikiwiki.jp/sidem-gstars/%E8%AC%B9%E8%B3%80%E6%96%B0%E5%B9%B42023',
  },
  '609': {
    title: 'GROWING FES -光彩のポートレート-',
    description: 'アーティスティックな仕事へ臨むアイドルたちのGROWING FES連動ストーリー。',
    official: true,
    gashaCode: '300091',
    sourceUrl: '',
  },
  '610': {
    title: '2023年エイプリルフール',
    description: '2023年4月1日に再公開された、前後編の特別ストーリー。',
    official: false,
  },
})

export function extraStorySeriesDefinition(seriesId) {
  const definition = SERIES[String(seriesId)] || {}
  return {
    title: definition.title || `Extra Story ${seriesId}`,
    description: definition.description || 'masterdata に収録された特別ストーリー。',
    official: definition.official === true,
    sourceUrl: Object.hasOwn(definition, 'sourceUrl')
      ? definition.sourceUrl
      : EXTRA_STORY_WIKI_URL,
    gashaCode: definition.gashaCode || '',
  }
}

export function resolveExtraStoryGasha(gashaIndex, gashaCode) {
  if (!gashaCode) return null
  return gashaIndex?.by_code?.[gashaCode] || null
}

export const EXTRA_STORY_OFFICIAL_SOURCE_URL = EXTRA_STORY_WIKI_URL
