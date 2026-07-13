const KNOWN_MODELS = [
  '001tom_002_00', '001tom_003_00', '001tom_004_00', '001tom_004_01', '001tom_005_00',
  '001tom_101_00', '001tom_101_01', '001tom_102_00', '001tom_103_00', '001tom_103_01',
  '002dra_002_00', '002dra_003_00', '003min_002_00', '003min_003_00',
  '004ren_002_00', '004ren_003_00', '005sho_002_00', '005sho_003_00',
  '006aio_002_00', '006aio_003_00', '007you_002_00', '007you_003_00',
  '008ter_002_00', '008ter_003_00', '009ryu_002_00', '009ryu_003_00',
  '010kai_002_00', '010kai_003_00', '024kir_002_00', '024kir_003_00',
  '025suz_002_00', '025suz_003_00', '031sak_002_00', '031sak_003_00',
  '032nco_002_00', '032nco_003_00',
]

function decodeAtlasText(buffer) {
  const fullText = new TextDecoder('utf-8').decode(buffer)
  const sizeIndex = fullText.indexOf('\nsize:')
  if (sizeIndex < 0) return fullText
  const lineStart = fullText.lastIndexOf('\n', sizeIndex - 1)
  if (lineStart < 0) return fullText
  const candidate = fullText.substring(lineStart + 1)
  return candidate.split('\n')[0].trim() && !candidate.includes(':') ? candidate : fullText
}

function textureFilename(atlasText) {
  for (const line of atlasText.split('\n')) {
    const value = line.trim()
    if (value && !value.includes(':') && !value.startsWith('//')) return value.split('/').pop()
  }
  return 'comu.png'
}

async function loadTexture(PIXI, url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const baseTexture = PIXI.BaseTexture.from(image)
      baseTexture.alphaMode = PIXI.ALPHA_MODES.PMA
      const done = () => resolve(PIXI.Texture.from(baseTexture))
      if (baseTexture.valid) done()
      else {
        baseTexture.once('update', done)
        setTimeout(done, 5000)
      }
    }
    image.onerror = () => reject(new Error('texture load failed'))
    image.src = url
  })
}

export function installSpineAnimationDebug() {
  const showAnims = async (charaId, modelIdx) => {
    const models = KNOWN_MODELS.filter(model => model.startsWith(charaId))
    if (!models.length) {
      const ids = [...new Set(KNOWN_MODELS.map(model => model.split('_')[0]))].sort()
      console.warn(`Unknown charaId "${charaId}". Try: ${ids.join(', ')}`)
      return
    }

    const targets = modelIdx !== undefined ? [models[modelIdx]] : models
    for (const modelId of targets) {
      if (!modelId) continue
      try {
        const baseUrl = `/assets/spines/${modelId}`
        const [atlasResponse, skeletonResponse] = await Promise.all([
          fetch(`${baseUrl}/comu.atlas`),
          fetch(`${baseUrl}/comu.skel`),
        ])
        if (!atlasResponse.ok || !skeletonResponse.ok) {
          console.warn(`[${modelId}] files not found`)
          continue
        }

        const [atlasBuffer, skeletonBuffer] = await Promise.all([
          atlasResponse.arrayBuffer(),
          skeletonResponse.arrayBuffer(),
        ])
        const atlasText = decodeAtlasText(atlasBuffer)
        const filename = textureFilename(atlasText)
        const [PIXI, spineRuntime, spineBase] = await Promise.all([
          import('pixi.js'),
          import('@pixi-spine/runtime-3.8'),
          import('@pixi-spine/base'),
        ])
        const texture = await loadTexture(PIXI, `${baseUrl}/${filename}`)
        texture.baseTexture.alphaMode = PIXI.ALPHA_MODES.PMA

        const fallbackCanvas = document.createElement('canvas')
        fallbackCanvas.width = 64
        fallbackCanvas.height = 64
        const fallbackContext = fallbackCanvas.getContext('2d')
        fallbackContext.fillStyle = '#ff00ff'
        fallbackContext.fillRect(0, 0, 64, 64)
        const fallbackTexture = PIXI.BaseTexture.from(fallbackCanvas)
        fallbackTexture.alphaMode = PIXI.ALPHA_MODES.PMA

        const atlas = await new Promise((resolve, reject) => {
          new spineBase.TextureAtlas(atlasText, (page, callback) => {
            callback(page.split('/').pop() === filename ? texture.baseTexture : fallbackTexture)
          }, result => result ? resolve(result) : reject(new Error('atlas load failed')))
        })
        atlas.pages.forEach(page => { page.pma = true })
        const attachmentLoader = new spineRuntime.AtlasAttachmentLoader(atlas)
        const skeletonData = new spineRuntime.SkeletonBinary(attachmentLoader)
          .readSkeletonData(new Uint8Array(skeletonBuffer))
        const animations = skeletonData.animations.map(animation => animation.name)
        console.log(
          `%c■ ${modelId} - ${animations.length} animations - ${skeletonData.bones.length} bones`,
          'font-weight:bold;color:#88ddff;font-size:14px',
        )
        console.log(animations.map((animation, index) =>
          `  ${String(index + 1).padStart(2, '0')}. ${animation}`).join('\n'))
      } catch (error) {
        console.warn(`[${modelId}] load failed:`, error?.message || error)
      }
    }
  }

  window.showAnims = showAnims
  console.log('%cConsole: showAnims("001tom") - list all animations', 'color:#88ddff;font-size:12px')
  return () => {
    if (window.showAnims === showAnims) delete window.showAnims
  }
}
