export function getRuntimeCueFeatureFlags(search = globalThis.location?.search || '') {
  const params = new URLSearchParams(search)
  const all = params.get('runtimeCues') === '1'
  return Object.freeze({
    camera: all || params.get('runtimeCamera') === '1',
    se: all || params.get('runtimeSE') === '1',
  })
}

export function isRuntimeCueChannelEnabled(channel, search) {
  return getRuntimeCueFeatureFlags(search)[channel] === true
}
