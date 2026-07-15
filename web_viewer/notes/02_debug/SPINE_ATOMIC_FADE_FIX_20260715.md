# Spine Atomic Fade Fix

## Report

In `1_4_001_00.json`, step 19 briefly flashed before the dialogue following the
three-character entrance. More generally, character creation and disposal
could expose semi-transparent attachments for a frame.

## Raw And Compiled Evidence

The authored sequence is valid:

- step 17 fades `047shu` out over 0.3 seconds;
- step 18 contains no characters;
- step 19 fades `001tom`, `004ter`, and `047shu` in with delays of 0, 0.1, and
  0.7 seconds;
- step 20 starts the next dialogue.

There is no authored screen flash before the dialogue. The defect was in the
web Spine lifecycle.

## Root Causes

1. `spawnSpine()` finalized and started fading a default skeleton before
   `SpineStage` applied the requested face, body animation, optional parts,
   scale and position.
2. Fade-in changed `Container.alpha`. Child meshes and overlapping attachments
   could therefore participate in semi-transparent blending before the model
   was visually stable.
3. Fade-out used a separate filter path, while other alpha operations still
   targeted the container. Competing paths could run during rapid step changes.
4. Disposal requested `textures: true`, risking destruction of texture data
   shared with cached or newly created instances.

## Fix

Every communication Spine now uses this lifecycle:

1. create an invisible wrapper with one `AlphaFilter(0)`;
2. attach the skeleton while the wrapper is hidden;
3. apply face, animation, parts, pose flush, scale and position;
4. reveal only through the wrapper's whole-model alpha filter;
5. cancel an existing alpha tween before a new fade or disposal;
6. fade the same whole-model filter to zero;
7. remove the wrapper from the display tree;
8. destroy instance children without destroying shared textures/base textures.

Immediate removals also detach the wrapper before destruction, so no disposal
frame can be rendered.

## Filter Quality Follow-up

Keeping `AlphaFilter` enabled after a fade caused the fully visible model to be
rendered through a default-resolution offscreen texture. This softened the
character and introduced subtle edge aliasing.

The whole-model filter now follows the renderer's physical-pixel resolution
and uses 4x MSAA only while alpha is between zero and one. At alpha one it is
disabled, returning the model to native Spine rendering. Camera grayscale and
sepia filters use the same renderer resolution and MSAA policy because they
previously exhibited the same low-resolution edge artifact.

## Verification

```powershell
npm run verify:spine-fade
npm run verify:spine-blink
npm run verify:story-playback-range
npx vite build --configLoader native --emptyOutDir false
```

The contract test covers hidden assembly, deferred reveal, a single
whole-model alpha path, and shared-texture-safe disposal. Visual confirmation
should focus on steps 17-20 and on rapid forward/back transitions involving
new models.
