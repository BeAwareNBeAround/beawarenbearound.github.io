import { Buffer } from 'node:buffer';

// Smallest legal MPEG-1 Layer III silent frame (used as a stand-in body for
// the placeholder action recordings so e2e runs never depend on the real mp3 playback).
const SILENT_MP3_FRAME = Buffer.from(
  'FFFB64C400000000000000000000000000000000000000000000000000000000',
  'hex',
);

/**
 * Registers a Playwright route that serves a silent MP3 frame for every
 * action recording request (public/resources/<function>-<locale>.mp3), keeping
 * the e2e suites independent of the recorded audio content.
 *
 * @param {import('@playwright/test').Page} page
 */
export function mockAudioRecordingRoutes(page) {
  page.route('**/resources/*.mp3', (route) => {
    route.fulfill({ status: 200, contentType: 'audio/mpeg', body: SILENT_MP3_FRAME });
  });
}
