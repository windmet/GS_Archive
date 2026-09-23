import assert from 'node:assert/strict'
import { stageRenderResolution } from '../src/core/StageRenderBudget.js'
import { storyStageFrame } from '../src/core/StoryStageFraming.js'
for (const [width, height, dpr] of [[319,492,2.175],[390,844,3],[844,390,2],[1280,720,1],[1920,1080,2],[3840,2160,3]]) {
  const frame=storyStageFrame(width,height)
  const resolution=stageRenderResolution(frame.width,frame.height,frame.scale,dpr)
  const pixels=frame.width*frame.height*resolution**2
  assert.ok(pixels <= 4*1024*1024+1e-6)
  assert.ok(resolution/frame.scale <= Math.min(2,dpr)+1e-6)
  assert.ok(resolution > 0)
}
const compact=storyStageFrame(319,492)
const after=stageRenderResolution(compact.width,compact.height,compact.scale,2.175)
assert.ok(after**2/2.175**2 < .4, 'compact framebuffer uses under 40% of prior pixels')
console.log('Stage rendering budget: displayed-pixel scaling, DPR cap, 4MP cap and compact reduction passed')
