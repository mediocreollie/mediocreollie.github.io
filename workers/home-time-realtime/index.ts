import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const TRIPS_URL = 'https://gtfs.adelaidemetro.com.au/v1/realtime/trip_updates';
const ALERTS_URL = 'https://gtfs.adelaidemetro.com.au/v1/realtime/service_alerts';

function epoch(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value && 'toNumber' in value) return (value as { toNumber(): number }).toNumber();
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function relationship(value: unknown) {
  const names = ['SCHEDULED', 'SKIPPED', 'NO_DATA', 'UNSCHEDULED', 'CANCELED', 'DUPLICATED', 'NEW', 'REPLACEMENT'];
  return typeof value === 'number' ? names[value] || String(value) : value ? String(value) : 'SCHEDULED';
}

function translatedText(value: any) {
  return value?.translation?.find((translation: any) => translation.language === 'en')?.text || value?.translation?.[0]?.text || '';
}

async function feed(url: string) {
  const response = await fetch(url, { headers: { accept: 'application/x-google-protobuf' } });
  if (!response.ok) throw new Error(`Feed returned ${response.status}`);
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(await response.arrayBuffer()));
}

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin') || '*';
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' } });
    const fetchedAt = new Date().toISOString();
    try {
      const [tripFeed, alertFeed] = await Promise.all([feed(TRIPS_URL), feed(ALERTS_URL)]);
      const updates = tripFeed.entity.flatMap((entity: any) => {
        const update = entity.tripUpdate;
        if (!update?.trip?.tripId) return [];
        return [{ tripId: update.trip.tripId, routeId: update.trip.routeId || null, startDate: update.trip.startDate || null, scheduleRelationship: relationship(update.trip.scheduleRelationship), stops: (update.stopTimeUpdate || []).map((stop: any) => ({ stopId: stop.stopId || null, stopSequence: stop.stopSequence || null, arrivalTime: epoch(stop.arrival?.time), departureTime: epoch(stop.departure?.time), delay: stop.departure?.delay ?? stop.arrival?.delay ?? null, scheduleRelationship: relationship(stop.scheduleRelationship) })) }];
      });
      const alerts = alertFeed.entity.flatMap((entity: any) => entity.alert ? [{ id: entity.id, header: translatedText(entity.alert.headerText) || 'Service disruption', description: translatedText(entity.alert.descriptionText).slice(0, 500), routeIds: [...new Set((entity.alert.informedEntity || []).map((item: any) => item.routeId).filter(Boolean))], stopIds: [...new Set((entity.alert.informedEntity || []).map((item: any) => item.stopId).filter(Boolean))] }] : []).slice(0, 40);
      return Response.json({ ok: true, fetchedAt, feedTimestamp: epoch(tripFeed.header.timestamp), inspectedTrips: tripFeed.entity.length, updates, alerts }, { headers: { 'Access-Control-Allow-Origin': origin, 'Cache-Control': 'public, max-age=20' } });
    } catch (error) {
      return Response.json({ ok: false, fetchedAt, error: error instanceof Error ? error.message : 'Realtime unavailable', updates: [], alerts: [] }, { status: 503, headers: { 'Access-Control-Allow-Origin': origin, 'Cache-Control': 'no-store' } });
    }
  },
};
