import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("cocobella_updater", ROOT / "scripts" / "cocobella" / "update_prices.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class TrackerTests(unittest.TestCase):
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
