# Network discovery

Generated 2026-08-18T09:40:58.906Z from Adelaide Metro GTFS version **1689**. This is a reproducible feed snapshot, not a promise that every listed route operates at every time of day.

## Home

- Reference: Stop 29B Seaview Rd - East side
- Public stop ID: 16355
- GTFS `stop_id`: 6524 (Adelaide Metro publishes 16355 as `stop_code` in the current feed)
- Coordinates: -34.911189, 138.492106
- Maximum final walk: 30 conservative minutes

## Walking area

- Adelaide Metro stop records geographically assessed: 9049
- Stops routed within the 3.2 km candidate area: 214
- Stops within 0–10 conservative minutes: 10
- Stops within 11–20 conservative minutes: 30
- Stops within 21–30 conservative minutes: 38
- Candidate-area stops excluded over 30 minutes or not connected to the pedestrian graph: 136
- Method: shortest paths over an OpenStreetMap pedestrian graph, 4.8 km/h base pace, 12% conservative buffer, rounded up. Grange Railway Station is manually overridden to 15 minutes.

## Useful network

- Unique useful bus routes: 10
- Unique useful rail routes: 1
- Unique CBD boarding stops: 7
- Unique candidate drop-off stops actually reached from the CBD: 37
- Useful scheduled trip patterns: 514
- Route numbers: 110, 112, 286, 287, AO18, AO19, GRNG, H30, H33, N30, X30

### Boarding stops

- Adelaide Railway Station (16490): 0 min walk
- Stop W1 North Tce - South side (13297): 2 min walk
- Stop AO19 King William Rd - West side (18708): 7 min walk
- Stop V3 Currie St - South side (18816): 8 min walk
- Stop AO18 King William Rd - West side (18710): 8 min walk
- Stop U2 Grenfell St - South side (13346): 10 min walk
- Stop V2 Currie St - South side (13353): 11 min walk

### Drop-off stops

- Stop 29B Seaview Rd - West side (16354): 1 min walk home
- Stop 29A Seaview Rd - West side (16356): 6 min walk home
- Stop 29C Seaview Rd - West side (16352): 6 min walk home
- Stop 29B Grange Rd - South side (13030): 9 min walk home
- Stop 29 Seaview Rd - West side (16359): 10 min walk home
- Stop 29D Military Rd - West side (16350): 11 min walk home
- Stop 29A Marlborough St - South side (13143): 11 min walk home
- Stop 29A Grange Rd - South side (13026): 12 min walk home
- Stop 29B East Tce - East side (13210): 13 min walk home
- Stop 27A North St - South side (13203): 14 min walk home
- Grange Railway Station (18563): 15 min walk home
- Stop 28 Seaview Rd - West side (16380): 15 min walk home
- Stop 30 Military Rd / Jetty St - West side (16348): 15 min walk home
- Stop 30 Military Rd / Main St - West side (13244): 15 min walk home
- Stop 29 Marlborough St - South side (13137): 16 min walk home
- Stop 29C East Tce - East side (16586): 16 min walk home
- Stop 29 Grange Rd - South side (13022): 17 min walk home
- Stop 30A Military Rd - West side (16347): 18 min walk home
- Stop 27 Seaview Rd - West side (16404): 19 min walk home
- Stop 27 North St - South side (13202): 20 min walk home
- Stop 28 Marlborough St - South side (13124): 21 min walk home
- Stop 30B Military Rd - West side (16345): 22 min walk home
- Stop 26 North St - South West side (13212): 22 min walk home
- Stop 26 Seaview Rd - West side (16439): 23 min walk home
- Stop 28 Grange Rd - South side (13017): 23 min walk home
- Stop 27 Marlborough St - South side (13118): 24 min walk home
- Stop 25 North St - South West side (13259): 25 min walk home
- Stop 27 Grange Rd - South side (13007): 26 min walk home
- Stop 25 Henley Beach Rd - South side (16445): 26 min walk home
- Stop 31 Fort St - North side (16342): 26 min walk home
- Stop 28 Frederick Rd - West side (12964): 27 min walk home
- Stop 30C Military Rd - West side (12770): 27 min walk home
- Stop 29 Frederick Rd - West side (12884): 29 min walk home
- Stop 31A Fort St - West side (16340): 29 min walk home
- Stop 31 Military Rd - West side (12738): 29 min walk home
- Stop 26 Marlborough St - South side (13109): 30 min walk home
- Stop 24 Cheadle St - South side (13271): 30 min walk home

## Known-route validation

- H30: validated as useful
- H30S: not present as a useful one-seat trip in this feed
- X30: validated as useful
- X30S: not present as a useful one-seat trip in this feed
- N30: validated as useful
- H33: validated as useful
- 287: validated as useful
- 286: validated as useful
- H22: not present as a useful one-seat trip in this feed
- H32: not present as a useful one-seat trip in this feed

Direction and route variants are validated per trip: the boarding stop must occur before a reachable home-area stop in that trip's stop sequence. A route number alone never makes a trip eligible.

## Realtime

- Trip updates endpoint: https://gtfs.adelaidemetro.com.au/v1/realtime/trip_updates
- Service alerts endpoint: https://gtfs.adelaidemetro.com.au/v1/realtime/service_alerts
- Direct browser CORS: unavailable in the response tested on 2026-08-18 (no `Access-Control-Allow-Origin` header)
- Resolution: the app exposes a same-origin, read-only server route that fetches and decodes the official protobuf feed. Scheduled departures remain available if it fails.
- OpenStreetMap data © OpenStreetMap contributors, used under ODbL.

## Realtime validation snapshot

- Feed endpoint successfully decoded: yes
- Live trip-update entities in this snapshot: 401
- Useful trip updates matched to the compact network: 10
- Matched route examples: 110, 286, 287, H30, H33, X30
- Feed timestamp: 2026-08-18T09:40:08.000Z
- Service-alert endpoint successfully tested: yes
- CORS header returned by the trip feed: none
- This is a time-of-day snapshot, not a general statement about Adelaide Metro realtime coverage.
