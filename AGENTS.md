# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Commands

Uses npm (Windows PowerShell — chain commands with `;`, never `&&`).

- `npm run dev` — start the dev server at http://localhost:3000
- `npm run build` — production build (also runs ESLint + `tsc` type validation)
- `npm run start` — serve the production build
- `npm run lint` — ESLint via `next lint`
- `npm run typecheck` — `tsc --noEmit`, the fastest cross-file correctness check

There is currently no test runner configured.

### Build troubleshooting (Windows-specific)

The initial build was flaky due to environment, not code. If `next build` fails with
`EPERM ... .next/trace` or `ENOENT ... pages-manifest.json` / `*.nft.json`:
- A crashed build leaves a stale `node` process holding `.next/trace`; kill it
  (`Stop-Process -Name node -Force`), delete `.next`, and rerun.
- Set `$env:NEXT_TELEMETRY_DISABLED="1"` to avoid the telemetry trace file entirely.
- Antivirus real-time scanning intermittently denies launching `node`/`npx` right
  after a process kill — a short retry usually succeeds.

## Architecture

Next.js 14 **App Router** (TypeScript, Tailwind CSS 3). Single-screen lo-fi app named
**YatriKripya**: live Indian-Railways train tracking + nostalgic carriage audio playground.

### Data flow: browser → API route → RapidAPI (with fallback)

`app/page.tsx` (client) → `hooks/useTrainStatus.ts` → `/api/train-status` (server) →
RapidAPI `indian-railway-irctc`, falling back to mock data on any failure.

- **`app/api/train-status/route.ts`** — `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
  Reads `process.env.RAPIDAPI_KEY` server-side only (never shipped to the client). It:
  1. Validates the query is exactly 5 ASCII digits (`/^\d{5}$/`) — rejects others with `400`
     before ever hitting the third party (doubles as injection/traversal guard).
  2. Calls upstream behind an `AbortController` timeout (`UPSTREAM_TIMEOUT_MS`).
  3. Normalizes the messy, inconsistently-cased IRCTC response into the app's own
     `TrainStatus` shape via `normalizeUpstream`, plucking from several possible field paths.
  4. On missing key, non-2xx, abort, or parse failure, returns **mock** data with HTTP `200`
     and an `x-train-source: mock` header so the client never breaks.

- **`app/lib/train-status.ts`** — the single source of truth shared by server and client:
  the `TrainStatus` / `StationStop` / `TrainStatusKind` types, curated `MOCK_TRAINS`, and
  `buildMockTrainStatus(trainNumber)`. **Any response-shape change must be made here first**,
  then reflected in `normalizeUpstream`.

- **`hooks/useTrainStatus.ts`** — debounced (500ms) client fetcher; aborts in-flight requests
  on query change/unmount; optional polling (`pollMs`, set to 60s by the page); surfaces
  `{ status, data, error, servedFromMock, lookup, refresh }`.

### Audio orchestration

- **`hooks/useAudioEngine.ts`** — owns all media as imperative `HTMLAudioElement` refs (no
  `<audio>` tags in JSX): the looping ambience (`/audio/loop-sleeper.mp3`), a hidden
  looping **stream**, and a rotating **6-element sfx pool** for one-shots. Browsers block
  autoplay, so nothing plays until `unlock()` is called from a user gesture. All elements are
  torn down on unmount. `page.tsx` gates entry behind a `BoardingGate` whose click calls
  `engine.unlock()`.
- **`components/SfxGrid.tsx`** — receives the shared `engine`. Tiles fire `engine.playSfx`;
  the **Emergency Chain** tile additionally replays a CSS `shake-haptic` animation (via a
  re-keyed wrapper) and calls `navigator.vibrate` where supported.

### Styling / aesthetic

- `app/globals.css` (imported once in `layout.tsx`) defines the fixed nostalgic overlays
  (`crt-scanlines`, `carriage-vignette`), `.led-panel`, the moving `.rail-track`, and
  `@keyframes`. Tailwind theme tokens (`berth-*`, `coach-*`, `signal-*`, `font-board`,
  `font-display`, keyframes) live in `tailwind.config.ts` — reference them, don't hardcode hex.
- Custom path alias `@/*` maps to the repo root.

### Metadata / sharing

- **`app/layout.tsx`** — exports `metadata` (title template, Open Graph, Twitter
  `summary_large_image`, `metadataBase` = `https://yatrikripyadhyandein.in`) and `viewport`.
  Do **not** add a `generateMetadata` alongside `export const metadata` (invalid in Next.js).
- **`app/opengraph-image.tsx`** — dynamically renders the OG card with `next/og`
  `ImageResponse` on the **edge runtime** (1200×630 PNG). Referenced by layout's OG/Twitter
  image URLs as `/opengraph-image`.

## Conventions

- Interactive screens are `"use client"` components; the route handler and metadata/OG files
  are server/edge modules.
- Expected audio assets (not committed) go under `public/audio/`: `loop-sleeper.mp3`,
  `stream-*.mp3`, and `public/audio/sfx/*.mp3`. Missing files fail silently by design
  (`play()` rejections are swallowed) so the UI degrades gracefully.
- `RAPIDAPI_KEY` is provided via `.env.local` (see `.env.local.example`).
