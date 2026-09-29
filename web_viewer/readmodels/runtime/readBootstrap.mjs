/** Synchronous read: shell creation must never await R2 or domain data. */
export function readBootstrap(doc = document) {
  const text = doc.getElementById('archive-bootstrap')?.textContent;
  if (!text || text.length > 128 * 1024) throw new Error('BUILD_BOOTSTRAP_MISSING_OR_TOO_LARGE');
  const boot = JSON.parse(text);
  if (boot.schema_version !== 1 || boot.read_model_version !== 1 || !/^[a-f0-9]{64}$/.test(boot.release || '')
    || !Array.isArray(boot.idols) || !boot.domains) throw new Error('BUILD_BOOTSTRAP_INVALID');
  return Object.freeze(boot);
}
