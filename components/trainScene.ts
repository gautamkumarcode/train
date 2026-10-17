/**
 * Shared types for the train journey scene components.
 */

/** Time-of-day palette used by both the window and exterior scenes. */
export type Mode = "night" | "day";

/** Which way the journey is shown. */
export type SceneView = "window" | "outside";

/** Pond water/bank palette. */
export interface PondColors {
  water: string;
  bank: string;
  hi: string;
  ripple: string;
  lily: string;
  reed: string;
  lotus: string;
}

/** Full scene palette for a given moment of the day. */
export interface Theme {
  sky: string;
  ground: string;
  far: string;
  far2: string;
  tree: string;
  pine: string;
  bld: string;
  win: string;
  near: string;
  bush: string;
  pole: string;
  bird: string;
  bus: string;
  car: string;
  auto: string;
  stars: boolean;
  sun: boolean;
  pond: PondColors;
}
