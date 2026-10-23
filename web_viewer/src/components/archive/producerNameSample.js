import { PRODUCER_NAME_WITH_P_TOKEN } from '../../localization/story/ProducerAddressing.js'

// The P-name preview line: a real home touch voice (天ヶ瀬冬馬), shown the way the home page shows it.
// App requests its card-line shard as soon as it decides to show the onboarding sheet, ahead of the
// sheet's chunk and the Portal's images, so the sheet's main line is not queued behind them.
export const PRODUCER_NAME_SAMPLE = `${PRODUCER_NAME_WITH_P_TOKEN}、\nいつもありがとな！　この調子で\nトップアイドルを目指すぜ！`
