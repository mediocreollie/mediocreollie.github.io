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

### Follow-up price checks, 20 September 2026

Coles Findon was selected through the public Click & Collect chooser. The exact
original 1L product was $3.85 (was $5.50), with Findon visible in the header,
including after reloading the product page. The new collector reproduces these
UI steps without cookies guessed from a store ID, and returns unavailable if
selection or product validation fails. GitHub runner access may differ from the
interactive browser, so browser success alone does not prove unattended support.

The first Actions attempt could not locate Coles' location selector. A dated
observation is therefore stored in data/browser-observations.json as a fallback,
explicitly labelled in the page. It expires after 36 hours, preserves its original
observation timestamp in history, and never gains freshness from a failed retry.
Automatic collection continues to try the normal store selector each morning.

Other Drakes microsites returned HTTP 403 for direct product requests. Fulham's
linked 16-22 September catalogue was downloaded and all 24 pages OCR-scanned;
no Cocobella offer was found. OCR cannot establish a regular price when the
product is absent. Henley's linked local specials PDF was for 9-15 September,
already expired. Woolworths rendered the product at $5.50 in an unselected
session, but completing the Fulham pickup selection requested login; that
price must not be labelled as a verified Fulham or West Lakes price.

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


## Coles runner diagnosis, 22 September 2026

The GitHub Actions response is HTTP 200 but contains an Imperva/Incapsula iframe. The diagnostic screenshot explicitly asks for an additional security check and hCaptcha. This is not a missing selector or price parsing error. OCR would read the challenge rather than a product price. Do not change fingerprints, rotate proxies, or attempt to bypass it.

The collector now identifies this response and reports that a human security check is required. Failed-selector screenshots are retained as Actions artifacts for three days, not published on the tracker. Dated browser observations still expire after 36 hours and retain their original observation time. Findon was checked interactively again on 22 September at 04:20:41 UTC: $3.85, was $5.50, with Findon Click & Collect selected after reload. This does not establish working unattended retrieval.
