// Published JSON products that archiveDataContracts.js validates, keyed by contract name.
// Only verify-archive-data-contracts.mjs reads this: the app loads products on demand through read-models.
export const ARCHIVE_PRODUCT_FIXTURES = {
  compiledIndex: '/data/compiled/index.json',
  cardIndex: '/data/masterdata/card_index.json',
  gashaIndex: '/data/masterdata/gasha_index.json',
  eventIndex: '/data/masterdata/event_index.json',
  storyCatalog: '/data/masterdata/story_catalog.json',
  birthdayStorySemantic: '/data/masterdata/birthday_story_semantic_index.json',
  extraStoryVisualIndex: '/data/masterdata/extra_story_visual_index.json',
  storyPresentation: '/data/masterdata/story_presentation_index.json',
  seasonalCampaign: '/data/masterdata/seasonal_campaign_index.json',
  workStory: '/data/masterdata/work_story_index.json',
  idolUnit: '/data/masterdata/idol_unit_dictionary.json',
  speakerDictionary: '/data/masterdata/speaker_dictionary.json',
  costumeDictionary: '/data/masterdata/costume_dictionary.json',
  archiveManifest: '/data/archive_manifest.json',
  archiveVerification: '/data/archive_verification.json',
  uiAssetCatalog: '/data/assets/ui_asset_catalog.json',
  rawCharacterImagePromotions: '/data/assets/raw_character_image_promotions.json',
  externalStoryResources: '/data/external_story_resources.json',
  songCatalog: '/data/song_catalog.json',
  songPlaybackAudio: '/data/song_playback_audio.json',
  songExperimentalAudio: '/data/song_experimental_audio.json',
  songJacketIndex: '/data/song_jacket_index.json',
}

export const CARD_DETAIL_FIXTURE = '/data/masterdata/card_detail_index.json'
export const IDOL_COMMUNICATION_FIXTURES = {
  idolEpisode: '/data/masterdata/idol_episode_index.json',
  mobileArchive: '/data/masterdata/mobile_archive_index.json',
  randomTalkPresentation: '/data/masterdata/random_talk_presentation_index.json',
}
