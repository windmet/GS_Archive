import * as PIXI from 'pixi.js'
import { sampleChibiParticle } from '../core/chibiParticleTimeline.js'

export async function loadChibiParticleLayer(animation, loadTexture) {
  const used = [...new Set(animation.systems.map(system => system.texture))]
  const loaded = await Promise.allSettled(used.map(id => loadTexture(animation.textures[id].file)))
  if (loaded.some(item => item.status === 'rejected')) {
    for (const item of loaded) if (item.status === 'fulfilled') item.value.destroy(true)
    throw loaded.find(item => item.status === 'rejected').reason
  }
  const textures = loaded.map(item => item.value)
  const container = new PIXI.Container()
  container.sortableChildren = true
  const frameTextures = []
  try {
    const sheets = new Map(used.map((id, index) => {
      const frames = Array.from({ length: 16 }, (_, frame) => new PIXI.Texture(textures[index].baseTexture,
        new PIXI.Rectangle((frame % 4) * 256, Math.floor(frame / 4) * 256, 256, 256)))
      frameTextures.push(...frames)
      return [id, frames]
    }))
    const particles = animation.systems.map(system => {
      const frames = sheets.get(system.texture)
      const sprite = new PIXI.Sprite(frames[0])
      sprite.anchor.set(0.5)
      sprite.position.set(system.position.x * 100, -system.position.y * 100)
      sprite.width = sprite.height = system.size * 100
      sprite.tint = (Math.round(system.color.r * 255) << 16)
        | (Math.round(system.color.g * 255) << 8) | Math.round(system.color.b * 255)
      sprite.alpha = system.color.a
      sprite.blendMode = PIXI.BLEND_MODES.ADD
      sprite.zIndex = system.sortingOrder
      sprite.name = system.source.pathId
      container.addChild(sprite)
      return { system, sprite, frames }
    })
    return { container, textures, frameTextures, particles, particleFrames: [], destroyed: false }
  } catch (error) {
    container.destroy({ children: true })
    for (const texture of frameTextures) texture.destroy(false)
    for (const texture of textures) texture.destroy(true)
    throw error
  }
}

export function updateChibiParticleLayer(runtime, milliseconds, activatedAt) {
  runtime.particleFrames = runtime.particles.map(({ system, sprite, frames }) => {
    const state = sampleChibiParticle(system, milliseconds, activatedAt)
    sprite.visible = state.visible
    sprite.texture = frames[state.frame]
    return state.visible ? state.frame : '-'
  })
}
