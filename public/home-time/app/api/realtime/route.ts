import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import config from "../../../data/transit-config.json";

export const dynamic = "force-dynamic";

const TRIPS_URL = "https://gtfs.adelaidemetro.com.au/v1/realtime/trip_updates";
const ALERTS_URL = "https://gtfs.adelaidemetro.com.au/v1/realtime/service_alerts";
const usefulTripIds = new Set(config.trips.map((trip) => trip.tripId));

function epoch(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value && "toNumber" in value) return (value as { toNumber(): number }).toNumber();
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function relationship(value: unknown) {
  const names = ["SCHEDULED", "SKIPPED", "NO_DATA", "UNSCHEDULED", "CANCELED", "DUPLICATED", "NEW", "REPLACEMENT"];
  return typeof value === "number" ? names[value] || String(value) : value ? String(value) : "SCHEDULED";
}

function translatedText(value: any) {
  return value?.translation?.find((translation: any) => translation.language === "en")?.text || value?.translation?.[0]?.text || "";
}

export async function GET() {
  const fetchedAt = new Date().toISOString();
  try {
    const [tripsResponse, alertsResponse] = await Promise.all([
      fetch(TRIPS_URL, { headers: { accept: "application/x-google-protobuf" } }),
      fetch(ALERTS_URL, { headers: { accept: "application/x-google-protobuf" } }),
    ]);
    if (!tripsResponse.ok) throw new Error(`Trip updates returned ${tripsResponse.status}`);
    const tripFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(await tripsResponse.arrayBuffer()));
    const updates = tripFeed.entity.flatMap((entity: any) => {
      const update = entity.tripUpdate;
      const tripId = update?.trip?.tripId;
      if (!tripId || !usefulTripIds.has(tripId)) return [];
      return [{
        tripId,
        routeId: update.trip.routeId || null,
        startDate: update.trip.startDate || null,
        scheduleRelationship: relationship(update.trip.scheduleRelationship),
        stops: (update.stopTimeUpdate || []).map((stop: any) => ({
          stopId: stop.stopId || null,
          stopSequence: stop.stopSequence || null,
          arrivalTime: epoch(stop.arrival?.time),
          departureTime: epoch(stop.departure?.time),
          delay: stop.departure?.delay ?? stop.arrival?.delay ?? null,
          scheduleRelationship: relationship(stop.scheduleRelationship),
        })),
      }];
    });
    let alerts: any[] = [];
    if (alertsResponse.ok) {
      const alertFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(await alertsResponse.arrayBuffer()));
      alerts = alertFeed.entity.flatMap((entity: any) => {
        if (!entity.alert) return [];
        const informed = entity.alert.informedEntity || [];
        return [{
          id: entity.id,
          header: translatedText(entity.alert.headerText) || "Service disruption",
          description: translatedText(entity.alert.descriptionText).slice(0, 500),
          routeIds: [...new Set(informed.map((item: any) => item.routeId).filter(Boolean))],
          stopIds: [...new Set(informed.map((item: any) => item.stopId).filter(Boolean))],
        }];
      }).slice(0, 40);
    }
    return Response.json({ ok: true, fetchedAt, feedTimestamp: epoch(tripFeed.header.timestamp), inspectedTrips: tripFeed.entity.length, updates, alerts }, {
      headers: { "Cache-Control": "public, max-age=20, s-maxage=25, stale-while-revalidate=60" },
    });
  } catch (error) {
    return Response.json({ ok: false, fetchedAt, error: error instanceof Error ? error.message : "Realtime unavailable", updates: [], alerts: [] }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
