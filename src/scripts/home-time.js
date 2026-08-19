import config from '../data/transit-config.json';
import { buildOptions, walkClass } from '../lib/transit.mjs';

const app = document.querySelector('#home-time-app');
const departures = app.querySelector('.departures');
const banner = app.querySelector('.feed-banner');
const count = app.querySelector('.result-count strong');
const diagnostics = app.querySelector('.diagnostics-grid');
const refreshButton = app.querySelector('.refresh');
const endpoint = app.dataset.realtimeEndpoint;
const timeFormatter = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Adelaide', hour: 'numeric', minute: '2-digit' });
const updatedFormatter = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Adelaide', hour: 'numeric', minute: '2-digit', second: '2-digit' });
let realtime = null;
let sort = 'home';
let now = new Date();

const adelaideParts = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Adelaide',
  dateStyle: 'full',
  timeStyle: 'long',
}).format;

const minutesLabel = (value) => value <= 0 ? 'Due' : `${Math.ceil(value)} min`;
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

function render() {
  const options = buildOptions(config, realtime, now);
  if (sort === 'departure') options.sort((a, b) => Number(b.status.catchable) - Number(a.status.catchable) || a.departureDate - b.departureDate);
  const viable = options.filter((option) => option.status.catchable);
  const visible = options.slice(0, 10);
  count.textContent = viable.length;
  departures.innerHTML = visible.length ? visible.map(renderCard).join('') : '<div class="empty-state"><span aria-hidden="true">⌁</span><h2>No useful services found</h2><p>There are no one-seat services in the next five hours that finish within a 30-minute walk of home.</p><button type="button" data-retry>Check again</button></div>';
  departures.querySelector('[data-retry]')?.addEventListener('click', refresh);
  const shortestWalk = viable.length ? Math.min(...viable.map((option) => option.drop.finalWalkMinutes)) : null;
  const uniqueRoutes = new Set(options.map((option) => option.route.shortName)).size;
  diagnostics.innerHTML = [['Adelaide time', updatedFormatter.format(now)], ['Trips inspected', realtime?.inspectedTrips ?? 'Schedule only'], ['Useful routes now', uniqueRoutes], ['Catchable options', viable.length], ['Shortest final walk', shortestWalk === null ? '—' : `${shortestWalk} min`], ['GTFS feed version', config.feedVersion], ['Nearby stops assessed', config.discovery.stopsRoutedNearHome], ['Excluded over 30 min', config.discovery.excludedOver30]].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  console.info('[home-time] schedule', {
    config: { stops: Object.keys(config.stops).length, routes: Object.keys(config.routes).length, trips: config.trips.length },
    nowUtc: now.toISOString(),
    adelaideTime: adelaideParts(now),
    serviceDate: new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replaceAll('-', ''),
    scheduledOptions: options.length,
    catchableOptions: viable.length,
    tooTightOptions: options.filter((option) => !option.status.catchable).length,
    nextCandidates: options.slice(0, 10).map((option) => ({ route: option.route.shortName, departure: option.departureDate.toISOString(), board: option.boardStop.name, drop: option.dropStop.name, finalWalkMinutes: option.drop.finalWalkMinutes, status: option.status.label })),
  });
}

function renderCard(option, index) {
  const train = option.route.type === 2;
  const walkLabel = walkClass(option.drop.finalWalkMinutes);
  const alert = option.alerts[0];
  return `<article class="trip-card ${index === 0 && option.status.catchable ? 'best' : ''} ${!option.status.catchable ? 'too-tight-card' : ''}">${index === 0 && option.status.catchable ? '<p class="best-label">BEST WAY HOME RIGHT NOW</p>' : ''}<div class="card-top"><div class="route"><span class="mode-icon" aria-hidden="true">${train ? 'T' : 'B'}</span><div><strong>${escapeHtml(option.route.shortName)}</strong><small>${escapeHtml(option.trip.headsign || option.route.longName)}</small></div></div><div class="leaves"><strong>${minutesLabel(option.status.minutesUntil)}</strong><span>until departure</span></div></div><div class="status-row"><span class="status ${option.status.key}">${option.status.catchable ? '✓' : '!'} ${option.status.label}</span><span>${timeFormatter.format(option.departureDate)} · <b class="${option.source === 'LIVE' ? 'live' : 'scheduled'}">${option.source}</b></span></div><div class="journey-line"><div class="journey-point"><span class="point-marker start"></span><div><span>BOARD</span><strong>${escapeHtml(option.boardStop.name)}</strong><small>${train && option.trip.board.cbdWalkMinutes === 0 ? 'Board here' : `${option.trip.board.cbdWalkMinutes} min walk to stop`}</small></div></div><div class="journey-stem"></div><div class="journey-point"><span class="point-marker finish"></span><div><span>GET OFF</span><strong>${escapeHtml(option.dropStop.name)}</strong><small>${option.drop.finalWalkMinutes === 0 ? 'At home' : `${option.drop.finalWalkMinutes} min walk home · ${walkLabel}`}</small></div></div></div>${alert ? `<details class="alert-details"><summary>⚠ Service disruption</summary><p>${escapeHtml(alert.header)}</p>${alert.description ? `<small>${escapeHtml(alert.description)}</small>` : ''}</details>` : ''}<div class="home-time"><span>Approx. home</span><strong>${timeFormatter.format(option.drop.homeDate)}</strong></div></article>`;
}

async function refresh() {
  refreshButton.disabled = true;
  refreshButton.querySelector('span').classList.add('spinning');
  if (endpoint) {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error('Realtime unavailable');
      realtime = result;
      banner.className = 'feed-banner';
      banner.innerHTML = `<div><span class="feed-dot"></span><strong>Live departures connected</strong></div><span>Updated ${updatedFormatter.format(new Date(result.fetchedAt))}</span>`;
    } catch {
      realtime = null;
      banner.className = 'feed-banner warning';
      banner.innerHTML = '<div><span class="feed-dot"></span><strong>Live updates unavailable</strong></div><span>Using today\'s timetable</span>';
    }
  }
  render();
  refreshButton.disabled = false;
  refreshButton.querySelector('span').classList.remove('spinning');
}

refreshButton.addEventListener('click', refresh);
app.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => { sort = button.dataset.sort; app.querySelectorAll('[data-sort]').forEach((item) => item.classList.toggle('active', item === button)); render(); }));
render();
refresh();
setInterval(() => { now = new Date(); render(); }, 15000);
if (endpoint) setInterval(refresh, 60000);
