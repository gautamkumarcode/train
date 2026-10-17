/**
 * Shared contract for live train status data used by both the
 * `/api/train-status` route handler (server) and the client hooks/components.
 *
 * The RapidAPI `indian-railway-irctc` payloads are messy and inconsistently
 * cased, so the route handler normalizes everything into this shape before it
 * reaches the browser. Mock fallback data conforms to the same contract, which
 * keeps the UI free of null-guessing.
 */

export type TrainStatusKind =
  | "ON_TIME"
  | "DELAYED"
  | "CANCELLED"
  | "UNKNOWN";

/** A single station on the train's route with arrival/departure detail. */
export interface StationStop {
  code: string;
  name: string;
  /** Scheduled arrival in "HH:MM" 24h, or null if origin/unknown. */
  scheduledArrival: string | null;
  /** Scheduled departure in "HH:MM" 24h, or null if terminal/unknown. */
  scheduledDeparture: string | null;
  /** Live/estimated arrival in "HH:MM" 24h, null if not yet broadcast. */
  currentArrival: string | null;
  /** Live/estimated departure in "HH:MM" 24h, null if not yet broadcast. */
  currentDeparture: string | null;
  /** Delay in minutes at this stop; 0 means on time, null means unknown. */
  delayMinutes: number | null;
}

/** Normalized live-status payload returned by the API route. */
export interface TrainStatus {
  trainNumber: string;
  trainName: string;
  sourceStation: string;
  destinationStation: string;
  /** Current station the train most recently passed/halted at. */
  lastReportedStation: string;
  status: TrainStatusKind;
  delayMinutes: number;
  /** Distance in km still to travel, when known. */
  distanceRemainingKm: number | null;
  /** Human ETA at destination, e.g. "today, 22:40". */
  expectedArrival: string;
  /**
   * Raw human-readable status line from the live upstream (IRCTC
   * `train_status_message`), e.g. "Train is running / Late by 25 min".
   * Absent for mock data.
   */
  statusMessage?: string;
  /** Whether the live feed reported the journey as terminated. */
  terminated?: boolean;
  /** Station code the train is currently at (for highlighting the route row). */
  currentStationCode?: string;
  /** Platform number if broadcast, otherwise null. */
  platform: number | null;
  /** Coach position hint for the nostalgic "where is my berth" feel. */
  positionHint: string | null;
  stops: StationStop[];
  /** ISO timestamp of when this snapshot was produced by the server. */
  fetchedAt: string;
  /** True when served from mock fallback rather than the live upstream. */
  isMock: boolean;
}

/** A tuned, deterministic mock snapshot for a handful of beloved trains. */
export const MOCK_TRAINS: Record<string, Omit<TrainStatus, "fetchedAt" | "isMock">> = {
  "12951": {
    trainNumber: "12951",
    trainName: "Rajkot – Mumbai Central Express",
    sourceStation: "RAJKOT JN",
    destinationStation: "MUMBAI CENTRAL",
    lastReportedStation: "SURAT",
    status: "DELAYED",
    delayMinutes: 45,
    distanceRemainingKm: 212,
    expectedArrival: "tonight, 06:15",
    platform: 3,
    positionHint: "S4 coach · berth 42 · lower",
    stops: [
      {
        code: "ST",
        name: "SURAT",
        scheduledArrival: "23:52",
        scheduledDeparture: "23:57",
        currentArrival: "00:31",
        currentDeparture: "00:36",
        delayMinutes: 39,
      },
      {
        code: "BVC",
        name: "BHARUCH JN",
        scheduledArrival: "01:06",
        scheduledDeparture: "01:09",
        currentArrival: null,
        currentDeparture: null,
        delayMinutes: null,
      },
    ],
  },
  "12301": {
    trainNumber: "12301",
    trainName: "Howrah – New Delhi Rajdhani Express",
    sourceStation: "HOWRAH JN",
    destinationStation: "NEW DELHI",
    lastReportedStation: "GAYA JN",
    status: "ON_TIME",
    delayMinutes: 0,
    distanceRemainingKm: 762,
    expectedArrival: "tomorrow, 07:05",
    platform: null,
    positionHint: "B2 coach · berth 17 · upper",
    stops: [
      {
        code: "GAYA",
        name: "GAYA JN",
        scheduledArrival: "02:18",
        scheduledDeparture: "02:26",
        currentArrival: "02:21",
        currentDeparture: "02:28",
        delayMinutes: 3,
      },
      {
        code: "PNBE",
        name: "PATNA JN",
        scheduledArrival: "04:15",
        scheduledDeparture: "04:25",
        currentArrival: null,
        currentDeparture: null,
        delayMinutes: null,
      },
    ],
  },
  "12627": {
    trainNumber: "12627",
    trainName: "Chennai Central – Bangalore Express",
    sourceStation: "MAS CHENNAI",
    destinationStation: "SBC BANGALORE",
    lastReportedStation: "JOLARPALLEI",
    status: "DELAYED",
    delayMinutes: 90,
    distanceRemainingKm: 168,
    expectedArrival: "tonight, 05:50",
    platform: 2,
    positionHint: "A1 coach · seat 88 · window",
    stops: [
      {
        code: "JPD",
        name: "JOLARPALLEI",
        scheduledArrival: "23:14",
        scheduledDeparture: "23:16",
        currentArrival: "00:38",
        currentDeparture: "00:41",
        delayMinutes: 84,
      },
    ],
  },
};

/**
 * Returns a fresh mock snapshot, optionally seeded with the requested train
 * number so the UI never contradicts the user's typed query. Used both when
 * the upstream is unreachable and when a well-formed number has no mock entry.
 */
export function buildMockTrainStatus(trainNumber: string): TrainStatus {
  const base =
    MOCK_TRAINS[trainNumber] ??
    ({
      trainNumber,
      trainName: "Unverified Service",
      sourceStation: "SOURCE · —",
      destinationStation: "DEST · —",
      lastReportedStation: "EN-ROUTE",
      status: "UNKNOWN" as TrainStatusKind,
      delayMinutes: 0,
      distanceRemainingKm: null,
      expectedArrival: "awaiting broadcast",
      platform: null,
      positionHint: null,
      stops: [],
    } satisfies Omit<TrainStatus, "fetchedAt" | "isMock">);

  return {
    ...base,
    trainNumber,
    fetchedAt: new Date().toISOString(),
    isMock: true,
  };
}
