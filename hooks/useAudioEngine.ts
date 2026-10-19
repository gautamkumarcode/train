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
  playSfx: (
    src: string,
    opts?: {
      volume?: number;
      rate?: number;
      trimMs?: number;
      keepLastMs?: number;
      startMs?: number;
    },
  ) => void;
  /** Start/restart a named looping bed (one element per id): platform hum, a
   *  chai-wala call, etc. `loop=false` plays it once but still stoppable by id. */
  setLoop: (
    id: string,
    src: string,
    opts?: { volume?: number; rate?: number; loop?: boolean },
  ) => void;
  /** Pause a named looping bed by id. */
  stopLoop: (id: string) => void;
}

const BG_LOOP_SRC = "/audio/loop-sleeper.wav";

export function useAudioEngine(): AudioEngine {
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<HTMLAudioElement | null>(null);
  // A small pool of reusable one-shot elements so rapid sfx taps don't stack
  // dozens of Audio objects.
  const sfxPoolRef = useRef<HTMLAudioElement[]>([]);
  const sfxCursorRef = useRef(0);
  // Monotonic token so a scheduled fade/stop from an earlier one-shot can't
  // silence a newer sound that reused the same pooled element.
  const sfxGenRef = useRef(0);
  // Flips true the first time the ambience actually starts playing. The gesture
  // self-heal only runs until then — so a deliberate "Pause ambience" after
  // playback has begun is never auto-resumed by the retry listener.
  const bgStartedOnceRef = useRef(false);
  // Named looping beds (platform ambience, chai vendor). One <audio> per id.
  const loopsRef = useRef<Record<string, HTMLAudioElement>>({});

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

  // Attempt to start the looping ambience. A browser that hasn't seen a user
  // gesture yet REJECTS play(); we don't swallow that silently — we flip
  // bgPlaying false and let the gesture-retry effect (below) try again on the
  // next tap/keypress, which is what causes "total silence" if we only try once.
  const startBg = useCallback(() => {
    const bg = bgRef.current;
    if (!bg) return;
    const p = bg.play();
    if (p && typeof p.then === "function") {
      p
        .then(() => {
          bgStartedOnceRef.current = true;
          setBgPlaying(true);
        })
        .catch(() => setBgPlaying(false));
    } else {
      bgStartedOnceRef.current = true;
      setBgPlaying(true);
    }
  }, []);

  const unlock = useCallback(() => {
    ensureElements();
    setUnlocked(true);
    // Begin the ambience on the same gesture that unlocked audio.
    startBg();
  }, [ensureElements, startBg]);

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
    (
      src: string,
      opts?: {
        volume?: number;
        rate?: number;
        trimMs?: number;
        keepLastMs?: number;
        startMs?: number;
      },
    ) => {
      ensureElements();
      const pool = sfxPoolRef.current;
      if (pool.length === 0) return;
      const el = pool[sfxCursorRef.current % pool.length];
      sfxCursorRef.current += 1;
      const tagged = el as HTMLAudioElement & { __sfxGen?: number };

      // Reset to a fresh one-shot regardless of prior playback state.
      el.pause();
      el.currentTime = 0;
      el.src = src;
      const baseVol = Math.min(1, Math.max(0, opts?.volume ?? 0.9));
      el.volume = baseVol;
      el.playbackRate = opts?.rate ?? 1;
      const gen = ++sfxGenRef.current;
      tagged.__sfxGen = gen;

      const trim = opts?.trimMs;
      const keepLast = opts?.keepLastMs;
      const startMs = opts?.startMs;

      // Optional hard trim: fade out and stop `trimMs` after playback begins.
      const scheduleTrim = () => {
        if (!trim || trim <= 0) return;
        const fade = Math.min(150, Math.max(40, trim / 3)); // fade-out window
        window.setTimeout(() => {
          if (tagged.__sfxGen !== gen) return; // element reused since
          const t0 = performance.now();
          const step = () => {
            if (tagged.__sfxGen !== gen) return;
            const p = Math.min(1, (performance.now() - t0) / fade);
            el.volume = baseVol * (1 - p);
            if (p < 1) {
              requestAnimationFrame(step);
            } else {
              el.pause();
              try {
                el.currentTime = 0;
              } catch {
                /* ignore */
              }
              el.volume = baseVol;
            }
          };
          step();
        }, Math.max(0, trim - fade));
      };

      // Begin playback. `keepLastMs` plays only the tail; `startMs` skips a
      // quiet/low lead-in so a trimmed horn starts on the real blast. Both seek,
      // so wait for metadata when it isn't loaded yet.
      const begin = () => {
        if (tagged.__sfxGen !== gen) return;
        if (keepLast && keepLast > 0) {
          const dur = el.duration;
          if (isFinite(dur) && dur > 0) {
            try {
              el.currentTime = Math.max(0, dur - keepLast / 1000);
            } catch {
              /* seeking before it's ready: fall back to playing from 0 */
            }
          }
        } else if (startMs && startMs > 0) {
          try {
            el.currentTime = startMs / 1000;
          } catch {
            /* ignore seek-before-ready */
          }
        }
        void el.play().catch(() => {
          /* A missing/unsupported sfx file should never crash the UI. */
        });
        scheduleTrim();
      };

      // HAVE_METADATA (readyState >= 1) means duration is already known.
      const wantsSeek =
        (keepLast && keepLast > 0) || (startMs && startMs > 0);
      if (wantsSeek && el.readyState < 1) {
        el.addEventListener("loadedmetadata", begin, { once: true });
      } else {
        begin();
      }
    },
    [ensureElements],
  );

  // Named looping beds. Each `id` owns one reusable <audio>; calling setLoop
  // (re)starts it from 0. Used for the stopped-at-platform ambience, the
  // one-shot station announcement, and the looping chai-wala call.
  const setLoop = useCallback(
    (
      id: string,
      src: string,
      opts?: { volume?: number; rate?: number; loop?: boolean },
    ) => {
      const map = loopsRef.current;
      let el = map[id];
      if (!el) {
        el = new Audio();
        el.preload = "auto";
        map[id] = el;
      }
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        /* ignore seek-before-ready */
      }
      el.src = src;
      el.loop = opts?.loop ?? true;
      el.volume = Math.min(1, Math.max(0, opts?.volume ?? 0.8));
      el.playbackRate = opts?.rate ?? 1;
      void el.play().catch(() => {
        /* blocked/missing: bgPlaying self-heal still drives user-facing audio */
      });
    },
    [],
  );

  const stopLoop = useCallback((id: string) => {
    const el = loopsRef.current[id];
    if (el) el.pause();
  }, []);

  // Self-heal autoplay: while the ambience isn't actually playing (a rejected
  // play() at boarding), retry on the very next user gesture. Without this a
  // single blocked first attempt would stay silent for the whole session.
  useEffect(() => {
    if (bgPlaying || bgStartedOnceRef.current) return;
    const retry = () => startBg();
    window.addEventListener("pointerdown", retry);
    window.addEventListener("keydown", retry);
    window.addEventListener("touchstart", retry, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      window.removeEventListener("touchstart", retry);
    };
  }, [bgPlaying, startBg]);

  // Tear down every media element on unmount to release the audio session.
  useEffect(() => {
    return () => {
      bgRef.current?.pause();
      streamRef.current?.pause();
      sfxPoolRef.current.forEach((el) => {
        el.pause();
        el.removeAttribute("src");
      });
      Object.values(loopsRef.current).forEach((el) => {
        el.pause();
        el.removeAttribute("src");
      });
      loopsRef.current = {};
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
    setLoop,
    stopLoop,
  };
}
