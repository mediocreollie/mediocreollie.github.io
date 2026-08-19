export const ADELAIDE_TIMEZONE = "Australia/Adelaide";

export function parseGtfsTime(value) {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  if (![hours, minutes, seconds].every(Number.isFinite)) throw new Error(`Invalid GTFS time: ${value}`);
  return hours * 3600 + minutes * 60 + seconds;
}

function partsFor(date, timeZone = ADELAIDE_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

export function zonedLocalToDate(local, timeZone = ADELAIDE_TIMEZONE) {
  const target = Date.UTC(local.year, local.month - 1, local.day, local.hour || 0, local.minute || 0, local.second || 0);
  let candidate = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = partsFor(new Date(candidate), timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    candidate += target - represented;
  }
  return new Date(candidate);
}

export function dateKeyInZone(date, timeZone = ADELAIDE_TIMEZONE) {
  const parts = partsFor(date, timeZone);
  return `${parts.year}${String(parts.month).padStart(2, "0")}${String(parts.day).padStart(2, "0")}`;
}

export function serviceDateFromKey(key) {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(4, 6)), day: Number(key.slice(6, 8)) };
}

export function addCalendarDays(dateKey, days) {
  const local = serviceDateFromKey(dateKey);
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day + days, 12));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function gtfsDateTime(serviceDateKey, gtfsTime, timeZone = ADELAIDE_TIMEZONE) {
  const local = serviceDateFromKey(serviceDateKey);
  const totalSeconds = parseGtfsTime(gtfsTime);
  const dayOffset = Math.floor(totalSeconds / 86400);
  const seconds = totalSeconds % 86400;
  const shifted = new Date(Date.UTC(local.year, local.month - 1, local.day + dayOffset, 12));
  return zonedLocalToDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: Math.floor(seconds / 3600),
    minute: Math.floor((seconds % 3600) / 60),
    second: seconds % 60,
  }, timeZone);
}

export function serviceRuns(service, dateKey, timeZone = ADELAIDE_TIMEZONE) {
  if (!service) return false;
  if (service.exceptions?.[dateKey] === 1) return true;
  if (service.exceptions?.[dateKey] === 2) return false;
  if (dateKey < service.startDate || dateKey > service.endDate) return false;
  const noon = gtfsDateTime(dateKey, "12:00:00", timeZone);
  const weekday = Number(new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "short" }).format(noon) === "Sun" ? 0 :
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "short" }).format(noon)) + 1);
  return service.weekdays[weekday] === 1;
}

export function isTripUseful(stopTimes, boardingStopIds, dropStopIds) {
  const sorted = [...stopTimes].sort((a, b) => a.sequence - b.sequence);
  return sorted.some((board) => boardingStopIds.has(board.stopId) && sorted.some((drop) => dropStopIds.has(drop.stopId) && drop.sequence > board.sequence));
}

export function applyPrediction(scheduledDate, realtimeStop) {
  const epoch = realtimeStop?.departureTime ?? realtimeStop?.arrivalTime;
  if (Number.isFinite(epoch)) return { date: new Date(epoch * 1000), source: "LIVE" };
  if (Number.isFinite(realtimeStop?.delay)) return { date: new Date(scheduledDate.getTime() + realtimeStop.delay * 1000), source: "LIVE" };
  return { date: scheduledDate, source: "SCHEDULED" };
}

export function catchability(departureDate, now, walkMinutes, safetyBufferMinutes = 3) {
  const minutesUntil = (departureDate.getTime() - now.getTime()) / 60000;
  const margin = minutesUntil - walkMinutes;
  if (margin < safetyBufferMinutes) return { key: "tight", label: "TOO TIGHT", catchable: false, minutesUntil };
  if (margin >= 12) return { key: "plenty", label: "PLENTY OF TIME", catchable: true, minutesUntil };
  return { key: "catchable", label: "CATCHABLE", catchable: true, minutesUntil };
}

export function walkClass(minutes) {
  if (minutes <= 10) return "Great";
  if (minutes <= 20) return "Good";
  if (minutes <= 30) return "Long walk";
  return null;
}

export function chooseBestDrop(trip, serviceDateKey, realtimeStops = [], timeZone = ADELAIDE_TIMEZONE) {
  const realtimeByKey = new Map();
  for (const stop of realtimeStops) {
    realtimeByKey.set(`${stop.stopId || ""}:${stop.stopSequence || ""}`, stop);
    if (stop.stopId) realtimeByKey.set(stop.stopId, stop);
  }
  return trip.drops
    .filter((drop) => drop.finalWalkMinutes <= 30)
    .map((drop) => {
      const scheduled = gtfsDateTime(serviceDateKey, drop.arrival, timeZone);
      const realtime = realtimeByKey.get(`${drop.stopId}:${drop.sequence}`) || realtimeByKey.get(drop.stopId);
      const predicted = applyPrediction(scheduled, realtime);
      return { ...drop, arrivalDate: predicted.date, source: predicted.source, homeDate: new Date(predicted.date.getTime() + drop.finalWalkMinutes * 60000) };
    })
    .sort((a, b) => a.homeDate - b.homeDate || a.finalWalkMinutes - b.finalWalkMinutes)[0];
}

export function buildOptions(config, realtime, now = new Date()) {
  const currentKey = dateKeyInZone(now, config.timezone);
  const serviceDays = [addCalendarDays(currentKey, -1), currentKey, addCalendarDays(currentKey, 1)];
  const updates = new Map();
  for (const update of realtime?.updates || []) {
    const entries = updates.get(update.tripId) || [];
    entries.push(update);
    updates.set(update.tripId, entries);
  }
  const options = [];
  for (const serviceDateKey of serviceDays) {
    for (const trip of config.trips) {
      if (!serviceRuns(config.services[trip.serviceId], serviceDateKey, config.timezone)) continue;
      const scheduledDeparture = gtfsDateTime(serviceDateKey, trip.board.departure, config.timezone);
      const update = (updates.get(trip.tripId) || []).find((candidate) => !candidate.startDate || candidate.startDate === serviceDateKey);
      if (update?.scheduleRelationship === "CANCELED") continue;
      const boardUpdate = update?.stops?.find((stop) => (stop.stopId === trip.board.stopId && (!stop.stopSequence || stop.stopSequence === trip.board.sequence)) || stop.stopSequence === trip.board.sequence);
      const departure = applyPrediction(scheduledDeparture, boardUpdate);
      const minutesAway = (departure.date - now) / 60000;
      if (minutesAway < -2 || minutesAway > 300) continue;
      const drop = chooseBestDrop(trip, serviceDateKey, update?.stops || [], config.timezone);
      if (!drop || drop.finalWalkMinutes > config.maxFinalWalkMinutes) continue;
      const status = catchability(departure.date, now, trip.board.cbdWalkMinutes, config.safetyBufferMinutes);
      const route = config.routes[trip.routeId];
      const alerts = (realtime?.alerts || []).filter((alert) => alert.routeIds?.includes(trip.routeId) || alert.stopIds?.includes(trip.board.stopId) || alert.stopIds?.includes(drop.stopId));
      options.push({
        id: `${trip.tripId}:${serviceDateKey}`,
        publicTransportLegs: 1,
        trip,
        route,
        boardStop: config.stops[trip.board.stopId],
        dropStop: config.stops[drop.stopId],
        departureDate: departure.date,
        source: departure.source,
        drop,
        status,
        alerts,
      });
    }
  }
  const deduped = [...new Map(options.map((option) => [option.id, option])).values()];
  return deduped.sort((a, b) => Number(b.status.catchable) - Number(a.status.catchable) || a.drop.homeDate - b.drop.homeDate || a.drop.finalWalkMinutes - b.drop.finalWalkMinutes);
}
