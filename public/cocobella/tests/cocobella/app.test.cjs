"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

// The Astro repository is `type: module`, while app.js also exposes a small
// CommonJS testing seam. Evaluate it without changing the site's package.json.
const appPath = path.resolve(__dirname, "../../public/cocobella/app.js");
const sandbox = { module: { exports: {} }, Intl };
vm.runInNewContext(fs.readFileSync(appPath, "utf8"), sandbox, { filename: appPath });
const { cheapestStores, indicator } = sandbox.module.exports;

function store(retailer, price, verified = true) {
  return { retailer, store: retailer, price: verified ? price : null, regularPrice: price, verified, available: verified };
}

test("cheapest calculation excludes unavailable retailers", () => {
  const result = cheapestStores([store("Coles", 5.5), store("Woolworths", 3.3), store("Foodland", 1, false)]);
  assert.deepEqual(result.map((item) => item.retailer), ["Woolworths"]);
});

test("cheapest calculation returns a tie", () => {
  const result = cheapestStores([store("Coles", 4), store("Woolworths", 4), store("Foodland", 5)]);
  assert.deepEqual(result.map((item) => item.retailer), ["Coles", "Woolworths"]);
});

test("indicator waits for meaningful history", () => {
  assert.equal(indicator(store("Coles", 5.5), [{ price: 5.5 }]).label, "NORMAL PRICE");
  const history = [5.5, 5.5, 4.5, 5.5, 5.5, 3.3].map((price) => ({ price }));
  assert.equal(indicator(store("Coles", 3.3), history).label, "🔥 STOCK UP");
});
