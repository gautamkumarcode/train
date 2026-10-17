/**
 * dayCycle — a continuous, realistic time-of-day model for the exterior scene.
 *
 * Instead of only two hand-authored palettes, we interpolate a `dayness`
 * (0 = deep night, 1 = bright noon) between the night and day object palettes,
 * and sample a dedicated multi-stop SKY keyframe track so dawn, golden hour and
 * dusk read as warm, colourful skies rather than a flat night→day crossfade.
 *
 * Everything is a pure function of `hour` (0..24) so it is deterministic and
 * SSR-safe; the caller animates `hour` over time.
 */

import type { Mode, Theme, PondColors } from "./trainScene";

/* ------------------------------ color utils ------------------------------ */
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend two hex colors and return an rgb() string. */
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const k = clamp01(t);
  const r = Math.round(A[0] + (B[0] - A[0]) * k);
  const g = Math.round(A[1] + (B[1] - A[1]) * k);
  const bl = Math.round(A[2] + (B[2] - A[2]) * k);
  return `rgb(${r},${g},${bl})`;
}

/** Interpolate a value defined as piecewise-linear keyframes over 0..24 hours. */
function sampleTrack(
  track: { h: number; v: number }[],
  hour: number,
): number {
  const hh = ((hour % 24) + 24) % 24;
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (hh >= a.h && hh <= b.h) {
      const f = (hh - a.h) / (b.h - a.h || 1);
      return a.v + (b.v - a.v) * f;
    }
  }
  return track[0].v;
}

/* ----------------------------- object palette ---------------------------- */
type ScalarKey =
  | "far"
  | "far2"
  | "tree"
  | "pine"
  | "bld"
  | "win"
  | "near"
  | "bush"
  | "pole"
  | "bird"
  | "bus"
  | "car"
  | "auto";

const NIGHT: Record<ScalarKey, string> = {
  far: "#16223f",
  far2: "#14213c",
  tree: "#152a24",
  pine: "#12271e",
  bld: "#1a1f33",
  win: "#f5b301",
  near: "#0b1220",
  bush: "#0d1622",
  pole: "#0e1626",
  bird: "#2a3f63",
  bus: "#22344f",
  car: "#2a3a2c",
  auto: "#3a2f1a",
};

const DAY: Record<ScalarKey, string> = {
  far: "#a9c6b6",
  far2: "#8fb79f",
  tree: "#3f8f5a",
  pine: "#2f7a4a",
  bld: "#d8b48a",
  win: "#3a5a7a",
  near: "#3f5a44",
  bush: "#4f9a63",
  pole: "#5b6069",
  bird: "#40566b",
  bus: "#e0a92e",
  car: "#3f6ea0",
  auto: "#3aa14f",
};

// Ground gradient stops (top / mid / bottom) for each end of the dayness ramp.
const GROUND_NIGHT = ["#0c1728", "#0a1120", "#05070f"];
const GROUND_DAY = ["#8cc06a", "#5aa050", "#3f7a3a"];

const POND_NIGHT: PondColors = {
  water: "#1b3a5b",
  bank: "#0e1a2b",
  hi: "#2f5f8a",
  ripple: "#3a6f9e",
  lily: "#1f5a3a",
  reed: "#123024",
  lotus: "#e0607e",
};
const POND_DAY: PondColors = {
  water: "#3f8fd0",
  bank: "#6bbf6b",
  hi: "#bfe6fb",
  ripple: "#eaf7ff",
  lily: "#2f8f4a",
  reed: "#2f7a3a",
  lotus: "#f0a0c0",
};

/* --------------------------- sky keyframe track -------------------------- */
// Each stop is [zenith, mid, horizon]. Warm horizons at sunrise/sunset sell it.
const SKY: { h: number; stops: [string, string, string] }[] = [
  { h: 0, stops: ["#0b1430", "#0b1020", "#05070f"] }, // deep night
  { h: 5, stops: ["#0d1836", "#1c2340", "#3a2f45"] }, // pre-dawn
  { h: 6.5, stops: ["#3a4a7a", "#c76b4a", "#f4b06a"] }, // sunrise
  { h: 8, stops: ["#5b93cf", "#a9d3ef", "#e6f3fb"] }, // morning
  { h: 12, stops: ["#4a9fdd", "#8fcdf2", "#eef8ff"] }, // noon
  { h: 16, stops: ["#57a0dc", "#a6d6f0", "#eaf6ff"] }, // afternoon
  { h: 18, stops: ["#4d6aa8", "#e08a4e", "#f8c884"] }, // golden hour
  { h: 19.2, stops: ["#2c2f5e", "#a2495a", "#e8814f"] }, // sunset
  { h: 20.5, stops: ["#141a3c", "#2a2350", "#4a2f48"] }, // dusk
  { h: 22, stops: ["#0b1430", "#0b1020", "#05070f"] }, // night
  { h: 24, stops: ["#0b1430", "#0b1020", "#05070f"] }, // wrap
];

function sampleSky(hour: number): string {
  const hh = ((hour % 24) + 24) % 24;
  let a = SKY[0];
  let b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) {
    if (hh >= SKY[i].h && hh <= SKY[i + 1].h) {
      a = SKY[i];
      b = SKY[i + 1];
      break;
    }
  }
  const f = clamp01((hh - a.h) / (b.h - a.h || 1));
  const top = mix(a.stops[0], b.stops[0], f);
  const mid = mix(a.stops[1], b.stops[1], f);
  const bot = mix(a.stops[2], b.stops[2], f);
  return `linear-gradient(180deg, ${top} 0%, ${mid} 52%, ${bot} 100%)`;
}

/* ------------------------------ dayness curve ---------------------------- */
const DAYNESS: { h: number; v: number }[] = [
  { h: 0, v: 0 },
  { h: 5, v: 0 },
  { h: 6.5, v: 0.18 },
  { h: 8, v: 0.72 },
  { h: 10, v: 1 },
  { h: 16, v: 1 },
  { h: 18, v: 0.78 },
  { h: 19.2, v: 0.36 },
  { h: 20.5, v: 0.08 },
  { h: 22, v: 0 },
  { h: 24, v: 0 },
];

/* ------------------------------- sun / moon ------------------------------ */
export interface Body {
  visible: boolean;
  x: number; // 0..100 (% across the sky)
  y: number; // 0..100 (% from the top; smaller = higher)
  alt: number; // 0..1 altitude above the horizon
}

function arc(hour: number, rise: number, set: number): Body {
  const span = set - rise;
  const p = (hour - rise) / span;
  if (p < 0 || p > 1) return { visible: false, x: 50, y: 80, alt: 0 };
  const alt = Math.sin(p * Math.PI); // 0 at the horizon, 1 at the peak
  return { visible: true, x: 8 + p * 84, y: 70 - alt * 60, alt };
}
const NOBODY: Body = { visible: false, x: 50, y: 80, alt: 0 };

/** Sun + moon positions for an hour (shared by skyAt and the per-frame loop). */
function bodies(hh: number): { sun: Body; moon: Body } {
  const sun = arc(hh, 5.6, 19.4);
  const moon =
    hh >= 18.6
      ? arc(hh, 18.6, 30) // evening → past midnight
      : hh <= 6.4
        ? arc(hh + 24, 18.6, 30) // before dawn → late night
        : NOBODY;
  return { sun, moon };
}

const starOpacityOf = (dayness: number) =>
  clamp01((0.32 - dayness) / 0.28);

/**
 * Cheap per-frame sky data: only the gradient, star opacity and sun/moon
 * positions — no object-colour mixing. Used by the rAF driver so the sky can
 * animate at 60fps without re-rendering the (large) SVG scene.
 */
export function skyFrame(hour: number) {
  const hh = ((hour % 24) + 24) % 24;
  const dayness = clamp01(sampleTrack(DAYNESS, hh));
  const { sun, moon } = bodies(hh);
  const g0 = mix(GROUND_NIGHT[0], GROUND_DAY[0], dayness);
  const g1 = mix(GROUND_NIGHT[1], GROUND_DAY[1], dayness);
  const g2 = mix(GROUND_NIGHT[2], GROUND_DAY[2], dayness);
  return {
    sky: sampleSky(hh),
    ground: `linear-gradient(180deg, ${g0} 0%, ${g1} 55%, ${g2} 100%)`,
    starOpacity: starOpacityOf(dayness),
    sun,
    moon,
  };
}

export interface SkyState {
  theme: Theme;
  hour: number;
  dayness: number;
  night: boolean; // dark enough for lamps/headlamps
  starOpacity: number;
  sun: Body;
  moon: Body;
  mode: Mode; // back-compat for the window view
}

/** Full scene state for a given hour (0..24). */
export function skyAt(hour: number): SkyState {
  const hh = ((hour % 24) + 24) % 24;
  const dayness = clamp01(sampleTrack(DAYNESS, hh));

  const scalars = {} as Record<ScalarKey, string>;
  (Object.keys(NIGHT) as ScalarKey[]).forEach((k) => {
    scalars[k] = mix(NIGHT[k], DAY[k], dayness);
  });

  const g0 = mix(GROUND_NIGHT[0], GROUND_DAY[0], dayness);
  const g1 = mix(GROUND_NIGHT[1], GROUND_DAY[1], dayness);
  const g2 = mix(GROUND_NIGHT[2], GROUND_DAY[2], dayness);

  const pond = {} as PondColors;
  (Object.keys(POND_NIGHT) as (keyof PondColors)[]).forEach((k) => {
    pond[k] = mix(POND_NIGHT[k], POND_DAY[k], dayness);
  });

  const night = dayness < 0.5;
  const starOpacity = starOpacityOf(dayness);

  // Sun rides the day arc; moon rides the night arc (wrapping midnight).
  const { sun, moon } = bodies(hh);

  const theme: Theme = {
    sky: sampleSky(hh),
    ground: `linear-gradient(180deg, ${g0} 0%, ${g1} 55%, ${g2} 100%)`,
    ...scalars,
    stars: starOpacity > 0.02,
    sun: !night,
    pond,
  };

  return {
    theme,
    hour: hh,
    dayness,
    night,
    starOpacity,
    sun,
    moon,
    mode: night ? "night" : "day",
  };
}
