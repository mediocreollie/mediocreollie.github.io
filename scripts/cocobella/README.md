# Cocobella watchlist

The static page at `/cocobella/` compares exact products, quantities and branches. The first product is **Cocobella Coconut Water Straight Up 1L**, with the existing 15 shops retained. Henley Square's five-mile filter is 8.04672 km straight-line; Rundle Mall remains selectable.

## What actually works

- **Drakes Findon:** public product JSON-LD, exact product URL/name and the page's `Serviced by Drakes Online Findon` identity. This is a branch **online** price, not a promise about the shelf.
- **Coles / Woolworths:** optional candidate adapters are implemented but **not approved or live**. No token is included. Each branch needs an independent check before enabling. Generic/default-store prices are rejected.
- **Henley Square Foodland and other candidates:** no proven exact-product branch feed. The directory does not assert stock. They stay unavailable unless a dated, evidenced manual observation is added.

A successful daily workflow is not proof that a retailer returned a price. Cards distinguish source requests, actual observation times, previous observations, and the site's publication time.

## Files and local operation

Python 3.11+ and Node 22; no third-party runtime packages.

```sh
python -m unittest discover -s tests/cocobella -p 'test_*.py'
node --test tests/cocobella/test_*.cjs
python scripts/cocobella/update_prices.py
python -m http.server 8000 --directory public
```

Open `http://localhost:8000/cocobella/`.

| File | Purpose |
| --- | --- |
| `public/cocobella/data/catalog.json` | Products, exact retailer mappings, branch IDs, nearby filter |
| `public/cocobella/data/state.json` | Current records, source status, last attempt and last success |
| `public/cocobella/data/history-v2.json` | Verified observations by product and branch |
| `public/cocobella/data/manual-observations.json` | Explicit dated human confirmations |
| `scripts/cocobella/providers.json` | Independently approved provider branches; no credentials |
| `scripts/cocobella/providers.py` | Interchangeable source adapters |
| `scripts/cocobella/model.py` | Identity, integer money, freshness and history rules |
| `public/cocobella/core.js` | Shared basket comparison rules |

The old `prices.json`, `price-history.json`, `browser-observations.json` and `nearby-stores.json` are preserved as archives. The page no longer reads them. Migration carries only the previously verified Drakes Findon and Coles Findon branch series into v2; it never relabels chain-wide records as store history.

## Connect and validate a candidate provider

These are experimental adapters based on the providers' published contracts, not demonstrated working feeds. Their response schemas or capabilities may differ in practice.

1. Use an **Apify Free** account without paid auto-recharge. Confirm its current allowance and actor pricing first. The code caps each run at $0.02 and five branch requests per collection; this is an additional guard, not a substitute for the account's spending limit. Keep the free-plan stop-at-limit protection enabled. No service is required for Drakes.
2. In GitHub repository Settings → Secrets and variables → Actions, add the secret `APIFY_TOKEN`. Never commit or paste it into a public issue. Add repository variable `APIFY_FREE_PLAN_CONFIRMED=true` only after confirming the account settings.
3. In Actions → **Update Cocobella prices** → Run workflow, select `validate-woolworths` or `validate-coles` and its matching branch. This makes one limited candidate call, saves the diagnostic artifact, and **does not publish prices or approve the source**.
4. Inspect `cocobella-source-validation`. Check exact product ID, size, branch ID and name, scope, availability and the provider's original timestamp. Independently compare the retailer page with that branch selected (or a same-day shelf check for shelf prices). Do not approve a matching number alone. Verify how the provider obtains branch context and that it respects access restrictions; do not enable a service that bypasses challenges or authentication controls.
5. Only after that evidence, add the branch entry below under the correct provider's `approved_stores`, using the real validation time and evidence. Commit it, then run `publish`.

```json
{
  "woolworths": {
    "validated": true,
    "validated_at": "REPLACE_WITH_ACTUAL_UTC_TIMESTAMP",
    "evidence": "REPLACE_WITH_INDEPENDENT_PRODUCT_AND_BRANCH_CHECK"
  }
}
```

Candidate contracts:
- [Woolworths actor](https://apify.com/crawlplant/woolworths-au): exact product IDs and branch IDs, cache disabled, store price scope, live source required.
- [Coles actor](https://apify.com/cylindrical_lighthouse/au-grocery-prices): product URL plus `colesStoreId`; output must echo the exact product/branch and AUD currency. Provisional scope is Click & Collect and must be confirmed before approval.
- [Apify synchronous dataset API](https://docs.apify.com/api/v2/actor-run-sync-get-dataset-items-post)

No paid plan, proxy, CAPTCHA solver, login automation or challenge retry is included. If a provider fails, inspect the one diagnostic result; leave it disabled instead of repeatedly retrying a blocked retailer route. Approval can be revoked by removing that branch entry.

## Add another product

Copy the existing product object in `catalog.json`, or use:

```sh
python scripts/cocobella/manage_catalog.py add /path/to/product.json
```

The input is one product object with a unique stable `id`, display `name`, exact `variant`, `pack_count`, `size_ml` or `size_g` (or `size_label`), sensible integer `price_bounds_cents`, and `mappings`. Each retailer mapping needs its real `product_id`, HTTPS `url`, exact accepted `names`, and normalized `sizes` such as `1l`. Use `store_ids` for branch-specific URLs so they cannot be reused at another shop. Do not guess IDs or broaden aliases to cover other flavours or multipacks. Only map retailers where the exact product is known. Then validate the source against that product before relying on its price.

The collector batches mapped products per branch. The page automatically adds quantity controls, a product picker and history. Existing saved baskets default a new product to zero. Adding a new retailer platform still needs an adapter; adding another product on an existing supported platform does not require page code.

## Manual observations

Manual observations require `product_id`, `store_id`, `price_cents`, `observed_at` with timezone, `currency: "AUD"`, `verified: true`, a branch `scope` (`store_shelf`, `store_online`, or `store_pickup`), `availability: "in_stock"`, `source: "manual"`, an HTTPS `source_url`, nonempty `evidence`, and `confirmed_by`. Use a private-neutral label such as `owner`; this file and its history are public. An optional explicit `expires_at` can shorten validity. Receipt/shelf evidence must identify the exact product and branch. Old prices do not become fresh when committed.

## Reliability and comparison rules

- Integer cents throughout; malformed money, unexpected pack sizes, ambiguous matches, wrong branches and future timestamps are rejected.
- Observations expire after at most 36 hours, at a stated offer end if earlier, or at Wednesday midnight Adelaide, whichever comes first. The page rechecks expiry each minute without waiting for another deployment.
- Missing or unknown stock is excluded from complete baskets. A failed request preserves last-success context but cannot republish it as current.
- Every basket item needs a current observation for a shop to win. Ties are preserved. A two-shop option allocates each product's entire quantity to one shop; it is not an optimization that splits one product across shops or combines cross-product promotions.
- Only explicitly confirmed unconditional multibuy quantities/prices affect totals. Provider promotional prose is displayed without guessing eligibility. Loyalty, delivery, pickup and travel costs are excluded.
- History is append-only and deduplicated by product, branch, observation time, scope and source. Missing observations are not zero; graph gaps over 36 hours are disconnected.
- Keep online, pickup and shelf scope visible. A basket can mix scopes and is only a comparison of the stated observations, not a guaranteed shelf total.

## Automation and troubleshooting

The workflow checks daily at 20:15 UTC (05:45 Adelaide standard time / 06:45 daylight time), on collector/config changes, and manually. Pull requests run tests and the public Drakes check without provider credentials or publishing. Main runs commit only `state.json` and `history-v2.json`. The existing `COCOBELLA_PUSH_TOKEN` allows that data commit to trigger the site's existing deployment workflow. If that secret is absent, GitHub's default token may commit but does not trigger a second push workflow; restore the existing push-token setup for automatic publication.

A run with all prices unavailable still publishes honest failure status. Inspect card messages and workflow logs. A provider validation failure leaves live data untouched. No connection means no new request timestamp. One retailer failing does not block others. Diagnostics are retained for seven days; API tokens are sent only as authorization headers and never written into data.

## No-provider browser capture and screenshot import

Open `/cocobella/capture.html`, also linked above the basket. Select the exact product and branch, open the retailer product link, and select that branch on the retailer website yourself. The desktop bookmarklet exports only dollar-price candidates from highlighted text, the canonical product URL and the actual capture time. It does not fetch retailer pages, inspect account details, or bypass login/security checks. Its URL fragment is cleared after import. Store identity must be confirmed by the user; a product URL alone never proves a branch.

On mobile, select a PNG/JPEG/WebP screenshot and click Read screenshot. Tesseract.js v5 is loaded on demand from jsDelivr and recognizes English locally, using its worker/core/language downloads. There is no OCR API account or image upload. The dependency downloads require an internet connection. Images and recognized text are not saved or exported. If OCR fails, the preview remains available for manual entry. Previous prices, unit prices and multibuys can appear among suggestions, so no suggested amount is automatically approved.

The confirmation step checks the exact catalog URL, retailer/branch compatibility, price bounds, observation time, expiry, price scope and explicit confirmation of product, size, branch and availability. Saved checks are labelled **Your confirmed check**, never an automated feed. A check overrides an automated observation only when it is newer or the automated observation is expired. Original observation time and Wednesday expiry rules apply.

Checks live in localStorage `cocobella-confirmed-checks-v1` on that browser, with a maximum of 300 entries. They are not published to GitHub and do not change shared data or unattended morning collection. Export/import transfers checks between devices, preserving timestamps and requiring confirmation; stale imports are rejected. Expired locally saved checks remain in local history but cannot win a comparison. Removal affects local checks only. The screenshot itself is not retained. Private-browsing/storage restrictions may prevent persistence, and clearing browser data removes these checks.
