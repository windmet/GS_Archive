import { validateStudioDocument } from './StudioDocument.mjs';

// A composition contains references and transforms, never embedded media.
export const STUDIO_DOCUMENT_FILE_MAX_BYTES = 64 * 1024;
export function serializeStudioDocument(document) {
  return JSON.stringify(validateStudioDocument(document), null, 2) + '\n';
}
export function parseStudioDocument(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > STUDIO_DOCUMENT_FILE_MAX_BYTES)
    throw Error('构图文件过大，最多支持 64 KiB');
  let value;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw Error('文件不是有效的 JSON 构图'); }
  return validateStudioDocument(value);
}
export async function readStudioDocumentFile(file) {
  if (!file || file.size > STUDIO_DOCUMENT_FILE_MAX_BYTES)
    throw Error('构图文件过大，最多支持 64 KiB');
  return parseStudioDocument(await file.text());
}
