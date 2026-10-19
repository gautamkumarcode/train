"use client";

import { useCallback, useState } from "react";
import type { AudioEngine } from "@/hooks/useAudioEngine";
import { SfxIcon } from "@/components/icons";

/**
 * Interactive environment sound board — the tactile "play with the carriage"
 * half of YatriKripya. Each tile fires a one-shot via the shared audio engine,
 * flashes for feedback, and (on the emergency chain) triggers the signature
 * haptic pull animation + device vibration where supported.
 *
 * SFX files are expected under /public/audio/sfx/*.wav. Missing files fail
 * silently (the engine swallows play() rejections) so the UI stays usable even
 * before the real recordings are dropped in.
 */

interface SfxTile {
  id: string;
  label: string;
  hint: string;
  src: string;
  /** Optional pitch jitter so repeat taps don't feel identical. */
  rate?: number;
  volume?: number;
  /** Optional hard trim (ms): stop a long recording early as a short blast. */
  trimMs?: number;
  /** Optional: skip the head and play only the last N ms (e.g. a tail horn). */
  keepLastMs?: number;
  /** Optional: seek to this many ms from the start before playing. */
  startMs?: number;
  kind: "ambient" | "chain";
}

const SFX_TILES: SfxTile[] = [
  {
    id: "chai",
    label: "Chai, Chai!",
    hint: "The platform vendor's sing-song call",
    src: "/audio/sfx/chai-chai.mp3",
    volume: 0.9,
    kind: "ambient",
  },
  {
    id: "horn",
    label: "Loco Horn",
    hint: "Long berth-corner warning blast",
    src: "/audio/sfx/horn-running.mp3",
    volume: 1,
    kind: "ambient",
  },
  {
    id: "whistle",
    label: "Guard's Whistle",
    hint: "All-aboard shriek before departure",
    src: "/audio/sfx/whistle.wav",
    rate: 1.05,
    volume: 0.85,
    kind: "ambient",
  },
  {
    id: "track",
    label: "Wheel Clack",
    hint: "Joint-by-joint sleeper rhythm",
    src: "/audio/sfx/wheel-clack.wav",
    rate: 0.95,
    volume: 0.8,
    kind: "ambient",
  },
  {
    id: "announcer",
    label: "Station Announce",
    hint: '"Kripaya pichli batayan gayi..."',
    src: "/audio/sfx/station-announce.mp3",
    volume: 0.95,
    kind: "ambient",
  },
  {
    id: "chain",
    label: "Emergency Chain",
    hint: "Pull to jolt the carriage",
    src: "/audio/sfx/chain-pull.wav",
    volume: 1,
    kind: "chain",
  },
];

export interface SfxGridProps {
  engine: AudioEngine;
  /** Render as tiny inline chips (for the single-frame top HUD) instead of the large grid. */
  compact?: boolean;
}

export default function SfxGrid({ engine, compact = false }: SfxGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chainJolt, setChainJolt] = useState(0);

  const trigger = useCallback(
    (tile: SfxTile) => {
      // Any tap is a valid user gesture — make sure ambience is unlocked too.
      if (!engine.unlocked) engine.unlock();

      engine.playSfx(tile.src, {
        volume: tile.volume,
        rate: tile.rate,
        trimMs: tile.trimMs,
        keepLastMs: tile.keepLastMs,
        startMs: tile.startMs,
      });

      setActiveId(tile.id);
      window.setTimeout(
        () => setActiveId((cur) => (cur === tile.id ? null : cur)),
        450,
      );

      if (tile.kind === "chain") {
        // Restart the CSS jolt by bumping a key and fire device haptics where
        // the platform supports the Vibration API.
        setChainJolt((n) => n + 1);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([30, 40, 90]);
          } catch {
            /* some browsers require transient activation; ignore failures */
          }
        }
      }
    },
    [engine],
  );

  if (compact) {
    // Small pill chips for the top HUD; icon always shown, label on wider
    // screens. Same trigger logic (unlock, flash, chain jolt + haptics).
    return (
      <div className="flex flex-wrap items-center gap-1">
        {SFX_TILES.map((tile) => {
          const isActive = activeId === tile.id;
          const isChain = tile.kind === "chain";
          const chip = (
            <button
              type="button"
              onClick={() => trigger(tile)}
              aria-pressed={isActive}
              data-on={isActive ? "true" : undefined}
              title={tile.hint}
              className={isChain ? "hud-chip hud-chip--red" : "hud-chip"}
            >
              <SfxIcon id={tile.id} className="ico" />
              <span className="hidden sm:inline">{tile.label}</span>
            </button>
          );
          return (
            <div
              key={isChain ? `chain-${chainJolt}` : tile.id}
              className={isChain && chainJolt > 0 ? "shake-haptic" : undefined}
            >
              {chip}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section aria-label="Environment sounds" className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-signal-amber" />
        <h2 className="font-board text-sm uppercase tracking-[0.35em] text-coach-cream/80">
          Coach Ambience
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SFX_TILES.map((tile) => {
          const isActive = activeId === tile.id;
          const isChain = tile.kind === "chain";

          // The chain tile wraps its inner button in a re-keyed container so
          // the shake animation replays on every pull.
          const inner = (
            <button
              type="button"
              onClick={() => trigger(tile)}
              aria-pressed={isActive}
              className={[
                "group relative flex h-full w-full flex-col items-start gap-2 rounded-md p-4 text-left",
                "border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber/70",
                isChain
                  ? "border-signal-red/50 bg-signal-red/10 hover:bg-signal-red/20"
                  : "border-coach-cream/15 bg-berth-deep hover:border-signal-amber/40 hover:bg-berth-steel",
                isActive ? "scale-[0.97] border-signal-amber/70" : "scale-100",
              ].join(" ")}
            >
              <span className="text-coach-cream/80" aria-hidden>
                <SfxIcon id={tile.id} className="h-6 w-6" />
              </span>
              <span className="font-board text-sm font-bold uppercase tracking-wider text-coach-cream glow-amber">
                {tile.label}
              </span>
              <span className="text-xs leading-snug text-coach-cream/50">
                {tile.hint}
              </span>

              {isChain && (
                <span className="pointer-events-none absolute right-3 top-3 text-[10px] font-bold uppercase tracking-widest text-signal-red/80">
                  Pull
                </span>
              )}
            </button>
          );

          return (
            <div
              key={isChain ? `chain-${chainJolt}` : tile.id}
              className={isChain && chainJolt > 0 ? "shake-haptic" : undefined}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
