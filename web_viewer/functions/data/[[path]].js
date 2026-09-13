import { serveR2Resource } from '../_shared/r2-resource.js'

export const onRequest = context => serveR2Resource({ ...context, prefix: 'data' })
