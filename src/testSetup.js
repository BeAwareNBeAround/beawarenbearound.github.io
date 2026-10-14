import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

// Mock HTMLAudioElement: services/hooks construct `new Audio(...)`; tests
// inspect the recorded instances (src, play/pause calls) via
// window.MockAudioInstances. Defined permanently (not vi.stubGlobal) so the
// mock survives the per-test global restoration in afterEach.
class MockAudio {
  constructor(src) {
    this.src = src ?? '';
    this.play = vi.fn(() => Promise.resolve());
    this.pause = vi.fn();
    window.MockAudioInstances.push(this);
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
