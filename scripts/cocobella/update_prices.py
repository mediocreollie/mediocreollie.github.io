#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "public" / "cocobella" / "data"
PRICES_PATH = DATA_DIR / "prices.json"
HISTORY_PATH = DATA_DIR / "price-history.json"
PRODUCT_NAME = "Cocobella Coconut Water Straight Up 1L"
COLES_URL = "https://www.coles.com.au/product/cocobella-coconut-water-straight-up-1l-1251527"
WOOLWORTHS_URL = "https://www.woolworths.com.au/shop/productdetails/724514/cocobella-coconut-water-straight-up"
USER_AGENT = "Mozilla/5.0 (compatible; CocobellaPriceTracker/1.0; +https://olliewritesthings.com/cocobella/)"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def format_price(value: float | None) -> str:
    return "Unavailable" if value is None else f"${value:.2f}"


def is_available(entry: dict[str, Any] | None) -> bool:
    return bool(entry and entry.get("verified") is True and entry.get("price") is not None)


def compute_cheapest(prices: dict[str, dict[str, Any]]) -> str | None:
    available = {key: value for key, value in prices.items() if is_available(value)}
    return min(available, key=lambda key: available[key]["price"]) if available else None


def fetch_text(url: str, *, cookies: str = "") -> str:
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
    if cookies:
        headers["Cookie"] = cookies
    with urlopen(Request(url, headers=headers), timeout=25) as response:
        return response.read().decode("utf-8", errors="replace")


def visible_text(page: str) -> str:
    page = re.sub(r"<script\b[^>]*>.*?</script>", " ", page, flags=re.I | re.S)
    page = re.sub(r"<style\b[^>]*>.*?</style>", " ", page, flags=re.I | re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", page))).strip()


def extract_price_near_product(page: str, product_name: str, product_id: str) -> float:
    text = visible_text(page)
    if product_id not in page or product_name.lower() not in text.lower():
        raise ValueError("The expected product and product ID were not both present")
    product_at = text.lower().find(product_name.lower())
    match = re.search(r"\$(\d{1,3}(?:\.\d{2})?)", text[product_at : product_at + 700])
    if not match:
        raise ValueError("No current price was present near the product name")
    price = float(match.group(1))
    if not 1 <= price <= 20:
        raise ValueError(f"Implausible price {price}")
    return price


def unavailable(name: str, store_id: str, error: str, checked_at: str) -> dict[str, Any]:
    return {"name": name, "store_id": store_id, "price": None, "status": "unavailable", "verified": False,
            "checked_at": checked_at, "error": error}


def collect_coles(checked_at: str) -> dict[str, Any]:
    name, store_id = "Coles Rundle Place", "4964"
    try:
        page = fetch_text(COLES_URL, cookies="fulfilmentStoreId=4964; storeId=4964")
        price = extract_price_near_product(page, PRODUCT_NAME, "1251527")
        return {"name": name, "store_id": store_id, "price": price, "status": "available", "verified": True,
                "checked_at": checked_at, "updated_at": checked_at, "source": COLES_URL}
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        return unavailable(name, store_id, str(exc), checked_at)


def collect_woolworths(checked_at: str) -> dict[str, Any]:
    name, store_id = "Woolworths Rundle Mall", "5317"
    try:
        page = fetch_text(WOOLWORTHS_URL, cookies="fulfilment-store-id=5317; storeId=5317")
        price = extract_price_near_product(page, PRODUCT_NAME, "724514")
        return {"name": name, "store_id": store_id, "price": price, "status": "available", "verified": True,
                "checked_at": checked_at, "updated_at": checked_at, "source": WOOLWORTHS_URL}
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        return unavailable(name, store_id, str(exc), checked_at)


def build_snapshot() -> dict[str, dict[str, Any]]:
    checked_at = now_iso()
    return {"coles": collect_coles(checked_at), "woolworths": collect_woolworths(checked_at),
            "foodland": unavailable("Foodland Henley Square", "henley-square", "No reliable public product-price source", checked_at)}


def read_history() -> dict[str, list[dict[str, Any]]]:
    if not HISTORY_PATH.exists():
        return {"coles": [], "woolworths": [], "foodland": []}
    history = json.loads(HISTORY_PATH.read_text(encoding="utf-8")).get("history", {})
    return {key: list(history.get(key, [])) for key in ("coles", "woolworths", "foodland")}


def append_history(history: dict[str, list[dict[str, Any]]], snapshot: dict[str, dict[str, Any]]) -> None:
    for store, entry in snapshot.items():
        if not is_available(entry):
            continue
        observation = {"date": entry["checked_at"], "price": entry["price"], "verified": True}
        prior = history.setdefault(store, [])
        if prior and prior[-1].get("date", "")[:10] == observation["date"][:10]:
            prior[-1] = observation
        else:
            prior.append(observation)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    snapshot = build_snapshot()
    history = read_history()
    append_history(history, snapshot)
    cheapest = compute_cheapest(snapshot)
    payload = {"generated_at": now_iso(), "product": PRODUCT_NAME, "stores": snapshot,
               "cheapest_store": cheapest, "recommended_store": cheapest, "history": history}
    write_json(PRICES_PATH, payload)
    write_json(HISTORY_PATH, {"history": history})
    verified = [key for key, value in snapshot.items() if is_available(value)]
    print("Verified live prices: " + (", ".join(verified) if verified else "none"))
    for key, value in snapshot.items():
        print(f"{key}: {format_price(value.get('price'))} ({value.get('status')})")
    return 0 if verified else 1


if __name__ == "__main__":
    sys.exit(main())
