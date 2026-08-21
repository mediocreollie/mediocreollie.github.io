(function () {
  "use strict";

  const COLOURS = { Coles: "#d62027", Woolworths: "#178841", Foodland: "#f07b18" };
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
  const adelaideTime = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide", dateStyle: "medium", timeStyle: "short"
  });

  function verifiedStores(stores) {
    return stores.filter((store) => store.verified === true && store.available === true && Number.isFinite(store.price));
  }

  function cheapestStores(stores) {
    const valid = verifiedStores(stores);
    if (!valid.length) return [];
    const low = Math.min(...valid.map((store) => store.price));
    return valid.filter((store) => Math.abs(store.price - low) < 0.001);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function formatOffer(store) {
    if (!store.offer?.description) return "";
    const unit = Number.isFinite(store.offer.effectiveUnitPrice)
      ? ` (${money.format(store.offer.effectiveUnitPrice)} each)` : "";
    return `<span class="offer">${escapeHtml(store.offer.description)}${unit}</span>`;
  }

  function renderCurrent(data) {
    const winners = cheapestStores(data.stores);
    const winner = document.querySelector("#cheapest");
    if (!winners.length) {
      winner.innerHTML = '<p class="winner-label">Cheapest today</p><h2>No verified price is available right now.</h2><p class="winner-note">The tracker will not guess or use a generic national price.</p>';
    } else {
      const names = winners.map((store) => `${store.retailer} ${store.store}`);
      const heading = winners.length > 1 ? `${names.join(" & ")} are tied` : names[0];
      winner.innerHTML = `<p class="winner-label">${winners.length > 1 ? "Cheapest today · tie" : "Cheapest today"}</p><h2>${escapeHtml(heading)}<span class="winner-price">${money.format(winners[0].price)}</span></h2><p class="winner-note">Verified single-unit price. ${winners.length > 1 ? "Both stores are equally cheapest." : "Conditional offers are listed below."}</p>`;
    }
    winner.setAttribute("aria-busy", "false");

    const winnerKeys = new Set(winners.map((store) => `${store.retailer}:${store.store}`));
    document.querySelector("#store-rows").innerHTML = data.stores.map((store) => {
      const key = `${store.retailer}:${store.store}`;
      const isBest = winnerKeys.has(key);
      const price = store.verified && Number.isFinite(store.price)
        ? `<span class="price">${money.format(store.price)}</span>${formatOffer(store)}`
        : '<span class="unavailable">Price unavailable</span>';
      const isOutOfStock = !store.verified && /not (?:reported|returned) in stock|out of stock/i.test(store.error || "");
      const statusText = !store.verified ? (isOutOfStock ? "Out of stock" : "Unavailable") : isBest ? "Cheapest" : store.special ? "Special" : "Regular";
      const statusClass = !store.verified ? "unknown" : isBest ? "best" : store.special ? "special" : "";
      const sourceLabels = {
        manual_shelf_check: "Manual shelf check",
        store_selected_catalogue: "Rundle Mall catalogue · stock may vary",
        official_foodland_catalogue: "Henley catalogue special · stock may vary",
        store_catalogue: "Henley store catalogue · stock may vary"
      };
      const source = sourceLabels[store.source?.type]
        || (store.verified ? "Store-specific result" : "Could not verify this store");
      return `<tr class="${isBest ? "is-cheapest" : ""}"><td><span class="store-name">${escapeHtml(store.retailer)} ${escapeHtml(store.store)}</span><span class="store-source">${source}</span></td><td>${price}</td><td><span class="status ${statusClass}">${statusText}</span></td></tr>`;
    }).join("");
    document.querySelector("#updated").textContent = data.lastSuccessfulCheck
      ? `Last successful check: ${adelaideTime.format(new Date(data.lastSuccessfulCheck))}`
      : `Last attempt: ${adelaideTime.format(new Date(data.checkedAt))} · no successful prices yet`;
  }

  function groupHistory(observations) {
    const grouped = {};
    observations.filter((item) => item.verified && Number.isFinite(item.price)).forEach((item) => {
      (grouped[item.retailer] ||= []).push({ ...item, time: new Date(item.observedAt).getTime() });
    });
    Object.values(grouped).forEach((series) => series.sort((a, b) => a.time - b.time));
    return grouped;
  }

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function indicator(current, series) {
    if (!current || !series.length) return { label: "BUILDING HISTORY", detail: "Waiting for a verified current price." };
    const prices = series.map((item) => item.price);
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    if (series.length >= 6 && high - low >= 0.5 && current.price <= low * 1.05) {
      return { label: "🔥 STOCK UP", detail: "Within 5% of a meaningful recorded low." };
    }
    if (series.length >= 6 && current.price <= median(prices.slice(-30)) * 0.9) {
      return { label: "👍 GOOD PRICE", detail: "At least 10% below the recent median." };
    }
    if (Number.isFinite(current.regularPrice) && current.regularPrice > current.price) {
      return { label: "👍 GOOD PRICE", detail: "Retailer explicitly reports a lower-than-regular price." };
    }
    return { label: "NORMAL PRICE", detail: series.length < 6 ? "Not enough history for a trend signal." : "No meaningful discount detected." };
  }

  function renderStats(currentData, historyData) {
    const grouped = groupHistory(historyData.observations || []);
    const currentByRetailer = Object.fromEntries(verifiedStores(currentData.stores).map((store) => [store.retailer, store]));
    document.querySelector("#history-stats").innerHTML = ["Coles", "Woolworths", "Foodland"].map((retailer) => {
      const series = grouped[retailer] || [];
      const current = currentByRetailer[retailer];
      const signal = indicator(current, series);
      const prices = series.map((item) => item.price);
      const low = prices.length ? Math.min(...prices) : null;
      const high = prices.length ? Math.max(...prices) : null;
      const lowItems = low === null ? [] : series.filter((item) => Math.abs(item.price - low) < 0.001);
      const lowLast = lowItems.length ? adelaideTime.format(new Date(lowItems[lowItems.length - 1].observedAt)) : "—";
      return `<article class="stat-card"><h3>${retailer}</h3><p class="indicator">${signal.label}</p><p class="store-source">${escapeHtml(signal.detail)}</p><dl class="stat-list"><dt>Current</dt><dd>${current ? money.format(current.price) : "Unavailable"}</dd><dt>Recorded low</dt><dd>${low === null ? "—" : money.format(low)}</dd><dt>Recorded high</dt><dd>${high === null ? "—" : money.format(high)}</dd><dt>Low last seen</dt><dd>${lowLast}</dd></dl></article>`;
    }).join("");
  }

  function drawChart(canvas, observations) {
    const grouped = groupHistory(observations);
    const seriesEntries = Object.entries(grouped).filter(([, values]) => values.length);
    const empty = document.querySelector("#chart-empty");
    document.querySelector("#legend").innerHTML = seriesEntries.map(([retailer]) => `<span class="legend-item"><span class="legend-swatch" style="background:${COLOURS[retailer]}"></span>${retailer}</span>`).join("");
    if (!seriesEntries.length) {
      empty.hidden = false;
      canvas.hidden = true;
      return;
    }
    empty.hidden = true;
    canvas.hidden = false;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    const width = rect.width, height = rect.height;
    const pad = { left: 50, right: 16, top: 18, bottom: 36 };
    const all = seriesEntries.flatMap(([, values]) => values);
    let minTime = Math.min(...all.map((item) => item.time));
    let maxTime = Math.max(...all.map((item) => item.time));
    if (minTime === maxTime) { minTime -= 43_200_000; maxTime += 43_200_000; }
    const minPrice = Math.max(0, Math.floor((Math.min(...all.map((item) => item.price)) - 0.5) * 2) / 2);
    const maxPrice = Math.ceil((Math.max(...all.map((item) => item.price)) + 0.5) * 2) / 2;
    const x = (time) => pad.left + ((time - minTime) / (maxTime - minTime)) * (width - pad.left - pad.right);
    const y = (price) => pad.top + ((maxPrice - price) / Math.max(0.5, maxPrice - minPrice)) * (height - pad.top - pad.bottom);
    context.font = "12px system-ui";
    context.fillStyle = "#60706a";
    context.strokeStyle = "#e1e5df";
    context.lineWidth = 1;
    for (let step = 0; step <= 4; step += 1) {
      const price = minPrice + ((maxPrice - minPrice) * step / 4);
      const py = y(price);
      context.beginPath(); context.moveTo(pad.left, py); context.lineTo(width - pad.right, py); context.stroke();
      context.fillText(money.format(price), 2, py + 4);
    }
    const dateFormat = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Adelaide", day: "numeric", month: "short" });
    context.fillText(dateFormat.format(new Date(minTime)), pad.left, height - 10);
    const endLabel = dateFormat.format(new Date(maxTime));
    context.fillText(endLabel, width - pad.right - context.measureText(endLabel).width, height - 10);
    seriesEntries.forEach(([retailer, values]) => {
      context.strokeStyle = COLOURS[retailer]; context.fillStyle = COLOURS[retailer]; context.lineWidth = 2.5;
      context.beginPath();
      values.forEach((item, index) => {
        const previous = values[index - 1];
        const gap = previous ? item.time - previous.time : 0;
        if (!previous || gap > 2.5 * 86_400_000) context.moveTo(x(item.time), y(item.price));
        else context.lineTo(x(item.time), y(item.price));
      });
      context.stroke();
      values.forEach((item) => { context.beginPath(); context.arc(x(item.time), y(item.price), 3.5, 0, Math.PI * 2); context.fill(); });
    });
  }

  async function initialise() {
    try {
      const [currentResponse, historyResponse] = await Promise.all([
        fetch("data/current.json", { cache: "no-store" }), fetch("data/history.json", { cache: "no-store" })
      ]);
      if (!currentResponse.ok || !historyResponse.ok) throw new Error("Price data could not be loaded");
      const [current, history] = await Promise.all([currentResponse.json(), historyResponse.json()]);
      renderCurrent(current);
      renderStats(current, history);
      const redraw = () => drawChart(document.querySelector("#history-chart"), history.observations || []);
      redraw();
      let resizeTimer;
      window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(redraw, 120);
      });
    } catch (error) {
      document.querySelector("#cheapest").innerHTML = '<p class="winner-label">Cheapest today</p><h2>Price data is temporarily unavailable.</h2>';
      document.querySelector("#store-rows").innerHTML = '<tr><td colspan="3">Could not load current price data.</td></tr>';
      document.querySelector("#updated").textContent = "Try again shortly.";
    }
  }

  const api = { cheapestStores, verifiedStores, groupHistory, indicator };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document !== "undefined") initialise();
})();
