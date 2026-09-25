import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {string} endpointUrl - Full URL to the PHP tracker script
 * @param {string} targetUrl - URL to track
 * @param {string} [installId] - Optional persistent identifier for the visitor
 */
export const useClickCounter = ({ endpointUrl, targetUrl, installId }) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Prevents duplicate tracking calls in React 18 Development StrictMode
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (!endpointUrl || !targetUrl) {
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const { signal } = controller;

    if (!hasTrackedRef.current) {
      hasTrackedRef.current = true;
      fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal,
        body: JSON.stringify({
          url: targetUrl,
          log: true,
          install_id: installId,
        }),
      }).catch(() => {
        // Fire-and-forget analytics: visit failures never surface.
      });
    }

    setLoading(true);
    setError(null);

    (async () => {
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
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [endpointUrl, targetUrl, installId]);

  const trackClick = useCallback(
    async (buttonId) => {
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

  return { count, loading, error, trackClick };
};
