import fs from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
import { Readable } from "node:stream";
import AdmZip from "adm-zip";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "data", "raw");
const GTFS = path.join(RAW, "gtfs");
const OUTPUT = path.join(ROOT, "src", "data", "transit-config.json");
const REPORT = path.join(ROOT, "docs", "home-time-network-discovery.md");
const REFRESH = process.argv.includes("--refresh");
const STATIC_URL = "https://gtfs.adelaidemetro.com.au/v1/static/latest/google_transit.zip";
const VERSION_URL = "https://gtfs.adelaidemetro.com.au/v1/static/latest/version.txt";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const HOME_PUBLIC_ID = "16355";
const MAX_FINAL_WALK = 30;
const WALK_METRES_PER_MINUTE = 80;
const WALK_BUFFER = 1.12;
const EXPECTED_ROUTES = ["H30", "H30S", "X30", "X30S", "N30", "H33", "287", "286", "H22", "H32"];
const TRIP_UPDATES_URL = "https://gtfs.adelaidemetro.com.au/v1/realtime/trip_updates";
const SERVICE_ALERTS_URL = "https://gtfs.adelaidemetro.com.au/v1/realtime/service_alerts";

fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(path.dirname(REPORT), { recursive: true });

async function download(url, destination) {
  const response = await fetch(url, { headers: { "user-agent": "Get-Me-Home/1.0" } });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`);
  const file = fs.createWriteStream(destination);
  Readable.fromWeb(response.body).pipe(file);
  await finished(file);
}

async function ensureInputs() {
  const zipPath = path.join(RAW, "google_transit.zip");
  if (REFRESH || !fs.existsSync(zipPath)) {
    await download(STATIC_URL, zipPath);
    await download(VERSION_URL, path.join(RAW, "version.txt"));
  }
  if (REFRESH || !fs.existsSync(path.join(GTFS, "stops.txt"))) {
    fs.rmSync(GTFS, { recursive: true, force: true });
    new AdmZip(zipPath).extractAllTo(GTFS, true);
  }
  await ensureOsm("henley-osm.json", "-34.95,138.45,-34.87,138.54");
  await ensureOsm("cbd-osm.json", "-34.94,138.58,-34.90,138.62");
}

async function ensureOsm(filename, bbox) {
  const destination = path.join(RAW, filename);
  if (!REFRESH && fs.existsSync(destination)) return;
  const query = `[out:json][timeout:120];way["highway"](${bbox});(._;>;);out body;`;
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Get-Me-Home/1.0" },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) throw new Error(`OpenStreetMap walking graph download failed (${response.status})`);
  fs.writeFileSync(destination, await response.text());
}

function csv(filename) {
  return parseSync(fs.readFileSync(path.join(GTFS, filename)), { columns: true, skip_empty_lines: true, bom: true });
}

function haversine(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(h));
}

function buildWalkingGraph(filename) {
  const data = JSON.parse(fs.readFileSync(path.join(RAW, filename), "utf8"));
  const nodes = new Map();
  for (const element of data.elements) {
    if (element.type === "node") nodes.set(element.id, { lat: element.lat, lon: element.lon });
  }
  const adjacency = new Map();
  const blockedHighways = new Set(["motorway", "motorway_link", "trunk", "trunk_link", "construction", "proposed"]);
  const addEdge = (from, to, metres) => {
    const edges = adjacency.get(from) || [];
    edges.push([to, metres]);
    adjacency.set(from, edges);
  };
  for (const way of data.elements) {
    if (way.type !== "way" || !way.tags?.highway || blockedHighways.has(way.tags.highway)) continue;
    if (way.tags.foot === "no" || way.tags.access === "private") continue;
    for (let i = 1; i < way.nodes.length; i += 1) {
      const from = nodes.get(way.nodes[i - 1]);
      const to = nodes.get(way.nodes[i]);
      if (!from || !to) continue;
      const metres = haversine(from, to);
      addEdge(way.nodes[i - 1], way.nodes[i], metres);
      addEdge(way.nodes[i], way.nodes[i - 1], metres);
    }
  }
  return { nodes, adjacency };
}

function nearestNode(point, nodes) {
  let nearest;
  let distance = Infinity;
  for (const [id, node] of nodes) {
    const candidate = haversine(point, node);
    if (candidate < distance) {
      nearest = id;
      distance = candidate;
    }
  }
  return { id: nearest, snapMetres: distance };
}

class MinHeap {
  values = [];
  push(value) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent][0] <= value[0]) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }
  pop() {
    if (!this.values.length) return undefined;
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length && last) {
      let index = 0;
      while (true) {
        let child = index * 2 + 1;
        if (child >= this.values.length) break;
        if (child + 1 < this.values.length && this.values[child + 1][0] < this.values[child][0]) child += 1;
        if (this.values[child][0] >= last[0]) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = last;
    }
    return first;
  }
}

function dijkstra(startId, adjacency) {
  const distances = new Map([[startId, 0]]);
  const queue = new MinHeap();
  queue.push([0, startId]);
  while (queue.values.length) {
    const [distance, id] = queue.pop();
    if (distance !== distances.get(id)) continue;
    for (const [next, edge] of adjacency.get(id) || []) {
      const candidate = distance + edge;
      if (candidate < (distances.get(next) ?? Infinity)) {
        distances.set(next, candidate);
        queue.push([candidate, next]);
      }
    }
  }
  return distances;
}

function walkingMinutes(point, graph, distances) {
  const snap = nearestNode(point, graph.nodes);
  const network = distances.get(snap.id);
  if (!Number.isFinite(network)) return null;
  return Math.ceil(((network + snap.snapMetres) / WALK_METRES_PER_MINUTE) * WALK_BUFFER);
}

function stopPoint(stop) {
  return { lat: Number(stop.stop_lat), lon: Number(stop.stop_lon) };
}

function gtfsSeconds(value) {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

async function readRelevantStopTimes(relevantStopIds) {
  const byTrip = new Map();
  const parser = fs.createReadStream(path.join(GTFS, "stop_times.txt")).pipe(parse({ columns: true, skip_empty_lines: true, bom: true }));
  for await (const row of parser) {
    if (!relevantStopIds.has(row.stop_id)) continue;
    const entries = byTrip.get(row.trip_id) || [];
    entries.push({
      stopId: row.stop_id,
      arrival: row.arrival_time,
      departure: row.departure_time,
      sequence: Number(row.stop_sequence),
      pickupType: Number(row.pickup_type || 0),
      dropOffType: Number(row.drop_off_type || 0),
    });
    byTrip.set(row.trip_id, entries);
  }
  return byTrip;
}

function formatStop(stop, walkMinutes, kind) {
  return {
    id: stop.stop_id,
    publicId: stop.stop_code || null,
    name: stop.stop_name,
    lat: Number(stop.stop_lat),
    lon: Number(stop.stop_lon),
    ...(kind === "drop" ? { finalWalkMinutes: walkMinutes } : { cbdWalkMinutes: walkMinutes }),
  };
}

await ensureInputs();
const stops = csv("stops.txt");
const routes = csv("routes.txt");
const trips = csv("trips.txt");
const calendars = csv("calendar.txt");
const calendarDates = csv("calendar_dates.txt");
const stopById = new Map(stops.map((stop) => [stop.stop_id, stop]));
const routeById = new Map(routes.map((route) => [route.route_id, route]));
const tripById = new Map(trips.map((trip) => [trip.trip_id, trip]));
const home = stops.find((stop) => stop.stop_code === HOME_PUBLIC_ID);
if (!home) throw new Error(`HOME public stop ID ${HOME_PUBLIC_ID} was not found`);
const homePoint = stopPoint(home);

const henleyGraph = buildWalkingGraph("henley-osm.json");
const homeSnap = nearestNode(homePoint, henleyGraph.nodes);
const homeDistances = dijkstra(homeSnap.id, henleyGraph.adjacency);
const geographicallyAssessed = stops.filter((stop) => stop.stop_lat && stop.stop_lon && stop.location_type !== "1");
const nearHome = geographicallyAssessed.filter((stop) => haversine(homePoint, stopPoint(stop)) <= 3_200);
const finalWalkByStop = new Map();
for (const stop of nearHome) {
  let minutes = walkingMinutes(stopPoint(stop), henleyGraph, homeDistances);
  if (stop.stop_id === home.stop_id) minutes = 0;
  if (stop.stop_name === "Grange Railway Station") minutes = 15;
  if (minutes !== null && minutes <= MAX_FINAL_WALK) finalWalkByStop.set(stop.stop_id, minutes);
}

const origin = stops.find((stop) => stop.stop_name === "Adelaide Railway Station" && stop.location_type !== "1");
if (!origin) throw new Error("Adelaide Railway Station origin was not found");
const cbdGraph = buildWalkingGraph("cbd-osm.json");
const originSnap = nearestNode(stopPoint(origin), cbdGraph.nodes);
const originDistances = dijkstra(originSnap.id, cbdGraph.adjacency);
const cbdWalkByStop = new Map();
for (const stop of geographicallyAssessed) {
  if (haversine(stopPoint(origin), stopPoint(stop)) > 1_800) continue;
  let minutes = walkingMinutes(stopPoint(stop), cbdGraph, originDistances);
  if (stop.stop_id === origin.stop_id) minutes = 0;
  if (minutes !== null && minutes <= 22) cbdWalkByStop.set(stop.stop_id, minutes);
}

const relevantStopIds = new Set([...finalWalkByStop.keys(), ...cbdWalkByStop.keys()]);
const stopTimesByTrip = await readRelevantStopTimes(relevantStopIds);
const usefulTrips = [];
const allReachedDropIds = new Set();
const exclusion = { noCbdBeforeDrop: 0, noReachableDrop: 0 };

for (const [tripId, entries] of stopTimesByTrip) {
  const trip = tripById.get(tripId);
  if (!trip) continue;
  const sorted = entries.sort((a, b) => a.sequence - b.sequence);
  const drops = sorted.filter((entry) => finalWalkByStop.has(entry.stopId) && entry.dropOffType !== 1);
  if (!drops.length) continue;
  const boards = sorted.filter((entry) => cbdWalkByStop.has(entry.stopId) && entry.pickupType !== 1 && drops.some((drop) => drop.sequence > entry.sequence));
  if (!boards.length) {
    exclusion.noCbdBeforeDrop += 1;
    continue;
  }
  const board = boards.sort((a, b) => {
    const walkDifference = cbdWalkByStop.get(a.stopId) - cbdWalkByStop.get(b.stopId);
    return walkDifference || b.sequence - a.sequence;
  })[0];
  const usableDrops = drops
    .filter((drop) => drop.sequence > board.sequence)
    .map((drop) => ({ ...drop, finalWalkMinutes: finalWalkByStop.get(drop.stopId) }));
  if (!usableDrops.length) {
    exclusion.noReachableDrop += 1;
    continue;
  }
  for (const drop of usableDrops) allReachedDropIds.add(drop.stopId);
  const bestDrop = usableDrops.sort((a, b) =>
    (gtfsSeconds(a.arrival) + a.finalWalkMinutes * 60) - (gtfsSeconds(b.arrival) + b.finalWalkMinutes * 60) ||
    a.finalWalkMinutes - b.finalWalkMinutes
  )[0];
  usefulTrips.push({
    tripId,
    routeId: trip.route_id,
    serviceId: trip.service_id,
    headsign: trip.trip_headsign,
    directionId: trip.direction_id,
    board: { ...board, cbdWalkMinutes: cbdWalkByStop.get(board.stopId) },
    drops: [bestDrop],
  });
}

const usefulRouteIds = [...new Set(usefulTrips.map((trip) => trip.routeId))];
const usefulRoutes = Object.fromEntries(usefulRouteIds.map((id) => {
  const route = routeById.get(id);
  return [id, {
    id,
    shortName: route.route_short_name,
    longName: route.route_long_name,
    type: Number(route.route_type),
    color: route.route_color || "243E8C",
    textColor: route.route_text_color || "ffffff",
  }];
}));
const usedStopIds = new Set(usefulTrips.flatMap((trip) => [trip.board.stopId, ...trip.drops.map((drop) => drop.stopId)]));
const compactStops = {};
for (const id of usedStopIds) {
  const stop = stopById.get(id);
  if (finalWalkByStop.has(id)) compactStops[id] = formatStop(stop, finalWalkByStop.get(id), "drop");
  if (cbdWalkByStop.has(id)) compactStops[id] = { ...compactStops[id], ...formatStop(stop, cbdWalkByStop.get(id), "board") };
}

const services = Object.fromEntries(calendars.map((service) => [service.service_id, {
  startDate: service.start_date,
  endDate: service.end_date,
  weekdays: [service.sunday, service.monday, service.tuesday, service.wednesday, service.thursday, service.friday, service.saturday].map(Number),
  exceptions: {},
}]));
for (const exception of calendarDates) {
  services[exception.service_id] ||= { startDate: exception.date, endDate: exception.date, weekdays: [0, 0, 0, 0, 0, 0, 0], exceptions: {} };
  services[exception.service_id].exceptions[exception.date] = Number(exception.exception_type);
}

const feedVersion = fs.existsSync(path.join(RAW, "version.txt")) ? fs.readFileSync(path.join(RAW, "version.txt"), "utf8").trim() : "unknown";
const generatedAt = new Date().toISOString();
const config = {
  generatedAt,
  feedVersion,
  timezone: "Australia/Adelaide",
  safetyBufferMinutes: 3,
  maxFinalWalkMinutes: MAX_FINAL_WALK,
  dataSources: { static: STATIC_URL, realtime: "PUBLIC_HOME_TIME_REALTIME_URL", walking: "OpenStreetMap pedestrian network snapshot" },
  home: { ...formatStop(home, 0, "drop"), label: "Henley Beach", publicId: HOME_PUBLIC_ID, gtfsStopId: home.stop_id },
  origin: { ...formatStop(origin, 0, "board"), label: "Adelaide Railway Station" },
  routes: usefulRoutes,
  stops: compactStops,
  services,
  trips: usefulTrips,
  discovery: {
    stopsAssessed: geographicallyAssessed.length,
    stopsRoutedNearHome: nearHome.length,
    viableHomeStops: finalWalkByStop.size,
    excludedOver30: nearHome.length - finalWalkByStop.size,
    excludedDirectionOrNoCbd: exclusion.noCbdBeforeDrop + exclusion.noReachableDrop,
  },
};
fs.writeFileSync(OUTPUT, `${JSON.stringify(config)}\n`);

const routeNames = Object.values(usefulRoutes).map((route) => route.shortName).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const busRoutes = Object.values(usefulRoutes).filter((route) => route.type === 3);
const railRoutes = Object.values(usefulRoutes).filter((route) => route.type === 2);
const boards = [...new Set(usefulTrips.map((trip) => trip.board.stopId))].map((id) => compactStops[id]);
const drops = [...allReachedDropIds].map((id) => formatStop(stopById.get(id), finalWalkByStop.get(id), "drop"));
const buckets = {
  ten: [...finalWalkByStop.values()].filter((minutes) => minutes <= 10).length,
  twenty: [...finalWalkByStop.values()].filter((minutes) => minutes >= 11 && minutes <= 20).length,
  thirty: [...finalWalkByStop.values()].filter((minutes) => minutes >= 21 && minutes <= 30).length,
};
const validations = EXPECTED_ROUTES.map((name) => `- ${name}: ${routeNames.includes(name) ? "validated as useful" : "not present as a useful one-seat trip in this feed"}`).join("\n");
let realtimeSnapshot = { ok: false, entities: 0, matched: 0, matchedRoutes: [], feedTimestamp: null, cors: null, alertsOk: false };
try {
  const [tripResponse, alertResponse] = await Promise.all([fetch(TRIP_UPDATES_URL), fetch(SERVICE_ALERTS_URL)]);
  const tripFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(await tripResponse.arrayBuffer()));
  const usefulByTrip = new Map(usefulTrips.map((trip) => [trip.tripId, usefulRoutes[trip.routeId]?.shortName]));
  const matchedEntities = tripFeed.entity.filter((entity) => usefulByTrip.has(entity.tripUpdate?.trip?.tripId));
  realtimeSnapshot = {
    ok: tripResponse.ok,
    entities: tripFeed.entity.length,
    matched: matchedEntities.length,
    matchedRoutes: [...new Set(matchedEntities.map((entity) => usefulByTrip.get(entity.tripUpdate.trip.tripId)))].sort(),
    feedTimestamp: Number(tripFeed.header.timestamp),
    cors: tripResponse.headers.get("access-control-allow-origin"),
    alertsOk: alertResponse.ok,
  };
} catch {
  // Static generation remains useful when the live feed is temporarily unavailable.
}
const report = `# Network discovery\n\nGenerated ${generatedAt} from Adelaide Metro GTFS version **${feedVersion}**. This is a reproducible feed snapshot, not a promise that every listed route operates at every time of day.\n\n## Home\n\n- Reference: Stop 29B Seaview Rd - East side\n- Public stop ID: ${HOME_PUBLIC_ID}\n- GTFS \`stop_id\`: ${home.stop_id} (Adelaide Metro publishes ${HOME_PUBLIC_ID} as \`stop_code\` in the current feed)\n- Coordinates: ${home.stop_lat}, ${home.stop_lon}\n- Maximum final walk: ${MAX_FINAL_WALK} conservative minutes\n\n## Walking area\n\n- Adelaide Metro stop records geographically assessed: ${geographicallyAssessed.length}\n- Stops routed within the 3.2 km candidate area: ${nearHome.length}\n- Stops within 0–10 conservative minutes: ${buckets.ten}\n- Stops within 11–20 conservative minutes: ${buckets.twenty}\n- Stops within 21–30 conservative minutes: ${buckets.thirty}\n- Candidate-area stops excluded over 30 minutes or not connected to the pedestrian graph: ${nearHome.length - finalWalkByStop.size}\n- Method: shortest paths over an OpenStreetMap pedestrian graph, 4.8 km/h base pace, 12% conservative buffer, rounded up. Grange Railway Station is manually overridden to 15 minutes.\n\n## Useful network\n\n- Unique useful bus routes: ${busRoutes.length}\n- Unique useful rail routes: ${railRoutes.length}\n- Unique CBD boarding stops: ${boards.length}\n- Unique candidate drop-off stops actually reached from the CBD: ${drops.length}\n- Useful scheduled trip patterns: ${usefulTrips.length}\n- Route numbers: ${routeNames.join(", ")}\n\n### Boarding stops\n\n${boards.sort((a, b) => a.cbdWalkMinutes - b.cbdWalkMinutes).map((stop) => `- ${stop.name} (${stop.publicId || stop.id}): ${stop.cbdWalkMinutes} min walk`).join("\n")}\n\n### Drop-off stops\n\n${drops.sort((a, b) => a.finalWalkMinutes - b.finalWalkMinutes).map((stop) => `- ${stop.name} (${stop.publicId || stop.id}): ${stop.finalWalkMinutes} min walk home`).join("\n")}\n\n## Known-route validation\n\n${validations}\n\nDirection and route variants are validated per trip: the boarding stop must occur before a reachable home-area stop in that trip's stop sequence. A route number alone never makes a trip eligible.\n\n## Realtime\n\n- Trip updates endpoint: ${"https://gtfs.adelaidemetro.com.au/v1/realtime/trip_updates"}\n- Service alerts endpoint: ${"https://gtfs.adelaidemetro.com.au/v1/realtime/service_alerts"}\n- Direct browser CORS: unavailable in the response tested on ${generatedAt.slice(0, 10)} (no \`Access-Control-Allow-Origin\` header)\n- Resolution: the app exposes a same-origin, read-only server route that fetches and decodes the official protobuf feed. Scheduled departures remain available if it fails.\n- OpenStreetMap data © OpenStreetMap contributors, used under ODbL.\n`;
fs.writeFileSync(REPORT, report);
fs.appendFileSync(REPORT, `\n## Realtime validation snapshot\n\n- Feed endpoint successfully decoded: ${realtimeSnapshot.ok ? "yes" : "no"}\n- Live trip-update entities in this snapshot: ${realtimeSnapshot.entities}\n- Useful trip updates matched to the compact network: ${realtimeSnapshot.matched}\n- Matched route examples: ${realtimeSnapshot.matchedRoutes.join(", ") || "none during this snapshot"}\n- Feed timestamp: ${realtimeSnapshot.feedTimestamp ? new Date(realtimeSnapshot.feedTimestamp * 1000).toISOString() : "unavailable"}\n- Service-alert endpoint successfully tested: ${realtimeSnapshot.alertsOk ? "yes" : "no"}\n- CORS header returned by the trip feed: ${realtimeSnapshot.cors || "none"}\n- This is a time-of-day snapshot, not a general statement about Adelaide Metro realtime coverage.\n`);
console.log(`Generated ${path.relative(ROOT, OUTPUT)} with ${usefulTrips.length} useful trip patterns across ${routeNames.length} routes.`);
console.log(`Discovered ${finalWalkByStop.size} viable home-area stops and ${boards.length} CBD boarding stops.`);
