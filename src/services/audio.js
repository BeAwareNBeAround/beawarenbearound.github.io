const ACTION_AUDIO = { 1: 'stay', 2: 'save', 3: 'side', 4: 'help' };

// Single source of truth for action-recording paths (relative URLs, reused
// recordings; the SAFE/Save mismatch is intentional existing asset naming).
export function getActionAudioSource(id, locale) {
  const name = ACTION_AUDIO[id];
  if (!name) return null;
  return `./resources/${name}-${locale}.mp3`;
}

let player = null;

function ensurePlayer(api = window) {
  if (!player) player = new api.Audio();
  return player;
}

export function stopAudio(api = window) {
  ensurePlayer(api).pause();
}

// Test-only: drop the shared player so each test observes a fresh instance.
export function __resetAudioPlayer() {
  player = null;
}

export function playActionAudio(id, locale, api = window) {
  const source = getActionAudioSource(id, locale);
  if (!source) return false;

  const audio = ensurePlayer(api);
  audio.pause();
  audio.src = source;
  audio.play().catch(() => {});
  return true;
}
