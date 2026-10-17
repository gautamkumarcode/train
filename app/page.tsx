"use client";

import { useCallback, useMemo, useState } from "react";
import SfxGrid from "@/components/SfxGrid";
import TrainJourney from "@/components/TrainJourney";
import YouTubePlayer from "@/components/YouTubePlayer";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useTrainStatus } from "@/hooks/useTrainStatus";
import type { TrainStatusKind } from "@/app/lib/train-status";

/**
 * YatriKripya — the single interactive screen.
 *
 * State orchestration lives here and is deliberately centralized:
 *   - `engine` (useAudioEngine): looping sleeper ambience, hidden stream, sfx.
 *   - `trainNumber` text -> `useTrainStatus`: debounced live tracking via the
 *     `/api/train-status` route (with server-side mock fallback).
 *   - A boarding gate captures the first user gesture to satisfy autoplay rules,
 *     then the whole carriage comes alive.
 *
 * Everything is wired so these three concerns share one source of truth without
 * leaking audio/DOM details into the markup.
 */

// Hidden streaming tracks (lo-fi radio style). Swap for real/streamed sources.
const STREAM_STATIONS = [
  { id: "sleeper", label: "Night Sleeper Lo-Fi", src: "/audio/stream-sleeper.wav" },
  { id: "panoram", label: "Digha Panorama Beats", src: "/audio/stream-panoramix.wav" },
  { id: "general", label: "General Compartment Drone", src: "/audio/stream-general.wav" },
] as const;

// Feature flag: live train tracking is temporarily hidden (to be re-enabled
// later). Flip this to true to bring the TrackingPanel back.
const SHOW_TRAIN_TRACKING = false;

const STATUS_META: Record<
  TrainStatusKind,
  { label: string; dot: string; text: string; ring: string }
> = {
  ON_TIME: {
    label: "On Time",
    dot: "bg-signal-green",
    text: "text-signal-green",
    ring: "border-signal-green/40",
  },
  DELAYED: {
    label: "Delayed",
    dot: "bg-signal-amber",
    text: "text-signal-amber",
    ring: "border-signal-amber/40",
  },
  CANCELLED: {
    label: "Cancelled",
    dot: "bg-signal-red",
    text: "text-signal-red",
    ring: "border-signal-red/40",
  },
  UNKNOWN: {
    label: "No Signal",
    dot: "bg-coach-cream/40",
    text: "text-coach-cream/60",
    ring: "border-coach-cream/20",
  },
};

export default function YatriKripyaPage() {
  const engine = useAudioEngine();
  const [trainNumber, setTrainNumber] = useState("");
  const tracking = useTrainStatus(trainNumber, { pollMs: 60_000 });

  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);

  // Boarding gate: the click here is the user gesture that unlocks audio and
  // starts the looping ambience. After this the carriage is "live".
  const [boarded, setBoarded] = useState(false);
  const handleBoard = useCallback(() => {
    engine.unlock();
    setBoarded(true);
  }, [engine]);

  const toggleStream = useCallback(
    (id: string, src: string) => {
      if (activeStreamId === id && engine.streamPlaying) {
        engine.stopStream();
        setActiveStreamId(null);
      } else {
        engine.playStream(src);
        setActiveStreamId(id);
      }
    },
    [activeStreamId, engine],
  );

  const status = tracking.data;
  const statusMeta = useMemo(
    () => STATUS_META[status?.status ?? "UNKNOWN"],
    [status?.status],
  );

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-berth-night">
      {/* Full-frame journey scene (window / outside + its own bottom view &
          day-night chips). Fixed overlays never cause the page to scroll. */}
      <div className="absolute inset-0">
        <TrainJourney running={boarded} />
      </div>

      {/* Top HUD — all the sound controls as small chips, everything in one frame. */}
      <div
        aria-hidden={!boarded}
        className={
          boarded
            ? "absolute inset-x-0 top-0 z-40 flex flex-wrap items-center gap-1.5 p-2 transition-opacity duration-700 sm:gap-2 sm:p-3"
            : "pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-wrap items-center gap-1.5 p-2 opacity-30 blur-[2px] sm:gap-2 sm:p-3"
        }
      >
        {/* Sound chips: ambience + hidden streams + environment sfx */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-coach-cream/10 bg-black/50 px-2 py-1.5 backdrop-blur-sm">
          <AmbienceChips engine={engine} />
          <span className="mx-0.5 hidden h-5 w-px bg-coach-cream/15 sm:block" />
          <StreamChips
            engine={engine}
            activeStreamId={activeStreamId}
            onToggleStream={toggleStream}
          />
          <span className="mx-0.5 hidden h-5 w-px bg-coach-cream/15 sm:block" />
          <SfxGrid engine={engine} compact />
        </div>

        {/* YouTube song control (its mini video floats below, top-right) */}
        <div className="ml-auto">
          <YouTubePlayer />
        </div>
      </div>

      {!boarded && <BoardingGate onBoard={handleBoard} />}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Presentational sub-sections (kept in-file so the screen stays whole) */
/* ------------------------------------------------------------------ */

function Header({ bgPlaying }: { bgPlaying: boolean }) {
  return (
    <header className="relative z-30 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-signal-amber/40 bg-berth-deep font-board text-lg font-bold text-signal-amber glow-amber">
          Y
        </div>
        <div>
          <h1 className="font-board text-xl font-bold uppercase tracking-[0.2em] text-coach-cream">
            YatriKripya
          </h1>
          <p className="text-[11px] uppercase tracking-[0.25em] text-coach-cream/40">
            Live Train · Lo-Fi Carriage
          </p>
        </div>
      </div>

      {/* Equalizer bars reflect the looping background track. */}
      <div className="flex h-8 items-end gap-1" title={bgPlaying ? "Ambience on" : "Ambience off"}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-1.5 origin-bottom rounded-sm bg-signal-amber/70 ${
              bgPlaying ? "animate-eq-bar" : "scale-y-[0.2]"
            }`}
            style={{
              height: "100%",
              animationDelay: `${i * 0.12}s`,
              animationDuration: `${0.7 + (i % 3) * 0.15}s`,
            }}
          />
        ))}
      </div>
    </header>
  );
}

function BoardingGate({ onBoard }: { onBoard: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-berth-night/85 px-6 backdrop-blur-sm">
      <div className="led-panel max-w-md rounded-lg p-8 text-center">
        <p className="font-board text-xs uppercase tracking-[0.35em] text-signal-amber/80">
          Safar shuru karne ke liye
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold text-coach-cream">
          Board the Coach
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-coach-cream/60">
          Tap below to wake the sleeper-car ambience, enable the platform sounds,
          and start live tracking. (Browsers need this tap before audio can play.)
        </p>
        <button
          type="button"
          onClick={onBoard}
          className="mt-6 w-full rounded-md border border-signal-amber/60 bg-signal-amber/10 px-6 py-3 font-board text-sm font-bold uppercase tracking-[0.25em] text-signal-amber transition hover:bg-signal-amber/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber"
        >
          🚉 All Aboard
        </button>
      </div>
    </div>
  );
}

interface TrackingPanelProps {
  trainNumber: string;
  setTrainNumber: (v: string) => void;
  tracking: ReturnType<typeof useTrainStatus>;
  statusMeta: (typeof STATUS_META)[TrainStatusKind];
}

function TrackingPanel({ trainNumber, setTrainNumber, tracking, statusMeta }: TrackingPanelProps) {
  const { status, data, error, servedFromMock, refresh } = tracking;
  const isValid = /^\d{5}$/.test(trainNumber.trim());

  return (
    <section aria-label="Live train tracking" className="led-panel rounded-lg p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex-1">
          <span className="mb-1 block font-board text-[11px] uppercase tracking-[0.3em] text-coach-cream/50">
            Enter 5-digit train number
          </span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={trainNumber}
            maxLength={5}
            placeholder="e.g. 12951"
            onChange={(e) =>
              setTrainNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))
            }
            className="w-full rounded-md border border-coach-cream/20 bg-berth-night px-4 py-3 font-board text-2xl tracking-[0.4em] text-signal-amber placeholder:text-coach-cream/20 focus:border-signal-amber/60 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={refresh}
          disabled={!isValid || status === "loading"}
          className="rounded-md border border-coach-cream/20 px-4 py-3 font-board text-xs uppercase tracking-widest text-coach-cream/70 transition enabled:hover:border-signal-amber/50 enabled:hover:text-signal-amber disabled:opacity-30"
        >
          Refresh
        </button>
      </div>

      {status === "idle" && !data && (
        <p className="py-8 text-center text-sm text-coach-cream/40">
          Enter a train number to summon its live position…
        </p>
      )}

      {status === "loading" && !data && <BoardSkeleton />}

      {status === "error" && (
        <p className="py-6 text-center text-sm text-signal-red">{error}</p>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-xl font-bold text-coach-cream">
                {data.trainName}
              </h3>
              <p className="text-xs uppercase tracking-widest text-coach-cream/50">
                {data.sourceStation} → {data.destinationStation}
              </p>
            </div>
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1 ${statusMeta.ring}`}
            >
              <span className={`h-2 w-2 rounded-full ${statusMeta.dot} ${status === "loading" ? "animate-pulse" : ""}`} />
              <span className={`font-board text-xs uppercase tracking-widest ${statusMeta.text}`}>
                {statusMeta.label}
                {data.delayMinutes > 0 ? ` · +${data.delayMinutes}m` : ""}
              </span>
            </div>
          </div>

          {servedFromMock && (
            <p className="rounded border border-signal-amber/20 bg-signal-amber/5 px-3 py-1 text-[11px] uppercase tracking-widest text-signal-amber/70">
              Showing offline mock feed — live upstream unavailable
            </p>
          )}

          {data?.statusMessage && (
            <p className="rounded border border-signal-green/20 bg-signal-green/5 px-3 py-2 text-sm text-coach-cream/90">
              {data.statusMessage}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCell label="Last Report" value={data.lastReportedStation} />
            <StatCell
              label="Live Status"
              value={data.expectedArrival}
            />
            <StatCell
              label="Distance Left"
              value={data.distanceRemainingKm != null ? `${data.distanceRemainingKm} km` : "—"}
            />
            <StatCell
              label="Platform"
              value={data.platform != null ? `#${data.platform}` : "TBA"}
            />
          </div>

          {data.positionHint && (
            <p className="font-board text-xs uppercase tracking-[0.25em] text-coach-cream/50">
              📍 Your berth · {data.positionHint}
            </p>
          )}

          {data.stops.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-md border border-coach-cream/10">
              <table className="w-full text-left font-board text-xs">
                <thead className="bg-berth-deep text-coach-cream/50">
                  <tr>
                    <th className="px-3 py-2 font-normal uppercase tracking-widest">Station</th>
                    <th className="px-3 py-2 font-normal uppercase tracking-widest">Scheduled</th>
                    <th className="px-3 py-2 font-normal uppercase tracking-widest">Live</th>
                    <th className="px-3 py-2 font-normal uppercase tracking-widest">Delay</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stops.map((s, i) => {
                    const isHere =
                      !!data.currentStationCode && s.code === data.currentStationCode;
                    const sched = [s.scheduledArrival, s.scheduledDeparture]
                      .filter(Boolean)
                      .join(" → ");
                    const live = [s.currentArrival, s.currentDeparture]
                      .filter(Boolean)
                      .join(" → ");
                    return (
                      <tr
                        key={`${s.code}-${i}`}
                        className={
                          isHere
                            ? "border-t border-signal-amber/40 bg-signal-amber/10"
                            : "border-t border-coach-cream/5"
                        }
                      >
                        <td className="px-3 py-2 text-coach-cream/80">
                          <span className="flex items-center gap-2">
                            {s.name}{" "}
                            <span className="text-coach-cream/30">({s.code})</span>
                            {isHere && (
                              <span className="rounded-sm bg-signal-amber/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-signal-amber">
                                ● Here
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-coach-cream/45">{sched || "—"}</td>
                        <td
                          className={`px-3 py-2 font-bold ${
                            live ? "text-signal-green" : "text-coach-cream/30"
                          }`}
                        >
                          {live || "—"}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            s.delayMinutes != null && s.delayMinutes > 0
                              ? "text-signal-amber"
                              : s.delayMinutes != null && s.delayMinutes < 0
                                ? "text-signal-green"
                                : "text-coach-cream/40"
                          }`}
                        >
                          {s.delayMinutes == null
                            ? "—"
                            : s.delayMinutes === 0
                              ? "On time"
                              : s.delayMinutes > 0
                                ? `+${s.delayMinutes}m`
                                : `${s.delayMinutes}m`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-coach-cream/10 bg-berth-night px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-coach-cream/40">{label}</p>
      <p className="mt-1 truncate font-board text-sm font-bold text-coach-cream" title={value}>
        {value}
      </p>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-2">
      <div className="h-6 w-2/3 rounded bg-coach-cream/10" />
      <div className="h-4 w-1/3 rounded bg-coach-cream/5" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded bg-coach-cream/5" />
        ))}
      </div>
    </div>
  );
}

interface AmbiencePanelProps {
  engine: ReturnType<typeof useAudioEngine>;
  activeStreamId: string | null;
  onToggleStream: (id: string, src: string) => void;
}

function AmbiencePanel({ engine, activeStreamId, onToggleStream }: AmbiencePanelProps) {
  return (
    <section aria-label="Ambience and music" className="led-panel rounded-lg p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-signal-green" />
        <h2 className="font-board text-sm uppercase tracking-[0.35em] text-coach-cream/80">
          Cabin Sound
        </h2>
      </div>

      {/* Background loop controls */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={engine.toggleBg}
          className="flex items-center gap-2 rounded-md border border-signal-amber/40 bg-signal-amber/5 px-4 py-2 font-board text-xs uppercase tracking-widest text-signal-amber transition hover:bg-signal-amber/15"
        >
          {engine.bgPlaying ? "⏸ Pause ambience" : "▶ Play ambience"}
        </button>

        <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-coach-cream/50">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={engine.bgVolume}
            onChange={(e) => engine.setBgVolume(Number(e.target.value))}
            className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-coach-cream/20 accent-signal-amber"
            aria-label="Background ambience volume"
          />
        </label>
      </div>

      {/* Hidden streaming music playback selector */}
      <p className="mt-5 mb-2 font-board text-[11px] uppercase tracking-[0.3em] text-coach-cream/40">
        Hidden Streams · Lo-Fi Radio
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STREAM_STATIONS.map((st) => {
          const isActive = activeStreamId === st.id && engine.streamPlaying;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => onToggleStream(st.id, st.src)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                isActive
                  ? "border-signal-green/60 bg-signal-green/10 text-coach-cream"
                  : "border-coach-cream/15 bg-berth-night text-coach-cream/70 hover:border-signal-green/40"
              }`}
            >
              <span className="flex items-center gap-2">
                {isActive && (
                  <span className="flex items-end gap-0.5" aria-hidden>
                    {[0, 1, 2].map((b) => (
                      <span
                        key={b}
                        className="w-0.5 origin-bottom animate-eq-bar bg-signal-green"
                        style={{ height: 10, animationDelay: `${b * 0.15}s` }}
                      />
                    ))}
                  </span>
                )}
                {st.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* Compact top-HUD chips — ambience toggle + volume, as a single small pill. */
function AmbienceChips({ engine }: { engine: ReturnType<typeof useAudioEngine> }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={engine.toggleBg}
        className="flex items-center gap-1 rounded-full border border-signal-amber/40 bg-signal-amber/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-signal-amber transition hover:bg-signal-amber/15"
        aria-label={engine.bgPlaying ? "Pause ambience" : "Play ambience"}
      >
        {engine.bgPlaying ? "⏸" : "▶"}
        <span className="hidden sm:inline">Ambience</span>
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={engine.bgVolume}
        onChange={(e) => engine.setBgVolume(Number(e.target.value))}
        className="h-1 w-14 cursor-pointer appearance-none rounded-full bg-coach-cream/20 accent-signal-amber sm:w-16"
        aria-label="Background ambience volume"
      />
    </div>
  );
}

/* The hidden lo-fi streams as small toggle chips, with an equaliser blip when live. */
function StreamChips({
  engine,
  activeStreamId,
  onToggleStream,
}: {
  engine: ReturnType<typeof useAudioEngine>;
  activeStreamId: string | null;
  onToggleStream: (id: string, src: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {STREAM_STATIONS.map((st) => {
        const isActive = activeStreamId === st.id && engine.streamPlaying;
        const short = st.label.split(" ")[0];
        return (
          <button
            key={st.id}
            type="button"
            onClick={() => onToggleStream(st.id, st.src)}
            aria-pressed={isActive}
            title={st.label}
            className={[
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition",
              isActive
                ? "border-signal-green/60 bg-signal-green/10 text-coach-cream"
                : "border-coach-cream/15 bg-berth-night text-coach-cream/70 hover:border-signal-green/40",
            ].join(" ")}
          >
            {isActive ? (
              <span className="flex items-end gap-0.5" aria-hidden>
                {[0, 1, 2].map((b) => (
                  <span
                    key={b}
                    className="w-0.5 origin-bottom animate-eq-bar bg-signal-green"
                    style={{ height: 8, animationDelay: `${b * 0.15}s` }}
                  />
                ))}
              </span>
            ) : (
              <span aria-hidden>🎧</span>
            )}
            <span className="hidden sm:inline">{short}</span>
          </button>
        );
      })}
    </div>
  );
}
