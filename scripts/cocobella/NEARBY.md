# Henley Square expansion

Tracks only Cocobella Straight Up Coconut Water 1L. The nearby shortlist uses a
five-mile (8.04672 km) straight-line radius from Henley Square, not road distance.
Coordinates were checked using OpenStreetMap/Nominatim on 19 September 2026.
Official retailer/centre addresses and source links are in nearby-stores.json.
This is not a complete inventory survey; candidate branches need stock confirmation.

## Confirmed additional source

Drakes Findon: https://079.drakes.com.au/lines/cocobella-coconut-water-straight-up-1l

Both a rendered browser visit and a direct HTTP request returned the original 1L
product at $4.50 on 19 September 2026. The collector reads the Product JSON-LD
offer and checks exact product name, canonical URL, AUD currency, InStock status,
plausible price and the visible 'Serviced by Drakes Online Findon' shop identity.
It needs only Python's standard library. This is the Findon online price; shelf
price and availability may differ. Never reuse it for another Drakes branch.

Other Drakes locations in the radius have catalogue/store pages but were not
listed as independently serviced online shops in the Drakes online chooser.
They are candidates, not live-price sources. Coles/Woolworths nearby branches
are also candidates: an exact chain product listing does not establish a branch's
stock or shelf price. Woolworths automation still encounters access denial.
Foodland's SA listing cannot establish any individual independent store's price.

## Operation

Existing daily GitHub Actions schedule includes Findon via build_snapshot().
Run `python scripts/cocobella/update_prices.py`; tests:
`python -m unittest discover -s tests/cocobella -p 'test_*.py'`.
Failures are isolated by collector. New store histories survive subsequent runs.
The page defaults to nearby sources; the selector retains Rundle Mall sources.
The recommendation only uses fresh, store-specific online prices. Prices older
than 36 hours are unavailable. Chain-level listings remain explicitly labelled.
The chart uses actual observation dates and breaks across missing daily checks.
No historical observations were fabricated or copied between stores.

To add a supported collector, give it a stable key, verify product and shop
identity, add it to build_snapshot(), the nearby view and chart labels/colors.
Update the shortlist only after checking the branch address and radius.
