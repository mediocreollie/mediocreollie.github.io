const state = {stores: {}, history: {}, nearby: [], view: 'nearby'};
const labels = {coles:'Coles Rundle Place', coles_findon:'Coles Findon', woolworths:'Woolworths Rundle Mall', foodland:'Foodland Henley Square', drakes_findon:'Drakes Findon'};
const colors = {coles:'#2d7d46', coles_findon:'#b83131', woolworths:'#3e8ed2', foodland:'#a66810', drakes_findon:'#9045ad'};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => Number.isFinite(value) ? `$${value.toFixed(2)}` : 'Unavailable';
const fresh = s => s?.verified === true && Number.isFinite(s.price) && Date.now()-Date.parse(s.updated_at) < 36*3600000;
const dateLabel = value => new Date(value).toLocaleString('en-AU', {timeZone:'Australia/Adelaide'});
const entries = () => Object.entries(state.stores).filter(([key]) => state.view === 'all' || ['drakes_findon','coles_findon','foodland'].includes(key));
function render() {
  document.getElementById('stores').innerHTML = entries().map(([key,s]) => `<article class="store-card"><h3>${esc(s.name || labels[key])}</h3><div class="price">${fresh(s) ? money(s.price) : 'Unavailable'}</div><p class="meta">${esc(s.price_scope || 'No verified current price')}</p><p class="meta">${s.updated_at ? 'Price observed: '+dateLabel(s.updated_at)+' (Adelaide)' : ''}</p><p class="meta">${s.checked_at ? 'Last attempt: '+dateLabel(s.checked_at)+' (Adelaide)' : ''}</p>${!fresh(s) && s.updated_at ? '<p class="meta">Last success: '+dateLabel(s.updated_at)+'. Price is stale.</p>' : ''}${s.refresh_error || s.error ? `<p class="meta">Refresh: ${esc(s.refresh_error || s.error)}</p>` : ''}${s.source ? `<a href="${esc(s.source)}" target="_blank" rel="noopener">Check product</a>` : ''}</article>`).join('');
  const eligible = entries().filter(([,s]) => fresh(s) && s.store_specific === true);
  const min = Math.min(...eligible.map(([,s]) => s.price));
  document.getElementById('cheapest-store').textContent = eligible.length ? eligible.filter(([,s]) => s.price === min).map(([,s]) => s.name).join(' / ')+': '+money(min) : 'No current store-specific price';
  const attempts = entries().map(([,s]) => s.checked_at).filter(Boolean).sort();
  document.getElementById('updated-at').textContent = attempts.length ? dateLabel(attempts.at(-1))+' (Adelaide)' : 'Unknown';
  document.getElementById('nearby-stores').innerHTML = state.nearby.map(s => `<article class="store-card"><h3>${esc(s.name)}</h3><p>${esc(s.address)}</p><p class="meta">${s.distance_km.toFixed(1)} km straight-line</p><p>${esc(s.note)}</p><a href="${esc(s.source)}" target="_blank" rel="noopener">Store website</a> · <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.name+', '+s.address)}" target="_blank" rel="noopener">Directions</a></article>`).join('');
  buildChart();
}
function buildChart() {
  const keys = new Set(entries().map(([key]) => key));
  const series = Object.entries(state.history).filter(([key]) => keys.has(key)).map(([key,v]) => [key,v.filter(p => Number.isFinite(p.price) && Number.isFinite(Date.parse(p.date))).sort((a,b) => Date.parse(a.date)-Date.parse(b.date))]).filter(([,v]) => v.length);
  const svg = document.getElementById('history-chart');
  if (!series.length) { svg.innerHTML='<text x="40" y="100">No observations yet</text>'; document.getElementById('chart-legend').textContent=''; return; }
  const points = series.flatMap(([,v]) => v), dates = points.map(p => Date.parse(p.date));
  const low=Math.min(...points.map(p=>p.price))-0.25, high=Math.max(...points.map(p=>p.price))+0.25;
  const start=Math.min(...dates), end=Math.max(...dates);
  const x=p=>55+(Date.parse(p.date)-start)/(end-start || 1)*595, y=p=>185-(p.price-low)/(high-low)*160;
  let markup=[0,1,2,3].map(i=>{const price=low+(high-low)*i/3, yy=y({price});return `<line x1="55" x2="650" y1="${yy}" y2="${yy}" stroke="#ccd8d0"/><text x="3" y="${yy+4}" font-size="12">$${price.toFixed(2)}</text>`;}).join('');
  for (const [key,v] of series) {
    const color=colors[key] || '#555';
    markup+=`<path d="${v.map((p,i)=>`${i && Date.parse(p.date)-Date.parse(v[i-1].date)<=36*3600000 ? 'L':'M'} ${x(p)} ${y(p)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`;
    markup+=v.map(p=>`<circle cx="${x(p)}" cy="${y(p)}" r="3" fill="${color}"><title>${esc(labels[key] || key)}: ${money(p.price)}, ${dateLabel(p.date)}</title></circle>`).join('');
  }
  const day=d=>new Date(d).toLocaleDateString('en-AU',{timeZone:'Australia/Adelaide'});
  svg.innerHTML=markup+`<text x="55" y="210" font-size="12">${day(start)}</text><text x="650" y="210" text-anchor="end" font-size="12">${day(end)}</text>`;
  document.getElementById('chart-legend').innerHTML=series.map(([key])=>`<span style="color:${colors[key] || '#555'}">● ${esc(labels[key] || key)}</span>`).join(' · ');
}
async function loadData() {
  const data=await Promise.all(['prices','price-history','nearby-stores'].map(async name=>{const r=await fetch(`./data/${name}.json`,{cache:'no-store'});if(!r.ok)throw new Error(name);return r.json();}));
  state.stores=data[0].stores || {};state.history=data[1].history || {};state.nearby=data[2].stores || [];
  document.getElementById('store-view').addEventListener('change',event=>{state.view=event.target.value;render();});
  render();
}
loadData().catch(error=>{console.error(error);document.getElementById('stores').textContent='Unable to load tracker data. Please try again.';document.getElementById('cheapest-store').textContent='Unavailable';document.getElementById('updated-at').textContent='Unknown';});
