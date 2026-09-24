import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// Only repository-owned translation JSON belongs in the code package. Never
// broaden this to copying public, which contains the multi-GiB media corpus.
export async function copyPreviewTranslations(root, outDir) {
  const files = execFileSync('git', ['ls-files', '-z', '--', 'public/translations'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
  let bytes = 0
  for (const relative of files) {
    if (!relative.startsWith('public/translations/') || !relative.endsWith('.json')) throw new Error(`Unexpected translation file: ${relative}`)
    const source = path.join(root, relative)
    if (await fs.realpath(source) !== source) throw new Error(`Redirected translation source: ${relative}`)
    const data = await fs.readFile(source)
    JSON.parse(data.toString('utf8'))
    const target = path.join(outDir, relative.slice('public/'.length))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, data)
    bytes += data.length
  }
  console.log(`Preview translations: ${files.length} tracked JSON files, ${bytes} bytes`)
  return { files: files.length, bytes }
}
