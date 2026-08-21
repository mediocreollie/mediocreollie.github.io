# Cocobella tracker integration

This directory contains the zero-cost collector for the static tracker at
`/public/cocobella/`. It observes only **Cocobella Coconut Water Straight Up
1L** at Coles Rundle Place (`4964`), Woolworths Rundle Mall (`5317`), and
Henley Square Foodland.

## Data sources and verification

- Coles uses Coles' public product data and accepts product `1251527` only
  when the response carries exact store context `4964`.
- Woolworths uses the public catalogue services used by Woolworths' catalogue
  frontend. It requires the exact Rundle Mall selector for postcode `5000`, a
  current SA catalogue for that selector, and exact stockcode `724514`.
  Catalogue-store ID `5231` is an internal catalogue mapping and is not used as
  a substitute for Woolworths store reference `5317`.
- Foodland checks current Henley Square-hosted specials and the current official
  Foodland SA catalogue. It accepts only an unambiguous exact match for the
  Straight Up 1L product. Foodland exposes no reliable everyday shelf-price
  feed, so an absent catalogue match remains `Price unavailable`.

All sources fail closed: an unverifiable store, product, date, availability, or
price produces an unavailable result rather than a generic or guessed price.

## Run locally from the repository root

```sh
python -m pip install -r scripts/cocobella/requirements.txt
python -m unittest discover -s tests/cocobella -p "test_*.py" -v
node --test tests/cocobella/app.test.cjs
python scripts/cocobella/collect_prices.py
python scripts/cocobella/validate_data.py
```

Current data is stored at `public/cocobella/data/current.json`; append-only,
deduplicated daily observations are stored at
`public/cocobella/data/history.json`. The static page reads these files with
relative URLs, so Astro copies the complete tracker to `dist/cocobella/`.

## GitHub Actions

`Update Cocobella prices` runs daily and can be started manually from the
Actions tab. Its optional manual inputs are for personally checked Woolworths
or Foodland shelf prices for the exact product and store. These observations
are explicitly labelled `manual_shelf_check` in the output.

The workflow commits only the two Cocobella JSON files to `main`; it does not
deploy Pages. That commit triggers the repository's existing Astro deployment.

GitHub deliberately suppresses new workflow runs for pushes authenticated with
the default `GITHUB_TOKEN`. Because the existing `deploy.yml` must remain
untouched, add one repository secret named `COCOBELLA_PUSH_TOKEN`: use a free
fine-grained personal access token restricted to this repository with
**Contents: read and write** permission. The workflow fails before collection
when this secret is missing, rather than committing data that never deploys.
The token push triggers `deploy.yml`, but cannot loop back into this workflow
because this workflow listens only to its daily schedule and manual dispatch.

No paid API, browser automation, database, root npm dependency, or other secret
is required.

To diagnose a failed retailer, run the collector and inspect that store's
`error` and `source` fields in `current.json`. Identifiers and public URLs live
in `tracker/config.py`; update the strict assertions and tests at the same time
if the tracked store or product is intentionally changed.
