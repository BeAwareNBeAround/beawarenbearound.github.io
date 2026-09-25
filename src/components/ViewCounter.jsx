import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * @param {string} endpointUrl - Full URL to the PHP tracker script
 * @param {string} [targetUrl] - URL to track (defaults to current window location)
 * @param {boolean} [autoTrack=true] - If true, sends POST on mount to log visit; if false, performs GET read-only
 * @param {string} [installId] - Optional persistent identifier for the visitor
 */
export const ViewCounter = ({
  endpointUrl,
  targetUrl = typeof window !== 'undefined' ? window.location.href : '',
  autoTrack = true,
  installId,
  className = '',
  label = 'Views',
}) => {
  const [metrics, setMetrics] = useState({ total_views: 0, unique_views: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Prevents duplicate tracking calls in React 18 Development StrictMode
  const hasTrackedRef = useRef(false);

  /**
   * Log visit and fetch fresh metrics (POST)
   */
  const logVisit = useCallback(async (signal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensures cookie 'wp_tracker_vid' is passed/saved
        signal,
        body: JSON.stringify({
          url: targetUrl,
          log: true,
          install_id: installId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const resData = await response.json();
      if (resData.status === 'success' && resData.metrics) {
        setMetrics(resData.metrics);
      } else {
        throw new Error(resData.message || 'Failed to record view count');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [endpointUrl, targetUrl, installId]);

  /**
   * Read metrics without logging a visit (GET)
   */
  const fetchMetrics = useCallback(async (signal) => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ url: targetUrl });
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
        setMetrics(resData.metrics);
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
  }, [endpointUrl, targetUrl]);

  useEffect(() => {
    if (!endpointUrl || !targetUrl) return;

    const controller = new AbortController();

    if (autoTrack) {
      if (!hasTrackedRef.current) {
        hasTrackedRef.current = true;
        logVisit(controller.signal);
      }
    } else {
      (async () => {
        await fetchMetrics(controller.signal);
      })();
    }

    return () => {
      controller.abort();
    };
  }, [autoTrack, endpointUrl, targetUrl, logVisit, fetchMetrics]);

  if (loading) {
    return <span className={`view-counter loading ${className}`}>Loading counts...</span>;
  }

  if (error) {
    return <span className={`view-counter error ${className}`}>Unavailable</span>;
  }

  return (
    <div className={`${className}`}>
        <span>{label}</span>&nbsp;
        <span>{metrics.total_views.toLocaleString()}</span>
    </div>
  );
};