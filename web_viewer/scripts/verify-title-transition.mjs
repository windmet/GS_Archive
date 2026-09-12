import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { readFile } from 'node:fs/promises'
import { isTransitionStep, getAutoAdvanceTiming } from '../src/utils/StoryStepFlow.js'

/**
 * The episode title card is an animated transition the player owns, not a
 * screen the reader dismisses. Its FX fades the whole card to opacity 0 and
 * holds it there, so a title step that does not advance when the animation ends
 * leaves the reader on a blank page with nothing to read and no visible reason
 * to press next. This pins that contract, and the reduced-motion path that
 * deliberately has no animation at all.
 */

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const [viewer, title] = await Promise.all([
  read('src/core/StoryViewer.vue'),
  read('src/components/TitleUI.vue'),
])

// 1. The FX really does end invisible; if that ever changes, the reason this
//    verifier exists has changed with it.
const visibility = title.match(/@keyframes fx-visibility\s*\{([\s\S]*?)\n\}/)
assert.ok(visibility, 'the title FX must declare its visibility keyframes')
assert.match(visibility[1], /100%\s*\{\s*opacity:\s*0;\s*\}/,
  'the title FX fades to nothing, so a stalled step would strand the reader')
assert.match(title, /\.title-fx\.play\s*\{[^}]*forwards/,
  'the faded-out end state must persist rather than snapping back')

// 2. Completion advances the step. Every other transition step in the player
//    advances on its own timing without consulting auto-play, and the title is
//    the same kind of step, so the FX ending is the advance.
const settle = viewer.match(/function onTitleAnimationSettled\([\s\S]*?\n\}/)
assert.ok(settle, 'the viewer must settle the title FX in one place')
assert.match(settle[0], /goNext\(['"]title-animation['"]\)/,
  'the finished FX must advance the step')
assert.doesNotMatch(settle[0], /autoEnabled/,
  'advancing must not depend on auto-play: manual mode fades the card too')
// A cancelled FX means the reader left mid-animation, so it must not advance on
// top of the navigation that cancelled it.
assert.match(settle[0], /if\s*\(event\s*===\s*['"]cancel['"]\)\s*return/,
  'a cancelled animation must release the hold without advancing')

// 3. Both endings reach that one handler.
const titleTag = viewer.match(/<TitleUI[\s\S]*?\/>/)
assert.ok(titleTag, 'the viewer must mount TitleUI')
assert.match(titleTag[0], /@complete="onTitleAnimationSettled\('complete'\)"/)
assert.match(titleTag[0], /@cancel="onTitleAnimationSettled\('cancel'\)"/)
assert.match(titleTag[0], /@start="setTitleAnimationPending\(true\)"/)

// 4. The hold is released before the advance, so auto cannot be left blocked on
//    a step that has already moved on, and auto waits for the FX rather than
//    stacking its own delay on top of a card that is still animating.
const body = settle[0]
assert.ok(body.indexOf('setTitleAnimationPending(false)') < body.indexOf('goNext('),
  'the hold must be released before advancing')
assert.match(viewer, /hasBlockingAuto:\s*\(\)\s*=>[^\n]*titleAnimationPending\.value/,
  'auto must treat a running title animation as a reason to wait')

// 5. The card is invisible by the time the FX ends, so an advance refused by an
//    open overlay has to be replayed once that overlay closes. Without the
//    retry the reader is stranded on the faded-out card, which is the same dead
//    end as never advancing at all.
const retry = viewer.match(/function retryTitleAdvance\(\)\s*\{[\s\S]*?\n\}/)
assert.ok(retry, 'a refused title advance must be remembered and retried')
assert.match(retry[0], /goNext\(['"]title-animation['"]\)/, 'the retry must resume the same advance')
// The guard clause alone also assigns false, so match the assignment that runs
// on the retry path: without it a refused advance fires again on every overlay
// change for as long as the player stays on the title step.
assert.match(retry[0], /\}\s*titleAdvancePending\s*=\s*false[\s\S]*?goNext\(/,
  'the retry must clear the flag before advancing, so a second refusal cannot loop')
assert.match(retry[0], /type\s*!==\s*['"]title['"]/,
  'the retry must not fire once the player has left the title step')
assert.match(settle[0], /titleAdvancePending\s*=\s*goNext\([^)]*\)\s*===\s*['"]blocked['"]/,
  'the settle handler must record a refused advance rather than dropping it')
const overlayWatch = viewer.match(/watch\(\[menuOpen, backlogOpen, episodeFinished\][\s\S]*?\n\}, \{ immediate: true \}\)/)
assert.ok(overlayWatch, 'the overlay watch must exist')
assert.match(overlayWatch[0], /if\s*\(!menu\s*&&\s*!backlog\s*&&\s*!finished\)\s*retryTitleAdvance\(\)/,
  'closing every overlay must replay a title advance that was refused')

// 6. Reduced motion renders the card as a static screen: the FX never starts, so
//    no completion arrives and the reader dismisses the step through the normal
//    playback flow. That is the pre-FX behaviour and it must stay reachable.
assert.match(title, /prefers-reduced-motion:\s*reduce/,
  'the FX must still honour reduced motion')
const mounted = title.match(/onMounted\(\(\)\s*=>\s*\{[\s\S]*?\n\}\)/)
assert.ok(mounted, 'TitleUI must decide on mount whether to animate')
assert.match(mounted[0], /prefers-reduced-motion[\s\S]*?return/,
  'reduced motion must return before emitting start')
assert.ok(mounted[0].indexOf('prefers-reduced-motion') < mounted[0].indexOf("emit('start')"),
  'the reduced-motion guard must precede the start signal')
assert.match(title, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.title-fx\s*\{\s*opacity:\s*1/,
  'the reduced-motion card must be visible rather than transparent')

// 7. If the title ever becomes a transition step in the shared flow table, two
//    mechanisms would advance it at once. It is not one today, and the FX is the
//    only thing that moves it.
const titleStep = { type: 'title' }
assert.equal(isTransitionStep(titleStep), false,
  'title steps are advanced by their own FX, not by the shared transition timing')
assert.equal(getAutoAdvanceTiming(titleStep), null, 'a title step has no timing-table entry')

// Execute the production navigation callback: a refused advance belongs to the
// outgoing title, including when navigation reaches another title.
const navigation = viewer.match(/watch\(currentStep, \(newStep, oldStep\) => \{([\s\S]*?)\n\}\)/)
assert.ok(navigation, 'the navigation callback must exist')
const context = {
  titleAdvancePending: true,
  newStep: { type: 'title' }, oldStep: { type: 'title' },
  restoredSceneState: { value: null },
  setTitleAnimationPending() {}, handleStepChange() {},
  playbackController: { notifyStateChanged() {} },
}
runInNewContext(navigation[1], context)
assert.equal(context.titleAdvancePending, false, 'navigation must discard the outgoing title retry')

console.log('Title source contract and navigation retry reset verified; browser timing and pause lifecycle remain separate acceptance work')
