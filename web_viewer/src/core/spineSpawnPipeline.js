import { createStoryAssetTransport, storyAssetTransport } from './StoryAssetTransport.js'
import { readSpineAtlasPages, readSpineAtlasPageSizes } from '../../shared/story/SpineAtlasPages.js'

// Some game atlases declare a larger page than the shipped texture (003hok_103_*: 2412 vs 2048).
// Unity samples with normalized UVs so it renders; Pixi uses pixel frames and rejects the
// overflowing regions, so stretch the texture to the declared page size to match.
function fitTextureToAtlasPage(texture, declared) {
  const base = texture.baseTexture
  const width = base.realWidth || base.width
  const height = base.realHeight || base.height
  if (!declared || (declared.width <= width && declared.height <= height)) return texture
  const source = base.resource?.source
  if (!source || typeof document === 'undefined') return texture
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(width, declared.width)
  canvas.height = Math.max(height, declared.height)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  const fitted = texture.constructor.from(canvas)
  if (base.alphaMode !== undefined) fitted.baseTexture.alphaMode = base.alphaMode
  fitted.baseTexture.scaleMode = base.scaleMode
  return fitted
}

export async function loadAndCreateSpine({
  modelId,
  atlasUrl,
  skelUrl,
  decodeAtlasText,
  resolveTextureUrl,
  loadTextureFromUrl,
  decodeSkelBuffer,
  Spine,
  SkeletonBinary,
  AtlasAttachmentLoader,
  TextureAtlas,
  fetchImpl,
  transport = fetchImpl ? createStoryAssetTransport({ fetchImpl }) : storyAssetTransport,
  signal,
}) {
  const [atlasBuf, skelBuffer] = await Promise.all([
    transport.getArrayBuffer(atlasUrl, { signal }),
    transport.getArrayBuffer(skelUrl, { signal }),
  ])

  const atlasText = decodeAtlasText(atlasBuf)
  const textureFiles = readSpineAtlasPages(atlasText)
  const pageSizes = readSpineAtlasPageSizes(atlasText)
  const textureMap = new Map(await Promise.all(textureFiles.map(async file => {
    const url = await resolveTextureUrl(modelId, file, { allowFallback: textureFiles.length === 1, signal })
    signal?.throwIfAborted()
    const texture = await loadTextureFromUrl(url, { signal })
    signal?.throwIfAborted()
    if (!texture?.baseTexture) throw new Error(`Spine texture unavailable: ${modelId}/${file}`)
    return [file, fitTextureToAtlasPage(texture, pageSizes.get(file))]
  })))

  const atlas = await new Promise((resolve, reject) => {
    try {
      new TextureAtlas(
        atlasText,
        (path, loaderCb) => {
          const tex = textureMap.get(path)
          if (tex && tex.baseTexture) loaderCb(tex.baseTexture)
          else loaderCb(null)
        },
        (result) => {
          if (result) resolve(result)
          else reject(new Error('TextureAtlas loading failed'))
        },
      )
    } catch (err) {
      reject(err)
    }
  })

  for (const page of atlas.pages) {
    page.pma = true
  }

  const attachmentLoader = new AtlasAttachmentLoader(atlas)
  const skeletonBinary = new SkeletonBinary(attachmentLoader)
  const cleanSkel = decodeSkelBuffer(skelBuffer)
  const skeletonData = skeletonBinary.readSkeletonData(new Uint8Array(cleanSkel))
  const spine = new Spine(skeletonData)
  const animNames = skeletonData.animations.map(a => a.name)

  let hasMeshOrRegion = false
  if (skeletonData.skins) {
    for (const skin of skeletonData.skins) {
      if (!skin || !skin.attachments) continue
      for (const attachmentMap of Object.values(skin.attachments)) {
        if (Object.keys(attachmentMap).length > 0) {
          hasMeshOrRegion = true
          break
        }
      }
      if (hasMeshOrRegion) break
    }
  }

  return {
    atlasText,
    textureFile: textureFiles[0],
    textureFiles,
    skeletonData,
    spine,
    animNames,
    hasMeshOrRegion,
  }
}
