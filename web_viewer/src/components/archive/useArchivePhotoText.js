import {loadArchiveNames, archiveNamedText, archiveNamedSearchText} from './useArchiveNamedText.js';
export const archiveText = archiveNamedText, archiveSearchText = archiveNamedSearchText;

// Names update independently; a missing translation must not prevent the studio
// or source catalogue from mounting. Each new owner can retry a failed request.
export function loadArchivePhotoNames() {
  for (const domain of ['photos', 'costumes'])
    void loadArchiveNames(domain).catch(error => console.warn('Photo names unavailable', domain, error));
}
