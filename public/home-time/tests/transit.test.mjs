import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  applyPrediction,
  buildOptions,
  catchability,
  chooseBestDrop,
  gtfsDateTime,
  isTripUseful,
  parseGtfsTime,
  walkClass,
  zonedLocalToDate,
} from "../lib/transit.mjs";

const config = JSON.parse(fs.readFileSync(new URL("../data/transit-config.json", import.meta.url)));

test("HOME is public stop ID 16355", () => {
  assert.equal(config.home.publicId, "16355");
  assert.equal(config.home.name, "Stop 29B Seaview Rd - East side");
});

test("every generated drop-off is within 30 minutes", () => {
  for (const trip of config.trips) for (const drop of trip.drops) assert.ok(drop.finalWalkMinutes <= 30);
});

test("a 31-minute walk is excluded", () => {
  const trip = { drops: [{ stopId: "far", arrival: "20:00:00", sequence: 2, finalWalkMinutes: 31 }] };
  assert.equal(chooseBestDrop(trip, "20260818"), undefined);
  assert.equal(walkClass(31), null);
});

test("Grange Railway Station uses the 15-minute calibrated walk", () => {
  const grange = Object.values(config.stops).filter((stop) => stop.name === "Grange Railway Station");
  assert.ok(grange.length > 0);
  assert.ok(grange.every((stop) => stop.finalWalkMinutes === 15));
});

test("a trip in the wrong direction is excluded", () => {
  const times = [{ stopId: "home", sequence: 1 }, { stopId: "cbd", sequence: 2 }];
  assert.equal(isTripUseful(times, new Set(["cbd"]), new Set(["home"])), false);
});

test("a route variant that never reaches a candidate stop is excluded", () => {
  const times = [{ stopId: "cbd", sequence: 1 }, { stopId: "elsewhere", sequence: 2 }];
  assert.equal(isTripUseful(times, new Set(["cbd"]), new Set(["home"])), false);
});

test("a realtime prediction replaces the scheduled time", () => {
  const scheduled = new Date("2026-08-18T10:00:00Z");
  const predicted = applyPrediction(scheduled, { departureTime: 1787049000 });
  assert.equal(predicted.source, "LIVE");
  assert.equal(predicted.date.getTime(), 1787049000 * 1000);
});

test("scheduled time remains labelled SCHEDULED when realtime is absent", () => {
  const scheduled = new Date("2026-08-18T10:00:00Z");
  const result = applyPrediction(scheduled);
  assert.equal(result.source, "SCHEDULED");
  assert.equal(result.date, scheduled);
});

test("GTFS times over 24:00 roll into the following day", () => {
  assert.equal(parseGtfsTime("25:10:00"), 90600);
  assert.equal(gtfsDateTime("20260818", "25:10:00").toISOString(), "2026-08-18T15:40:00.000Z");
});

test("Australia/Adelaide daylight saving offsets are respected", () => {
  assert.equal(gtfsDateTime("20260115", "12:00:00").toISOString(), "2026-01-15T01:30:00.000Z");
  assert.equal(gtfsDateTime("20260715", "12:00:00").toISOString(), "2026-07-15T02:30:00.000Z");
});

test("a departure before walk plus safety allowance is too tight", () => {
  const now = new Date("2026-08-18T10:00:00Z");
  const departure = new Date("2026-08-18T10:10:00Z");
  assert.equal(catchability(departure, now, 8, 3).label, "TOO TIGHT");
});

test("V1 options contain exactly one public-transport leg", () => {
  const now = zonedLocalToDate({ year: 2026, month: 8, day: 18, hour: 18, minute: 0, second: 0 });
  const options = buildOptions(config, null, now);
  assert.ok(options.length > 0);
  assert.ok(options.every((option) => option.publicTransportLegs === 1));
});
