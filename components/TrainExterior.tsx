"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Theme, PondColors } from "./trainScene";
import { skyAt, skyFrame } from "./dayCycle";

/**
 * TrainExterior — the "outside the train" diorama: a red locomotive pulling
 * blue ICF coaches runs along the track while a living Indian countryside
 * scrolls past behind it in depth-graded parallax layers (hills & jungle, a
 * field with trees/houses/huts/ponds, a road with buses/cars/autos/cyclists,
 * and a near trackside strip of poles, bushes, animals and passengers).
 *
 * Realism touches from the earlier pass are kept: a ground plane filling to
 * the horizon, contact shadows under objects, atmospheric blur on the far
 * layer, correct scale (small animals), foreground grass and a centred sun.
 * Layout is deterministic (seeded) so SSR matches the client; `running=false`
 * freezes the wheels, steam and every scrolling layer.
 */

const cls = (...v: (string | false | null | undefined)[]) =>
  v.filter(Boolean).join(" ");

const dr = (i: number, salt = 1) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* Theme + PondColors types live in ./trainScene; palettes are generated per
   hour by ./dayCycle (skyAt) — see the component below. */

/* --------------------------- svg primitives ---------------------------- */
function Svg({
  w,
  h,
  vb,
  s = 1,
  children,
}: {
  w: number;
  h: number;
  vb?: string;
  s?: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={w * s}
      height={h * s}
      viewBox={vb ?? `0 0 ${w} ${h}`}
      className="block"
      style={{ overflow: "visible" }}
    >
      {children}
    </svg>
  );
}

const Tree = ({ c }: { c: string }) => (
  <Svg w={40} h={70}>
    <rect x={18} y={40} width={4} height={30} fill={c} />
    <circle cx={20} cy={28} r={15} fill={c} />
    <circle cx={11} cy={37} r={10} fill={c} />
    <circle cx={29} cy={37} r={10} fill={c} />
  </Svg>
);
const Pine = ({ c }: { c: string }) => (
  <Svg w={34} h={72}>
    <rect x={15} y={58} width={4} height={14} fill={c} />
    <polygon points="17,2 30,34 4,34" fill={c} />
    <polygon points="17,20 32,54 2,54" fill={c} />
  </Svg>
);
const Palm = ({ c }: { c: string }) => (
  <Svg w={46} h={82}>
    <path d="M23 82 q-5 -34 2 -50" stroke={c} strokeWidth={4} fill="none" />
    <path
      d="M25 32 q-16 -8 -24 2 M25 32 q16 -8 24 2 M25 32 q-8 -18 -20 -20 M25 32 q8 -18 20 -20 M25 32 q0 -20 0 -24"
      stroke={c}
      strokeWidth={4}
      fill="none"
      strokeLinecap="round"
    />
  </Svg>
);
const Bush = ({ c }: { c: string }) => (
  <Svg w={40} h={24}>
    <circle cx={11} cy={16} r={9} fill={c} />
    <circle cx={23} cy={13} r={11} fill={c} />
    <circle cx={33} cy={17} r={8} fill={c} />
  </Svg>
);
const House = ({ c, win }: { c: string; win: string }) => (
  <Svg w={70} h={64}>
    <rect x={10} y={30} width={50} height={34} fill={c} />
    <polygon points="6,32 35,8 64,32" fill={c} />
    <rect x={29} y={44} width={12} height={20} fill="#05070f" opacity={0.7} />
    <rect x={16} y={38} width={8} height={8} fill={win} opacity={0.9} />
    <rect x={46} y={38} width={8} height={8} fill={win} opacity={0.7} />
  </Svg>
);
const Hut = ({ c }: { c: string }) => (
  <Svg w={54} h={50}>
    <rect x={13} y={26} width={28} height={24} fill={c} />
    <polygon points="4,28 27,6 50,28" fill={c} opacity={0.92} />
    <rect x={22} y={34} width={10} height={16} fill="#05070f" opacity={0.7} />
  </Svg>
);
// A two-up village home with a lit window and a doorway.
const Building = ({ c, win }: { c: string; win: string }) => (
  <Svg w={64} h={92}>
    <rect x={12} y={16} width={40} height={76} fill={c} />
    <rect x={12} y={16} width={40} height={6} fill="#05070f" opacity={0.25} />
    {Array.from({ length: 6 }).map((_, k) => {
      const col = k % 2;
      const row = Math.floor(k / 2);
      return (
        <rect
          key={k}
          x={18 + col * 20}
          y={28 + row * 18}
          width={12}
          height={12}
          fill={win}
          opacity={0.9}
        />
      );
    })}
    <rect x={26} y={80} width={12} height={12} fill="#05070f" opacity={0.7} />
  </Svg>
);
// A small roadside temple with a shikhara spire and kalash finial.
const Temple = ({ c, win }: { c: string; win: string }) => (
  <Svg w={54} h={74}>
    <rect x={14} y={44} width={26} height={30} fill={c} />
    <polygon points="27,10 40,44 14,44" fill={c} />
    <rect x={25} y={2} width={4} height={10} fill={win} />
    <circle cx={27} cy={2} r={2.5} fill={win} />
    <rect x={23} y={58} width={8} height={16} fill="#05070f" opacity={0.7} />
  </Svg>
);
// An elevated village water tank on a concrete stand.
const WaterTank = ({ c }: { c: string }) => (
  <Svg w={44} h={80}>
    <rect x={9} y={40} width={4} height={40} fill={c} />
    <rect x={31} y={40} width={4} height={40} fill={c} />
    <rect x={7} y={44} width={30} height={4} fill={c} />
    <rect x={8} y={14} width={28} height={28} rx={3} fill={c} />
    <rect x={8} y={14} width={28} height={6} fill="#05070f" opacity={0.22} />
  </Svg>
);
// A railway station: platform, pitched-roof building, lit windows, a blue
// name-board, platform lamp-posts (with a warm glow at night) and a few
// travellers waiting on the platform. A contrasting outline + drop-shadow keep
// it readable against the scenery in both day and night.
const Station = ({
  c,
  win,
  fig,
  height,
  night,
  signalRef,
}: {
  c: string;
  win: string;
  fig?: string;
  height?: string;
  night?: boolean;
  signalRef?: React.Ref<SVGGElement>;
}) => {
  const edge = night ? "#7c8cc4" : "#5a4326"; // outline that separates from bg
  const roof = night ? "#3a3560" : "#a24b2e"; // solid, visible roof
  const person = night ? "#9aa6c4" : fig ?? "#3a2f22"; // platform crowd
  const lampX = [20, 60, 103, 150, 190]; // platform lamp-posts
  const peopleX = [30, 46, 116, 150, 166, 196]; // travellers
  return (
    <svg
      viewBox="0 0 210 96"
      className="block shrink-0"
      style={{
        height: height ?? "100%",
        width: "auto",
        overflow: "visible",
        filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.45))",
      }}
    >
      <defs>
        <radialGradient id="stLampGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff2c4" stopOpacity={night ? 0.85 : 0.4} />
          <stop offset="100%" stopColor="#fff2c4" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={2} y={80} width={206} height={12} fill={c} stroke={edge} strokeWidth={0.8} />
      <rect x={2} y={80} width={206} height={3} fill="#05070f" opacity={0.25} />
      <rect x={28} y={44} width={150} height={38} fill={c} stroke={edge} strokeWidth={1} />
      <polygon points="22,46 103,24 184,46" fill={roof} stroke={edge} strokeWidth={0.8} />
      <rect x={22} y={44} width={162} height={5} fill={roof} />
      <g fill={win} opacity={0.95}>
        <rect x={40} y={56} width={12} height={12} />
        <rect x={60} y={56} width={12} height={12} />
        <rect x={136} y={56} width={12} height={12} />
        <rect x={156} y={56} width={12} height={12} />
      </g>
      <rect x={96} y={58} width={18} height={24} fill="#05070f" opacity={0.7} />
      <rect x={70} y={28} width={70} height={13} rx={2} fill="#123a68" stroke={edge} strokeWidth={0.6} />
      <rect x={75} y={32} width={58} height={2} fill="#eef2ff" opacity={0.85} />
      <rect x={75} y={36} width={38} height={2} fill="#eef2ff" opacity={0.6} />
      {/* platform lamp-posts: pole + warm bulb, with a soft glow at night. The
          pole base sits on the platform floor (y85). */}
      {lampX.map((lx) => (
        <g key={`lamp${lx}`}>
          <rect x={lx - 0.7} y={63} width={1.4} height={22} fill="#05070f" opacity={0.6} />
          <circle cx={lx} cy={62} r={7} fill="url(#stLampGlow)" />
          <circle cx={lx} cy={62} r={1.7} fill={night ? "#fff2c4" : "#f5d76e"} />
        </g>
      ))}
      {/* travellers standing on the platform floor (feet at y85) — midway down
          the slab so they read as ON it, not floating above or hidden below */}
      <g fill={person}>
        {peopleX.map((px, idx) => {
          const child = idx % 3 === 0;
          const hr = child ? 1.2 : 1.5;
          const bh = child ? 4 : 5.6;
          const hy = 85 - bh - hr; // head centre so feet land on y85
          return (
            <g key={`p${px}`}>
              <circle cx={px} cy={hy} r={hr} />
              <rect x={px - 1.3} y={hy + hr} width={2.6} height={bh} rx={1.2} />
            </g>
          );
        })}
      </g>
      {/* Railway block signal, set a distance AHEAD of the platform (to the
          right, in the direction of travel) so the stopping train's nose lines
          up with it instead of covering it — the train body is drawn over the
          station, so a signal on the platform would be hidden. Its lamps are
          toggled from the halt loop via signalRef: RED while braking-in/holding
          (first 1.5s), GREEN once clear / when there is no scheduled stop. */}
      <g ref={signalRef} data-signal>
        <rect x={267.2} y={40} width={1.6} height={50} fill="#05070f" opacity={0.75} />
        <rect x={262} y={88} width={12} height={3} rx={1} fill="#05070f" opacity={0.55} />
        <rect x={263} y={30} width={10} height={20} rx={1.8} fill="#12161f" stroke={edge} strokeWidth={0.5} />
        <circle data-lamp="r" cx={268} cy={36} r={2.7} fill="#ff4136" opacity={0.22} />
        <circle data-lamp="g" cx={268} cy={45} r={2.7} fill="#39d353" opacity={1} />
      </g>
    </svg>
  );
};
// A village home with life around it: a footpath to the road, an adult by the
// door, children playing with a ball, a resting cow and hens in the yard.
const HomeYard = ({ c, win, fig }: { c: string; win: string; fig: string }) => (
  <Svg w={176} h={96}>
    {/* footpath leading from the door down to the road in front */}
    <polygon points="80,72 96,72 112,96 62,96" fill={fig} opacity={0.16} />
    {/* the home */}
    <rect x={54} y={44} width={68} height={30} fill={c} />
    <polygon points="48,46 88,24 128,46" fill={c} />
    <polygon points="48,46 88,24 128,46" fill="#05070f" opacity={0.16} />
    <rect x={82} y={58} width={12} height={16} fill="#05070f" opacity={0.7} />
    <rect x={62} y={52} width={10} height={9} fill={win} opacity={0.9} />
    <rect x={104} y={52} width={10} height={9} fill={win} opacity={0.75} />
    {/* adult by the door */}
    <g fill={fig}>
      <circle cx={73} cy={63} r={2.4} />
      <rect x={71} y={65} width={4} height={10} rx={1.6} />
    </g>
    {/* children playing, one chasing a ball */}
    <g fill={fig}>
      <circle cx={122} cy={79} r={2} />
      <rect x={120.4} y={81} width={3.2} height={7} rx={1.3} />
      <circle cx={134} cy={82} r={2} />
      <rect x={132.4} y={84} width={3.2} height={6} rx={1.3} />
    </g>
    <circle cx={143} cy={90} r={2.2} fill="#eef2ff" opacity={0.85} />
    {/* cow resting near the home */}
    <g fill={fig}>
      <ellipse cx={38} cy={85} rx={12} ry={5} />
      <rect x={29} y={88} width={2.4} height={7} />
      <rect x={35} y={88} width={2.4} height={7} />
      <rect x={43} y={88} width={2.4} height={7} />
      <rect x={48} y={88} width={2.4} height={7} />
      <circle cx={52} cy={80} r={3.6} />
      <path d="M49 77 l-2 -4 M55 77 l2 -4" stroke={fig} strokeWidth={1.4} />
    </g>
    {/* hens pecking in the yard */}
    <g fill={fig}>
      <ellipse cx={100} cy={91} rx={2.6} ry={1.9} />
      <circle cx={102} cy={89} r={1} />
      <ellipse cx={110} cy={93} rx={2.6} ry={1.9} />
      <circle cx={112} cy={91} r={1} />
    </g>
  </Svg>
);
const Cow = ({ c, s = 1 }: { c: string; s?: number }) => (
  <Svg w={56} h={36} s={s}>
    <ellipse cx={26} cy={18} rx={18} ry={9} fill={c} />
    <rect x={10} y={22} width={3} height={13} fill={c} />
    <rect x={19} y={22} width={3} height={13} fill={c} />
    <rect x={33} y={22} width={3} height={13} fill={c} />
    <rect x={41} y={22} width={3} height={13} fill={c} />
    <circle cx={47} cy={12} r={6} fill={c} />
    <rect x={49} y={9} width={7} height={2.5} fill={c} />
    <path d="M44 6 l-2 -5 M50 6 l2 -5" stroke={c} strokeWidth={2} />
  </Svg>
);
const Deer = ({ c, s = 1 }: { c: string; s?: number }) => (
  <Svg w={46} h={48} s={s}>
    <ellipse cx={20} cy={26} rx={13} ry={6} fill={c} />
    <rect x={10} y={30} width={2} height={16} fill={c} />
    <rect x={16} y={30} width={2} height={16} fill={c} />
    <rect x={26} y={30} width={2} height={16} fill={c} />
    <rect x={30} y={30} width={2} height={16} fill={c} />
    <path d="M32 24 l7 -9" stroke={c} strokeWidth={3} />
    <circle cx={40} cy={13} r={3.5} fill={c} />
    <path d="M38 10 l-2 -7 M42 10 l2 -7" stroke={c} strokeWidth={1.5} />
  </Svg>
);
const Dog = ({ c, s = 1 }: { c: string; s?: number }) => (
  <Svg w={36} h={24} s={s}>
    <ellipse cx={17} cy={14} rx={10} ry={5} fill={c} />
    <circle cx={28} cy={11} r={4} fill={c} />
    <rect x={9} y={17} width={2} height={7} fill={c} />
    <rect x={23} y={17} width={2} height={7} fill={c} />
    <path d="M7 13 l-6 -4" stroke={c} strokeWidth={2} />
  </Svg>
);
const PersonFig = ({ c, s = 1 }: { c: string; s?: number }) => (
  <Svg w={14} h={32} s={s}>
    <circle cx={7} cy={5} r={4} fill={c} />
    <rect x={3} y={9} width={8} height={14} rx={3} fill={c} />
    <rect x={4} y={22} width={2.5} height={10} fill={c} />
    <rect x={7.5} y={22} width={2.5} height={10} fill={c} />
  </Svg>
);
const Cyclist = ({ c, night }: { c: string; night?: boolean }) => (
  <Svg w={46} h={36}>
    <circle cx={11} cy={26} r={9} fill="none" stroke={c} strokeWidth={2} />
    <circle cx={35} cy={26} r={9} fill="none" stroke={c} strokeWidth={2} />
    <path d="M11 26 L21 17 L35 26 M21 17 L26 26 M21 17 L18 15" stroke={c} strokeWidth={2} fill="none" />
    <circle cx={23} cy={10} r={3.5} fill={c} />
    <path d="M23 13 L21 17" stroke={c} strokeWidth={3} />
    {night && (
      <g>
        <circle cx={41} cy={22} r={3.2} fill="#fff2c4" opacity={0.3} />
        <circle cx={41} cy={22} r={1.2} fill="#fffbe6" />
        <circle cx={6} cy={24} r={2.4} fill="#ff4d4d" opacity={0.3} />
        <circle cx={6} cy={24} r={1} fill="#ff6b6b" />
      </g>
    )}
  </Svg>
);
const Bus = ({ c, night }: { c: string; night?: boolean }) => (
  <Svg w={94} h={46}>
    <rect x={4} y={6} width={86} height={28} rx={5} fill={c} />
    <g fill={night ? "#ffd27a" : "#0b1020"} opacity={night ? 0.85 : 0.55}>
      <rect x={12} y={12} width={12} height={9} />
      <rect x={28} y={12} width={12} height={9} />
      <rect x={44} y={12} width={12} height={9} />
      <rect x={60} y={12} width={12} height={9} />
      <rect x={75} y={12} width={11} height={9} />
    </g>
    <circle cx={24} cy={38} r={6} fill="#05070f" />
    <circle cx={72} cy={38} r={6} fill="#05070f" />
    {night && (
      <g>
        <polygon points="90,24 120,17 120,33 90,29" fill="#fff2c4" opacity={0.16} />
        <circle cx={88} cy={27} r={5.5} fill="#fff2c4" opacity={0.28} />
        <circle cx={88} cy={27} r={2} fill="#fffbe6" />
        <circle cx={6} cy={27} r={4} fill="#ff4d4d" opacity={0.3} />
        <circle cx={6} cy={27} r={1.6} fill="#ff6b6b" />
      </g>
    )}
  </Svg>
);
const Car = ({ c, night }: { c: string; night?: boolean }) => (
  <Svg w={62} h={30}>
    <path d="M8 18 q4 -11 17 -11 h15 q10 0 14 11 z" fill={c} />
    <rect x={2} y={16} width={58} height={9} rx={3} fill={c} />
    <circle cx={17} cy={25} r={5} fill="#05070f" />
    <circle cx={45} cy={25} r={5} fill="#05070f" />
    {night && (
      <g>
        <polygon points="60,18 84,13 84,25 60,22" fill="#fff2c4" opacity={0.16} />
        <circle cx={58} cy={20} r={4} fill="#fff2c4" opacity={0.3} />
        <circle cx={58} cy={20} r={1.6} fill="#fffbe6" />
        <circle cx={4} cy={20} r={3.2} fill="#ff4d4d" opacity={0.3} />
        <circle cx={4} cy={20} r={1.3} fill="#ff6b6b" />
      </g>
    )}
  </Svg>
);
const Auto = ({ c, night }: { c: string; night?: boolean }) => (
  <Svg w={46} h={36}>
    <path d="M9 28 v-13 q0 -8 10 -8 h11 q8 0 8 8 v13 z" fill={c} />
    <rect x={7} y={26} width={33} height={4} fill={c} />
    <rect x={15} y={13} width={12} height={8} fill={night ? "#ffd27a" : "#0b1020"} opacity={night ? 0.6 : 0.5} />
    <circle cx={13} cy={32} r={4} fill="#05070f" />
    <circle cx={35} cy={32} r={4} fill="#05070f" />
    {night && (
      <g>
        <polygon points="38,22 60,17 60,29 38,26" fill="#fff2c4" opacity={0.16} />
        <circle cx={37} cy={24} r={3.6} fill="#fff2c4" opacity={0.3} />
        <circle cx={37} cy={24} r={1.4} fill="#fffbe6" />
        <circle cx={10} cy={24} r={3} fill="#ff4d4d" opacity={0.3} />
        <circle cx={10} cy={24} r={1.2} fill="#ff6b6b" />
      </g>
    )}
  </Svg>
);
const Pole = ({ c }: { c: string }) => (
  <Svg w={22} h={96}>
    <rect x={10} y={8} width={3} height={88} fill={c} />
    <rect x={2} y={14} width={19} height={2.5} fill={c} />
    <rect x={5} y={22} width={13} height={2.5} fill={c} />
  </Svg>
);
const Pond = ({ c }: { c: PondColors }) => (
  <Svg w={150} h={46} vb="0 0 150 46">
    <ellipse cx={75} cy={30} rx={62} ry={10} fill={c.water} />
    <ellipse cx={75} cy={27} rx={44} ry={3.5} fill={c.hi} opacity={0.5} />
    <g stroke={c.ripple} strokeWidth={1.2} opacity={0.5} fill="none">
      <path d="M50 33 h18" />
      <path d="M86 31 h16" />
    </g>
    <ellipse cx={52} cy={31} rx={5} ry={2.4} fill={c.lily} />
    <ellipse cx={98} cy={29} rx={4} ry={2} fill={c.lily} />
    <circle cx={64} cy={28} r={1.8} fill={c.lotus} />
    <path
      d="M18 30 q-2 -12 1 -17 M24 30 q1 -10 4 -14 M132 30 q2 -12 -1 -16"
      stroke={c.reed}
      strokeWidth={1.6}
      fill="none"
      strokeLinecap="round"
    />
  </Svg>
);
const Bird = ({
  c,
  dur = 0.5,
  delay = 0,
}: {
  c: string;
  dur?: number;
  delay?: number;
}) => (
  <Svg w={16} h={8}>
    <g>
      {/* gentle vertical bob so the bird drifts through the air */}
      <animateTransform
        attributeName="transform"
        type="translate"
        values="0 0; 0 -1.6; 0 0"
        dur={`${dur * 4}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
      {/* wing flap: morph the chevron between raised and flat */}
      <path d="M1 6 q6 -6 7 0 q1 -6 7 0" stroke={c} strokeWidth={1.5} fill="none">
        <animate
          attributeName="d"
          values="M1 6 q6 -6 7 0 q1 -6 7 0; M1 6 q6 -1 7 0 q1 -1 7 0; M1 6 q6 -6 7 0 q1 -6 7 0"
          dur={`${dur}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
      </path>
    </g>
  </Svg>
);

/* ------------------------------ the train ------------------------------ */
// A detailed side-profile electric locomotive (WAP-7 style: blue body, yellow
// waist stripe, pantograph, lit cab glass, Co-Co bogies) pulling ICF coaches.
// All inline SVG with gradients + shading for a realistic look.

function SvgWheel({
  cx,
  cy,
  r,
  running,
}: {
  cx: number;
  cy: number;
  r: number;
  running: boolean;
}) {
  return (
    <g>
      {/* tyre + tread */}
      <circle cx={cx} cy={cy} r={r} fill="#0a0d14" stroke="#4a5464" strokeWidth={1.4} />
      <circle cx={cx} cy={cy} r={r * 0.86} fill="none" stroke="#20272f" strokeWidth={1} />
      <g
        className={cls(running && "animate-wheel-spin")}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        {/* wheel web */}
        <circle cx={cx} cy={cy} r={r * 0.72} fill="#1b222d" />
        {/* counterweight (rotates with the wheel) */}
        <path
          d={`M ${cx - r * 0.66} ${cy} A ${r * 0.66} ${r * 0.66} 0 0 0 ${cx + r * 0.66} ${cy} Z`}
          fill="#3a4453"
          opacity={0.85}
        />
        {/* spokes */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(a) * r * 0.66}
              y2={cy + Math.sin(a) * r * 0.66}
              stroke="#2b3442"
              strokeWidth={1.1}
            />
          );
        })}
        {/* hub */}
        <circle cx={cx} cy={cy} r={r * 0.24} fill="#5a6474" />
        <circle cx={cx} cy={cy} r={r * 0.1} fill="#161c26" />
      </g>
    </g>
  );
}

function Coach({ running, night }: { running: boolean; night?: boolean }) {
  return (
    <svg
      style={{ height: "min(15vh, 9vw)", width: "auto" }}
      viewBox="14 0 216 104"
      className="block"
    >
      <defs>
        <linearGradient id="coachBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#356fae" />
          <stop offset="0.5" stopColor="#1e4f8a" />
          <stop offset="1" stopColor="#123a68" />
        </linearGradient>
        <filter id="coachWinGlow" x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <ellipse cx={122} cy={101} rx={104} ry={5} fill="rgba(0,0,0,0.35)" />
      <path d="M18 30 Q122 21 226 30 L226 36 H18 Z" fill="#2a3340" />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={40 + i * 30} y={25} width={16} height={4} rx={2} fill="#3a4552" />
      ))}
      <rect x={16} y={34} width={212} height={42} rx={6} fill="url(#coachBody)" stroke="#0b1a3a" strokeWidth={1} />
      <rect x={16} y={55} width={212} height={4} fill="#f4c430" />
      <rect x={16} y={59} width={212} height={2} fill="#eef2ff" opacity={0.75} />
      {night && (
        <rect x={24} y={38} width={200} height={16} rx={4} fill="#ffcf6b" opacity={0.2} filter="url(#coachWinGlow)" />
      )}
      {Array.from({ length: 10 }).map((_, i) => (
        <g key={i}>
          <rect x={28 + i * 20} y={40} width={14} height={12} rx={1.5} fill={night ? "#ffcf6b" : "#0b1420"} />
          <rect x={28 + i * 20} y={40} width={14} height={5} rx={1.5} fill={night ? "#fff2c4" : "#8fd0ff"} opacity={night ? 0.85 : 0.35} />
        </g>
      ))}
      <rect x={21} y={40} width={5} height={32} rx={1} fill="#0f264c" />
      <rect x={218} y={40} width={5} height={32} rx={1} fill="#0f264c" />
      <rect x={20} y={76} width={204} height={6} fill="#0a0d14" />
      <rect x={44} y={80} width={40} height={8} rx={2} fill="#141922" />
      <SvgWheel cx={56} cy={88} r={9} running={running} />
      <SvgWheel cx={76} cy={88} r={9} running={running} />
      <rect x={160} y={80} width={40} height={8} rx={2} fill="#141922" />
      <SvgWheel cx={172} cy={88} r={9} running={running} />
      <SvgWheel cx={192} cy={88} r={9} running={running} />
      {/* short couplers at the cropped edges so the units link up seamlessly */}
      <rect x={14} y={72} width={4} height={4} rx={1} fill="#2a3340" />
      <rect x={226} y={72} width={4} height={4} rx={1} fill="#2a3340" />
      <circle cx={18} cy={70} r={2} fill="#ff5a5a" />
      <circle cx={226} cy={70} r={2} fill="#ff5a5a" />
    </svg>
  );
}

function Loco({ running, night }: { running: boolean; night?: boolean }) {
  return (
    <svg
      style={{ height: "min(15vh, 9vw)", width: "auto", overflow: "visible" }}
      viewBox="18 0 246 104"
      className="block"
    >
      <defs>
        <linearGradient id="locoBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a67b8" />
          <stop offset="0.45" stopColor="#1f4693" />
          <stop offset="1" stopColor="#0f2859" />
        </linearGradient>
        <linearGradient id="locoCab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a78c6" />
          <stop offset="1" stopColor="#12305f" />
        </linearGradient>
        <linearGradient id="locoGlass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe6ff" stopOpacity={0.95} />
          <stop offset="0.5" stopColor="#3f6f9e" />
          <stop offset="1" stopColor="#0a1524" />
        </linearGradient>
        <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff4cf" stopOpacity={0.5} />
          <stop offset="0.5" stopColor="#fff4cf" stopOpacity={0.16} />
          <stop offset="1" stopColor="#fff4cf" stopOpacity={0} />
        </linearGradient>
        <radialGradient id="lampGlow">
          <stop offset="0" stopColor="#fff2c4" stopOpacity={0.9} />
          <stop offset="0.5" stopColor="#ffe39a" stopOpacity={0.35} />
          <stop offset="1" stopColor="#ffe39a" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx={132} cy={101} rx={112} ry={5} fill="rgba(0,0,0,0.42)" />

      {/* night headlight beam + rays projecting forward off the nose */}
      {night && (
        <g>
          <polygon points="240,35 372,4 372,82 240,47" fill="url(#beamGrad)" />
          <g stroke="#fff4cf" strokeWidth={0.9} opacity={0.45} strokeLinecap="round">
            <line x1={242} y1={38} x2={368} y2={18} />
            <line x1={242} y1={41} x2={372} y2={44} />
            <line x1={242} y1={44} x2={368} y2={70} />
          </g>
        </g>
      )}

      {/* pantograph — arms rise above the roof, base is hidden by the body */}
      <g stroke="#414b5c" strokeWidth={1.6} fill="none" strokeLinecap="round">
        <path d="M160 31 L172 13 L163 6" />
        <path d="M171 31 L178 17" />
        <path d="M151 5 H175" strokeWidth={2.2} />
        <path d="M151 5 l-2 -2.5 M175 5 l2 -2.5" strokeWidth={1.3} />
      </g>

      {/* main body: long hood + raised cab + sloped aerodynamic nose */}
      <path
        d="M24 32 H196 L200 28 H214 Q236 30 243 50 L246 66 Q246 76 238 76 H24 Z"
        fill="url(#locoBody)"
        stroke="#0a1c3f"
        strokeWidth={1}
      />
      {/* cab / nose panel in a slightly lighter shade */}
      <path
        d="M200 28 H214 Q236 30 243 50 L246 66 Q246 76 238 76 H204 Z"
        fill="url(#locoCab)"
        opacity={0.92}
      />
      {/* roof highlight */}
      <path
        d="M26 33 H196 L200 29 H212"
        stroke="#7ea0dd"
        strokeWidth={1.2}
        fill="none"
        opacity={0.55}
      />

      {/* roof equipment: insulators, cab AC unit, air horns */}
      {Array.from({ length: 5 }).map((_, i) => (
        <rect key={i} x={70 + i * 14} y={28} width={4} height={4} rx={1} fill="#39434f" />
      ))}
      <rect x={188} y={24} width={16} height={5} rx={2} fill="#2a3340" />
      <path d="M206 28 l3 -5 M211 28 l3 -5" stroke="#2a3340" strokeWidth={1.6} strokeLinecap="round" />

      {/* waist band */}
      <rect x={24} y={56} width={206} height={5} fill="#f4c430" />
      <rect x={24} y={61} width={206} height={2} fill="#eef2ff" opacity={0.85} />

      {/* radiator grilles (louvers) on the long hood */}
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} x={40 + i * 9} y={40} width={4.5} height={14} rx={1} fill="#0a1c3f" opacity={0.55} />
      ))}
      {Array.from({ length: 5 }).map((_, i) => (
        <rect key={i} x={128 + i * 9} y={40} width={4.5} height={14} rx={1} fill="#0a1c3f" opacity={0.55} />
      ))}
      {/* panel seams */}
      <path d="M124 33 V74 M176 33 V74" stroke="#0a1c3f" strokeWidth={0.8} opacity={0.5} />

      {/* cab door + side window */}
      <rect x={200} y={36} width={11} height={38} rx={1.5} fill="#0f2c5c" stroke="#0a1c3f" strokeWidth={0.6} />
      <rect x={202} y={39} width={7} height={10} rx={1} fill="url(#locoGlass)" />
      {/* angled front windscreen */}
      <path
        d="M214 33 H228 Q236 35 240 46 L226 46 Q218 45 214 40 Z"
        fill="url(#locoGlass)"
        stroke="#0a1524"
        strokeWidth={0.8}
      />
      {/* night: lit cab interior glowing through the windows */}
      {night && <rect x={202} y={39} width={7} height={10} rx={1} fill="#ffd27a" opacity={0.9} />}
      {night && (
        <path d="M214 33 H228 Q236 35 240 46 L226 46 Q218 45 214 40 Z" fill="#ffcf6b" opacity={0.35} />
      )}
      {/* yellow first-aid box */}
      <rect x={190} y={44} width={6} height={8} fill="#f4c430" />

      {/* nose headlight cluster (with glow) + marker */}
      {night && <circle cx={238} cy={40} r={12} fill="url(#lampGlow)" />}
      {night && <circle cx={231} cy={37} r={6} fill="url(#lampGlow)" />}
      {night && <circle cx={241} cy={60} r={7} fill="url(#lampGlow)" />}
      <circle cx={238} cy={40} r={5} fill="#fff7d6" opacity={0.22} />
      <circle cx={238} cy={40} r={2.6} fill="#fff7d6" />
      <circle cx={231} cy={37} r={1.8} fill="#fff2c4" />
      <circle cx={241} cy={60} r={2.2} fill="#ffd27a" />
      {/* rear red tail marker */}
      {night && <circle cx={27} cy={62} r={6} fill="#ff5a5a" opacity={0.3} />}
      <circle cx={27} cy={62} r={2.2} fill="#ff5a5a" />
      {/* nose number board */}
      <rect x={214} y={61} width={22} height={7} rx={1} fill="#eef2ff" opacity={0.85} />
      <rect x={216} y={63} width={18} height={3} fill="#0a1524" opacity={0.5} />
      {/* nose grab rail */}
      <path d="M210 51 H240" stroke="#0a1c3f" strokeWidth={1} opacity={0.55} />

      {/* running board + steps */}
      <rect x={24} y={74} width={214} height={3} fill="#0a0d14" />
      <path d="M120 74 V70 M176 74 V70" stroke="#2a3340" strokeWidth={1} />

      {/* underframe */}
      <rect x={26} y={76} width={210} height={6} fill="#0a0d14" />

      {/* rear Co-Co bogie (3 axles) */}
      <g>
        <rect x={40} y={79} width={64} height={9} rx={2} fill="#161d28" />
        <rect x={44} y={78} width={56} height={3} fill="#232c39" />
        <path d="M50 80 V77 M72 80 V77 M94 80 V77" stroke="#3a4552" strokeWidth={1.4} />
        <SvgWheel cx={50} cy={88} r={9} running={running} />
        <SvgWheel cx={72} cy={88} r={9} running={running} />
        <SvgWheel cx={94} cy={88} r={9} running={running} />
      </g>
      {/* front Co-Co bogie (3 axles) */}
      <g>
        <rect x={150} y={79} width={64} height={9} rx={2} fill="#161d28" />
        <rect x={154} y={78} width={56} height={3} fill="#232c39" />
        <path d="M160 80 V77 M182 80 V77 M204 80 V77" stroke="#3a4552" strokeWidth={1.4} />
        <SvgWheel cx={160} cy={88} r={9} running={running} />
        <SvgWheel cx={182} cy={88} r={9} running={running} />
        <SvgWheel cx={204} cy={88} r={9} running={running} />
      </g>

      {/* coupler to coaches (bridges the cropped left edge to link with the coach) */}
      <rect x={18} y={72} width={8} height={4} rx={1} fill="#2a3340" />
    </svg>
  );
}

/* ----------------------------- scroll band ----------------------------- */
function Band({
  running,
  duration,
  bottom,
  height,
  z,
  blur = 0,
  opacity = 1,
  keepMoving = false,
  children,
}: {
  running: boolean;
  duration: number;
  bottom: string;
  height: number;
  z: number;
  blur?: number;
  opacity?: number;
  keepMoving?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-x-0 overflow-hidden"
      style={{
        bottom,
        height,
        zIndex: z,
        filter: blur ? `blur(${blur}px)` : undefined,
        opacity,
      }}
    >
      <div
        className={cls("flex h-full w-max items-end", running && "animate-scroll-x")}
        style={{ animationDuration: `${duration}s` }}
        {...(keepMoving ? { "data-keep-moving": "" } : {})}
      >
        <div className="flex shrink-0 items-end">{children}</div>
        <div className="flex shrink-0 items-end" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- deterministic tiles ----------------------- */
function place(
  out: ReactNode[],
  key: number,
  x: number,
  base: number,
  w: number,
  h: number,
  node: ReactNode,
  shadow: boolean,
) {
  out.push(
    <g key={key} transform={`translate(${x},${base - h})`}>
      {shadow && (
        <ellipse cx={w / 2} cy={h} rx={w * 0.5} ry={4} fill="rgba(0,0,0,0.22)" />
      )}
      {node}
    </g>,
  );
}

function FarTile({ t }: { t: Theme }) {
  return (
    <svg width={1600} height={150} viewBox="0 0 1600 150" className="block">
      <path
        d="M0 96 Q200 44 400 82 T820 72 T1240 90 T1600 74 L1600 150 L0 150Z"
        fill={t.far}
      />
      {Array.from({ length: 60 }).map((_, i) => (
        <polygon
          key={i}
          points={`${i * 27},150 ${i * 27 + 13},${104 - (i % 3) * 8} ${i * 27 + 26},150`}
          fill={t.far2}
        />
      ))}
    </svg>
  );
}

function MidTile({ t }: { t: Theme }) {
  const night = !t.sun;
  const out: ReactNode[] = [];
  const branches: ReactNode[] = []; // driveways, drawn behind the structures
  let x = 12;
  const base = 180; // ground line the structures stand on
  const tileBottom = 250; // extends down into the main-road band (bottom 34%)
  for (let i = 0; i < 16; i++) {
    const r = dr(i, 21);
    let node: ReactNode;
    let w: number;
    let h: number;
    // Ponds lie flat on the ground, so they get no contact shadow (an ellipse
    // under them reads as a stray dark smudge). Everything else is grounded.
    let shadow = true;
    let connects = false; // does this structure get a branch road to the highway?
    if (r < 0.16) {
      node = <Tree c={t.tree} />;
      w = 40;
      h = 70;
    } else if (r < 0.3) {
      node = <HomeYard c={t.bld} win={t.win} fig={t.near} />;
      w = 176;
      h = 96;
      connects = true;
    } else if (r < 0.4) {
      node = <Building c={t.bld} win={t.win} />;
      w = 64;
      h = 92;
      connects = true;
    } else if (r < 0.48) {
      node = <House c={t.bld} win={t.win} />;
      w = 70;
      h = 64;
      connects = true;
    } else if (r < 0.56) {
      node = <Temple c={t.bld} win={t.win} />;
      w = 54;
      h = 74;
      connects = true;
    } else if (r < 0.64) {
      node = <Pine c={t.pine} />;
      w = 34;
      h = 72;
    } else if (r < 0.72) {
      node = <Palm c={t.tree} />;
      w = 46;
      h = 82;
    } else if (r < 0.78) {
      node = <Hut c={t.bld} />;
      w = 54;
      h = 50;
      connects = true;
    } else if (r < 0.84) {
      node = <WaterTank c={t.bld} />;
      w = 44;
      h = 80;
    } else if (r < 0.92) {
      node = <Pond c={t.pond} />;
      w = 150;
      h = 46;
      shadow = false;
    } else {
      node = <Bush c={t.tree} />;
      w = 40;
      h = 24;
    }

    // A short branch road (driveway) from the structure's door down to the main
    // road. It flares a little where it meets the highway. Drawn before the
    // structure so the building sits on top of it; the highway band (z4) paints
    // over the very bottom so the join reads as connected.
    if (connects) {
      const cx = x + w / 2;
      branches.push(
        <polygon
          key={`br${i}`}
          points={`${cx - 5},${base} ${cx + 5},${base} ${cx + 13},${tileBottom} ${cx - 13},${tileBottom}`}
          fill={night ? "#232a38" : "#8a8f98"}
        />,
      );
      branches.push(
        <g
          key={`bre${i}`}
          stroke={night ? "#0c1220" : "#6b7078"}
          strokeWidth={1}
          opacity={0.5}
        >
          <line x1={cx - 5} y1={base} x2={cx - 13} y2={tileBottom} />
          <line x1={cx + 5} y1={base} x2={cx + 13} y2={tileBottom} />
        </g>,
      );
    }

    place(out, i, x, base, w, h, node, shadow);
    x += w + 24 + dr(i, 22) * 90;
    if (x > 1600 - 160) break;
  }
  return (
    <svg width={1600} height={250} viewBox="0 0 1600 250" className="block">
      {/* Continuous ground: a strip of land the houses stand ON that runs down
          into the road, so nothing floats on a transparent gap. The slightly
          lighter top edge reads as the far lip of the village field. */}
      <rect x={0} y={base} width={1600} height={tileBottom - base} fill={night ? "#101a26" : "#4f8a45"} />
      <rect x={0} y={base} width={1600} height={3} fill={night ? "#0a1018" : "#6bb15c"} opacity={0.8} />
      {branches}
      {out}
    </svg>
  );
}

function RoadTile({ t }: { t: Theme }) {
  const night = !t.sun;
  const W = 1600;
  const H = 64;
  const roadTop = 42; // top edge of the asphalt
  const roadH = 18; // asphalt thickness
  const centreY = roadTop + roadH / 2;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
      {/* earth/gravel roadbed so the highway has thickness and sits IN the
          ground instead of floating as a thin grey ribbon */}
      <rect
        x={0}
        y={roadTop - 4}
        width={W}
        height={roadH + 9}
        fill={night ? "#1b2230" : "#6f6656"}
      />
      {/* asphalt */}
      <rect
        x={0}
        y={roadTop}
        width={W}
        height={roadH}
        fill={night ? "#141a26" : "#4b5563"}
      />
      {/* far kerb highlight */}
      <rect
        x={0}
        y={roadTop}
        width={W}
        height={2}
        fill={night ? "rgba(244,233,210,0.12)" : "rgba(255,255,255,0.35)"}
      />
      {/* near edge shadow */}
      <rect
        x={0}
        y={roadTop + roadH - 2}
        width={W}
        height={2}
        fill="rgba(0,0,0,0.35)"
      />
      {/* dashed centre line */}
      <line
        x1={0}
        y1={centreY}
        x2={W}
        y2={centreY}
        stroke={night ? "rgba(244,233,210,0.28)" : "rgba(255,255,255,0.6)"}
        strokeWidth={2}
        strokeDasharray="16 18"
      />
    </svg>
  );
}

// Traffic is JS-driven so it behaves correctly in the train's moving frame.
// Each vehicle has its own FORWARD speed (px/s). Its on-screen velocity is
// (ownForward - trainScreenSpeed): while the train is faster it recedes left
// (gets overtaken), and when the train brakes/stops the train term drops to 0
// so the cars keep rolling FORWARD (right) — traffic never freezes or reverses.
const TRAIN_SCREEN_SPEED = 200; // px/s the scenery recedes at full train speed
type TrafficItem = {
  kind: "bus" | "car" | "auto" | "cyclist";
  spd: number; // forward speed in px/s (relative to the screen)
  offset: number; // 0..1 initial spread across the road
  y: number; // wheel line, px above the band bottom (slight lane variety)
};

const TRAFFIC: TrafficItem[] = [
  { kind: "cyclist", spd: 56, offset: 0.12, y: 6 },
  { kind: "bus", spd: 84, offset: 0.4, y: 6 },
  { kind: "auto", spd: 104, offset: 0.66, y: 7 },
  { kind: "car", spd: 140, offset: 0.88, y: 9 },
  { kind: "auto", spd: 112, offset: 0.28, y: 6 },
  { kind: "car", spd: 150, offset: 0.55, y: 10 },
  { kind: "car", spd: 132, offset: 0.75, y: 8 },
];

function Traffic({
  t,
  running,
  speedFactorRef,
}: {
  t: Theme;
  running: boolean;
  speedFactorRef: { current: number };
}) {
  const night = !t.sun;
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef<number[] | null>(null);

  const node = (kind: TrafficItem["kind"]) => {
    if (kind === "bus") return <Bus c={t.bus} night={night} />;
    if (kind === "auto") return <Auto c={t.auto} night={night} />;
    if (kind === "cyclist") return <Cyclist c={t.near} night={night} />;
    return <Car c={t.car} night={night} />;
  };

  useEffect(() => {
    if (!running) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const width = wrap.clientWidth;
      if (width > 0) {
        const margin = 90;
        const span = width + margin * 2;
        if (!posRef.current) {
          posRef.current = TRAFFIC.map((it) => it.offset * span - margin);
        }
        const train = TRAIN_SCREEN_SPEED * (speedFactorRef.current ?? 1);
        for (let i = 0; i < TRAFFIC.length; i++) {
          let p = posRef.current[i] + (TRAFFIC[i].spd - train) * dt;
          if (p > width + margin) p -= span;
          else if (p < -margin) p += span;
          posRef.current[i] = p;
          const el = itemRefs.current[i];
          if (el) el.style.transform = `translateX(${p}px)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speedFactorRef]);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute inset-x-0 bottom-[34%] z-[4] h-[64px] overflow-hidden"
    >
      {TRAFFIC.map((it, i) => (
        <div
          key={i}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          className="absolute left-0 will-change-transform"
          style={
            running
              ? {
                  bottom: it.y,
                  transform: `translateX(${it.offset * 100}vw)`,
                }
              : { bottom: it.y, left: `${6 + i * 13}%` }
          }
        >
          {node(it.kind)}
        </div>
      ))}
    </div>
  );
}

function NearTile({ t }: { t: Theme }) {
  const out: ReactNode[] = [];
  let x = 20;
  const base = 130;
  for (let i = 0; i < 14; i++) {
    const r = dr(i, 41);
    let node: ReactNode;
    let w: number;
    let h: number;
    if (r < 0.34) {
      node = <Pole c={t.pole} />;
      w = 22;
      h = 96;
    } else if (r < 0.5) {
      node = <Bush c={t.bush} />;
      w = 40;
      h = 24;
    } else if (r < 0.62) {
      node = <Cow c={t.near} s={0.55} />;
      w = 56 * 0.55;
      h = 36 * 0.55;
    } else if (r < 0.72) {
      node = <Deer c={t.near} s={0.5} />;
      w = 46 * 0.5;
      h = 48 * 0.5;
    } else if (r < 0.82) {
      node = <Dog c={t.near} s={0.6} />;
      w = 36 * 0.6;
      h = 24 * 0.6;
    } else {
      node = <PersonFig c={t.near} s={0.7} />;
      w = 14 * 0.7;
      h = 32 * 0.7;
    }
    place(out, i, x, base, w, h, node, true);
    x += w + 40 + dr(i, 42) * 90;
    if (x > 1600 - 120) break;
  }
  return (
    <svg width={1600} height={130} viewBox="0 0 1600 130" className="block">
      {out}
    </svg>
  );
}

function BirdTile({ t }: { t: Theme }) {
  return (
    <svg width={1600} height={40} viewBox="0 0 1600 40" className="block">
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${120 + i * 420 + dr(i, 51) * 120},${6 + dr(i, 52) * 20})`}>
          <Bird c={t.bird} dur={0.4 + dr(i, 61) * 0.5} delay={dr(i, 62) * 1.2} />
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------- scene --------------------------------- */
// Intermittent rain. Drop positions/timing are seeded (deterministic) so SSR
// matches the client. The whole layer is marked data-keep-moving so rainfall is
// exempt from the train-halt slowdown — rain keeps falling when the train stops.
const RAIN_DROPS = Array.from({ length: 110 }, (_, i) => ({
  left: dr(i, 7) * 100,
  dur: 0.55 + dr(i, 13) * 0.6,
  delay: -dr(i, 17) * 1.6,
  h: 14 + dr(i, 19) * 20,
  o: 0.28 + dr(i, 23) * 0.5,
  w: 1 + dr(i, 31) * 1.1,
}));

function Rain({ night, on }: { night: boolean; on: boolean }) {
  const rgb = night ? "178,196,255" : "233,241,251";
  return (
    <div
      data-keep-moving
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        zIndex: 20,
        opacity: on ? 1 : 0,
        transition: "opacity 1400ms ease-in-out",
      }}
    >
      {/* cool mood wash: an overcast grey veil by day, a deep blue by night */}
      <div
        className="absolute inset-0"
        style={{
          background: night
            ? "linear-gradient(180deg, rgba(8,12,28,0.5) 0%, rgba(8,12,28,0.22) 45%, rgba(6,9,20,0.34) 100%)"
            : "linear-gradient(180deg, rgba(112,126,148,0.30) 0%, rgba(146,158,176,0.10) 50%, rgba(88,100,118,0.22) 100%)",
        }}
      />
      {RAIN_DROPS.map((d, i) => (
        <span
          key={i}
          className="rain-drop"
          style={{
            left: `${d.left}%`,
            height: `${d.h}px`,
            width: `${d.w}px`,
            opacity: d.o,
            background: `linear-gradient(180deg, rgba(${rgb},0) 0%, rgba(${rgb},0.92) 100%)`,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function CloudBank({ night }: { night: boolean }) {
  const gid = night ? "cloudGradN" : "cloudGradD";
  // sunlit top -> mid body -> darker stormy base for volumetric shading
  const top = night ? "#33456a" : "#ffffff";
  const mid = night ? "#1a2740" : "#ccd6e3";
  const base = night ? "#0b1220" : "#8593a8";
  const clouds = [
    { x: 70, s: 1.0, y: 84 },
    { x: 230, s: 1.28, y: 74 },
    { x: 400, s: 0.96, y: 88 },
    { x: 560, s: 1.34, y: 72 },
    { x: 720, s: 1.06, y: 86 },
  ];
  return (
    <svg
      width={800}
      height={140}
      viewBox="0 0 800 140"
      className="block shrink-0"
      style={{ overflow: "hidden", filter: "blur(5px)" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="52%" stopColor={mid} />
          <stop offset="100%" stopColor={base} />
        </linearGradient>
      </defs>
      {clouds.map((c, i) => {
        const s = c.s;
        return (
          <g key={i} fill={`url(#${gid})`}>
            {/* flat-ish base with a puffy cauliflower top */}
            <ellipse cx={c.x} cy={c.y} rx={94 * s} ry={26 * s} />
            <circle cx={c.x - 54 * s} cy={c.y - 8} r={26 * s} />
            <circle cx={c.x - 18 * s} cy={c.y - 28 * s} r={35 * s} />
            <circle cx={c.x + 20 * s} cy={c.y - 32 * s} r={30 * s} />
            <circle cx={c.x + 52 * s} cy={c.y - 12 * s} r={26 * s} />
          </g>
        );
      })}
    </svg>
  );
}

// Storm cloud bank that fades in across the top of the sky while it rains and
// drifts slowly (seamless two-copy strip). A bottom mask dissolves the clouds
// into the sky so there is no hard band edge. Marked data-keep-moving so the
// clouds keep drifting even when the train halts.
function StormClouds({ night, on }: { night: boolean; on: boolean }) {
  return (
    <div
      data-keep-moving
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
      style={{
        height: "30%",
        zIndex: 2,
        opacity: on ? 1 : 0,
        transition: "opacity 1600ms ease-in-out",
        WebkitMaskImage:
          "linear-gradient(180deg, #000 0%, #000 58%, rgba(0,0,0,0.4) 82%, transparent 100%)",
        maskImage:
          "linear-gradient(180deg, #000 0%, #000 58%, rgba(0,0,0,0.4) 82%, transparent 100%)",
      }}
    >
      <div
        className={cls("flex h-full w-max items-start", on && "animate-scroll-x")}
        style={{ animationDuration: "120s" }}
      >
        <div className="flex shrink-0">
          <CloudBank night={night} />
        </div>
        <div className="flex shrink-0" aria-hidden>
          <CloudBank night={night} />
        </div>
      </div>
    </div>
  );
}

export default function TrainExterior({
  running = true,
  hour = 8,
  hourRef,
}: {
  running?: boolean;
  hour?: number;
  hourRef?: { current: number };
}) {
  const sky = skyAt(hour);
  const t = sky.theme;
  const night = sky.night;
  // Sky/sun/moon/stars animate imperatively from the live clock. Keep the
  // first-paint values constant so React never re-binds them and fights the
  // animation frames; the coarse `hour` still refreshes the object palette.
  const initialSky = useRef(sky.theme.sky).current;
  const initialGround = useRef(t.ground).current;
  const liveHourRef = useRef(hour);
  liveHourRef.current = hour;

  // ---- intermittent weather: rain rolls in and out on random intervals ----
  // Dry spells last ~25-70s, showers ~12-30s. Timers run only while the scene
  // is live (running) and start client-side, so SSR/hydration stay clean.
  const [raining, setRaining] = useState(false);
  useEffect(() => {
    if (!running) return;
    const next = raining
      ? 12_000 + Math.random() * 18_000 // how long a shower lasts
      : 25_000 + Math.random() * 45_000; // how long the dry spell lasts
    const timer = setTimeout(() => setRaining((r) => !r), next);
    return () => clearTimeout(timer);
  }, [raining, running]);

  // Lightning: while it rains, fire a bright flash every few seconds. Bumping
  // the counter remounts the flash overlay (via key) so its one-shot CSS
  // flicker replays. Stops automatically when the shower ends.
  const [flashCount, setFlashCount] = useState(0);
  useEffect(() => {
    if (!running || !raining) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setFlashCount((c) => c + 1);
        schedule();
      }, 3_500 + Math.random() * 9_000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [running, raining]);

  // ---- station halt with smooth brake-in / hold / accel-out ----
  // The station layer is driven in JS so we can decelerate the whole scene to a
  // stop exactly when a station is centred on the train, hold, then ease back up
  // to full speed. The same live speed factor is applied to every CSS animation
  // via the Web Animations API playbackRate, so the train, wheels, rails and all
  // parallax layers slow down and speed up together (no instant stop, no reset).
  const PERIOD = 3200; // px between stations (matches the ~320px/s max speed)
  const SPEED = 320; // px/s at full speed
  // Random halt cadence: after each stop, the next halt is scheduled 3, 4 or 5
  // stations ahead (re-rolled every time), so the train doesn't stop on a fixed beat.
  const HALT_MIN = 3; // minimum stations between halts
  const HALT_RANGE = 3; // gap = HALT_MIN + floor(rand * HALT_RANGE) ∈ {3,4,5}
  const DECEL_DIST = 280; // px over which to brake to a stop
  const HOLD_MS = 2000; // stopped duration at the station
  const ACCEL_MS = 2200; // time to ease back up to full speed

  const sceneRootRef = useRef<HTMLDivElement>(null);
  const sunRef = useRef<HTMLDivElement>(null);
  const moonRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);

  // Animate the sky gradient, star fade and sun/moon arc every frame straight
  // from the live clock — no React re-render, so the day/night transition is
  // smooth even though the heavy SVG palette only updates a couple times/sec.
  useEffect(() => {
    let raf = 0;
    const SUN_HOT =
      "radial-gradient(circle at 50% 50%, #fff1c2 0%, #ff9a44 44%, rgba(255,120,50,0) 74%)";
    const SUN_DAY =
      "radial-gradient(circle at 50% 50%, #fff7d6 0%, #ffe27a 45%, rgba(255,226,122,0) 72%)";
    const loop = () => {
      const f = skyFrame((hourRef ?? liveHourRef).current);
      const root = sceneRootRef.current;
      if (root) root.style.background = f.sky;
      if (groundRef.current) groundRef.current.style.background = f.ground;
      if (starsRef.current)
        starsRef.current.style.opacity = String(f.starOpacity * 0.9);
      const sun = sunRef.current;
      if (sun) {
        sun.style.left = `${f.sun.x}%`;
        sun.style.top = `${f.sun.y}%`;
        sun.style.opacity = f.sun.visible ? "1" : "0";
        sun.style.background = f.sun.alt < 0.3 ? SUN_HOT : SUN_DAY;
        sun.style.boxShadow =
          f.sun.alt < 0.3
            ? "0 0 78px 30px rgba(255,150,70,0.55)"
            : "0 0 60px 22px rgba(255,236,150,0.6)";
      }
      const moon = moonRef.current;
      if (moon) {
        moon.style.left = `${f.moon.x}%`;
        moon.style.top = `${f.moon.y}%`;
        moon.style.opacity = f.moon.visible ? "1" : "0";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hourRef]);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const stationWrapRef = useRef<HTMLDivElement>(null);
  const distRef = useRef(0);
  const phaseRef = useRef<"cruise" | "decel" | "hold" | "accel">("cruise");
  const lastHaltMRef = useRef(-1);
  const nextHaltAtRef = useRef(-1); // station index of the next scheduled halt
  const signalRefs = useRef<(SVGGElement | null)[]>([null, null, null]); // platform signals
  const speedFactorRef = useRef(1); // live train speed 0..1, shared with the traffic loop

  const cells = Array.from({ length: 3 });

  useEffect(() => {
    if (!running) return;
    const container = containerRef.current;
    const row = rowRef.current;
    if (!container || !row) return;

    let raf = 0;
    let last = performance.now();
    let dist = distRef.current;
    let prevDist = dist;
    let phase = phaseRef.current;
    let lastHaltM = lastHaltMRef.current;
    let nextHaltAt = nextHaltAtRef.current;
    if (nextHaltAt < 0) nextHaltAt = HALT_MIN + Math.floor(Math.random() * HALT_RANGE);
    let dFrom = 0;
    let dTo = 0;
    let dStart = 0;
    let dDur = 1;
    let holdStart = 0;
    let accelStart = 0;

    // capture the scene's running CSS animations so we can scale their speed
    let anims: Animation[] = [];
    let animTick = 0;
    const refreshAnims = () => {
      if (!sceneRootRef.current) return;
      anims = sceneRootRef.current
        .getAnimations({ subtree: true })
        .filter((a) => {
          // traffic layers keep running at full speed even while the train halts
          const target = (a.effect as KeyframeEffect | null)?.target ?? null;
          return !(target instanceof Element) || !target.closest("[data-keep-moving]");
        });
    };
    refreshAnims();

    // Platform signal: red while braking-in + first 1.5s of the stop, green
    // once clear or when no stop is scheduled at the passing station.
    let signalRed = false;
    const paintSignal = (red: boolean) => {
      for (const g of signalRefs.current) {
        if (!g) continue;
        g.querySelector('[data-lamp="r"]')?.setAttribute("opacity", red ? "1" : "0.22");
        g.querySelector('[data-lamp="g"]')?.setAttribute("opacity", red ? "0.22" : "1");
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const sw = stationWrapRef.current?.offsetWidth ?? 0;
      const center = container.clientWidth / 2;
      let c = -1;
      if (sw > 0) {
        c = (PERIOD + sw / 2 - center) % PERIOD;
        if (c < 0) c += PERIOD;
      }

      let spd = 1;
      if (phase === "cruise") {
        dist += SPEED * dt;
        if (c >= 0) {
          const passes = dist >= c ? Math.floor((dist - c) / PERIOD) + 1 : 0;
          const nextM = passes;
          const remaining = c + nextM * PERIOD - dist;
          if (
            nextM === nextHaltAt &&
            remaining <= DECEL_DIST &&
            nextM !== lastHaltM
          ) {
            phase = "decel";
            lastHaltM = nextM;
            nextHaltAt = nextM + HALT_MIN + Math.floor(Math.random() * HALT_RANGE);
            dFrom = dist;
            dTo = c + nextM * PERIOD;
            dStart = now;
            // ease-out-cubic starts at full speed when dDur = 3*distance/SPEED
            dDur = Math.max(500, (3 * (dTo - dFrom) * 1000) / SPEED);
          }
        }
      } else if (phase === "decel") {
        const p = Math.min(1, (now - dStart) / dDur);
        const e = 1 - Math.pow(1 - p, 3);
        dist = dFrom + (dTo - dFrom) * e;
        if (p >= 1) {
          dist = dTo;
          phase = "hold";
          holdStart = now;
        }
      } else if (phase === "hold") {
        dist = dTo;
        spd = 0;
        if (now - holdStart >= HOLD_MS) {
          phase = "accel";
          accelStart = now;
        }
      } else {
        spd = Math.min(1, (now - accelStart) / ACCEL_MS);
        dist += SPEED * spd * dt;
        if (spd >= 1) phase = "cruise";
      }

      // actual speed factor keeps the scenery locked to the station's motion
      const actual =
        dt > 0 ? Math.max(0, Math.min(1, (dist - prevDist) / (SPEED * dt))) : 1;
      speedFactorRef.current = actual; // let the traffic loop brake/roll with us
      prevDist = dist;

      const base = ((dist % PERIOD) + PERIOD) % PERIOD;
      row.style.transform = `translateX(${-base}px)`;

      if (animTick++ % 15 === 0) refreshAnims();
      for (const a of anims) {
        try {
          a.playbackRate = actual;
        } catch {
          /* ignore */
        }
      }

      distRef.current = dist;
      phaseRef.current = phase;
      lastHaltMRef.current = lastHaltM;
      nextHaltAtRef.current = nextHaltAt;

      const wantRed =
        phase === "decel" || (phase === "hold" && now - holdStart < 1500);
      if (wantRed !== signalRed) {
        signalRed = wantRed;
        paintSignal(wantRed);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const a of anims) {
        try {
          a.playbackRate = 1;
        } catch {
          /* ignore */
        }
      }
    };
  }, [running]);

  return (
    <section
      aria-label="Outside the train"
      className="relative overflow-hidden rounded-2xl ring-1 ring-black/40"
    >
      <div
        ref={sceneRootRef}
        className="relative h-[100svh] w-full"
        style={{ background: initialSky }}
      >
        {/* Stars — opacity driven every frame by the rAF clock (fade in at dusk) */}
        <div
          ref={starsRef}
          className="absolute inset-x-0 top-0 h-1/2"
          style={{
            opacity: 0,
            backgroundImage:
              "radial-gradient(1.4px 1.4px at 30px 20px, #fff, transparent), radial-gradient(1.2px 1.2px at 120px 46px, #dfe8ff, transparent), radial-gradient(1.6px 1.6px at 220px 14px, #fff, transparent), radial-gradient(1px 1px at 320px 60px, #cdd8ff, transparent)",
            backgroundRepeat: "repeat",
            backgroundSize: "480px 100%",
          }}
        />

        {/* Sun — rides an arc east→west; warm and low at dawn/dusk */}
        <div
          ref={sunRef}
          className="absolute h-10 w-10 rounded-full will-change-transform"
          style={{ transform: "translate(-50%, -50%)", opacity: 0 }}
        />

        {/* Moon — rides the night arc */}
        <div
          ref={moonRef}
          className="absolute h-9 w-9 rounded-full will-change-transform"
          style={{
            transform: "translate(-50%, -50%)",
            opacity: 0,
            background:
              "radial-gradient(circle at 38% 38%, #f4f1e6 0%, #d9d4c3 55%, #b9b4a3 100%)",
            boxShadow: "0 0 30px 9px rgba(220,228,255,0.35)",
          }}
        />

        {/* Ground plane to the horizon */}
        <div
          ref={groundRef}
          className="absolute inset-x-0 bottom-0 z-[1]"
          style={{ height: "52%", background: initialGround }}
        />

        {/* Storm clouds roll into the sky while it rains */}
        <StormClouds night={night} on={raining} />

        {/* Birds */}
        <Band running={running} duration={30} bottom="74%" height={40} z={2} opacity={0.8}>
          <BirdTile t={t} />
        </Band>

        {/* Far hills + jungle (hazy) */}
        <Band running={running} duration={60} bottom="48%" height={150} z={2} blur={1.6} opacity={0.9}>
          <FarTile t={t} />
        </Band>

        {/* Mid field: trees, houses, ponds. Bottom is dropped to 34% (the road
            level) with extra height so the branch-road driveways can reach the
            highway; structures still sit ~70px up, i.e. around the old 40%. */}
        <Band running={running} duration={20} bottom="34%" height={250} z={3}>
          <MidTile t={t} />
        </Band>

        {/* Road: a straight asphalt strip (scrolls with the scenery, so it
            stops when the train halts) ... */}
        <Band running={running} duration={8} bottom="34%" height={64} z={4}>
          <RoadTile t={t} />
        </Band>
        {/* ... and traffic that drives forward on its own at mixed speeds. It
            is JS-driven so the train overtakes it while cruising, yet the cars
            keep rolling forward (never freeze or reverse) when the train stops. */}
        <Traffic t={t} running={running} speedFactorRef={speedFactorRef} />

        {/* Near trackside: poles, bushes, animals, passengers */}
        <Band running={running} duration={5} bottom="18%" height={130} z={5}>
          <NearTile t={t} />
        </Band>

        {/* Stations: JS-driven so the train can halt exactly when one is centred
            on it. Sits on the ground at the rail line (bottom 12%). It is nearer
            than the road, so it is drawn IN FRONT of the road/poles (z 6) but
            still behind the train (z 10). Every 3rd station => a 2s halt. */}
        <div
          ref={containerRef}
          className="pointer-events-none absolute inset-x-0 bottom-[12%] h-[600px] overflow-hidden"
          style={{ zIndex: 6 }}
        >
          <div ref={rowRef} className="flex h-full w-max items-end">
            {cells.map((_, i) => (
              <div
                key={i}
                className="flex h-full shrink-0 items-end"
                style={{ width: PERIOD }}
              >
                <div ref={i === 0 ? stationWrapRef : undefined}>
                  <Station
                    c={t.bld}
                    win={t.win}
                    fig={t.near}
                    night={night}
                    height="calc(min(15vh, 9vw) + 200px)"
                    signalRef={(el) => {
                      signalRefs.current[i] = el;
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Foreground grass tufts */}
        <div
          className={cls(
            "absolute inset-x-0 bottom-[16px] z-[7] h-[10px] opacity-80",
            running && "animate-rail-scroll",
          )}
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, ${
              night ? "#0c1a12" : "#3f7a45"
            } 0 3px, transparent 3px 12px)`,
            backgroundRepeat: "repeat-x",
            animationDuration: "0.15s",
          }}
        />

        {/* Track + train — dropped into the foreground on a solid ballast bed
            so it reads as grounded. Pinning it to the vertical centre sat the
            rails right on the horizon, which made the train look airborne. */}
        <div className="absolute inset-x-0 bottom-[12%] z-10">
          <div className="relative h-[min(24vh,14vw)]">
            {/* ballast / track bed — solid gravel band that grounds the rails */}
            <div
              className="absolute inset-x-0 bottom-[4px] h-[26px] rounded-[3px]"
              style={{
                background:
                  night
                    ? "linear-gradient(180deg,#2b303c 0%,#141821 100%)"
                    : "linear-gradient(180deg,#c3b8a2 0%,#8f8471 100%)",
                boxShadow: "0 8px 14px rgba(0,0,0,0.4)",
              }}
            />
            {/* sleepers */}
            <div
              className={cls(
                "absolute inset-x-0 bottom-[8px] h-[18px]",
                running && "animate-rail-scroll",
              )}
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(0,0,0,0.30) 0 6px, transparent 6px 48px)",
                backgroundRepeat: "repeat-x",
                animationDuration: "0.15s",
              }}
            />
            {/* two steel rails */}
            <div className="absolute inset-x-0 bottom-[22px] h-[3px] bg-gradient-to-b from-[#c8ced8] to-[#6b7280]" />
            <div className="absolute inset-x-0 bottom-[16px] h-[3px] bg-gradient-to-b from-[#c8ced8] to-[#6b7280]" />
            {/* foreground speed streaks (motion blur) along the rail line */}
            <div
              className={cls(
                "absolute inset-x-0 bottom-[24px] z-[9] h-[5px] opacity-40 blur-[1.5px]",
                running && "animate-streak-scroll",
              )}
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 10px, transparent 10px 60px)",
                backgroundRepeat: "repeat-x",
              }}
            />
            {/* contact shadow under the train */}
            <div className="absolute bottom-[16px] left-1/2 h-[10px] w-[74%] -translate-x-1/2 rounded-[50%] bg-black/40 blur-[3px]" />
            {/* the train */}
            <div className="absolute bottom-[12px] left-1/2 -translate-x-1/2">
              <div className={cls("flex items-end", running && "animate-train-clack")}>
                <Coach running={running} night={night} />
                <Coach running={running} night={night} />
                <Loco running={running} night={night} />
              </div>
            </div>
          </div>
        </div>
        {/* Intermittent rain overlay — sits above the whole scene, fades in/out */}
        <Rain night={night} on={raining} />
        {/* Lightning flash — a bright one-shot overlay replayed on each strike */}
        <div
          key={flashCount}
          aria-hidden
          data-keep-moving
          className={cls(
            "pointer-events-none absolute inset-0",
            flashCount > 0 && "lightning-flash",
          )}
          style={{
            zIndex: 22,
            opacity: 0,
            background:
              "radial-gradient(120% 70% at 50% 0%, rgba(228,238,255,0.95) 0%, rgba(190,210,255,0.5) 30%, rgba(160,185,255,0.12) 55%, transparent 75%)",
          }}
        />
      </div>
    </section>
  );
}
