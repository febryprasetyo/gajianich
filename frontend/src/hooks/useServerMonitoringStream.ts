'use client';

import { useEffect, useState } from 'react';
import { AUTH_COOKIE_NAME } from '@/lib/authCookie';

function readAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const localToken = localStorage.getItem('token');
    if (localToken) return localToken;
  } catch {
    // Ignore storage error
  }
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split('=');
  return match ? decodeURIComponent(match[1]) : null;
}

interface UseServerMonitoringStreamOptions {
  onPulseOrTelemetry: () => void;
  intervalSeconds?: number;
}

export function useServerMonitoringStream({
  onPulseOrTelemetry,
  intervalSeconds = 5,
}: UseServerMonitoringStreamOptions) {
  const [countdown, setCountdown] = useState(intervalSeconds);
  const [streamConnected, setStreamConnected] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onPulseOrTelemetry();
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onPulseOrTelemetry, intervalSeconds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const abortController = new AbortController();
    const token = readAuthToken();
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || '/api/v1').replace(/\/+$/, '');

    async function connectSse() {
      try {
        const res = await fetch(`${baseUrl}/infrastructure/servers/stream`, {
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          setStreamConnected(false);
          return;
        }

        setStreamConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!abortController.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';

          for (const chunk of chunks) {
            if (chunk.startsWith('data:')) {
              onPulseOrTelemetry();
            }
          }
        }
      } catch {
        // Fallback polling timer in the first useEffect remains active
      }
    }

    void connectSse();
    return () => {
      abortController.abort();
    };
  }, [onPulseOrTelemetry]);

  return {
    countdown,
    streamConnected,
  };
}
