#!/usr/bin/env python3
"""Fail CI if generated tracker data could mislead the webpage."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
EXPECTED = {
    ("Coles", "Rundle Place", "4964"),
    ("Woolworths", "Rundle Mall", "5317"),
    ("Foodland", "Henley Square", None),
}
PRODUCT_NAME = "Cocobella Coconut Water Straight Up 1L"


def timestamp(value: Any, field: str) -> None:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be an ISO timestamp")
    datetime.fromisoformat(value)


def validate_current(data: dict[str, Any]) -> None:
    if data.get("schemaVersion") != 1:
        raise ValueError("unsupported current-data schema")
    if data.get("product", {}).get("name") != PRODUCT_NAME:
        raise ValueError("wrong product in current data")
    timestamp(data.get("checkedAt"), "checkedAt")
    if data.get("lastSuccessfulCheck") is not None:
        timestamp(data.get("lastSuccessfulCheck"), "lastSuccessfulCheck")
    timestamp(data.get("updated"), "updated")
    stores = data.get("stores")
    if not isinstance(stores, list) or len(stores) != 3:
        raise ValueError("current data must contain exactly three stores")
    actual = {(s.get("retailer"), s.get("store"), s.get("storeId")) for s in stores}
    if actual != EXPECTED:
        raise ValueError("current data contains an unexpected retailer or store")
    for store in stores:
        timestamp(store.get("checkedAt"), f"{store['retailer']}.checkedAt")
        price = store.get("price")
        if store.get("verified"):
            if store.get("available") is not True or not isinstance(price, (int, float)) or not 0 < price < 100:
                raise ValueError(f"invalid verified result for {store['retailer']}")
        elif price is not None:
            raise ValueError(f"unverified retailer {store['retailer']} must not expose a price")


def validate_history(data: dict[str, Any]) -> None:
    if data.get("schemaVersion") != 1 or data.get("product", {}).get("name") != PRODUCT_NAME:
        raise ValueError("invalid history schema or product")
    seen: set[tuple] = set()
    for item in data.get("observations", []):
        timestamp(item.get("observedAt"), "history.observedAt")
        if item.get("verified") is not True:
            raise ValueError("history may contain only verified observations")
        price = item.get("price")
        if not isinstance(price, (int, float)) or not 0 < price < 100:
            raise ValueError("history contains an invalid price")
        key = (
            item.get("date"), item.get("retailer"), item.get("store"), price,
            item.get("regularPrice"), bool(item.get("special")),
        )
        if key in seen:
            raise ValueError("history contains a duplicate observation")
        seen.add(key)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--current",
        type=Path,
        default=REPOSITORY_ROOT / "public" / "cocobella" / "data" / "current.json",
    )
    parser.add_argument(
        "--history",
        type=Path,
        default=REPOSITORY_ROOT / "public" / "cocobella" / "data" / "history.json",
    )
    args = parser.parse_args()
    with args.current.open(encoding="utf-8") as handle:
        validate_current(json.load(handle))
    with args.history.open(encoding="utf-8") as handle:
        validate_history(json.load(handle))
    print("Tracker data is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
