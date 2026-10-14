import { Buffer } from 'node:buffer';

// Smallest legal MPEG-1 Layer III silent frame (used as a stand-in body for
// the placeholder action recordings so a suite never depends on the real mp3 content).
const SILENT_MP3_FRAME = Buffer.from(
  'FFFB64C400000000000000000000000000000000000000000000000000000000',
  'hex',
);

/**
 * Registers a Playwright route that serves a silent MP3 frame for every
 * action recording request (public/resources/<function>-<locale>.mp3).
 *
 * This applies only to suites that load the app WITHOUT the service worker.
 * Every suite under tests/ runs against the built PWA (playwright.config.js
 * builds and previews it), where the precaching service worker answers
 * /resources/*.mp3 from its own cache before page routes can see the request,
 * so calling this there is a no-op — and the silent frame it would serve is
 * not decodable media anyway. Suites that need deterministic media events use
 * mock-playlist-player.js; real decoding/duration coverage stays with the
 * non-mocked tests in playlist.spec.js.
 *
 * @param {import('@playwright/test').Page} page
 */
export function mockAudioRecordingRoutes(page) {
  page.route('**/resources/*.mp3', (route) => {
    route.fulfill({ status: 200, contentType: 'audio/mpeg', body: SILENT_MP3_FRAME });
  });
}
