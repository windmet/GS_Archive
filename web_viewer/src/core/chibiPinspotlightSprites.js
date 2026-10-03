// Black mask Sprites drawn normally over a white mask texture produce
// product(1 - maskAlpha). The native background shader multiplies by that
// texture's luminance. Apply the equivalent inverse mask per native Sprite;
// Pixi's SpriteMaskFilter supplies transformed, atlas-aware UV coordinates.
export const PINSPOTLIGHT_MASK_FRAGMENT = `
varying vec2 vMaskCoord;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D mask;
uniform float alpha;
uniform vec4 maskClamp;
void main(void) {
  float clip = step(3.5,
    step(maskClamp.x, vMaskCoord.x) + step(maskClamp.y, vMaskCoord.y) +
    step(vMaskCoord.x, maskClamp.z) + step(vMaskCoord.y, maskClamp.w));
  float maskAlpha = texture2D(mask, vMaskCoord).a * alpha * clip;
  gl_FragColor = texture2D(uSampler, vTextureCoord) * (1.0 - maskAlpha);
}`

export function createPinspotlightSprites(PIXI, parent, id, layers, textures) {
  const maskSprite = new PIXI.Sprite(textures[0])
  const sprite = new PIXI.Sprite(textures[1])
  maskSprite.anchor.set(layers[0].anchorX, layers[0].anchorY)
  sprite.anchor.set(layers[1].anchorX, layers[1].anchorY)
  maskSprite.tint = layers[0].initialColor
  sprite.tint = layers[1].initialColor
  sprite.blendMode = PIXI.BLEND_MODES.ADD
  const filter = new PIXI.SpriteMaskFilter(undefined, PINSPOTLIGHT_MASK_FRAGMENT)
  filter.maskSprite = maskSprite // also sets renderable=false: mask never paints the scene
  parent.addChild(maskSprite, sprite)
  return { id, sprite, maskSprite, filter }
}

export function destroyPinspotlightSprites(runtime) {
  runtime.sprite.removeFromParent()
  runtime.maskSprite.removeFromParent()
  runtime.sprite.destroy()
  runtime.maskSprite.destroy()
  runtime.filter.destroy()
}

export function pinspotlightModelForAsset(model, assets, asset) {
  if (!model || !assets?.pinspotlight?.file) return null
  const actual = assets[asset]?.file ? asset : 'pinspotlight'
  return { ...model, layers: model.layers.map(layer => ({ ...layer, asset: actual })) }
}
