import { NextResponse } from "next/server";
import {
  buildMockTrainStatus,
  type StationStop,
  type TrainStatus,
  type TrainStatusKind,
} from "@/app/lib/train-status";

// This handler must run on the Node runtime so it can read server-only env
// vars (process.env.RAPIDAPI_KEY) and keep the secret away from edge/browser
// caches. Status lookups are user-driven and short-lived, so we opt out of
// static generation entirely.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RAPIDAPI_HOST = "indian-railway-irctc.p.rapidapi.com";
// Confirmed live-status path for the `indian-railway-irctc` (rahilkhan224)
// product. It requires a departure_date (YYYYMMDD) and a few client-identifying
// query params, otherwise RapidAPI returns 404 / a non-success status body.
const STATUS_PATH = "/api/trains/v1/train/status";
const RAPIDAPI_CLIENT = "web";
const RAPIDAPI_DEVICE_IDENTIFIER = "YatriKripya";
// Upstream call budget: fail fast to mock rather than hanging the client.
const UPSTREAM_TIMEOUT_MS = 6000;

/** Format a Date as the YYYYMMDD string the IRCTC endpoint expects. */
function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Strictly validate the query as a bare 5-digit Indian Railways number. */
function normalizeTrainNumber(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Guard against injection / path traversal: only five ASCII digits allowed.
  return /^\d{5}$/.test(trimmed) ? trimmed : null;
}

function resolveStatusKind(...candidates: unknown[]): TrainStatusKind {
  const joined = candidates
    .filter((v) => typeof v === "string")
    .join(" ")
    .toUpperCase();
  if (joined.includes("CANCEL")) return "CANCELLED";
  if (joined.includes("DELAY")) return "DELAYED";
  if (joined.includes("ON TIME") || joined.includes("ONTIME")) return "ON_TIME";
  return "UNKNOWN";
}

function toInt(value: unknown): number | null {
  if (value == null) return null;
  const n = Number.parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** Parse an "HH:MM" 24h clock string into minutes-since-midnight, else null. */
function parseClock(value: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Delay in minutes = actual clock time − scheduled clock time. Returns null if
 * either is missing/"--". Wraps by ±1 day so a train crossing midnight (e.g.
 * scheduled 23:50, actual 00:10) reads as +20 min rather than a huge negative.
 */
function clockDiffMinutes(actual: unknown, scheduled: unknown): number | null {
  const a = parseClock(actual);
  const s = parseClock(scheduled);
  if (a == null || s == null) return null;
  let diff = a - s;
  if (diff < -720) diff += 1440;
  else if (diff > 720) diff -= 1440;
  return diff;
}

/**
 * Parses the `indian-railway-irctc` live-status response, which nests
 * everything under `status` (a success flag) and `body` (the payload).
 *
 * Each route stop carries scheduled times (`arrivalTime`/`departureTime`),
 * actual/estimated times (`actual_arrival_time`/`actual_departure_time`), a
 * cumulative `distance`, and an `expected_platform`. The feed has no train name
 * or delay-minutes field, so we derive origin/terminus, remaining distance, and
 * the current platform from the route and use honest placeholders elsewhere.
 * "--" is the upstream's sentinel for "not available".
 */
function normalizeUpstream(trainNumber: string, json: unknown): TrainStatus {
  const root = (json ?? {}) as Record<string, any>;

  const statusObj = (root.status ?? {}) as Record<string, any>;
  const body = (root.body ?? {}) as Record<string, any>;

  // A non-success status result is an upstream business error — surface it via
  // the thrown path so the caller falls back to mock with a real reason.
  const resultFlag = String(statusObj.result ?? "").toLowerCase();
  if (resultFlag && resultFlag !== "success") {
    const msg =
      statusObj?.message?.message ?? statusObj?.message ?? "upstream returned a non-success status";
    throw new Error(String(msg));
  }

  const rawStations: any[] = Array.isArray(body.stations) ? body.stations : [];

  // "--" (and empty) is the upstream sentinel for "no data yet".
  const timeOrNull = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return !s || s === "--" ? null : s;
  };

  const stations: StationStop[] = rawStations.map((s: any) => ({
    code: String(s.stationCode ?? s.station_code ?? "--"),
    name: String(s.stationName ?? s.station_name ?? "UNKNOWN"),
    scheduledArrival: timeOrNull(s.arrivalTime),
    scheduledDeparture: timeOrNull(s.departureTime),
    // Actual/estimated times use snake_case in this feed.
    currentArrival: timeOrNull(s.actual_arrival_time ?? s.actualArrivalTime),
    currentDeparture: timeOrNull(s.actual_departure_time ?? s.actualDepartureTime),
    // The feed has no delay field — derive it from actual vs scheduled time,
    // preferring arrival and falling back to departure when arrival is "--".
    delayMinutes:
      clockDiffMinutes(s.actual_arrival_time, s.arrivalTime) ??
      clockDiffMinutes(s.actual_departure_time, s.departureTime),
  }));

  const reportedCode = String(body.current_station ?? "").trim();
  const reportedIdx = rawStations.findIndex(
    (s) => String(s.stationCode ?? "").trim() === reportedCode,
  );

  // The feed's `current_station` can lag behind the live status message (e.g.
  // "crossed Banaras" while current_station still says Prayagraj). Determine
  // the furthest ACTUALLY-OBSERVED stop: one whose actual time is populated and
  // differs from its scheduled time (a real observation, not a pre-departure
  // prediction). Take whichever is further, so a not-yet-started train — where
  // every actual equals its schedule — correctly stays at its origin.
  let reachedIdx = reportedIdx;
  for (let i = 0; i < rawStations.length; i++) {
    const s = rawStations[i];
    const aArr = timeOrNull(s.actual_arrival_time);
    const aDep = timeOrNull(s.actual_departure_time);
    const sArr = timeOrNull(s.arrivalTime);
    const sDep = timeOrNull(s.departureTime);
    const observed = Boolean((aArr && aArr !== sArr) || (aDep && aDep !== sDep));
    if (observed) reachedIdx = Math.max(reachedIdx, i);
  }

  const currentStation = reachedIdx >= 0 ? stations[reachedIdx] : undefined;
  const currentRaw = reachedIdx >= 0 ? rawStations[reachedIdx] : undefined;
  const currentStationCode = currentStation?.code ?? reportedCode;
  const terminated = Boolean(body.terminated);

  // IRCTC wraps parts of the message in HTML (e.g. "<b>Banaras</b>"); we render
  // plain text, so strip tags and collapse whitespace.
  const statusMessage: string = String(body.train_status_message ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const kind = terminated
    ? "ON_TIME"
    : resolveStatusKind(statusMessage, currentStation?.name);

  const sourceStation = stations[0]?.name ?? "SOURCE";
  const destinationStation =
    stations.length > 1 ? stations[stations.length - 1].name : "DESTINATION";

  // Remaining distance = terminus cumulative km − current station km.
  const totalKm = toInt(rawStations[rawStations.length - 1]?.distance);
  const travelledKm = currentRaw ? toInt(currentRaw.distance) : null;
  const distanceRemainingKm =
    totalKm != null && travelledKm != null
      ? Math.max(0, totalKm - travelledKm)
      : null;

  // Platform is per-station; use the current station's expected platform.
  const platform = toInt(currentRaw?.expected_platform);

  return {
    trainNumber,
    // IRCTC status payload carries no train name — keep the number prominent.
    trainName: String(body.train_name ?? body.trainName ?? `Train ${trainNumber}`),
    sourceStation,
    destinationStation,
    lastReportedStation:
      currentStation?.name ?? (currentStationCode || "EN-ROUTE"),
    status: kind,
    delayMinutes: 0,
    distanceRemainingKm,
    expectedArrival: statusMessage || (terminated ? "journey terminated" : "en route"),
    statusMessage: statusMessage || undefined,
    terminated,
    currentStationCode: currentStationCode || undefined,
    platform,
    positionHint: null,
    stops: stations,
    fetchedAt: new Date().toISOString(),
    // Served from the live upstream, not the fallback.
    isMock: false,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trainNumber = normalizeTrainNumber(searchParams.get("trainNumber"));

  // Reject malformed input early with an explicit 400 rather than silently
  // forwarding a bad parameter to the third-party API.
  if (!trainNumber) {
    return NextResponse.json(
      {
        error: "invalid_train_number",
        message: "A 5-digit train number is required (e.g. 12951).",
      },
      { status: 400 },
    );
  }

  // Read the secret server-side only. Never interpolate it into any response.
  const apiKey = process.env.RAPIDAPI_KEY?.trim();

  // Without a configured key we cannot call upstream — degrade gracefully.
  if (!apiKey) {
    const mock = buildMockTrainStatus(trainNumber);
    return NextResponse.json(
      { ...mock, notice: "RAPIDAPI_KEY not configured — serving mock data." },
      { status: 200, headers: { "x-train-source": "mock" } },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const url = new URL(`https://${RAPIDAPI_HOST}${STATUS_PATH}`);
    url.searchParams.set("train_number", trainNumber);
    // The IRCTC endpoint keys its cache on the departure date; default to today.
    url.searchParams.set("departure_date", toYmd(new Date()));
    url.searchParams.set("isH5", "true");
    url.searchParams.set("client", RAPIDAPI_CLIENT);
    url.searchParams.set("deviceIdentifier", RAPIDAPI_DEVICE_IDENTIFIER);

    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!upstream.ok) {
      throw new Error(`upstream responded ${upstream.status}`);
    }

    const json = await upstream.json();
    const formatted = normalizeUpstream(trainNumber, json);

    return NextResponse.json(formatted, {
      status: 200,
      headers: { "x-train-source": "live" },
    });
  } catch (err) {
    // Any network error, timeout/abort, non-2xx, or JSON parse failure lands
    // here. Return robust mock data with a 200 so the client stays functional.
    const mock = buildMockTrainStatus(trainNumber);
    const reason = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json(
      { ...mock, notice: `Upstream unavailable (${reason}) — serving mock data.` },
      { status: 200, headers: { "x-train-source": "mock", "x-upstream-error": "1" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
