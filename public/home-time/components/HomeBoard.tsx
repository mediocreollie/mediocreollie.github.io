"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import config from "../data/transit-config.json";
import { buildOptions, walkClass } from "../lib/transit.mjs";

type Realtime = {
  ok: boolean;
  fetchedAt: string;
  feedTimestamp?: number;
  inspectedTrips?: number;
  updates: unknown[];
  alerts: unknown[];
};

const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Adelaide",
  hour: "numeric",
  minute: "2-digit",
});
const updatedFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Adelaide",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

function minutesLabel(value: number) {
  if (value <= 0) return "Due";
  return `${Math.ceil(value)} min`;
}

function RouteIcon({ type }: { type: number }) {
  return <span className="mode-icon" aria-hidden="true">{type === 2 ? "T" : "B"}</span>;
}

export default function HomeBoard({ initialNow }: { initialNow: string }) {
  const [realtime, setRealtime] = useState<Realtime | null>(null);
  const [realtimeError, setRealtimeError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date(initialNow));
  const [sort, setSort] = useState<"home" | "departure">("home");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/realtime`, { cache: "no-store" });
      const result = await response.json() as Realtime;
      if (!response.ok || !result.ok) throw new Error("Realtime unavailable");
      setRealtime(result);
      setRealtimeError(false);
    } catch {
      setRealtimeError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const updateNetwork = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    refresh();
    const countdown = window.setInterval(() => setNow(new Date()), 15_000);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    if ("serviceWorker" in navigator) {
      const baseUrl = import.meta.env.BASE_URL;
      navigator.serviceWorker.register(`${baseUrl}sw.js`, { scope: baseUrl }).catch(() => undefined);
    }
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
      window.clearInterval(countdown);
      window.clearInterval(poll);
    };
  }, [refresh]);

  const options = useMemo(() => {
    const built = buildOptions(config, realtime, now);
    if (sort === "departure") {
      return [...built].sort((a, b) => Number(b.status.catchable) - Number(a.status.catchable) || a.departureDate - b.departureDate);
    }
    return built;
  }, [now, realtime, sort]);
  const visible = options.slice(0, 10);
  const viable = options.filter((option) => option.status.catchable);
  const uniqueRoutes = new Set(options.map((option) => option.route.shortName)).size;
  const shortestWalk = viable.length ? Math.min(...viable.map((option) => option.drop.finalWalkMinutes)) : null;
  const lastUpdated = realtime?.fetchedAt ? new Date(realtime.fetchedAt) : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ADELAIDE RAILWAY STATION <span aria-hidden="true">→</span> HENLEY BEACH</p>
          <h1>GET ME HOME</h1>
        </div>
        <button className="refresh" type="button" onClick={refresh} disabled={refreshing} aria-label="Refresh departures">
          <span aria-hidden="true" className={refreshing ? "spinning" : ""}>↻</span>
        </button>
      </header>

      <section className={`feed-banner ${realtimeError || !online ? "warning" : ""}`} aria-live="polite">
        <div>
          <span className="feed-dot" />
          <strong>{!online ? "You’re offline" : realtimeError ? "Live updates unavailable" : realtime ? "Live departures connected" : "Checking live departures"}</strong>
        </div>
        <span>{lastUpdated ? `Updated ${updatedFormatter.format(lastUpdated)}` : "Using today’s timetable"}</span>
      </section>

      <section className="utility-row" aria-label="Departure controls">
        <div className="result-count"><strong>{viable.length}</strong><span>catchable now</span></div>
        <div className="sort-control" aria-label="Sort departures">
          <button type="button" className={sort === "home" ? "active" : ""} onClick={() => setSort("home")}>Fastest home</button>
          <button type="button" className={sort === "departure" ? "active" : ""} onClick={() => setSort("departure")}>Next departures</button>
        </div>
      </section>

      {!online && <p className="notice">Times below are scheduled and may have changed. Reconnect for live predictions.</p>}

      <section className="departures" aria-label="Useful departures">
        {visible.length === 0 ? (
          <div className="empty-state">
            <span aria-hidden="true">⌁</span>
            <h2>No useful services found</h2>
            <p>There are no one-seat services in the next five hours that finish within a 30-minute walk of home.</p>
            <button type="button" onClick={refresh}>Check again</button>
          </div>
        ) : visible.map((option, index) => {
          const train = option.route.type === 2;
          const walkLabel = walkClass(option.drop.finalWalkMinutes);
          const statusSymbol = option.status.catchable ? "✓" : "!";
          return (
            <article className={`trip-card ${index === 0 && option.status.catchable ? "best" : ""} ${!option.status.catchable ? "too-tight-card" : ""}`} key={option.id}>
              {index === 0 && option.status.catchable && <p className="best-label">BEST WAY HOME RIGHT NOW</p>}
              <div className="card-top">
                <div className="route">
                  <RouteIcon type={option.route.type} />
                  <div>
                    <strong>{option.route.shortName}</strong>
                    <small>{option.trip.headsign || option.route.longName}</small>
                  </div>
                </div>
                <div className="leaves"><strong>{minutesLabel(option.status.minutesUntil)}</strong><span>until departure</span></div>
              </div>

              <div className="status-row">
                <span className={`status ${option.status.key}`}>{statusSymbol} {option.status.label}</span>
                <span>{timeFormatter.format(option.departureDate)} · <b className={option.source === "LIVE" ? "live" : "scheduled"}>{option.source}</b></span>
              </div>

              <div className="journey-line" aria-label={`Board ${option.boardStop.name}, get off ${option.dropStop.name}`}>
                <div className="journey-point">
                  <span className="point-marker start" />
                  <div><span>BOARD</span><strong>{option.boardStop.name}</strong><small>{train && option.trip.board.cbdWalkMinutes === 0 ? "Board here" : `${option.trip.board.cbdWalkMinutes} min walk to stop`}</small></div>
                </div>
                <div className="journey-stem" />
                <div className="journey-point">
                  <span className="point-marker finish" />
                  <div><span>GET OFF</span><strong>{option.dropStop.name}</strong><small>{option.drop.finalWalkMinutes === 0 ? "At home" : `${option.drop.finalWalkMinutes} min walk home · ${walkLabel}`}</small></div>
                </div>
              </div>

              {option.alerts.length > 0 && (
                <details className="alert-details">
                  <summary>⚠ Service disruption</summary>
                  <p>{option.alerts[0].header}</p>
                  {option.alerts[0].description && <small>{option.alerts[0].description}</small>}
                </details>
              )}

              <div className="home-time"><span>Approx. home</span><strong>{timeFormatter.format(option.drop.homeDate)}</strong></div>
            </article>
          );
        })}
      </section>

      <details className="diagnostics">
        <summary>Service status & diagnostics</summary>
        <dl>
          <div><dt>Adelaide time</dt><dd>{updatedFormatter.format(now)}</dd></div>
          <div><dt>Trips inspected</dt><dd>{realtime?.inspectedTrips ?? "Schedule only"}</dd></div>
          <div><dt>Useful routes now</dt><dd>{uniqueRoutes}</dd></div>
          <div><dt>Catchable options</dt><dd>{viable.length}</dd></div>
          <div><dt>Shortest final walk</dt><dd>{shortestWalk === null ? "—" : `${shortestWalk} min`}</dd></div>
          <div><dt>GTFS feed version</dt><dd>{config.feedVersion}</dd></div>
          <div><dt>Nearby stops assessed</dt><dd>{config.discovery.stopsRoutedNearHome}</dd></div>
          <div><dt>Excluded over 30 min</dt><dd>{config.discovery.excludedOver30}</dd></div>
        </dl>
        <p>All options are one service only. Every final walk is 30 minutes or less.</p>
      </details>

      <footer>
        <p>Times are estimates. Leave a little extra time to reach your stop.</p>
        <p>Adelaide Metro · Department for Infrastructure and Transport, South Australia</p>
        <p>Walking data © OpenStreetMap contributors</p>
      </footer>
    </main>
  );
}
