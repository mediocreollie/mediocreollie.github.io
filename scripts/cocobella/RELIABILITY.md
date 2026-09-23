# Tracker reliability, 23 September 2026

The collector only publishes prices for a confirmed branch and the exact original 1L product.

- Drakes Findon: structured in-stock AUD offer from the Findon shop.
- Coles Findon: browser selects Click & Collect, confirms the branch after reload, and validates the product. The GitHub runner currently receives a human security check. A dated browser observation may remain for at most 36 hours; its original timestamp is retained.
- Coles Rundle Place: no validated branch collector. Generic listing prices are excluded.
- Woolworths: public API and runner access were denied. Interactive text extraction works, but saving a store requires login and the login page was blocked. OCR cannot establish missing branch context. Do not retry blocked routes or substitute generic prices.
- Henley Square Foodland: no validated store-specific product source. The official specials link is provided; other Foodlands are not proxies.

Unavailable results are valid output, including when all sources fail, so scheduled publication clears expired prices. Unexpected script errors still fail the workflow. Refresh attempt time is distinct from successful observation time. The browser checks expiry each minute, rejects future timestamps, and only recommends branch-specific observations under 36 hours old.

Legacy chain observations remain in JSON with store_specific false and are excluded from the branch chart. No fake history is added. Optional history or nearby-file loading failures do not hide current price status.

Run tests: python -m unittest discover -s tests/cocobella -p 'test_*.py'
Run collection: python scripts/cocobella/update_prices.py
Use Actions > Update Cocobella prices > Run workflow for a manual refresh. Inspect the current data and errors, not just a green run. The existing COCOBELLA_PUSH_TOKEN allows data commits to trigger site deployment; github.token is only a checkout fallback and its commits do not trigger downstream push workflows.
