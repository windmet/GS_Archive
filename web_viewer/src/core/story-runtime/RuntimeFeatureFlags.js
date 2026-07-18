export function getRuntimeCueFeatureFlags(search = globalThis.location?.search || '') {
  const params = new URLSearchParams(search)
  const all = params.get('runtimeCues') === '1'
  return Object.freeze({
    camera: all || params.get('runtimeCamera') === '1',
    se: all || params.get('runtimeSE') === '1',
    screen: all || params.get('runtimeScreen') === '1',
    background: all || params.get('runtimeBackground') === '1',
    snapshot: all || params.get('runtimeSnapshots') === '1',
    spine: all || params.get('runtimeSpine') === '1',
  })
}

export function isRuntimeCueChannelEnabled(channel, search) {
  return getRuntimeCueFeatureFlags(search)[channel] === true
}
