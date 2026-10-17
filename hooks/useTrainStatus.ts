"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TrainStatus } from "@/app/lib/train-status";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Client-side integration with the `/api/train-status` route.
 *
 * Responsibilities:
 *   - Debounce the raw text field so we don't spam the server per keystroke.
 *   - Only fire a request for a well-formed 5-digit number.
 *   - Track loading/error/success states and whether data came from live/mock.
 *   - Optionally poll on an interval to emulate a live tracking feed.
 *   - Cancel in-flight requests when the query changes or on unmount.
 */
export interface TrainStatusState {
  status: Status;
  data: TrainStatus | null;
  error: string | null;
  /** True when the current payload was produced by the server's mock fallback. */
  servedFromMock: boolean;
  /** Kick off a lookup for a specific number (bypasses debounce). */
  lookup: (trainNumber: string) => void;
  /** Re-fetch the last valid number on demand. */
  refresh: () => void;
}

export function useTrainStatus(
  query: string,
  { pollMs = 0 }: { pollMs?: number } = {},
): TrainStatusState {
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<TrainStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [servedFromMock, setServedFromMock] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastValidNumberRef = useRef<string | null>(null);

  const fetchStatus = useCallback(async (trainNumber: string) => {
    lastValidNumberRef.current = trainNumber;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(
        `/api/train-status?trainNumber=${encodeURIComponent(trainNumber)}`,
        { signal: controller.signal, headers: { accept: "application/json" } },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }

      const json: TrainStatus = await res.json();
      if (controller.signal.aborted) return;

      setData(json);
      setServedFromMock(Boolean(json.isMock));
      setStatus("success");
    } catch (err) {
      if (controller.signal.aborted) return; // expected on cancel
      setError(err instanceof Error ? err.message : "Failed to fetch status.");
      setStatus("error");
    }
  }, []);

  // Debounced fetch driven by the external `query` text.
  useEffect(() => {
    const trimmed = query.trim();
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!/^\d{5}$/.test(trimmed)) {
      // Not a valid number yet: keep any prior data but drop to idle so the UI
      // can show a "enter 5 digits" hint without an error state.
      setStatus((prev) => (prev === "loading" ? "loading" : "idle"));
      return;
    }

    timerRef.current = setTimeout(() => {
      void fetchStatus(trimmed);
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, fetchStatus]);

  // Optional live polling once we have a valid number and successful payload.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const valid = /^\d{5}$/.test(query.trim());
    if (pollMs > 0 && valid && status === "success") {
      pollRef.current = setInterval(() => {
        void fetchStatus(query.trim());
      }, pollMs);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollMs, query, status, fetchStatus]);

  // Abort any in-flight request when the component using the hook unmounts.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const lookup = useCallback(
    (trainNumber: string) => {
      if (/^\d{5}$/.test(trainNumber.trim())) {
        void fetchStatus(trainNumber.trim());
      }
    },
    [fetchStatus],
  );

  const refresh = useCallback(() => {
    if (lastValidNumberRef.current) void fetchStatus(lastValidNumberRef.current);
  }, [fetchStatus]);

  return { status, data, error, servedFromMock, lookup, refresh };
}
