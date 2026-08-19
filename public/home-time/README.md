# Get Me Home · Adelaide

A mobile-first departures board for one very specific question: **which single Adelaide Metro bus or train can I catch from Adelaide Railway Station that gets me within a conservative 30-minute walk of home near Henley Beach?**

It does not calculate transfers or choose one supposedly perfect journey. It discovers every qualifying one-seat trip from the current Adelaide Metro GTFS feed, adds live predictions when available, checks whether there is enough time to walk to the boarding stop, and sorts options by approximate arrival home.

## Home reference

- Public reference: **Stop 29B Seaview Rd - East side, public stop ID 16355**
- The current GTFS publishes `16355` as `stop_code`; its internal `stop_id` is `6524`.
- The UI says only **Henley Beach** or **Home** and does not contain a residential address.
- Hard maximum final walk: **30 conservative minutes**.
- Manual calibration: **Grange Railway Station → Home = 15 minutes**.

## V1 origin

V1 starts at **Adelaide Railway Station**. Trains board there; bus results include a precomputed conservative walk from the station to the relevant CBD stop. The calculation layer accepts coordinates and is intentionally separated from the UI so a one-off browser geolocation origin can replace this fixed point in V2.

## Data sources

- [Adelaide Metro static GTFS](https://gtfs.adelaidemetro.com.au/v1/static/latest/google_transit.zip)
- [Adelaide Metro GTFS-Realtime API](https://gtfs.adelaidemetro.com.au/)
- Pedestrian paths from [OpenStreetMap](https://www.openstreetmap.org/copyright)

Adelaide Metro attribution: **Adelaide Metro – Department for Infrastructure and Transport, South Australia**.

## Architecture

1. `scripts/generate-transit-config.mjs` downloads or reads the current static GTFS and two bounded OpenStreetMap walking graphs.
2. It routes every nearby stop over the pedestrian graph, adds a conservative 12% time buffer, rounds up, applies the 15-minute Grange override, and rejects anything over 30 minutes.
3. It discovers each individual trip where a reachable CBD boarding stop occurs before a reachable home-area stop. Route numbers are never treated as sufficient evidence.
4. It writes the compact `data/transit-config.json` used by the browser and the real-data report in `docs/network-discovery.md`.
5. `/api/realtime` fetches and decodes the official GTFS-Realtime protobuf trip updates and service alerts, returning only relevant updates to the browser.
6. If realtime fails, the app keeps using valid `calendar.txt` / `calendar_dates.txt` schedules and labels them **SCHEDULED**.

All time calculations use `Australia/Adelaide`, including daylight saving and GTFS times beyond `24:00:00`.

## Running locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm test
npm run build
```

## Refreshing GTFS and walking data

```bash
npm run gtfs:refresh
```

This downloads the latest official timetable, refreshes the two bounded OpenStreetMap extracts, rebuilds the compact configuration, and rewrites the discovery report. A normal `node scripts/generate-transit-config.mjs` reuses the local raw snapshots.

## Realtime proxy and deployment

The official protobuf endpoint returned HTTPS successfully but did **not** return an `Access-Control-Allow-Origin` header in the 18 August 2026 test. A direct static GitHub Pages build therefore cannot reliably fetch live data from browser JavaScript.

The included same-origin `/api/realtime` route is the smallest required server layer. It stores no data and needs no Adelaide Metro key, database, or paid API. GitHub Pages is not suitable because it serves static files and cannot run this route. The included GitHub Actions workflow deploys the complete app to Cloudflare Workers through its free tier.

On every push to `main` that changes `public/home-time`, the workflow installs dependencies, runs the tests, builds the app, and deploys `dist/server/wrangler.json`. It also supports manual dispatch. The repository must have `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` configured as GitHub Actions secrets.

## Repository layout

This app intentionally lives in `public/home-time` inside the parent Astro site. Run all commands below from that directory. `data/transit-config.json` is the committed browser dataset; raw GTFS and OpenStreetMap downloads are ignored and regenerated when needed.

## Tests

The test suite covers the requested V1 invariants: home ID, the 30-minute cutoff and 31-minute exclusion, Grange calibration, trip direction and route variants, realtime replacement, scheduled fallback, post-midnight GTFS times, Adelaide DST, catchability, and the one-leg limit.

## Current discovery snapshot

Feed version 1689 produced 78 walk-eligible home-area stops, 37 drop-off stops actually reached from the CBD, 7 CBD boarding stops, 514 useful scheduled trip patterns, 10 bus routes, and the Grange rail route. Routes discovered were **110, 112, 286, 287, AO18, AO19, GRNG, H30, H33, N30, and X30**. See `docs/network-discovery.md` for every boarding/drop-off stop and current realtime-match figures.

## Known limitations

- Walking times are conservative development-time paths over a bounded OpenStreetMap snapshot, not live pedestrian routing. Refresh the generated data after material path or network changes.
- Realtime coverage varies by trip and stop. A trip is labelled LIVE only when its boarding prediction can actually be applied.
- Service alerts are associated only when the feed identifies a matching route or stop.
- V1 has exactly one transit leg and a fixed origin. It deliberately has no transfers, map, login, database, tracking, Uber integration, or residential address.
- AO18/AO19 are event services and appear only when their GTFS service calendar says they operate.

## Version 2

Use the browser Geolocation API only after a clear tap, keep the coordinates in memory, and rerun the origin-to-boarding-stop walking calculation. No permanent tracking or backend storage is needed. A later version could also refresh the pedestrian graph more frequently or use a dependable free pedestrian-routing service.
