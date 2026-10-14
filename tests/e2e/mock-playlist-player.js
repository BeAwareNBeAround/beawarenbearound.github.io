/**
 * Deterministic media control for browser tests.
 *
 * Installs a scriptable stand-in for `window.Audio` before the app loads so
 * playback-event coverage never races a real recording: the test decides when
 * `playing`, `pause`, `ended`, `error`, `timeupdate`, and `durationchange`
 * happen, and no unsolicited automatic end event can fire mid-assertion. The
 * app is not stubbed — `usePlaylistPlayer` still creates `new window.Audio()`
 * and reacts to the events dispatched here, and every assertion runs against
 * the rendered UI and the mocked counter requests.
 *
 * The stand-in mirrors the HTMLAudioElement behavior the player depends on,
 * including a real browser's reflection of an assigned relative `src` as a
 * resolved absolute URL, and a `play()` promise that settles when the test
 * says playback starts (or refuses).
 *
 * Suites that only need recording *routes* (no media-event timing) use
 * `mock-audio-recording.js`, which only takes effect in runs without the
 * precaching service worker; real decoding/duration coverage stays with the
 * non-mocked tests in playlist.spec.js.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{
 *   state: () => Promise<{src: string, currentTime: number, duration: number|null, paused: boolean,
 *     playbackRate: number, volume: number, muted: boolean, playCount: number, pauseCount: number,
 *     eventLog: string[]} | null>,
 *   elementCount: () => Promise<number>,
 *   fire: (type: string) => Promise<void>,
 *   setTime: (seconds: number) => Promise<void>,
 *   setDuration: (seconds: number) => Promise<void>,
 *   resolvePlay: () => Promise<void>,
 *   rejectPlay: () => Promise<void>,
 * }>}
 */
export async function mockPlaylistPlayer(page) {
  await page.addInitScript(() => {
    class ScriptableAudio {
      constructor() {
        this._src = '';
        this.currentTime = 0;
        this.duration = NaN;
        this.playbackRate = 1;
        this.volume = 1;
        this.muted = false;
        this.paused = true;
        this.playCount = 0;
        this.pauseCount = 0;
        this.eventLog = [];
        this._listeners = new Map();
        this._pendingPlays = [];
        window.__playlistMedia.elements.push(this);
      }

      // A real element reflects the resolved absolute URL, which is what the
      // player compares its commanded source against.
      get src() { return this._src ? new URL(this._src, document.baseURI).href : ''; }
      set src(value) { this._src = String(value ?? ''); }
      get currentSrc() { return this.src; }

      addEventListener(type, handler) {
        if (!this._listeners.has(type)) this._listeners.set(type, new Set());
        this._listeners.get(type).add(handler);
      }

      removeEventListener(type, handler) {
        this._listeners.get(type)?.delete(handler);
      }

      emit(type) {
        this.eventLog.push(type);
        // Handlers may read event.target/currentTarget (real media events always
        // carry the element), so hand out a real Event bound to this stand-in.
        const event = new Event(type);
        Object.defineProperty(event, 'target', { value: this });
        Object.defineProperty(event, 'currentTarget', { value: this });
        for (const handler of [...(this._listeners.get(type) ?? [])]) handler(event);
      }

      play() {
        this.playCount += 1;
        this.paused = false;
        return new Promise((resolve, reject) => this._pendingPlays.push({ resolve, reject }));
      }

      pause() {
        const wasPlaying = !this.paused;
        this.paused = true;
        this.pauseCount += 1;
        if (wasPlaying) this.emit('pause');
      }
    }

    const requireCurrent = () => {
      const element = api.current();
      if (!element) throw new Error('mockPlaylistPlayer: the app has not created a media element yet');
      return element;
    };

    const api = {
      elements: [],
      current() { return this.elements[this.elements.length - 1] ?? null; },
      state() {
        const element = api.current();
        if (!element) return null;
        return {
          src: element.src,
          currentTime: element.currentTime,
          duration: Number.isFinite(element.duration) ? element.duration : null,
          paused: element.paused,
          playbackRate: element.playbackRate,
          volume: element.volume,
          muted: element.muted,
          playCount: element.playCount,
          pauseCount: element.pauseCount,
          eventLog: [...element.eventLog],
        };
      },
      fire(type) {
        const element = requireCurrent();
        // A real element resolves play() before it starts firing playing.
        if (type === 'playing') api.resolvePlay();
        element.emit(type);
      },
      setTime(seconds) {
        const element = requireCurrent();
        element.currentTime = seconds;
        element.emit('timeupdate');
      },
      setDuration(seconds) {
        const element = requireCurrent();
        element.duration = seconds;
        element.emit('durationchange');
      },
      resolvePlay() {
        for (const pending of requireCurrent()._pendingPlays.splice(0)) pending.resolve();
      },
      rejectPlay() {
        for (const pending of requireCurrent()._pendingPlays.splice(0)) {
          pending.reject(new DOMException('Playback was refused by the browser.', 'NotAllowedError'));
        }
      },
    };

    window.__playlistMedia = api;
    Object.defineProperty(window, 'Audio', { value: ScriptableAudio, configurable: true, writable: true });
  });

  return {
    state: () => page.evaluate(() => window.__playlistMedia.state()),
    elementCount: () => page.evaluate(() => window.__playlistMedia.elements.length),
    fire: (type) => page.evaluate((eventType) => window.__playlistMedia.fire(eventType), type),
    setTime: (seconds) => page.evaluate((value) => window.__playlistMedia.setTime(value), seconds),
    setDuration: (seconds) => page.evaluate((value) => window.__playlistMedia.setDuration(value), seconds),
    resolvePlay: () => page.evaluate(() => window.__playlistMedia.resolvePlay()),
    rejectPlay: () => page.evaluate(() => window.__playlistMedia.rejectPlay()),
  };
}
