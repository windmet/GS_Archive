import { readFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'
import {
  authoritativeStoryRegistryPath,
  authoritativeStoryRegistrySchemaPath,
  authoritativeV2Stats,
} from './lib/archive-baseline-report.mjs'

const [registry, schema] = await Promise.all([
  readFile(authoritativeStoryRegistryPath, 'utf8').then(JSON.parse),
  readFile(authoritativeStoryRegistrySchemaPath, 'utf8').then(JSON.parse),
])
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)

if (!validate(registry)) {
  console.error('Authoritative Story publication registry verification failed:')
  validate.errors.forEach(error => {
    console.error(`- ${error.instancePath || '/'} ${error.message}`)
  })
  process.exitCode = 1
} else {
  try {
    const stats = authoritativeV2Stats()
    console.log(
      'Authoritative Story publications verified: ' +
      `${stats.collection_count} collections + ${stats.standalone_count} standalone / ` +
      `${stats.artifact_count} Runtime v2 artifacts; ` +
      `${stats.ledger_governed.length} ledger-governed`,
    )
  } catch (error) {
    console.error('Authoritative Story publication registry verification failed:')
    console.error(`- ${error.message}`)
    process.exitCode = 1
  }
}
