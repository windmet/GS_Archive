export function getRuntimeCueFeatureFlags(search = globalThis.location?.search || '') {
  const params = new URLSearchParams(search)
  const all = params.get('runtimeCues') === '1'
  const cameraOverride = params.get('runtimeCamera')
  const seOverride = params.get('runtimeSE')
  const screenOverride = params.get('runtimeScreen')
  const backgroundOverride = params.get('runtimeBackground')
  const snapshotOverride = params.get('runtimeSnapshots')
  const spineOverride = params.get('runtimeSpine')
  return Object.freeze({
    // Camera has completed channel acceptance. Keep runtimeCamera=0 as the
    // complete legacy rollback path while the remaining channels migrate.
    camera: cameraOverride !== '0',
    // SE has completed channel acceptance. Keep runtimeSE=0 as the complete
    // legacy setTimeout rollback path.
    se: seOverride !== '0',
    // Screen/fade has completed channel acceptance. Keep an explicit
    // runtimeScreen=0 escape hatch while the remaining runtime channels migrate.
    screen: screenOverride !== '0',
    // Background transition has completed channel acceptance. Keep
    // runtimeBackground=0 as the complete legacy rollback path.
    background: backgroundOverride !== '0',
    // Snapshot-backed history/restore has completed acceptance. Keep
    // runtimeSnapshots=0 as the index-stack rollback path.
    snapshot: snapshotOverride !== '0',
    // Spine timeline has completed channel acceptance. Keep an explicit
    // runtimeSpine=0 escape hatch while the remaining runtime channels migrate.
    spine: all || spineOverride !== '0',
  })
}

export function isRuntimeCueChannelEnabled(channel, search) {
  return getRuntimeCueFeatureFlags(search)[channel] === true
}
