export const COUNTER_ORIGIN = 'https://epilepsy.org.hk';
export const COUNTER_PATHNAME = '/counter/';

/**
 * Registers a Playwright route that mocks the counter endpoint with
 * in-memory state, mirroring the request routing of the unit stub:
 *   - OPTIONS  -> 204 preflight with the CORS headers the browser needs
 *   - GET      -> 200 {status, metrics} (the initial count read)
 *   - POST with body.action === 'click' -> increments the total, returns metrics
 *   - POST without action (the mount visit) -> 200 {status} (no increment)
 *   - POST with a missing or unparseable body -> 400 {status: 'error'}
 *
 * Every fulfilled response carries the CORS headers required for the
 * app's cross-origin `credentials: 'include'` fetches: when the request
 * carries an Origin header it is echoed (a `*` origin is invalid for
 * credentialed requests) plus `access-control-allow-credentials: true`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{initialTotal?: number, initialUnique?: number}} [options]
 * @returns {{requests: Array<{method: string, url: string, body: object|null}>, state: () => {total: number, unique: number}}}
 */
export function mockCounterRoute(page, { initialTotal = 0, initialUnique = null } = {}) {
  let total = initialTotal;
  let unique = initialUnique ?? initialTotal;
  const requests = [];

  const isCounterRequest = (url) => url.origin === COUNTER_ORIGIN && url.pathname === COUNTER_PATHNAME;

  page.route(isCounterRequest, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const origin = request.headers()['origin'];
    const corsHeaders = origin
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
        }
      : {};

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders,
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type',
        },
      });
      return;
    }

    let body = null;
    if (method === 'POST') {
      const raw = request.postData();
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          requests.push({ method, url: request.url(), body: { raw } });
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({ status: 'error' }),
          });
          return;
        }
        requests.push({ method, url: request.url(), body });
      }
    } else if (method === 'GET') {
      requests.push({ method, url: request.url(), body: null });
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ status: 'success', metrics: { total_views: total, unique_views: unique } }),
      });
      return;
    }

    if (method === 'POST' && body) {
      if (body.action === 'click') {
        total += 1;
        unique += 1;
      }
      const payload = body.action === 'click'
        ? { status: 'success', metrics: { total_views: total, unique_views: unique } }
        : { status: 'success' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(payload),
      });
      return;
    }

    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ status: 'error' }),
    });
  });

  return {
    requests,
    state: () => ({ total, unique }),
  };
}
