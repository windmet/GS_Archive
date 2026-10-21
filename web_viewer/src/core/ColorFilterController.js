import * as PIXI from 'pixi.js'
import { runRafTween } from './rafTween.js'
import {
  IDENTITY_COLOR_FILTER,
  colorFilterPixiMatrix,
  isIdentityColorFilter,
  lerpColorFilter,
} from '../../shared/story/ColorFilter.js'

const sameFilter = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** One Growing.ColorFilter target: a ColorMatrixFilter on a display object, tweened by preset components. */
export class ColorFilterController {
  constructor({ app, getTarget }) {
    this.app = app
    this.getTarget = getTarget
    this.current = IDENTITY_COLOR_FILTER
    this.target = IDENTITY_COLOR_FILTER
    this._filter = null
    this._tween = null
  }

  /** Lerp from the current preset to `preset` after `delay` seconds over `duration` seconds. */
  set(preset, { delay = 0, duration = 0, nowMilliseconds } = {}) {
    const target = preset || IDENTITY_COLOR_FILTER
    const delayMs = Math.max(0, Number(delay) || 0) * 1000
    const durationMs = Math.max(0, Number(duration) || 0) * 1000
    // A later cumulative snapshot repeats the settled preset without its one-shot timing; keep a running lerp.
    if (sameFilter(target, this.target) && delayMs === 0 && durationMs === 0) {
      if (!this._tween) this._apply(target)
      return
    }
    this.cancel()
    this.target = target
    if (delayMs === 0 && durationMs === 0) {
      this._apply(target)
      return
    }
    const from = this.current
    this._tween = runRafTween({
      durationMs,
      delayMs,
      nowMilliseconds,
      ease: t => t,
      onUpdate: t => this._apply(lerpColorFilter(from, target, t)),
      onComplete: () => { this._tween = null },
    })
  }

  cancel() {
    this._tween?.cancel?.()
    this._tween = null
  }

  reset() {
    this.cancel()
    this.target = IDENTITY_COLOR_FILTER
    this._apply(IDENTITY_COLOR_FILTER)
  }

  _apply(filter) {
    this.current = filter
    const target = this.getTarget()
    if (!target || target.destroyed) return
    const others = (target.filters || []).filter(item => item !== this._filter)
    if (isIdentityColorFilter(filter)) {
      target.filters = others.length ? others : null
      return
    }
    if (!this._filter) {
      this._filter = new PIXI.ColorMatrixFilter()
      this._filter.padding = 0
    }
    this._filter.resolution = this.app.renderer.resolution
    this._filter.multisample = PIXI.MSAA_QUALITY.MEDIUM
    this._filter.matrix = colorFilterPixiMatrix(filter)
    target.filters = [...others, this._filter]
  }

  destroy() {
    this.cancel()
    this._filter?.destroy?.()
    this._filter = null
  }
}
