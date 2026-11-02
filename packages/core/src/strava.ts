/* Strava: what its API sends for an activity, and how that becomes an APEX activity.
   The token exchange happens in the `strava` edge function (supabase/functions/strava), because it
   needs the app's secret; the browser maps what comes back here and saves it like any other activity. */

import { thin, ROUTE_POINTS, type Activity, type Sport, type Split } from "./activity";

/** The fields APEX reads from Strava's SummaryActivity / DetailedActivity. */
export interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  kilojoules?: number;
  map?: { summary_polyline?: string | null; polyline?: string | null } | null;
  splits_metric?: { distance: number; moving_time: number; elapsed_time: number; average_heartrate?: number; elevation_difference?: number; split: number }[];
}

const STRAVA_SPORT: Record<string, Sport> = {
  Run: "run", TrailRun: "run", VirtualRun: "run",
  Swim: "swim",
  Ride: "ride", VirtualRide: "ride", GravelRide: "ride", MountainBikeRide: "ride", EBikeRide: "ride", EMountainBikeRide: "ride", Velomobile: "ride", Handcycle: "ride",
  Rowing: "row", VirtualRow: "row",
  Walk: "walk",
  Hike: "hike",
};

export const stravaSport = (a: Pick<StravaActivity, "sport_type" | "type">): Sport => STRAVA_SPORT[a.sport_type ?? ""] ?? STRAVA_SPORT[a.type ?? ""] ?? "other";

/** Google's encoded polyline format, which Strava uses for routes. */
export function decodePolyline(s: string, precision = 5): [number, number][] {
  const out: [number, number][] = [];
  const f = 10 ** precision;
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = s.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) {
    lat += next();
    lon += next();
    out.push([lat / f, lon / f]);
  }
  return out;
}

export function fromStravaActivity(a: StravaActivity, id: string): Activity {
  const line = a.map?.polyline || a.map?.summary_polyline;
  const route = line ? decodePolyline(line) : [];
  const splits: Split[] = (a.splits_metric ?? []).filter((s) => s.distance > 50).map((s) => ({
    n: s.split, metres: Math.round(s.distance), seconds: Math.round(s.moving_time),
    ...(s.average_heartrate ? { avgHr: Math.round(s.average_heartrate) } : {}),
    ...(s.elevation_difference !== undefined ? { elevationM: Math.round(s.elevation_difference) } : {}),
  }));
  // Rides report work in kJ; on a bike that's close to kcal burned.
  const calories = a.calories || (a.kilojoules ? Math.round(a.kilojoules) : undefined);
  const detail = { ...(route.length > 1 ? { route: thin(route, ROUTE_POINTS) } : {}), ...(splits.length ? { splits } : {}) };
  return {
    id,
    sport: stravaSport(a),
    name: a.name,
    startedAt: new Date(a.start_date).toISOString(),
    metres: Math.round(a.distance),
    movingSeconds: a.moving_time,
    elapsedSeconds: a.elapsed_time,
    ...(a.total_elevation_gain !== undefined ? { elevationGainM: Math.round(a.total_elevation_gain) } : {}),
    ...(a.average_heartrate ? { avgHr: Math.round(a.average_heartrate) } : {}),
    ...(a.max_heartrate ? { maxHr: Math.round(a.max_heartrate) } : {}),
    ...(calories ? { calories: Math.round(calories) } : {}),
    source: "strava",
    externalId: String(a.id),
    ...(Object.keys(detail).length ? { detail } : {}),
  };
}

export const STRAVA_SCOPES = "read,activity:read_all";

/** Where the client goes to say yes. `state` comes back unchanged so the app can check the reply is its own. */
export function stravaAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", approval_prompt: "auto", scope: STRAVA_SCOPES, state });
  return `https://www.strava.com/oauth/authorize?${q}`;
}
