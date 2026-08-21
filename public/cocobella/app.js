const storeLabel = {
  coles: 'Coles Rundle Place',
  woolworths: 'Woolworths Rundle Mall',
  foodland: 'Foodland Henley Square',
};

const state = {
  stores: {},
  history: {},
};

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'Unavailable';
  }
  return `$${Number(value).toFixed(2)}`;
}

function renderStores() {
  const section = document.getElementById('stores');
  const entries = Object.entries(state.stores);
  section.innerHTML = entries
    .map(([key, store]) => {
      const isAvailable = store.price !== null && store.price !== undefined;
      return `
        <article class="store-card">
          <h3>${store.name || storeLabel[key] || key}</h3>
          <div class="price-row">
            <div class="price">${formatPrice(store.price)}</div>
            <span class="status ${isAvailable ? 'available' : 'unavailable'}">${isAvailable ? 'Available' : 'Unavailable'}</span>
          </div>
          <div class="meta">${isAvailable ? 'Current listing' : 'No current stock price available'}</div>
        </article>
      `;
    })
    .join('');
}

function renderSummary() {
  const cheapestKey = Object.entries(state.stores)
    .filter(([, store]) => store.price !== null && store.price !== undefined)
    .sort(([, a], [, b]) => Number(a.price) - Number(b.price))[0];

  const cheapestEl = document.getElementById('cheapest-store');
  if (cheapestKey) {
    cheapestEl.textContent = `${cheapestKey[1].name || storeLabel[cheapestKey[0]]}: ${formatPrice(cheapestKey[1].price)}`;
  } else {
    cheapestEl.textContent = 'Unavailable';
  }

  const updatedEl = document.getElementById('updated-at');
  const latest = Object.values(state.stores).map((store) => store.updated_at).filter(Boolean).sort().pop();
  updatedEl.textContent = latest ? new Date(latest).toLocaleString() : 'Unknown';
}

function buildChart() {
  const svg = document.getElementById('history-chart');
  const series = Object.entries(state.history).filter(([, values]) => values && values.length);
  if (!series.length) {
    svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#586a73" font-size="16">No history available</text>';
    return;
  }

  const width = 680;
  const height = 220;
  const padding = 24;
  const points = [];
  const prices = series.flatMap(([, values]) => values.map((point) => point.price)).filter((value) => value !== null && value !== undefined);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  series.forEach(([storeKey, values]) => {
    const valuesWithPrice = values.filter((point) => point.price !== null && point.price !== undefined);
    if (!valuesWithPrice.length) {
      return;
    }

    const path = valuesWithPrice
      .map((point, index) => {
        const x = padding + (index / Math.max(valuesWithPrice.length - 1, 1)) * (width - padding * 2);
        const y = height - padding - ((Number(point.price) - minPrice) / range) * (height - padding * 2);
        points.push({ x, y, store: storeKey });
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    const stroke = storeKey === 'woolworths' ? '#3e8ed2' : storeKey === 'coles' ? '#2d7d46' : '#d38b20';
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', path);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', '3');
    svg.appendChild(line);
  });

  const gridLines = Array.from({ length: 4 }, (_, idx) => {
    const y = padding + (idx / 3) * (height - padding * 2);
    return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#d9e3dd" stroke-dasharray="4 6" />`;
  }).join('');

  svg.innerHTML = gridLines;
  series.forEach(([storeKey, values]) => {
    const valuesWithPrice = values.filter((point) => point.price !== null && point.price !== undefined);
    if (!valuesWithPrice.length) {
      return;
    }

    const stroke = storeKey === 'woolworths' ? '#3e8ed2' : storeKey === 'coles' ? '#2d7d46' : '#d38b20';
    const path = valuesWithPrice
      .map((point, index) => {
        const x = padding + (index / Math.max(valuesWithPrice.length - 1, 1)) * (width - padding * 2);
        const y = height - padding - ((Number(point.price) - minPrice) / range) * (height - padding * 2);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', path);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', '3');
    svg.appendChild(line);
  });
}

async function loadData() {
  const [pricesResponse, historyResponse] = await Promise.all([
    fetch('./data/prices.json'),
    fetch('./data/price-history.json'),
  ]);

  const prices = await pricesResponse.json();
  const history = await historyResponse.json();

  state.stores = prices.stores || {};
  state.history = history.history || {};

  renderStores();
  renderSummary();
  buildChart();
}

loadData().catch((error) => {
  console.error('Failed to load Cocobella data:', error);
  document.getElementById('stores').innerHTML = '<p>Unable to load tracker data.</p>';
});
