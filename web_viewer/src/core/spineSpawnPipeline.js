import { readSpineAtlasPages } from '../../shared/story/SpineAtlasPages.js'

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
  fetchImpl = (...args) => fetch(...args),
}) {
  const [atlasBuf, skelBuffer] = await Promise.all([
    fetchImpl(atlasUrl).then(r => {
      if (!r.ok) throw new Error(`Atlas ${r.status}`)
      return r.arrayBuffer()
    }),
    fetchImpl(skelUrl).then(r => {
      if (!r.ok) throw new Error(`Skel ${r.status}`)
      return r.arrayBuffer()
    }),
  ])

  const atlasText = decodeAtlasText(atlasBuf)
  const textureFiles = readSpineAtlasPages(atlasText)
  const textureMap = new Map(await Promise.all(textureFiles.map(async file => {
    const url = await resolveTextureUrl(modelId, file, { allowFallback: textureFiles.length === 1 })
    const texture = await loadTextureFromUrl(url)
    if (!texture?.baseTexture) throw new Error(`Spine texture unavailable: ${modelId}/${file}`)
    return [file, texture]
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
