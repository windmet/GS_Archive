import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
const root=process.argv[2]
if (!root) throw Error('Usage: node scripts/generate-portal-card-facets.mjs READ_MODEL_ROOT')
const bootstrap=JSON.parse(await fs.readFile(path.join(root,'bootstrap.inline.json'),'utf8'))
async function read(descriptor) {
  const bytes=await fs.readFile(path.join(root,'pages',descriptor.url.slice(1)))
  if (createHash('sha256').update(bytes).digest('hex')!==descriptor.sha256 || bytes.length!==descriptor.bytes) throw Error('Read model evidence drift')
  return JSON.parse(bytes).data
}
const index=await read(bootstrap.domains.cards)
const rows=(await Promise.all(index.pages.map(read))).flatMap(page=>page.rows)
const cards={}
for (const row of rows) {
  const detail=await read(row.detail), attribute=detail.card?.gameplay?.attribute
  if (detail.id!==row.resource_id || ({1:'Physical',2:'Intelligence',3:'Mental'})[attribute?.id]!==attribute?.name) throw Error(`Card attribute identity mismatch ${row.resource_id}`)
  cards[row.resource_id]={attributeId:attribute.id,attribute:attribute.name,detailSha256:row.detail.sha256}
}
await fs.writeFile('public/data/assets/portal_card_facets.json',JSON.stringify({schemaVersion:1,release:bootstrap.release,cards})+'\n')
console.log(`Projected ${rows.length} card attributes with pinned detail hashes`)
