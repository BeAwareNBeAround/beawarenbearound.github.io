import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getActionAudioSource } from '../services/audio';

const TRACK_IDS = [1, 2, 3, 4];
const REPEAT_MODES = ['off', 'all', 'one'];
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5];

// HTMLMediaElement.src reflects the resolved absolute URL, while the hook
// tracks the relative recording path; compare resolved forms so real
// browsers and jsdom agree about which source an event belongs to.
const resolveSource = (source) => new URL(source, document.baseURI).href;

// Page-owned player state for the four first-aid recordings. The hook owns
// one lazily created Audio element and never calls the click counter; the
// App routes counted clicks through selectTrack and calls transport
// commands directly.
//
// Phase transitions are event-driven: media events (playing, pause, ended,
// waiting, error, timeupdate, durationchange) and the play promise outcome
// drive the phase; no polling. loadTokenRef/expectedSrcRef guard against
// stale play rejections and late events from an interrupted source, and the
// pause handler also requires the element to report itself paused so a queued
// pause from the outgoing source cannot pause the track just selected.
export function usePlaylistPlayer({ locale }) {
  const [selectedId, setSelectedId] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(NaN);
  const [repeatMode, setRepeatModeState] = useState('off');
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMutedState] = useState(false);

  const audioRef = useRef(null);
  const listenersRef = useRef([]);
  const loadTokenRef = useRef(0);
  // Source the hook last commanded the element to load; null once that
  // source is invalidated (locale change) or nothing was loaded yet.
  const expectedSrcRef = useRef(null);
  const phaseRef = useRef('idle');
  const selectedIdRef = useRef(null);
  const repeatModeRef = useRef('off');
  const playbackRateRef = useRef(1);
  const volumeRef = useRef(1);
  const mutedRef = useRef(false);
  const localeRef = useRef(locale);
  const playTrackRef = useRef(null);
  const loadTrackRef = useRef(null);

  // Media event handlers outlive renders, so phase changes go through this
  // helper to keep the ref in sync with the state synchronously.
  const applyPhase = (nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  const getAudio = () => {
    if (audioRef.current) return audioRef.current;
    const audio = new window.Audio();
    // Source events only count while the element still carries the source
    // the hook last commanded; late events for an interrupted source are
    // dropped, as are events after a locale change invalidated it.
    const isCurrentSource = () => {
      const expectedSource = expectedSrcRef.current;
      return Boolean(expectedSource) && resolveSource(audio.src) === resolveSource(expectedSource);
    };
    const listeners = [
      ['playing', () => {
        if (!isCurrentSource()) return;
        if (phaseRef.current === 'loading' || phaseRef.current === 'paused' || phaseRef.current === 'playing') applyPhase('playing');
      }],
      ['pause', () => {
        // Stale-source guard, like every other listener. A real browser queues
        // media events, so the pause() that startTrack/loadTrack issue on the
        // outgoing source can be delivered after requestPlay has already set
        // loading on the new source; by then the element reports itself playing
        // again, so a pause that does not match the commanded source or the
        // element's own paused flag belongs to an interrupted source.
        if (!isCurrentSource() || !audio.paused) return;
        if (phaseRef.current === 'playing' || phaseRef.current === 'loading') applyPhase('paused');
      }],
      ['ended', () => {
        if (!isCurrentSource()) return;
        if (phaseRef.current !== 'playing' && phaseRef.current !== 'paused') return;
        if (repeatModeRef.current === 'off') {
          applyPhase('ended');
          return;
        }
        if (repeatModeRef.current === 'one') {
          playTrackRef.current(selectedIdRef.current);
          return;
        }
        playTrackRef.current(TRACK_IDS[(TRACK_IDS.indexOf(selectedIdRef.current) + 1) % TRACK_IDS.length]);
      }],
      ['waiting', () => {
        if (!isCurrentSource()) return;
        if (phaseRef.current === 'playing') applyPhase('loading');
      }],
      ['error', () => {
        if (!isCurrentSource()) return;
        if (phaseRef.current === 'idle') return;
        // Retryable error state; autoplay/repetition halts until a command
        // retries the selected source.
        applyPhase('error');
      }],
      ['timeupdate', () => {
        if (!isCurrentSource()) return;
        setCurrentTime(audio.currentTime);
      }],
      ['durationchange', () => {
        if (!isCurrentSource()) return;
        const mediaDuration = audio.duration;
        setDuration(Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : NaN);
      }],
    ];
    for (const [eventType, handler] of listeners) audio.addEventListener(eventType, handler);
    listenersRef.current = listeners;
    // Settings chosen before the first playback apply to the new element.
    audio.playbackRate = playbackRateRef.current;
    audio.volume = volumeRef.current;
    audio.muted = mutedRef.current;
    audioRef.current = audio;
    return audio;
  };

  // A rejected play is an error only when its request is still the current
  // intent and the hook is still awaiting playback; superseded requests
  // (new selection, pause, locale change) resolve or reject unheard.
  const requestPlay = (audio) => {
    const token = loadTokenRef.current;
    audio.play().catch(() => {
      if (loadTokenRef.current !== token) return;
      if (phaseRef.current !== 'loading') return;
      applyPhase('error');
    });
    applyPhase('loading');
  };

  // Stops the old playback and plays the requested track from the beginning.
  const startTrack = (id) => {
    const source = getActionAudioSource(id, localeRef.current);
    if (!source) return;
    const audio = getAudio();
    loadTokenRef.current += 1;
    audio.pause();
    expectedSrcRef.current = source;
    selectedIdRef.current = id;
    setSelectedId(id);
    setCurrentTime(0);
    setDuration(NaN);
    audio.currentTime = 0;
    audio.src = source;
    requestPlay(audio);
  };

  // Switches source and resets position without starting playback.
  const loadTrack = (id) => {
    const source = getActionAudioSource(id, localeRef.current);
    if (!source) return;
    const audio = getAudio();
    loadTokenRef.current += 1;
    audio.pause();
    expectedSrcRef.current = source;
    selectedIdRef.current = id;
    setSelectedId(id);
    setCurrentTime(0);
    setDuration(NaN);
    audio.currentTime = 0;
    audio.src = source;
    applyPhase('paused');
  };

  useEffect(() => {
    playTrackRef.current = startTrack;
    loadTrackRef.current = loadTrack;
  });

  const selectTrack = (id) => {
    if (!getActionAudioSource(id, localeRef.current)) return;
    startTrack(id);
  };

  const togglePlayback = () => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'loading') {
      loadTokenRef.current += 1;
      // Phase first so the element's own pause event observes the pause.
      applyPhase('paused');
      const audio = audioRef.current;
      if (audio) audio.pause();
      return;
    }
    if (phaseRef.current === 'paused') {
      const audio = audioRef.current;
      if (!audio) return;
      requestPlay(audio);
      return;
    }
    // idle, ended, or error: (re)load the selected source from zero; with
    // no selection yet, the first play chooses track 1.
    startTrack(selectedIdRef.current ?? TRACK_IDS[0]);
  };

  const stepTrack = (delta) => {
    const currentIndex = TRACK_IDS.indexOf(selectedIdRef.current);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + delta;
    // Bounds are absolute: never wrap, even in repeat all.
    if (targetIndex < 0 || targetIndex >= TRACK_IDS.length) return;
    if (phaseRef.current === 'playing' || phaseRef.current === 'loading') startTrack(TRACK_IDS[targetIndex]);
    else loadTrack(TRACK_IDS[targetIndex]);
  };

  const seek = (seconds) => {
    // Seeking stays disabled until a finite positive duration is known.
    if (!Number.isFinite(seconds)) return;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.min(Math.max(seconds, 0), duration);
    audio.currentTime = target;
    setCurrentTime(target);
  };

  const setRepeatMode = (mode) => {
    if (!REPEAT_MODES.includes(mode)) return;
    repeatModeRef.current = mode;
    setRepeatModeState(mode);
  };

  const setPlaybackRate = (rate) => {
    if (!PLAYBACK_RATES.includes(rate)) return;
    playbackRateRef.current = rate;
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
    setPlaybackRateState(rate);
  };

  const setVolume = (value) => {
    if (!Number.isFinite(value)) return;
    const clamped = Math.min(Math.max(value, 0), 1);
    volumeRef.current = clamped;
    const audio = audioRef.current;
    if (audio) audio.volume = clamped;
    setVolumeState(clamped);
  };

  const setMuted = (value) => {
    mutedRef.current = Boolean(value);
    const audio = audioRef.current;
    if (audio) audio.muted = mutedRef.current;
    setMutedState(mutedRef.current);
  };

  // A language change stops playback and resets progress while selection and
  // settings survive; the next play loads the new locale's recording. The
  // state reset happens during render (React's adjust-state-on-prop-change
  // pattern); invalidating the tracked source and pausing the media element
  // are the external-system parts and run in the layout effect below, which
  // commits before any media event can observe the in-between state.
  const [renderedLocale, setRenderedLocale] = useState(locale);
  if (renderedLocale !== locale) {
    setRenderedLocale(locale);
    setPhase('idle');
    setCurrentTime(0);
    setDuration(NaN);
  }

  useLayoutEffect(() => {
    phaseRef.current = 'idle';
    localeRef.current = locale;
    loadTokenRef.current += 1;
    expectedSrcRef.current = null;
    const audio = audioRef.current;
    if (audio) audio.pause();
  }, [locale]);

  // Detach the page's audio on unmount so route changes cannot leave
  // recordings playing; nothing is created (or leaked) if never played.
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      loadTokenRef.current += 1;
      expectedSrcRef.current = null;
      phaseRef.current = 'idle';
      for (const [eventType, handler] of listenersRef.current) audio.removeEventListener(eventType, handler);
      listenersRef.current = [];
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  return {
    selectedId,
    phase,
    currentTime,
    duration,
    repeatMode,
    playbackRate,
    volume,
    muted,
    selectTrack,
    togglePlayback,
    previous: () => stepTrack(-1),
    next: () => stepTrack(1),
    seek,
    setRepeatMode,
    setPlaybackRate,
    setVolume,
    setMuted,
  };
}
