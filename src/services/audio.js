const ACTION_AUDIO = { 1: 'stay', 2: 'save', 3: 'side', 4: 'help' };

// Single source of truth for action-recording paths (relative URLs, reused
// recordings; the SAFE/Save mismatch is intentional existing asset naming).
// Playback itself is owned by the page-level usePlaylistPlayer hook, which
// resolves sources through this resolver.
export function getActionAudioSource(id, locale) {
  const name = ACTION_AUDIO[id];
  if (!name) return null;
  return `./resources/${name}-${locale}.mp3`;
}
