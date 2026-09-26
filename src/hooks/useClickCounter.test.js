import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { expect, test, vi } from 'vitest';
import { useClickCounter } from './useClickCounter';

const ENDPOINT = 'https://epilepsy.org.hk/counter/';
const TARGET = 'https://epilepsy.org.hk/';
const INSTALL_ID = 'install-1';

function successResponse(totalViews) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ status: 'success', metrics: { total_views: totalViews, unique_views: 1 } }),
  };
}

function setupHook(fetchImpl, props = {}) {
  const fetchMock = vi.fn(fetchImpl);
  vi.stubGlobal('fetch', fetchMock);
  const hook = renderHook(() =>
    useClickCounter({ endpointUrl: ENDPOINT, targetUrl: TARGET, installId: INSTALL_ID, ...props }),
  );
  return { fetchMock, ...hook };
}

test('on mount, fires a visit POST (no action key) and a click-count GET', async () => {
  const { fetchMock } = setupHook(async () => successResponse(100));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

  const [visitUrl, visitOptions] = fetchMock.mock.calls[0];
  expect(visitUrl).toBe(ENDPOINT);
  expect(visitOptions.method).toBe('POST');
  expect(visitOptions.credentials).toBe('include');
  expect(visitOptions.headers).toEqual({ 'Content-Type': 'application/json' });
  const visitBody = JSON.parse(visitOptions.body);
  expect(visitBody).toEqual({ url: TARGET, log: true, install_id: INSTALL_ID });
  expect(visitBody).not.toHaveProperty('action');

  const [getUrl, getOptions] = fetchMock.mock.calls[1];
  expect(getOptions.method).toBe('GET');
  expect(getOptions.credentials).toBe('include');
  expect(getUrl).toBe(`${ENDPOINT}?${new URLSearchParams({ url: TARGET, action: 'click' }).toString()}`);
  const getQuery = new URL(getUrl).searchParams;
  expect(getQuery.get('url')).toBe(TARGET);
  expect(getQuery.get('action')).toBe('click');
});

test('sets count from the initial GET metrics.total_views', async () => {
  const { result } = setupHook(async (url, options) =>
    options.method === 'GET' ? successResponse(1234) : successResponse(999),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.count).toBe(1234);
  expect(result.current.error).toBeNull();
});

test('skips fetches and stops loading when endpoint or target is missing', async () => {
  const { fetchMock, result } = setupHook(
    async () => successResponse(100),
    { endpointUrl: '', targetUrl: '' },
  );

  await act(async () => {});

  expect(fetchMock).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeNull();
  expect(result.current.count).toBe(0);
});

test('trackClick POSTs the click and updates count from that response', async () => {
  const { fetchMock, result } = setupHook(async (url, options) =>
    options.method === 'POST' ? successResponse(42) : successResponse(100),
  );

  await waitFor(() => expect(result.current.count).toBe(100));

  fetchMock.mockClear();
  await act(async () => {
    await result.current.trackClick(1);
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [clickUrl, clickOptions] = fetchMock.mock.calls[0];
  expect(clickUrl).toBe(ENDPOINT);
  expect(clickOptions.method).toBe('POST');
  expect(clickOptions.credentials).toBe('include');
  expect(JSON.parse(clickOptions.body)).toEqual({
    url: TARGET,
    log: true,
    install_id: INSTALL_ID,
    action: 'click',
    action_target: '1',
  });
  expect(result.current.count).toBe(42);
  expect(result.current.error).toBeNull();
});

test('sets error when the initial GET returns a non-2xx response', async () => {
  const { result } = setupHook(async (url, options) =>
    options.method === 'GET' ? { ok: false, status: 500 } : successResponse(100),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.error).toBe('HTTP Error 500');
});

test('sets error when the initial GET request fails', async () => {
  const { result } = setupHook(async (url, options) => {
    if (options.method === 'GET') throw new TypeError('Failed to fetch');
    return successResponse(100);
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.error).toBe('Failed to fetch');
});

test('sets error when the initial GET response is not a success payload', async () => {
  const { result } = setupHook(async (url, options) =>
    options.method === 'GET'
      ? { ok: true, status: 200, json: async () => ({ status: 'error', message: 'tracker down' }) }
      : successResponse(100),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.error).toBe('tracker down');
});

test('a failed visit POST never surfaces an error', async () => {
  const { result } = setupHook(async (url, options) => {
    if (options.method === 'POST') throw new TypeError('visit post failed');
    return successResponse(100);
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.count).toBe(100);
  expect(result.current.error).toBeNull();
});

test('trackClick failure keeps the previous count and never sets error', async () => {
  const { fetchMock, result } = setupHook(async (url, options) =>
    options.method === 'POST' ? successResponse(42) : successResponse(100),
  );

  await waitFor(() => expect(result.current.count).toBe(100));
  fetchMock.mockImplementation(async () => {
    throw new TypeError('network down');
  });

  await act(async () => {
    await result.current.trackClick(2);
  });

  expect(result.current.count).toBe(100);
  expect(result.current.error).toBeNull();
});

test('trackClick non-2xx response keeps the previous count and never sets error', async () => {
  const { fetchMock, result } = setupHook(async (url, options) =>
    options.method === 'POST' ? successResponse(42) : successResponse(100),
  );

  await waitFor(() => expect(result.current.count).toBe(100));
  fetchMock.mockImplementation(async () => ({ ok: false, status: 503 }));

  await act(async () => {
    await result.current.trackClick(2);
  });

  expect(result.current.count).toBe(100);
  expect(result.current.error).toBeNull();
});

test('StrictMode double-mount issues exactly one visit POST', async () => {
  const fetchMock = vi.fn(async () => successResponse(5));
  vi.stubGlobal('fetch', fetchMock);

  renderHook(
    () => useClickCounter({ endpointUrl: ENDPOINT, targetUrl: TARGET, installId: INSTALL_ID }),
    {
      wrapper: ({ children }) => React.createElement(React.StrictMode, null, children),
    },
  );

  await act(async () => {});

  const postCalls = fetchMock.mock.calls.filter(([, options]) => options && options.method === 'POST');
  expect(postCalls).toHaveLength(1);

  const [visitUrl, visitOptions] = postCalls[0];
  expect(visitUrl).toBe(ENDPOINT);
  expect(visitOptions).not.toHaveProperty('signal');
});
