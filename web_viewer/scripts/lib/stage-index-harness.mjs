import { createStageIndexDocument } from '../../src/utils/StageIndexTransport.js'

// Existing loader fixtures inject raw response text. Feed it through the same
// document decoder as production; transport sharing is tested separately.
export function withStageIndexTransport(factory) {
  return (transport, ...args) => factory({
    ...transport, load: async (...input) => createStageIndexDocument(await transport.load(...input)),
  }, ...args)
}
