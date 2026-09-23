#!/usr/bin/env python3
from __future__ import annotations

import html
import math
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
FOODLAND_URL = "https://products.foodlandsa.com.au/lines/c-bella-ccnut-wtr-str-up-1l"
DRAKES_URL = "https://079.drakes.com.au/lines/cocobella-coconut-water-straight-up-1l"
USER_AGENT = "Mozilla/5.0 (compatible; CocobellaPriceTracker/1.0; +https://olliewritesthings.com/cocobella/)"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def format_price(value: float | None) -> str:
    return "Unavailable" if value is None else f"${value:.2f}"


def is_available(entry: dict[str, Any] | None) -> bool:
    return bool(entry and entry.get("verified") is True and isinstance(entry.get("price"), (int, float)) and not isinstance(entry["price"], bool) and math.isfinite(entry["price"]) and 1 <= entry["price"] <= 20)


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
    text = html.unescape(re.sub(r"<[^>]+>", " ", page)).replace("|", " ")
    return re.sub(r"\s+", " ", text).strip()


def extract_price_near_product(page: str, product_name: str, product_id: str | None = None) -> float:
    headings = re.findall(r"<h1\b[^>]*>(.*?)</h1>", page, re.I | re.S)
    if not any(visible_text(h).casefold() == product_name.casefold() for h in headings):
        raise ValueError("The exact product heading was not present")
    if product_id and product_id not in page:
        raise ValueError("The expected product identifier was not present")
    # Never take the first dollar amount: it may be savings, a was price or a recommendation.
    after_heading = re.split(r"</h1\s*>", page, maxsplit=1, flags=re.I)[1]
    text = visible_text(after_heading).split("Similar Items")[0].split("People Who Bought")[0][:700]
    explicit = re.search(r"(?:^|\s)Price\s*\$(\d{1,3}(?:\.\d{2})?)(?![\d.])", text, re.I)
    if explicit:
        price = float(explicit.group(1))
    else:
        # Coles exposes an isolated current-price amount directly after the heading.
        first = re.match(r"\s*\$(\d{1,3}(?:\.\d{2})?)(?![\d.])", text)
        if not first:
            raise ValueError("An unambiguous current product price was not present")
        price = float(first.group(1))
    if not 1 <= price <= 20:
        raise ValueError(f"Implausible price {price}")
    return price


def fetch_rendered_text(url: str) -> str:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright is required for the Woolworths collector") from exc

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT, locale="en-AU")
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        try:
            page.locator("h1", has_text=PRODUCT_NAME).wait_for(timeout=20000)
            page.locator("text=/Price \\$[0-9]+(?:\\.[0-9]{2})?/").first.wait_for(timeout=20000)
        except Exception:
            # Preserve the rendered response so product validation can fail safely.
            pass
        content = page.content()
        browser.close()
        return content


def unavailable(name: str, store_id: str, error: str, checked_at: str) -> dict[str, Any]:
    return {"name": name, "store_id": store_id, "price": None, "status": "unavailable", "verified": False,
            "checked_at": checked_at, "error": error}


def collect_coles(checked_at: str) -> dict[str, Any]:
    result = unavailable("Coles Rundle Place", "4964", "No verified Rundle Place price source. Generic online prices are excluded.", checked_at)
    result["source"] = COLES_URL
    return result


def check_coles_access(page_html: str) -> None:
    # HTTP 200 can still be an Imperva challenge inside an otherwise empty iframe.
    if '_Incapsula_Resource' in page_html and ('incident_id=' in page_html or 'Incapsula incident ID' in page_html):
        raise RuntimeError("Coles requires a human security check on the automatic runner; no Findon price was retrieved")


def fetch_coles_findon() -> str:
    """Select a real pickup store, then reload to avoid the default-location price."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            page = browser.new_page(locale="en-AU")
            page.set_default_timeout(20000)
            response = page.goto(COLES_URL, wait_until="domcontentloaded", timeout=60000)
            try:
                check_coles_access(page.content())
                page.get_by_role("button", name=re.compile(r"^(Set your location|Set shopping method)")).click()
            except Exception as exc:
                diagnostics = ROOT / "artifacts" / "coles-findon"
                diagnostics.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(diagnostics / "page.png"), full_page=True)
                check_coles_access(page.content())
                raise RuntimeError(f"Coles location selector unavailable. HTTP {response.status if response else 'unknown'}; URL {page.url}; Page: {page.title()}; HTML length {len(page.content())}; {page.locator('body').inner_text()[:200]}") from exc
            page.get_by_role("button", name="Click & Collect", exact=True).click()
            page.get_by_role("combobox", name="Your selected store", exact=True).fill("Findon")
            page.get_by_role("option", name="Findon, SA 5023", exact=True).click()
            page.get_by_role("radio", name=re.compile(r"^Coles Findon Findon S/C, Cnr Grange & Findon Rds")).check()
            page.get_by_role("button", name="Set location", exact=True).click()
            page.get_by_role("banner").get_by_text("Findon", exact=True).wait_for()
            page.reload(wait_until="domcontentloaded", timeout=60000)
            page.get_by_role("banner").get_by_text("Findon", exact=True).wait_for()
            page.get_by_role("heading", name="Cocobella Coconut Water Straight Up | 1L", exact=True).wait_for()
            return page.content()
        finally:
            browser.close()


def collect_coles_findon(checked_at: str) -> dict[str, Any]:
    try:
        page = fetch_coles_findon()
        price = extract_price_near_product(page, PRODUCT_NAME, "1251527")
        return {"name": "Coles Findon", "store_id": "403", "price": price,
                "status": "available", "verified": True, "store_specific": True,
                "checked_at": checked_at, "updated_at": checked_at, "source": COLES_URL,
                "price_scope": "Findon Click & Collect price; shelf price and stock may differ"}
    except Exception as exc:
        result = unavailable("Coles Findon", "403", str(exc), checked_at)
        path = DATA_DIR / "browser-observations.json"
        if path.exists():
            try:
                observation = json.loads(path.read_text()).get("coles_findon", {})
                observed_at = observation.get("updated_at", "")
                age = (datetime.fromisoformat(checked_at.replace("Z", "+00:00")) - datetime.fromisoformat(observed_at.replace("Z", "+00:00"))).total_seconds()
                if (0 <= age < 36 * 3600 and observation.get("product_id") == "1251527"
                        and observation.get("store_id") == "403" and observation.get("verified") is True
                        and isinstance(observation.get("price"), (int, float)) and 1 <= observation["price"] <= 20):
                    result.update(observation)
                    result.update(status="available", store_specific=True)
                    result.pop("error", None)
                    result["checked_at"] = checked_at
                    result["refresh_error"] = str(exc)
                    result["price_scope"] = "Findon Click & Collect, dated browser check; automatic refresh unavailable. Expires after 36 hours."
            except (ValueError, TypeError, AttributeError, OSError):
                pass
        return result


def collect_woolworths(checked_at: str) -> dict[str, Any]:
    result = unavailable("Woolworths Rundle Mall", "5317", "Automatic access is blocked; branch pricing could not be verified. Check the product with your store selected.", checked_at)
    result["source"] = WOOLWORTHS_URL
    return result


def collect_foodland(checked_at: str) -> dict[str, Any]:
    result = unavailable("Foodland Henley Square", "henley-square", "No verified Henley Square product-price source. Another Foodland's price is not substituted.", checked_at)
    result["source"] = "https://henleysquarefoodland.com.au/specials/"
    return result


def parse_drakes(page: str) -> float:
    # The shop's own structured offer avoids confusing unit/previous prices.
    text = visible_text(page)
    if "Serviced by Drakes Online Findon" not in text:
        raise ValueError("Findon shop identity could not be verified")
    for raw in re.findall(r'<script\b[^>]*type=[\"\']application/ld\+json[\"\'][^>]*>(.*?)</script>', page, re.I | re.S):
        product = json.loads(raw)
        if not isinstance(product, dict) or product.get("@type") != "Product":
            continue
        if product.get("name") != "Cocobella Straight Up Coconut Water 1L" or product.get("url") != DRAKES_URL:
            continue
        offer = product.get("offers", {})
        if offer.get("priceCurrency") != "AUD" or not offer.get("availability", "").endswith("/InStock"):
            raise ValueError("No in-stock AUD offer for Findon")
        price = float(offer["price"])
        if not 1 <= price <= 20:
            raise ValueError("Implausible Findon price")
        return price
    raise ValueError("Exact original 1L product offer missing")


def collect_drakes(checked_at: str) -> dict[str, Any]:
    try:
        price = parse_drakes(fetch_text(DRAKES_URL))
        return {"name": "Drakes Findon", "store_id": "079", "price": price,
                "status": "available", "verified": True, "store_specific": True,
                "checked_at": checked_at, "updated_at": checked_at, "source": DRAKES_URL,
                "price_scope": "Findon online shop; shelf price and stock may differ"}
    except Exception as exc:
        return unavailable("Drakes Findon", "079", str(exc), checked_at)


def build_snapshot() -> dict[str, dict[str, Any]]:
    checked_at = now_iso()
    return {"coles": collect_coles(checked_at), "woolworths": collect_woolworths(checked_at),
            "foodland": collect_foodland(checked_at), "drakes_findon": collect_drakes(checked_at),
            "coles_findon": collect_coles_findon(checked_at)}


def read_history() -> dict[str, list[dict[str, Any]]]:
    if not HISTORY_PATH.exists():
        return {"coles": [], "woolworths": [], "foodland": []}
    history = json.loads(HISTORY_PATH.read_text(encoding="utf-8")).get("history", {})
    # Legacy collectors verified the product, not the branch. Preserve but label those records.
    return {key: [dict(value, store_specific=value.get("store_specific", key in {"drakes_findon", "coles_findon"}))
                  for value in values] for key, values in history.items()}


def append_history(history: dict[str, list[dict[str, Any]]], snapshot: dict[str, dict[str, Any]]) -> None:
    for store, entry in snapshot.items():
        if not is_available(entry) or entry.get("store_specific") is not True:
            continue
        observation = {"date": entry.get("updated_at", entry["checked_at"]), "price": entry["price"], "verified": True, "store_specific": True}
        prior = history.setdefault(store, [])
        if prior and prior[-1].get("date", "") > observation["date"]:
            continue
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
    cheapest = compute_cheapest({key: value for key, value in snapshot.items() if value.get("store_specific") is True})
    payload = {"generated_at": now_iso(), "product": PRODUCT_NAME, "stores": snapshot,
               "cheapest_store": cheapest, "recommended_store": cheapest, "history": history}
    write_json(PRICES_PATH, payload)
    write_json(HISTORY_PATH, {"history": history})
    verified = [key for key, value in snapshot.items() if is_available(value)]
    print("Available verified observations: " + (", ".join(verified) if verified else "none"))
    for key, value in snapshot.items():
        print(f"{key}: {format_price(value.get('price'))} ({value.get('status')})")
        if value.get("error"):
            print(f"  {value['error']}")
    # Unavailability is valid data and must reach the site, even if every source fails.
    return 0


if __name__ == "__main__":
    sys.exit(main())
