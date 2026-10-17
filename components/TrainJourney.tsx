"use client";

import { useEffect, useRef, useState } from "react";
import TrainWindowView from "./TrainWindowView";
import TrainExterior from "./TrainExterior";
import type { Mode, SceneView } from "./trainScene";

/**
 * TrainJourney — the ambient journey scene with a switchable viewpoint.
 *
 * The user chooses *how* they watch the ride:
 *  - 🪟 Window seat — look out through the cabin window (TrainWindowView);
 *  - 🚂 Outside the train — watch the loco & coaches run past the world
 *    (TrainExterior).
 *
 * Time of day now runs on an automatic demo cycle (dawn → day → dusk → night)
 * driven by a continuous `hour`; the exterior scene interpolates its whole
 * palette from it. The old ☀/🌙 button is kept as a manual override: tap it to
 * pin Day or Night, and it reverts to the automatic cycle after a short idle.
 * The scene fills the viewport; the controls float as a translucent overlay at
 * the bottom so the header can sit over the top of the scene.
 */

const cls = (...v: (string | false | null | undefined)[]) =>
  v.filter(Boolean).join(" ");

// The 🪟 Window-seat view is temporarily hidden (to be implemented later).
// Flip this to true to bring the viewpoint switch back.
const SHOW_WINDOW_VIEW = false;

// One full day→night→day cycle over this many seconds (auto demo).
const CYCLE_SECONDS = 180;
// The heavy SVG scene only re-renders (for object palette) at this cadence; the
// sky/sun/moon/stars animate smoothly between steps via a shared live ref.
const COARSE_MS = 2000;
// A manually pinned phase reverts to the automatic cycle after this idle time.
const MANUAL_REVERT_MS = 45_000;

type CycleSel = "auto" | "day" | "night";

export default function TrainJourney({
  running = true,
}: {
  running?: boolean;
}) {
  const [view, setView] = useState<SceneView>(
    SHOW_WINDOW_VIEW ? "window" : "outside",
  );
  const [cycle, setCycle] = useState<CycleSel>("auto");
  // Continuous clock: a live ref (read every animation frame by the scene) plus
  // a coarse state that only ticks every COARSE_MS to re-render object colours.
  const hourRef = useRef(6);
  // Start at dawn so the first thing you see is a sunrise.
  const [hour, setHour] = useState(6);

  // Auto demo cycle: advance the clock smoothly; paused while a phase is pinned.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let since = COARSE_MS; // push a coarse update immediately on mount
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (cycle === "auto" && running) {
        hourRef.current =
          (hourRef.current + (24 / CYCLE_SECONDS) * dt) % 24;
      }
      since += dt * 1000;
      if (since >= COARSE_MS) {
        since = 0;
        setHour(hourRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cycle, running]);

  // Manual override: after a while of being pinned, fall back to auto.
  useEffect(() => {
    if (cycle === "auto") return;
    const id = setTimeout(() => setCycle("auto"), MANUAL_REVERT_MS);
    return () => clearTimeout(id);
  }, [cycle]);

  const cycleClick = () => {
    if (cycle === "auto") {
      hourRef.current = 13; // pin midday
      setHour(13);
      setCycle("day");
    } else if (cycle === "day") {
      hourRef.current = 1; // pin midnight
      setHour(1);
      setCycle("night");
    } else {
      setCycle("auto");
    }
  };

  // Coarse day/night for the (hidden) window view, which still expects a Mode.
  const derivedMode: Mode = hour >= 6 && hour < 19 ? "day" : "night";

  const label =
    cycle === "day"
      ? "☀ Day · pinned"
      : cycle === "night"
        ? "🌙 Night · pinned"
        : hour < 5 || hour >= 19.5
          ? "🌙 Night · auto"
          : hour < 7.5
            ? "🌅 Dawn · auto"
            : hour < 17.5
              ? "☀ Day · auto"
              : "🌇 Dusk · auto";

  return (
    <div className="relative z-0">
      {view === "window" ? (
        <TrainWindowView running={running} mode={derivedMode} />
      ) : (
        <TrainExterior running={running} hour={hour} hourRef={hourRef} />
      )}

      {/* Overlaid controls (bottom of the scene) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        {/* Viewpoint selector — hidden while the window seat is unimplemented */}
        {SHOW_WINDOW_VIEW && (
          <div className="pointer-events-auto inline-flex rounded-full border border-coach-cream/15 bg-black/45 p-1 backdrop-blur-sm">
            <ViewButton
              active={view === "window"}
              onClick={() => setView("window")}
              label="🪟 Window seat"
            />
            <ViewButton
              active={view === "outside"}
              onClick={() => setView("outside")}
              label="🚂 Outside"
            />
          </div>
        )}

        {/* Time of day: auto cycle, tap to pin a phase */}
        <button
          type="button"
          onClick={cycleClick}
          className="pointer-events-auto rounded-full border border-coach-cream/20 bg-black/45 px-3 py-1.5 font-board text-[10px] uppercase tracking-[0.2em] text-coach-cream/85 backdrop-blur-sm transition hover:bg-black/65"
          aria-label="Time of day: tap to pin day or night, tap again to resume the automatic cycle"
        >
          {label}
        </button>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cls(
        "rounded-full px-3 py-1 font-board text-[10px] uppercase tracking-[0.18em] transition",
        active
          ? "bg-signal-amber/90 text-berth-night"
          : "text-coach-cream/70 hover:text-coach-cream",
      )}
    >
      {label}
    </button>
  );
}
