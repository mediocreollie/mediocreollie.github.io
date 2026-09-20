import importlib.util
import unittest
import json
from unittest.mock import patch
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("cocobella_updater", ROOT / "scripts" / "cocobella" / "update_prices.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class TrackerTests(unittest.TestCase):
    def test_browser_observation_expires_and_keeps_original_time(self):
        with patch.object(MODULE, 'fetch_coles_findon', side_effect=TimeoutError('offline')):
            current = MODULE.collect_coles_findon('2026-09-20T01:00:00Z')
            expired = MODULE.collect_coles_findon('2026-09-22T01:00:00Z')
        self.assertEqual(current['price'], 3.85)
        self.assertEqual(current['updated_at'], '2026-09-20T00:04:19Z')
        self.assertIsNone(expired['price'])
        history = {}
        MODULE.append_history(history, {'coles_findon': current})
        current['checked_at'] = '2026-09-21T01:00:00Z'
        MODULE.append_history(history, {'coles_findon': current})
        self.assertEqual(len(history['coles_findon']), 1)
        self.assertEqual(history['coles_findon'][0]['date'], current['updated_at'])

    def test_findon_does_not_fall_back_to_generic_price(self):
        with patch.object(MODULE, 'fetch_coles_findon', side_effect=TimeoutError('location not confirmed')):
            result = MODULE.collect_coles_findon('2026-09-20T00:00:00Z')
        self.assertFalse(result['verified'])
        self.assertIsNone(result['price'])

    def test_findon_rejects_wrong_product(self):
        with patch.object(MODULE, 'fetch_coles_findon', return_value='<h1>Cocobella Coffee 1L</h1>$2.75 1251527'):
            self.assertFalse(MODULE.collect_coles_findon('2026-09-20T00:00:00Z')['verified'])

    def drakes_page(self, **changes):
        product = {"@type": "Product", "name": "Cocobella Straight Up Coconut Water 1L", "url": MODULE.DRAKES_URL,
                   "offers": {"price": "4.50", "priceCurrency": "AUD", "availability": "https://schema.org/InStock"}}
        product.update(changes)
        return 'Serviced by Drakes Online Findon<script type="application/ld+json">' + json.dumps(product) + '</script>'

    def test_drakes_exact_offer_and_store(self):
        self.assertEqual(MODULE.parse_drakes(self.drakes_page()), 4.5)
        for page in [self.drakes_page(name="Cocobella Coffee 1L"), self.drakes_page().replace('Findon', 'Wayville'),
                     self.drakes_page(url="https://022.drakes.com.au/lines/example"), self.drakes_page().replace('InStock', 'OutOfStock'),
                     self.drakes_page().replace('AUD', 'USD')]:
            with self.assertRaises(ValueError):
                MODULE.parse_drakes(page)

    def test_drakes_failure_is_isolated(self):
        with patch.object(MODULE, 'fetch_text', side_effect=TimeoutError('offline')):
            self.assertIsNone(MODULE.collect_drakes('2026-09-19T00:00:00Z')['price'])

    def test_history_keeps_new_stores_on_reload(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as folder:
            path = Path(folder) / 'history.json'
            path.write_text(json.dumps({'history': {'drakes_findon': [{'date': '2026-09-19T00:00:00Z', 'price': 4.5}]}}))
            with patch.object(MODULE, 'HISTORY_PATH', path):
                self.assertEqual(MODULE.read_history()['drakes_findon'][0]['price'], 4.5)

    def test_currency_and_verified_availability_logic(self):
        self.assertEqual(MODULE.format_price(5.5), "$5.50")
        self.assertEqual(MODULE.format_price(None), "Unavailable")
        self.assertTrue(MODULE.is_available({"price": 3.3, "verified": True}))
        self.assertFalse(MODULE.is_available({"price": 3.3, "verified": False}))

    def test_cheapest_ignores_unverified_prices(self):
        prices = {"coles": {"price": 5.5, "verified": True}, "woolworths": {"price": 3.3, "verified": False},
                  "foodland": {"price": None, "verified": False}}
        self.assertEqual(MODULE.compute_cheapest(prices), "coles")

    def test_exact_product_price_is_extracted(self):
        page = '<main><h1>Cocobella Coconut Water Straight Up 1L</h1><p>$4.50</p><p>Code: 1251527</p></main>'
        self.assertEqual(MODULE.extract_price_near_product(page, MODULE.PRODUCT_NAME, "1251527"), 4.5)

    def test_coles_title_separator_is_normalized(self):
        page = '<main><h1>Cocobella Coconut Water Straight Up | 1L</h1><p>$5.50</p><p>Code: 1251527</p></main>'
        self.assertEqual(MODULE.extract_price_near_product(page, MODULE.PRODUCT_NAME, "1251527"), 5.5)

    def test_wrong_variant_is_rejected(self):
        page = '<main><h1>Cocobella Coffee Coconut Water 1L</h1><p>$2.75</p><p>Code: 1251527</p></main>'
        with self.assertRaises(ValueError):
            MODULE.extract_price_near_product(page, MODULE.PRODUCT_NAME, "1251527")

    def test_history_only_records_verified_live_prices(self):
        history = {"coles": [], "woolworths": [], "foodland": []}
        snapshot = {"coles": {"checked_at": "2026-09-03T00:00:00Z", "price": 5.5, "verified": True},
                    "woolworths": {"checked_at": "2026-09-03T00:00:00Z", "price": 3.3, "verified": False},
                    "foodland": {"checked_at": "2026-09-03T00:00:00Z", "price": None, "verified": False}}
        MODULE.append_history(history, snapshot)
        self.assertEqual(len(history["coles"]), 1)
        self.assertEqual(history["woolworths"], [])
        self.assertEqual(history["foodland"], [])


if __name__ == "__main__":
    unittest.main()
