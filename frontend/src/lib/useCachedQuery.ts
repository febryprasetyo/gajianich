'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCachedEntry,
  fetchWithCache,
} from './queryCache';

export interface UseCachedQueryOptions<T> {
  /** Time in ms before cached data is considered stale and revalidated in background (default 30_000ms) */
  staleTimeMs?: number;
  /** Keep previous data visible while key changes (e.g. pagination/filter) to avoid full-table spinner */
  keepPreviousData?: boolean;
  /** Initial fallback value when no data is cached yet */
  initialData?: T;
}

export interface UseCachedQueryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  revalidate: () => Promise<T | undefined>;
}

/**
 * Lightweight Stale-While-Revalidate (SWR) hook with in-flight deduplication,
 * organization-scope isolation, and keepPreviousData support for smooth table filtering.
 */
export function useCachedQuery<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseCachedQueryOptions<T> = {}
): UseCachedQueryResult<T> {
  const {
    staleTimeMs = 30_000,
    keepPreviousData = true,
    initialData,
  } = options;

  const cached = key ? getCachedEntry<T>(key) : undefined;
  const [data, setData] = useState<T | undefined>(() => cached ? cached.data : initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const abortRef = useRef<AbortController | null>(null);

  const executeFetch = useCallback(
    async (targetKey: string, forceNetwork: boolean): Promise<T | undefined> => {
      const existing = getCachedEntry<T>(targetKey);
      if (existing) {
        setData(existing.data);
        const age = Date.now() - existing.updatedAt;
        if (!forceNetwork && age < staleTimeMs) {
          setError(null);
          return existing.data;
        }
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsValidating(true);
      setError(null);

      try {
        const fresh = await fetchWithCache<T>(targetKey, () =>
          fetcherRef.current(controller.signal)
        );
        if (!controller.signal.aborted) {
          setData(fresh);
        }
        return fresh;
      } catch (err: unknown) {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          return undefined;
        }
        const normalized = err instanceof Error ? err : new Error(String(err));
        setError(normalized);
        return undefined;
      } finally {
        if (abortRef.current === controller) {
          setIsValidating(false);
        }
      }
    },
    [staleTimeMs]
  );

  useEffect(() => {
    if (!key) {
      setIsValidating(false);
      return;
    }
    const existing = getCachedEntry<T>(key);
    if (existing) {
      setData(existing.data);
    } else if (!keepPreviousData) {
      setData(initialData);
    }
    void executeFetch(key, false);

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [key, keepPreviousData, initialData, executeFetch]);

  const revalidate = useCallback(async () => {
    if (!key) return undefined;
    return executeFetch(key, true);
  }, [key, executeFetch]);

  const hasData = data !== undefined;
  const isLoading = !hasData && isValidating;

  return {
    data,
    error,
    isLoading,
    isValidating,
    revalidate,
  };
}
