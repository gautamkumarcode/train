"use client";

import { type ReactNode } from "react";
import type { Mode } from "./trainScene";

/**
 * TrainWindowView — the photorealistic "seat by the window" view.
 *
 * You look OUT through an Indian Railways cabin window at the countryside
 * sliding past. Realism comes from depth, not cartoon shapes:
 *  - a time-of-day sky gradient with sun/moon bloom and drifting clouds;
 *  - far hills hazy, desaturated and blurred (atmospheric perspective);
 *  - a mid treeline with a small village (lit windows at night);
 *  - a green ground plane receding to the horizon;
 *  - fast, motion-blurred telegraph poles + sagging catenary wires whipping by;
 *  - a glass sheen, an inner vignette and a chunky window frame on top.
 *
 * Distant scenery drifts slowly, nearby scenery rushes past. All patterns are
 * laid out deterministically (seeded) so SSR matches the client. The parent
 * owns `mode` (day/night) and the view/day-night toggles.
 */

const cls = (...v: (string | false | null | undefined)[]) =>
  v.filter(Boolean).join(" ");

/** Deterministic pseudo-random in [0,1) from an integer seed. */
const dr = (i: number, salt = 1) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

interface Theme {
  sky: string;
  horizon: string;
  farA: string;
  farB: string;
  tree: string;
  treeDark: string;
  house: string;
  houseRoof: string;
  lit: boolean;
  ground: string;
  hedge: string;
  pole: string;
  starOpacity: number;
  cloudOpacity: number;
  vignette: number;
  sheen: number;
}

const THEMES: Record<Mode, Theme> = {
  night: {
    sky: "linear-gradient(180deg,#03050c 0%,#070f24 38%,#0e1c3a 62%,#182a4c 82%,#243a5e 100%)",
    horizon: "rgba(70,100,150,0.55)",
    farA: "#12213c",
    farB: "#0c1830",
    tree: "#0a1526",
    treeDark: "#060d1a",
    house: "#0a1424",
    houseRoof: "#0d1a2e",
    lit: true,
    ground: "linear-gradient(180deg,#0c1728 0%,#070f1c 45%,#03060d 100%)",
    hedge: "#050b16",
    pole: "rgba(4,8,15,0.92)",
    starOpacity: 0.9,
    cloudOpacity: 0.12,
    vignette: 0.62,
    sheen: 0.06,
  },
  day: {
    sky: "linear-gradient(180deg,#4a9fdd 0%,#79bfe9 34%,#a9d8f2 62%,#d6eefa 82%,#eef8ff 100%)",
    horizon: "rgba(220,240,255,0.9)",
    farA: "#a9c6b6",
    farB: "#8fb79f",
    tree: "#5f9a63",
    treeDark: "#3f7a48",
    house: "#d8b48a",
    houseRoof: "#b0563f",
    lit: false,
    ground: "linear-gradient(180deg,#8cc06a 0%,#6aa854 40%,#4f8f45 75%,#3f7a3a 100%)",
    hedge: "#356b34",
    pole: "rgba(30,34,30,0.82)",
    starOpacity: 0,
    cloudOpacity: 0.9,
    vignette: 0.34,
    sheen: 0.1,
  },
};

/* --------------------------- scenery tiles ----------------------------- */
function Hills({ t }: { t: Theme }) {
  return (
    <svg width={1600} height={150} viewBox="0 0 1600 150" className="block">
      <path
        d="M0 96 Q160 52 320 82 T640 74 T960 92 T1280 68 T1600 86 L1600 150 L0 150Z"
        fill={t.farA}
      />
      <path
        d="M0 122 Q200 88 420 112 T860 108 T1300 120 T1600 108 L1600 150 L0 150Z"
        fill={t.farB}
      />
    </svg>
  );
}

function TreeLine({ t }: { t: Theme }) {
  const items: ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    const x = i * 62 + dr(i, 2) * 20;
    const kind = dr(i, 3);
    const h = 34 + dr(i, 4) * 26;
    if (kind < 0.62) {
      items.push(
        <g key={i} fill={t.tree}>
          <rect x={x + 6} y={70 - h * 0.4} width={4} height={h * 0.5} />
          <ellipse cx={x + 8} cy={70 - h * 0.6} rx={12 + dr(i, 5) * 6} ry={h * 0.45} />
        </g>,
      );
    } else if (kind < 0.72) {
      items.push(
        <g key={i} stroke={t.tree} strokeWidth={3} fill="none" strokeLinecap="round">
          <path d={`M${x + 8} 74 q-3 -26 2 -40`} />
          <path
            d={`M${x + 10} 34 q-14 -6 -22 2 M${x + 10} 34 q14 -6 22 2 M${x + 10} 34 q-6 -14 -16 -16 M${x + 10} 34 q6 -14 16 -16`}
          />
        </g>,
      );
    } else {
      const w = 26 + dr(i, 6) * 12;
      items.push(
        <g key={i}>
          <rect x={x} y={70 - h * 0.5} width={w} height={h * 0.5} fill={t.house} />
          <polygon
            points={`${x - 3},${70 - h * 0.5} ${x + w / 2},${70 - h * 0.5 - 12} ${x + w + 3},${70 - h * 0.5}`}
            fill={t.houseRoof}
          />
          {t.lit && (
            <rect
              x={x + w / 2 - 3}
              y={70 - h * 0.4}
              width={6}
              height={6}
              fill="#ffcf6b"
              opacity={0.9}
            />
          )}
        </g>,
      );
    }
  }
  return (
    <svg width={1600} height={150} viewBox="0 0 1600 150" className="block">
      {items}
    </svg>
  );
}

function Poles({ t }: { t: Theme }) {
  const step = 200;
  const poles: ReactNode[] = [];
  for (let i = 0; i <= 1600 / step; i++) {
    const x = i * step;
    poles.push(
      <g key={i} fill={t.pole}>
        <rect x={x} y={10} width={5} height={140} />
        <rect x={x - 11} y={22} width={27} height={3} />
        <rect x={x - 8} y={34} width={21} height={3} />
        <rect x={x - 9} y={18} width={3} height={6} />
        <rect x={x + 7} y={18} width={3} height={6} />
      </g>,
    );
  }
  const wire = (yy: number) => {
    let d = `M0 ${yy}`;
    for (let i = 0; i < 1600 / step; i++) {
      const x0 = i * step;
      d += ` Q${x0 + step / 2} ${yy + 14} ${x0 + step} ${yy}`;
    }
    return d;
  };
  return (
    <svg width={1600} height={150} viewBox="0 0 1600 150" className="block">
      <path d={wire(20)} stroke={t.pole} strokeWidth={1.4} fill="none" opacity={0.8} />
      <path d={wire(32)} stroke={t.pole} strokeWidth={1.2} fill="none" opacity={0.7} />
      {poles}
    </svg>
  );
}

/* ----------------------------- scroll band ----------------------------- */
function Band({
  running,
  duration,
  bottom,
  height,
  blur = 0,
  opacity = 1,
  children,
}: {
  running: boolean;
  duration: number;
  bottom: string;
  height: number;
  blur?: number;
  opacity?: number;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-x-0 overflow-hidden"
      style={{
        bottom,
        height,
        filter: blur ? `blur(${blur}px)` : undefined,
        opacity,
      }}
    >
      <div
        className={cls("flex w-max items-end", running && "animate-scroll-x")}
        style={{ animationDuration: `${duration}s` }}
      >
        <div className="flex shrink-0 items-end">{children}</div>
        <div className="flex shrink-0 items-end" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- scene --------------------------------- */
export default function TrainWindowView({
  running = true,
  mode = "night",
}: {
  running?: boolean;
  mode?: Mode;
}) {
  const t = THEMES[mode];

  return (
    <section
      aria-label="View from the train window"
      className="relative rounded-2xl bg-gradient-to-b from-[#2b303b] to-[#0f1219] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_-12px_rgba(0,0,0,0.8)]"
    >
      {/* Glass */}
      <div className="relative h-[70vh] w-full overflow-hidden rounded-xl ring-1 ring-black/70">
        <div
          className="absolute inset-0 transition-[background] duration-700"
          style={{ background: t.sky }}
        />

        {t.starOpacity > 0 && (
          <div
            className="absolute inset-x-0 top-0 h-2/3"
            style={{
              opacity: t.starOpacity,
              backgroundImage:
                "radial-gradient(1.4px 1.4px at 30px 20px, #fff, transparent), radial-gradient(1.2px 1.2px at 120px 46px, #dfe8ff, transparent), radial-gradient(1.6px 1.6px at 220px 14px, #fff, transparent), radial-gradient(1px 1px at 320px 60px, #cdd8ff, transparent), radial-gradient(1.3px 1.3px at 420px 30px, #fff, transparent)",
              backgroundRepeat: "repeat",
              backgroundSize: "480px 100%",
            }}
          />
        )}

        <div
          className="absolute right-[16%] top-6 h-11 w-11 rounded-full"
          style={
            mode === "day"
              ? {
                  background:
                    "radial-gradient(circle at 50% 50%, #fff7d6 0%, #ffe27a 45%, rgba(255,226,122,0) 72%)",
                  boxShadow: "0 0 70px 30px rgba(255,236,150,0.6)",
                }
              : {
                  background:
                    "radial-gradient(circle at 38% 38%, #f4f1e6 0%, #d9d4c3 55%, #b9b4a3 100%)",
                  boxShadow: "0 0 34px 10px rgba(220,228,255,0.35)",
                }
          }
        />

        <div className="absolute inset-x-0 top-4 h-24" style={{ opacity: t.cloudOpacity }}>
          <Band running={running} duration={150} bottom="40px" height={40}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ marginRight: 220 + dr(i, 9) * 160 }}>
                <div
                  className="h-7 rounded-full bg-white blur-[6px]"
                  style={{ width: 90 + dr(i, 8) * 80, opacity: 0.9 }}
                />
              </div>
            ))}
          </Band>
        </div>

        <div
          className="absolute inset-x-0"
          style={{
            bottom: "42%",
            height: "18%",
            background: `linear-gradient(180deg, transparent, ${t.horizon})`,
          }}
        />

        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: "52%", background: t.ground }}
        />

        <Band
          running={running}
          duration={140}
          bottom="46%"
          height={150}
          blur={2.4}
          opacity={0.85}
        >
          <Hills t={t} />
        </Band>

        <Band running={running} duration={54} bottom="40%" height={150} blur={0.7}>
          <TreeLine t={t} />
        </Band>

        <Band running={running} duration={16} bottom="26%" height={70} blur={2}>
          <svg width={1600} height={70} viewBox="0 0 1600 70" className="block">
            {Array.from({ length: 40 }).map((_, i) => (
              <ellipse
                key={i}
                cx={i * 40 + 20}
                cy={54}
                rx={26 + dr(i, 11) * 10}
                ry={20 + dr(i, 12) * 10}
                fill={t.hedge}
              />
            ))}
          </svg>
        </Band>

        <Band running={running} duration={5} bottom="8%" height={150} blur={3.2}>
          <Poles t={t} />
        </Band>

        <div
          className={cls(
            "absolute inset-x-0 bottom-0 h-[26px] opacity-80",
            running && "animate-rail-scroll",
          )}
          style={{
            filter: "blur(4px)",
            backgroundImage: `repeating-linear-gradient(90deg, ${t.hedge} 0 10px, transparent 10px 34px)`,
            backgroundRepeat: "repeat-x",
          }}
        />

        {/* Glass sheen + reflection + vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(115deg, rgba(255,255,255,${t.sheen}) 0%, rgba(255,255,255,${t.sheen * 0.3}) 16%, transparent 34%, transparent 66%, rgba(255,255,255,${t.sheen * 0.5}) 90%, transparent 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 50% 120%, rgba(0,0,0,${t.vignette * 0.5}) 0%, transparent 55%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: `inset 0 0 70px 22px rgba(0,0,0,${t.vignette})` }}
        />
      </div>
    </section>
  );
}
