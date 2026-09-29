import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const bootstrapPath = fileURLToPath(new URL('../../readmodels/bootstrap.inline.json', import.meta.url))

export function archiveBootstrapPlugin() {
  return {
    name: 'archive-bootstrap',
    transformIndexHtml(html) {
      const boot = JSON.parse(readFileSync(bootstrapPath, 'utf8'))
      if (boot.schema_version !== 1 || boot.read_model_version !== 1 || !/^[a-f0-9]{64}$/.test(boot.release || '')) {
        throw new Error('Invalid checked-in archive bootstrap')
      }
      if (!html.includes('</head>') || html.includes('id="archive-bootstrap"')) {
        throw new Error('Cannot insert archive bootstrap into HTML')
      }
      const inline = JSON.stringify(boot).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
      return html.replace('</head>', `<script type="application/json" id="archive-bootstrap">${inline}</script>\n</head>`)
    },
  }
}
