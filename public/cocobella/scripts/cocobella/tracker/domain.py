"""Validation and price-domain helpers shared by the collector and tests."""

from __future__ import annotations

import math
import re
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable

from .config import PRODUCT

_EXCLUDED_VARIANTS = {
    "chocolate",
    "coffee",
    "watermelon",
    "smoothie",
    "yoghurt",
    "yogurt",
    "matcha",
    "strawberry",
    "hazelnut",
}


def normalise(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def parse_price(value: Any) -> float | None:
    """Return a sane AUD price or None; never coerce missing data to zero."""
    if value is None or isinstance(value, bool):
        return None
    text = str(value).strip().replace("$", "").replace(",", "")
    if not text:
        return None
    try:
        price = float(Decimal(text))
    except (InvalidOperation, ValueError):
        return None
    if not math.isfinite(price) or price <= 0 or price >= 100:
        return None
    return round(price, 2)


def validate_product(
    *,
    product_id: Any,
    expected_id: str,
    name: Any,
    brand: Any,
    size: Any,
    description: Any = "",
) -> bool:
    """Strictly accept only Cocobella Straight Up 1L with the configured ID."""
    if str(product_id) != str(expected_id):
        return False
    combined = normalise(" ".join(map(str, (name, brand, size, description))))
    if any(re.search(rf"\b{re.escape(term)}\b", combined) for term in _EXCLUDED_VARIANTS):
        return False
    if "cocobella" not in combined or "straight up" not in combined:
        return False
    explicit_size = normalise(size)
    size_ok = explicit_size in {"1l", "1 l", "1 litre", "1 liter"}
    if not size_ok:
        size_ok = bool(re.search(r"\b1\s*(?:l|litre|liter)\b", combined))
    return size_ok


def verify_store(store: dict[str, Any], expected_id: str, expected_name: str) -> bool:
    store_id = store.get("storeId") or store.get("id")
    if isinstance(store_id, str) and ":" in store_id:
        store_id = store_id.rsplit(":", 1)[-1]
    name = store.get("storeName") or store.get("name") or ""
    return str(store_id) == str(expected_id) and normalise(expected_name) in normalise(name)


def cheapest(stores: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    valid = [
        store
        for store in stores
        if store.get("verified") is True
        and store.get("available") is True
        and parse_price(store.get("price")) is not None
    ]
    if not valid:
        return []
    low = min(float(store["price"]) for store in valid)
    return [store for store in valid if abs(float(store["price"]) - low) < 0.001]


def unavailable(config: dict[str, Any], checked_at: str, error: str, **extra: Any) -> dict[str, Any]:
    result = {
        "retailer": config["retailer"],
        "store": config["store"],
        "storeId": config.get("storeId"),
        "price": None,
        "regularPrice": None,
        "special": False,
        "available": False,
        "verified": False,
        "checkedAt": checked_at,
        "error": error,
    }
    result.update(extra)
    return result


def configured_product() -> dict[str, str]:
    return {"name": PRODUCT["name"], "size": PRODUCT["size"]}

