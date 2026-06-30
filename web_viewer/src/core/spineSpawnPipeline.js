export async function loadAndCreateSpine({
  modelId,
  atlasUrl,
  skelUrl,
  decodeAtlasText,
  extractTextureFilename,
  resolveTextureUrl,
  loadTextureFromUrl,
  getFallbackTexture,
  decodeSkelBuffer,
  Spine,
  SkeletonBinary,
  AtlasAttachmentLoader,
  TextureAtlas,
}) {
  const [atlasBuf, skelBuffer] = await Promise.all([
    fetch(atlasUrl).then(r => {
      if (!r.ok) throw new Error(`Atlas ${r.status}`)
      return r.arrayBuffer()
    }),
    fetch(skelUrl).then(r => {
      if (!r.ok) throw new Error(`Skel ${r.status}`)
      return r.arrayBuffer()
    }),
  ])

  const atlasText = decodeAtlasText(atlasBuf)
  const textureFile = extractTextureFilename(atlasText)
  const textureUrl = await resolveTextureUrl(modelId, textureFile)
  const texture = await loadTextureFromUrl(textureUrl)

  const textureMap = { [textureFile]: texture }

  const atlas = await new Promise((resolve, reject) => {
    try {
      new TextureAtlas(
        atlasText,
        (path, loaderCb) => {
          const fileName = path.split('/').pop()
          const tex = textureMap[fileName]
          if (tex && tex.baseTexture) loaderCb(tex.baseTexture)
          else loaderCb(getFallbackTexture())
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
    textureFile,
    skeletonData,
    spine,
    animNames,
    hasMeshOrRegion,
  }
}
