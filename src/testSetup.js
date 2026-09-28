import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

Object.defineProperty(window, 'speechSynthesis', {
  value: { cancel: vi.fn(), speak: vi.fn() },
  configurable: true,
});

window.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
  }
};

HTMLMediaElement.prototype.pause = vi.fn();
HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());

// jsdom only implements the <dialog> `open` attribute reflection; mirror the
// native lifecycle so components can use showModal()/show()/close().
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.show = function show() { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
