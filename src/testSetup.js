import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// Mock HTMLAudioElement: services/hooks construct `new Audio(...)`; tests
// inspect the recorded instances (src, play/pause calls) via
// window.MockAudioInstances. Defined permanently (not vi.stubGlobal) so the
// mock survives the per-test global restoration in afterEach.
//
// The mock simulates the media lifecycle event-wise: tests attach listeners
// and emit events (emit('playing'), emit('ended'), ...), and control the play
// promise via resolvePlay()/rejectPlay() or the per-call playDeferreds list
// for race tests. Playback state (currentTime, duration, ...) is plain
// properties the test sets before emitting the matching event.
class MockAudio {
  constructor(src) {
    this.src = src ?? '';
    this.currentTime = 0;
    this.duration = NaN;
    this.playbackRate = 1;
    this.volume = 1;
    this.muted = false;
    this.paused = true;
    this._listeners = new Map();
    this.playDeferreds = [];
    this.play = vi.fn(() => {
      const deferred = createDeferred();
      this.playDeferreds.push(deferred);
      this.paused = false;
      return deferred.promise;
    });
    this.pause = vi.fn(() => {
      this.paused = true;
    });
    window.MockAudioInstances.push(this);
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }

  dispatchEvent(event) {
    for (const handler of [...(this._listeners.get(event.type) ?? [])]) handler(event);
    return true;
  }

  // Test helper: dispatch a media event by name.
  emit(type) {
    this.dispatchEvent(new Event(type));
  }

  // Test helpers: settle every pending play() promise (oldest first).
  resolvePlay() {
    for (const deferred of this.playDeferreds.splice(0)) deferred.resolve();
  }

  rejectPlay(error) {
    for (const deferred of this.playDeferreds.splice(0)) deferred.reject(error ?? new Error('MockAudio play rejected'));
  }
}
window.MockAudioInstances = [];
Object.defineProperty(window, 'Audio', { value: MockAudio, configurable: true });

afterEach(() => {
  window.MockAudioInstances = [];
});

// jsdom only implements the <dialog> `open` attribute reflection; mirror the
// native lifecycle so components can use showModal()/show()/close().
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.show = function show() { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close = function close() {
  if (this.hasAttribute('open')) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  }
};
