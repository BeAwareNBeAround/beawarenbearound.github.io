import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {string} endpointUrl - Full URL to the PHP tracker script
 * @param {string} targetUrl - URL to track
 * @param {string} [installId] - Optional persistent identifier for the visitor
 */
export const useClickCounter = ({ endpointUrl, targetUrl, installId }) => {
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Prevents duplicate tracking calls in React 18 Development StrictMode
  const hasTrackedRef = useRef(false);

  /**
   * Read the click count without logging a visit (GET)
   */
  const fetchClickCount = useCallback(
    async (signal) => {
      setError(null);

      try {
        const query = new URLSearchParams({ url: targetUrl, action: 'click' });
        const response = await fetch(`${endpointUrl}?${query.toString()}`, {
          method: 'GET',
          credentials: 'include',
          signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}`);
        }

        const resData = await response.json();
        if (resData.status === 'success' && resData.metrics) {
          setCount(resData.metrics.total_views);
        } else {
          throw new Error(resData.message || 'Failed to fetch metrics');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        if (!signal.aborted) {
          setLoaded(true);
        }
      }
    },
    [endpointUrl, targetUrl],
  );

  useEffect(() => {
    if (!endpointUrl || !targetUrl) {
      return undefined;
    }

    const controller = new AbortController();

    if (!hasTrackedRef.current) {
      hasTrackedRef.current = true;
      fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          url: targetUrl,
          log: true,
          install_id: installId,
        }),
      }).catch(() => {
        // Fire-and-forget analytics: visit failures never surface.
      });
    }

    (async () => {
      await fetchClickCount(controller.signal);
    })();

    return () => controller.abort();
  }, [endpointUrl, targetUrl, installId, fetchClickCount]);

  const trackClick = useCallback(
    async (buttonId) => {
      if (!endpointUrl || !targetUrl) {
        return;
      }
      try {
        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            url: targetUrl,
            log: true,
            install_id: installId,
            action: 'click',
            action_target: String(buttonId),
          }),
        });

        if (!response.ok) return;

        const resData = await response.json();
        if (resData.status === 'success' && resData.metrics) {
          setCount(resData.metrics.total_views);
        }
      } catch {
        // Fire-and-forget analytics: click failures never surface.
      }
    },
    [endpointUrl, targetUrl, installId],
  );

  const loading = endpointUrl && targetUrl ? !loaded : false;

  return { count, loading, error, trackClick };
};
