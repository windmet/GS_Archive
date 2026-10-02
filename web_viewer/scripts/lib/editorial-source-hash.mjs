import {createHash} from 'node:crypto'
// Git text checkout may use CRLF on Windows. Only normalize CRLF, not JSON
// values, whitespace, ordering, media bytes or published artifact hashes.
export const EDITORIAL_SOURCE_HASH_FORMAT = 'sha256-utf8-lf-v1'
export function editorialSourceHash(bytes) {
  return createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g,'\n'),'utf8').digest('hex')
}
