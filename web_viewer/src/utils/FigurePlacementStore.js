import { getFigurePlacementUrl } from './AssetResolver.js'
import { createStoryConfigStore } from './StoryConfigStore.js'

// idol_figure_placement.json: { skeletons: { model: prefab root y }, textures: { model: rect } }.
const store = createStoryConfigStore({ kind: 'costume-figure-placement', url: getFigurePlacementUrl })
export const loadFigurePlacement = options => store.load(options)
