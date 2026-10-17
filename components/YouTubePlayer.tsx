"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

/**
 * YouTubePlayer — plays a pasted YouTube track/song non-stop via the official
 * YouTube IFrame Player API (no API key, ToS-compliant: we embed YouTube's own
 * player rather than ripping audio).
 *
 * Notes:
 *  - Browsers require a user gesture before audio can start, so playback begins
 *    from the "Play" button click (loadVideoById autoplays inside that gesture).
 *  - "Non-stop" is achieved by restarting on the ENDED state; live streams run
 *    continuously on their own.
 *  - The player element is created imperatively and mounted into a stable
 *    React-owned wrapper (the API replaces the inner node, so we hand it a
 *    throwaway child to avoid clobbering React's DOM).
 */

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";
let apiPromise: Promise<any> | null = null;

function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = API_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return apiPromise;
}

/** Accepts a raw 11-char ID or any common YouTube URL form. */
export function parseYouTubeId(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
  try {
    const u = new URL(v.startsWith("http") ? v : `https://${v}`);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1, 12);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    const q = u.searchParams.get("v");
    if (q && /^[a-zA-Z0-9_-]{11}$/.test(q)) return q;
    const m = u.pathname.match(/\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch {
    /* not a URL — fall through */
  }
  const m = v.match(/(?:v=|be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

interface YouTubePlayerProps {
  /** Optional default video ID/URL to prefill (still needs a click to start). */
  defaultUrl?: string;
}

export default function YouTubePlayer({ defaultUrl = "" }: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const pendingIdRef = useRef<string | null>(null);

  const [url, setUrl] = useState(defaultUrl);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [title, setTitle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  // The floating top-right player stays hidden until a valid link is entered.
  const [hasLink, setHasLink] = useState(false);

  // Instantiate the player once, into a throwaway child of the stable wrapper.
  useEffect(() => {
    let cancelled = false;
    const mount = document.createElement("div");
    hostRef.current?.appendChild(mount);

    loadYouTubeApi().then((YT) => {
      if (cancelled || !YT || playerRef.current) return;
      playerRef.current = new YT.Player(mount, {
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            setReady(true);
            try {
              playerRef.current?.setVolume(volume);
            } catch {
              /* ignore */
            }
            if (pendingIdRef.current) {
              playerRef.current?.loadVideoById(pendingIdRef.current);
              pendingIdRef.current = null;
            }
          },
          onStateChange: (e: any) => {
            const S = window.YT?.PlayerState;
            if (e.data === S?.PLAYING) {
              setPlaying(true);
              setError(null);
              try {
                setTitle(playerRef.current?.getVideoData?.()?.title ?? "");
              } catch {
                /* ignore */
              }
            } else if (e.data === S?.PAUSED) {
              setPlaying(false);
            } else if (e.data === S?.ENDED) {
              // Non-stop: rewind and replay the same track.
              e.target?.seekTo(0, true);
              e.target?.playVideo();
            }
          },
          onError: (e: any) => {
            setPlaying(false);
            const code = e?.data;
            setError(
              code === 101 || code === 150
                ? "This video blocks embedding. Try another link."
                : code === 100
                  ? "Video not found — check the link."
                  : `Playback error (code ${code}).`,
            );
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAndPlay = useCallback(
    (raw: string) => {
      const id = parseYouTubeId(raw);
      if (!id) {
        setError("Couldn't read a YouTube link or ID from that.");
        return;
      }
      setError(null);
      setHasLink(true); // reveal the corner player once a valid link is loaded
      const p = playerRef.current;
      if (!p || !ready) {
        pendingIdRef.current = id;
        // If the API is already up but our ready flag raced, try directly.
        loadYouTubeApi().then(() => {
          if (playerRef.current && pendingIdRef.current) {
            playerRef.current.loadVideoById(pendingIdRef.current);
            pendingIdRef.current = null;
          }
        });
        return;
      }
      p.loadVideoById(id); // loadVideoById autoplays (inside the click gesture)
    },
    [ready],
  );

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      loadAndPlay(url);
    },
    [url, loadAndPlay],
  );

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }, [playing]);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  }, [muted]);

  const onVolume = useCallback((v: number) => {
    setVolume(v);
    try {
      playerRef.current?.setVolume(v);
      if (v > 0 && playerRef.current?.isMuted?.()) {
        playerRef.current?.unMute();
        setMuted(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <>
      {/* Floating mini video player, docked just below the top bar (top-right),
          kept always mounted so the single YouTube instance survives, and hidden
          until a valid link is entered. */}
      <div
        className={`fixed right-2 top-14 z-50 w-[168px] max-w-[46vw] sm:w-[210px] ${
          hasLink ? "" : "hidden"
        }`}
      >
        <div className="overflow-hidden rounded-lg border border-coach-cream/20 bg-black shadow-2xl shadow-black/60">
          <div className="relative aspect-video w-full">
            <div ref={hostRef} className="absolute inset-0" />
            {!playing && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 px-2 text-center text-[9px] uppercase tracking-widest text-coach-cream/40">
                ▶ loading…
              </div>
            )}
          </div>
        </div>
        <p
          className="mt-1 truncate text-center text-[10px] text-coach-cream/50"
          title={title}
        >
          {playing ? title || "Now playing…" : "YouTube Jukebox"}
        </p>
      </div>

      {/* Compact song controls, meant to dock at the right end of the top HUD. */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-coach-cream/10 bg-black/50 px-2 py-1.5 backdrop-blur-sm">
        <span aria-hidden className="text-[11px]">
          🎵
        </span>
        <form onSubmit={onSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube link…"
            className="w-28 rounded-md border border-coach-cream/20 bg-berth-night px-2 py-1 text-xs text-coach-cream placeholder:text-coach-cream/25 focus:border-signal-amber/60 focus:outline-none sm:w-44"
            aria-label="YouTube link or video ID"
          />
          <button
            type="submit"
            className="rounded-md border border-signal-amber/60 bg-signal-amber/10 px-2.5 py-1 font-board text-[10px] font-bold uppercase tracking-widest text-signal-amber transition hover:bg-signal-amber/20"
          >
            ▶ Play
          </button>
        </form>

        {hasLink && (
          <>
            <button
              type="button"
              onClick={togglePlay}
              disabled={!ready}
              aria-label={playing ? "Pause" : "Play"}
              className="rounded-full border border-coach-cream/20 px-2 py-1 text-[11px] text-coach-cream/80 transition enabled:hover:border-signal-amber/50 disabled:opacity-30"
            >
              {playing ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              disabled={!ready}
              aria-label={muted ? "Unmute" : "Mute"}
              className="rounded-full border border-coach-cream/20 px-2 py-1 text-[11px] text-coach-cream/80 transition enabled:hover:border-signal-amber/50 disabled:opacity-30"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => onVolume(Number(e.target.value))}
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-coach-cream/20 accent-signal-amber"
              aria-label="YouTube volume"
            />
          </>
        )}

        {error && <span className="text-[10px] text-signal-red">{error}</span>}
      </div>
    </>
  );
}
