"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Central audio orchestrator for YatriKripya.
 *
 * It owns three independent playback concerns so that page.tsx only has to
 * reason about intent, not raw <audio> plumbing:
 *   1. `bg` — the always-on looping sleeper-car ambience.
 *   2. `stream` — a hidden, on-demand streaming track (lo-fi radio style).
 *   3. `sfx` — short one-shot environment sounds (chai vendor, horns, chain).
 *
 * Browsers block audio until a user gesture, so nothing autoplays on mount:
 * callers invoke `unlock()` from within a click/keydown handler, which then
 * lets the background loop begin. All elements are created imperatively and
 * torn down on unmount to avoid leaked media sessions.
 */
export interface AudioEngine {
  /** True once a user gesture has allowed playback to start. */
  unlocked: boolean;
  bgPlaying: boolean;
  bgVolume: number;
  streamPlaying: boolean;
  /** The URL currently loaded into the hidden stream element, if any. */
  streamSrc: string | null;
  unlock: () => void;
  toggleBg: () => void;
  setBgVolume: (v: number) => void;
  playStream: (src: string) => void;
  stopStream: () => void;
  playSfx: (src: string, opts?: { volume?: number; rate?: number }) => void;
}

const BG_LOOP_SRC = "/audio/loop-sleeper.wav";

export function useAudioEngine(): AudioEngine {
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<HTMLAudioElement | null>(null);
  // A small pool of reusable one-shot elements so rapid sfx taps don't stack
  // dozens of Audio objects.
  const sfxPoolRef = useRef<HTMLAudioElement[]>([]);
  const sfxCursorRef = useRef(0);

  const [unlocked, setUnlocked] = useState(false);
  const [bgPlaying, setBgPlaying] = useState(false);
  const [bgVolume, setBgVolumeState] = useState(0.6);
  const [streamPlaying, setStreamPlaying] = useState(false);
  const [streamSrc, setStreamSrc] = useState<string | null>(null);

  // Lazily construct the persistent elements once, on the client only.
  const ensureElements = useCallback(() => {
    if (typeof window === "undefined") return;

    if (!bgRef.current) {
      const bg = new Audio(BG_LOOP_SRC);
      bg.loop = true;
      bg.preload = "auto";
      bg.volume = bgVolume;
      bgRef.current = bg;
    }

    if (!streamRef.current) {
      const stream = new Audio();
      stream.loop = true;
      stream.preload = "none";
      stream.volume = 0.85;
      streamRef.current = stream;
    }

    if (sfxPoolRef.current.length === 0) {
      sfxPoolRef.current = Array.from({ length: 6 }, () => {
        const el = new Audio();
        el.preload = "auto";
        return el;
      });
    }
  }, [bgVolume]);

  const unlock = useCallback(() => {
    ensureElements();
    setUnlocked(true);
    // Begin the ambience on the same gesture that unlocked audio.
    const bg = bgRef.current;
    if (bg) {
      void bg
        .play()
        .then(() => setBgPlaying(true))
        .catch(() => setBgPlaying(false));
    }
  }, [ensureElements]);

  const toggleBg = useCallback(() => {
    const bg = bgRef.current;
    if (!bg) return;
    if (bg.paused) {
      void bg.play().then(() => setBgPlaying(true)).catch(() => {});
    } else {
      bg.pause();
      setBgPlaying(false);
    }
  }, []);

  const setBgVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setBgVolumeState(clamped);
    if (bgRef.current) bgRef.current.volume = clamped;
  }, []);

  const playStream = useCallback(
    (src: string) => {
      ensureElements();
      const stream = streamRef.current;
      if (!stream) return;
      if (streamSrc !== src) {
        stream.src = src;
        setStreamSrc(src);
      }
      void stream
        .play()
        .then(() => setStreamPlaying(true))
        .catch(() => setStreamPlaying(false));
    },
    [ensureElements, streamSrc],
  );

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.pause();
    stream.removeAttribute("src");
    try {
      stream.load();
    } catch {
      /* no-op: clearing an already-empty src can throw in some engines */
    }
    setStreamPlaying(false);
    setStreamSrc(null);
  }, []);

  const playSfx = useCallback(
    (src: string, opts?: { volume?: number; rate?: number }) => {
      ensureElements();
      const pool = sfxPoolRef.current;
      if (pool.length === 0) return;
      const el = pool[sfxCursorRef.current % pool.length];
      sfxCursorRef.current += 1;

      // Reset to a fresh one-shot regardless of prior playback state.
      el.pause();
      el.currentTime = 0;
      el.src = src;
      el.volume = Math.min(1, Math.max(0, opts?.volume ?? 0.9));
      el.playbackRate = opts?.rate ?? 1;
      void el.play().catch(() => {
        /* A missing/unsupported sfx file should never crash the UI. */
      });
    },
    [ensureElements],
  );

  // Tear down every media element on unmount to release the audio session.
  useEffect(() => {
    return () => {
      bgRef.current?.pause();
      streamRef.current?.pause();
      sfxPoolRef.current.forEach((el) => {
        el.pause();
        el.removeAttribute("src");
      });
      bgRef.current = null;
      streamRef.current = null;
      sfxPoolRef.current = [];
    };
  }, []);

  return {
    unlocked,
    bgPlaying,
    bgVolume,
    streamPlaying,
    streamSrc,
    unlock,
    toggleBg,
    setBgVolume,
    playStream,
    stopStream,
    playSfx,
  };
}
