export function getRuntimeCueFeatureFlags(search = globalThis.location?.search || '') {
  const params = new URLSearchParams(search)
  const all = params.get('runtimeCues') === '1'
  const cameraOverride = params.get('runtimeCamera')
  const screenOverride = params.get('runtimeScreen')
  const backgroundOverride = params.get('runtimeBackground')
  const spineOverride = params.get('runtimeSpine')
  return Object.freeze({
    // Camera has completed channel acceptance. Keep runtimeCamera=0 as the
    // complete legacy rollback path while the remaining channels migrate.
    camera: cameraOverride !== '0',
    se: all || params.get('runtimeSE') === '1',
    // Screen/fade has completed channel acceptance. Keep an explicit
    // runtimeScreen=0 escape hatch while the remaining runtime channels migrate.
    screen: screenOverride !== '0',
    // Background transition has completed channel acceptance. Keep
    // runtimeBackground=0 as the complete legacy rollback path.
    background: backgroundOverride !== '0',
    snapshot: all || params.get('runtimeSnapshots') === '1',
    // Spine timeline has completed channel acceptance. Keep an explicit
    // runtimeSpine=0 escape hatch while the remaining runtime channels migrate.
    spine: all || spineOverride !== '0',
  })
}

export function isRuntimeCueChannelEnabled(channel, search) {
  return getRuntimeCueFeatureFlags(search)[channel] === true
}
