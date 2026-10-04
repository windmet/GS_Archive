import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { publishRawCharacterImageBatch } from './lib/raw-character-image-promotion.mjs'
const workspaceRoot = process.cwd()
const idols = JSON.parse(readFileSync('readmodels/bootstrap.inline.json')).idols.map(row => row.id).sort()
for (const code of idols) {
  const candidate = `.analysis/portal-story-portraits/story_visual/${code}`
  if (!existsSync(`${candidate}/candidate.json`)) execFileSync('python', ['-X','utf8','../data_pipeline/extract_raw_character_image_candidate.py','story_visual',code,'--output-root','.analysis/portal-story-portraits'], {stdio:'pipe'})
}
for (let i=0;i<idols.length;i+=5) {
  const codes=idols.slice(i,i+5)
  await publishRawCharacterImageBatch({workspaceRoot,candidateDirectories:codes.map(code=>`.analysis/portal-story-portraits/story_visual/${code}`),registryFile:'public/data/assets/raw_character_image_promotions.json',assetsRoot:'public/assets',backupDirectory:`.analysis/portal-story-portraits/backup-${i}`,confirmKey:`story_visual:${codes.join('+')}`})
  console.log(`Promoted ${codes.join(', ')}`)
}
