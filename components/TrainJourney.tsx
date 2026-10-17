"use client";

import { useState } from "react";
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
 * Both share `running` (freeze when not boarded) and a day / night toggle.
 * The scene fills the viewport; the controls float as a translucent overlay
 * at the bottom so the header can sit over the top of the scene.
 */

const cls = (...v: (string | false | null | undefined)[]) =>
  v.filter(Boolean).join(" ");

// The 🪟 Window-seat view is temporarily hidden (to be implemented later).
// Flip this to true to bring the viewpoint switch back.
const SHOW_WINDOW_VIEW = false;

export default function TrainJourney({ running = true }: { running?: boolean }) {
  const [view, setView] = useState<SceneView>(SHOW_WINDOW_VIEW ? "window" : "outside");
  const [mode, setMode] = useState<Mode>("night");

  return (
    <div className="relative z-0">
      {view === "window" ? (
        <TrainWindowView running={running} mode={mode} />
      ) : (
        <TrainExterior running={running} mode={mode} />
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

        {/* Day / Night */}
        <button
          type="button"
          onClick={() => setMode((m) => (m === "night" ? "day" : "night"))}
          className="pointer-events-auto rounded-full border border-coach-cream/20 bg-black/45 px-3 py-1.5 font-board text-[10px] uppercase tracking-[0.2em] text-coach-cream/85 backdrop-blur-sm transition hover:bg-black/65"
          aria-label="Toggle day and night"
        >
          {mode === "night" ? "☀ Day" : "🌙 Night"}
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
