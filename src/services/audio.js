const ACTION_AUDIO = { 1: 'track1', 2: 'track2', 3: 'track3', 4: 'track4' };

// Single source of truth for action-recording paths (relative URLs; assets
// are named track<id>-<locale>.mp3 so filenames carry no slogan wording).
// Playback itself is owned by the page-level usePlaylistPlayer hook, which
// resolves sources through this resolver.
export function getActionAudioSource(id, locale) {
  const name = ACTION_AUDIO[id];
  if (!name) return null;
  return `./resources/${name}-${locale}.mp3`;
}
