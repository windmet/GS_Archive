export function getRuntimeCueFeatureFlags(search = globalThis.location?.search || '') {
  const params = new URLSearchParams(search)
  const all = params.get('runtimeCues') === '1'
  const screenOverride = params.get('runtimeScreen')
  const spineOverride = params.get('runtimeSpine')
  return Object.freeze({
    camera: all || params.get('runtimeCamera') === '1',
    se: all || params.get('runtimeSE') === '1',
    // Screen/fade has completed channel acceptance. Keep an explicit
    // runtimeScreen=0 escape hatch while the remaining runtime channels migrate.
    screen: screenOverride !== '0',
    background: all || params.get('runtimeBackground') === '1',
    snapshot: all || params.get('runtimeSnapshots') === '1',
    // Spine timeline has completed channel acceptance. Keep an explicit
    // runtimeSpine=0 escape hatch while the remaining runtime channels migrate.
    spine: all || spineOverride !== '0',
  })
}

export function isRuntimeCueChannelEnabled(channel, search) {
  return getRuntimeCueFeatureFlags(search)[channel] === true
}
