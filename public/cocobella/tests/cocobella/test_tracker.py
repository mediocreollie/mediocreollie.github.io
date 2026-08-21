from __future__ import annotations

import json
import os
import sys
import unittest
from unittest import mock
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

COCOBELLA_SCRIPTS = Path(__file__).resolve().parents[2] / "scripts" / "cocobella"
sys.path.insert(0, str(COCOBELLA_SCRIPTS))

from tracker.collector import (
    apply_manual_override,
    catalogue_dates,
    coles_runtime_key,
    coles_store_from_page,
    extract_foodland_text_price,
    foodland_catalogue_metadata,
    issuu_page_texts,
    issuu_publication_id,
    parse_coles_product,
    parse_woolworths_probe,
)
from tracker.config import FOODLAND
from tracker.domain import cheapest, parse_price, validate_product, verify_store
from tracker.history import append_observations


class ProductValidationTests(unittest.TestCase):
    def test_correct_product_is_accepted(self):
        self.assertTrue(validate_product(
            product_id=1251527,
            expected_id="1251527",
            name="Coconut Water Straight Up",
            brand="Cocobella",
            size="1L",
            description="COCOBELLA COCONUT WATER STRAIGHT UP 1 LITRE",
        ))

    def test_wrong_variant_and_size_are_rejected(self):
        self.assertFalse(validate_product(
            product_id=1251527, expected_id="1251527", name="Coconut Water Coffee",
            brand="Cocobella", size="1L", description="Flavoured coffee",
        ))
        self.assertFalse(validate_product(
            product_id=1251527, expected_id="1251527", name="Coconut Water Straight Up",
            brand="Cocobella", size="350mL",
        ))
        self.assertFalse(validate_product(
            product_id=724515, expected_id="724514", name="Coconut Water Straight Up",
            brand="Cocobella", size="1L",
        ))

    def test_price_parsing_and_missing_price(self):
        self.assertEqual(parse_price("$5.50"), 5.5)
        self.assertEqual(parse_price(3.3), 3.3)
        self.assertIsNone(parse_price(None))
        self.assertIsNone(parse_price("Currently unavailable"))
        self.assertIsNone(parse_price("0"))


class ColesParsingTests(unittest.TestCase):
    def test_store_verification(self):
        store = {"storeId": "4964", "storeName": "Coles Rundle Place"}
        self.assertTrue(verify_store(store, "4964", "Coles Rundle Place"))
        self.assertFalse(verify_store(store, "1234", "Coles Rundle Place"))
        self.assertFalse(verify_store(store, "4964", "Coles Firle"))

    def test_store_page_embedded_json(self):
        payload = {"props": {"pageProps": {"store": {"storeId": "4964", "storeName": "Coles Rundle Place"}}}}
        html = f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(payload)}</script>'
        self.assertEqual(coles_store_from_page(html)["storeId"], "4964")

    def test_public_runtime_key_and_challenge_rejection(self):
        html = '<script>window.__RUNTIME_CONFIG__={"BFF_API_SUBSCRIPTION_KEY":"eae83861d1cd4de6bb9cd8a2cd6f041e"}</script>'
        self.assertEqual(coles_runtime_key(html), "eae83861d1cd4de6bb9cd8a2cd6f041e")
        with self.assertRaises(ValueError):
            coles_runtime_key("<title>Pardon Our Interruption</title>")

    def test_regular_and_special_price_parsing(self):
        base = {
            "id": 1251527, "name": "Coconut Water Straight Up", "brand": "Cocobella",
            "size": "1L", "description": "COCOBELLA COCONUT WATER STRAIGHT UP 1 LITRE",
            "availability": True,
        }
        regular = parse_coles_product({**base, "pricing": {"now": 5.5, "promotionType": ""}}, "2026-08-18T18:00:00+09:30")
        self.assertEqual(regular["price"], 5.5)
        self.assertFalse(regular["special"])

        special = parse_coles_product({**base, "pricing": {
            "now": 3.85, "was": 5.5, "promotionType": "SPECIAL", "specialType": "SIMPLE",
        }}, "2026-08-18T18:00:00+09:30")
        self.assertTrue(special["special"])
        self.assertEqual(special["regularPrice"], 5.5)

    def test_multibuy_keeps_single_unit_price(self):
        result = parse_coles_product({
            "id": 1251527, "name": "Coconut Water Straight Up", "brand": "Cocobella",
            "size": "1L", "description": "COCOBELLA COCONUT WATER STRAIGHT UP 1 LITRE",
            "availability": True,
            "pricing": {
                "now": 5.5, "promotionType": "SPECIAL", "offerDescription": "Pick any 6 for $27",
                "specialType": "MULTI_SAVE", "multiBuyPromotion": {"minQuantity": 6, "reward": 4.5},
            },
        }, "2026-08-18T18:00:00+09:30")
        self.assertEqual(result["price"], 5.5)
        self.assertEqual(result["offer"]["effectiveUnitPrice"], 4.5)


class WoolworthsAndManualTests(unittest.TestCase):
    def probe(self):
        return {
            "store": {"storeId": "5317", "storeName": "Rundle Mall"},
            "product": {
                "id": "724514", "name": "Cocobella Coconut Water Straight Up 1L",
                "brand": "Cocobella", "size": "1L", "description": "Pure coconut water",
            },
            "price": 5.5, "regularPrice": 5.5, "special": False, "available": True,
            "availabilityVerified": True,
            "catalogue": {
                "storeName": "Woolworths Rundle Mall, 5000", "areaName": "SA",
                "catalogueStoreId": "5231", "saleId": "67221",
                "validFrom": "2026-08-19", "validTo": "2026-08-25",
            },
        }

    def test_woolworths_probe_requires_exact_store_and_catalogue(self):
        result = parse_woolworths_probe(self.probe(), "2026-08-18T20:00:00+09:30")
        self.assertEqual(result["price"], 5.5)
        self.assertTrue(result["verified"])

        wrong_store = self.probe()
        wrong_store["store"] = {"storeId": "5619", "storeName": "Unley"}
        with self.assertRaises(ValueError):
            parse_woolworths_probe(wrong_store, "2026-08-18T20:00:00+09:30")

        wrong_context = self.probe()
        wrong_context["catalogue"]["storeName"] = "Woolworths Unley, 5061"
        with self.assertRaises(ValueError):
            parse_woolworths_probe(wrong_context, "2026-08-18T20:00:00+09:30")

    def test_manual_shelf_check_is_explicit_and_price_validated(self):
        base = {"verified": False}
        with mock.patch.dict(os.environ, {
            "MANUAL_FOODLAND_PRICE": "4.75",
            "MANUAL_FOODLAND_REGULAR_PRICE": "5.50",
            "MANUAL_FOODLAND_SPECIAL": "true",
        }, clear=False):
            result = apply_manual_override(base, FOODLAND, "2026-08-18T20:00:00+09:30")
        self.assertEqual(result["price"], 4.75)
        self.assertTrue(result["special"])
        self.assertEqual(result["source"]["type"], "manual_shelf_check")

        with mock.patch.dict(os.environ, {"MANUAL_FOODLAND_PRICE": "not a price"}, clear=False):
            self.assertIs(apply_manual_override(base, FOODLAND, "2026-08-18T20:00:00+09:30"), base)


class DomainAndHistoryTests(unittest.TestCase):
    def store(self, retailer, store, price, verified=True):
        return {
            "retailer": retailer, "store": store, "storeId": retailer,
            "price": price if verified else None, "regularPrice": price if verified else None,
            "special": False, "available": verified, "verified": verified,
            "checkedAt": "2026-08-18T18:00:00+09:30",
        }

    def test_cheapest_tie_and_unavailable(self):
        stores = [self.store("Coles", "Rundle Place", 4.0), self.store("Woolworths", "Rundle Mall", 4.0), self.store("Foodland", "Henley Square", None, False)]
        self.assertEqual([item["retailer"] for item in cheapest(stores)], ["Coles", "Woolworths"])
        stores[1]["price"] = 5.5
        self.assertEqual([item["retailer"] for item in cheapest(stores)], ["Coles"])
        self.assertEqual(cheapest([stores[2]]), [])

    def test_history_appends_without_same_day_duplicates(self):
        history = {"observations": []}
        coles = self.store("Coles", "Rundle Place", 5.5)
        unavailable = self.store("Woolworths", "Rundle Mall", None, False)
        self.assertEqual(append_observations(history, [coles, unavailable]), 1)
        self.assertEqual(append_observations(history, [coles]), 0)
        changed = {**coles, "price": 3.85, "regularPrice": 5.5, "special": True}
        self.assertEqual(append_observations(history, [changed]), 1)
        self.assertEqual(len(history["observations"]), 2)

    def test_catalogue_date_parsing(self):
        dates = catalogue_dates("https://henleysquarefoodland.com.au/wp-content/uploads/2026/08/HEN9792-Market-Day-A4-19-25-Aug.pdf")
        self.assertEqual(tuple(item.isoformat() for item in dates), ("2026-08-19", "2026-08-25"))


class FoodlandCatalogueTests(unittest.TestCase):
    def test_official_catalogue_metadata_and_reader_validation(self):
        html = '''
        <p>ON SALE 19 AUGUST 2026 - 25 AUGUST 2026</p>
        <option>Henley Square</option>
        <iframe src="https://e.issuu.com/embed.html?d=foodland_catalogue_week_34_2026_abc123&amp;u=foodlandsupermarkets"></iframe>
        '''
        metadata = foodland_catalogue_metadata(html, datetime(2026, 8, 21).date())
        self.assertEqual(metadata["documentName"], "foodland_catalogue_week_34_2026_abc123")
        publication = {"document": {"publicationId": "a" * 32, "pages": [{"a11yHtmlUrl": "https://example.test"}]}}
        self.assertEqual(issuu_publication_id(publication), "a" * 32)
        text_payload = [{"result": {"data": {"json": {"pageTexts": ["one", "two"]}}}}]
        self.assertEqual(issuu_page_texts(text_payload), ["one", "two"])

    def test_exact_foodland_product_price_and_wrong_variant(self):
        exact = ["3\n$ 30\nCocobella Coconut Water Straight Up 1L"]
        self.assertEqual(extract_foodland_text_price(exact), 3.3)
        self.assertIsNone(extract_foodland_text_price([
            "$3.30 Cocobella Coconut Water Watermelon & Mint 1L",
        ]))


if __name__ == "__main__":
    unittest.main()
