"""Retailer collectors. Uncertainty always becomes an unavailable result."""

from __future__ import annotations

import io
import json
import os
import re
from datetime import date, datetime
from html import unescape
from html.parser import HTMLParser
from typing import Any
from urllib.parse import parse_qs, quote, urljoin, urlparse
from zoneinfo import ZoneInfo

from .config import COLES, FOODLAND, PRODUCT, WOOLWORTHS
from .domain import parse_price, unavailable, validate_product, verify_store
from .http import FetchError, HttpClient

ADELAIDE = ZoneInfo("Australia/Adelaide")


class ScriptParser(HTMLParser):
    def __init__(self, target_id: str):
        super().__init__()
        self.target_id = target_id
        self.capture = False
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag.lower() == "script" and values.get("id") == self.target_id:
            self.capture = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self.capture:
            self.capture = False

    def handle_data(self, data: str) -> None:
        if self.capture:
            self.parts.append(data)


def extract_json_script(html: str, script_id: str = "__NEXT_DATA__") -> dict[str, Any]:
    parser = ScriptParser(script_id)
    parser.feed(html)
    if not parser.parts:
        raise ValueError(f"Missing {script_id} data")
    return json.loads("".join(parser.parts))


def coles_store_from_page(html: str) -> dict[str, Any]:
    data = extract_json_script(html)
    page_props = data.get("props", {}).get("pageProps", {})
    store = page_props.get("store")
    if isinstance(store, dict):
        return store
    queries = page_props.get("initialState", {}).get("digitalGraphQLApi", {}).get("queries", {})
    for query in queries.values():
        candidate = query.get("data", {}).get("store") if isinstance(query, dict) else None
        if isinstance(candidate, dict):
            return candidate
    raise ValueError("Coles store record was missing")


def coles_runtime_key(html: str) -> str:
    if "Pardon Our Interruption" in html or "reeseSkipExpirationCheck" in html:
        raise ValueError("Coles bot protection interrupted the public page request")
    match = re.search(r'"BFF_API_SUBSCRIPTION_KEY":"([a-fA-F0-9]{16,128})"', html)
    if not match:
        raise ValueError("Coles public frontend API key was not present")
    return match.group(1)


COLES_PRODUCT_QUERY = """
query GetProductDetails($storeId: BrandedId!, $productId: String!, $shoppingMethod: ShoppingMethod, $useV2NipAndAllergens: Boolean) {
  product(storeId: $storeId, productId: $productId, shoppingMethod: $shoppingMethod, useV2NipAndAllergens: $useV2NipAndAllergens) {
    id name brand description size availability availabilityStatus lastUpdated
    pricing {
      now was saveAmount saveStatement comparable promotionType onlineSpecial
      priceDescription savePercent specialType offerDescription
      multiBuyPromotion { type minQuantity reward unitPriceDisplay instruction }
    }
  }
}
""".strip()


def parse_coles_product(product: dict[str, Any], checked_at: str) -> dict[str, Any]:
    if not validate_product(
        product_id=product.get("id"),
        expected_id=COLES["productId"],
        name=product.get("name"),
        brand=product.get("brand"),
        size=product.get("size"),
        description=product.get("description"),
    ):
        raise ValueError("Coles returned the wrong product or package size")
    pricing = product.get("pricing") or {}
    price = parse_price(pricing.get("now"))
    if price is None:
        raise ValueError("Coles returned no valid current price")
    available = product.get("availability") is True
    if not available:
        raise ValueError("Product is unavailable at the selected Coles store")
    was = parse_price(pricing.get("was"))
    promotion_type = str(pricing.get("promotionType") or "").upper()
    multi = pricing.get("multiBuyPromotion") or None
    special = bool(was and was > price) or promotion_type == "SPECIAL" or bool(multi)
    regular_price = was or price
    result = {
        "retailer": COLES["retailer"],
        "store": COLES["store"],
        "storeId": COLES["storeId"],
        "price": price,
        "regularPrice": regular_price,
        "special": special,
        "available": True,
        "verified": True,
        "checkedAt": checked_at,
        "source": {
            "type": "retailer_graphql",
            "url": COLES["productUrl"],
            "storeContext": f"COL:{COLES['storeId']}",
        },
    }
    if product.get("lastUpdated"):
        result["retailerUpdatedAt"] = product["lastUpdated"]
    if pricing.get("offerDescription") or multi:
        result["offer"] = {
            "description": pricing.get("offerDescription") or pricing.get("priceDescription"),
            "type": pricing.get("specialType") or promotion_type,
            "minimumQuantity": multi.get("minQuantity") if multi else None,
            "effectiveUnitPrice": parse_price(multi.get("reward")) if multi else None,
        }
    return result


def collect_coles(client: HttpClient, checked_at: str) -> dict[str, Any]:
    try:
        store_html = client.request(COLES["storeUrl"]).text
        store = coles_store_from_page(store_html)
        if not verify_store(store, COLES["storeId"], "Coles Rundle Place"):
            raise ValueError("Coles store ID/name could not be verified")

        product_page = client.request(COLES["productUrl"]).text
        subscription_key = coles_runtime_key(product_page)
        response = client.request(
            COLES["graphqlUrl"],
            method="POST",
            headers={
                "Accept": "application/json",
                "Origin": "https://www.coles.com.au",
                "Referer": COLES["productUrl"],
                "Ocp-Apim-Subscription-Key": subscription_key,
            },
            json_body={
                "operationName": "GetProductDetails",
                "query": COLES_PRODUCT_QUERY,
                "variables": {
                    "storeId": f"COL:{COLES['storeId']}",
                    "productId": COLES["productId"],
                    "shoppingMethod": "CLICKANDCOLLECT",
                    "useV2NipAndAllergens": True,
                },
            },
        )
        payload = json.loads(response.text)
        if payload.get("errors"):
            raise ValueError(f"Coles GraphQL error: {payload['errors'][0].get('message', 'unknown error')}")
        product = payload.get("data", {}).get("product")
        if not isinstance(product, dict):
            raise ValueError("Coles response did not contain a product")
        return parse_coles_product(product, checked_at)
    except Exception as error:
        return unavailable(
            COLES,
            checked_at,
            f"Store-specific price could not be verified: {error}",
            source={"type": "retailer_graphql", "url": COLES["productUrl"]},
        )


def collect_woolworths(client: HttpClient, checked_at: str) -> dict[str, Any]:
    """Match Woolworths' exact product data to its Rundle Mall catalogue."""
    try:
        today = datetime.fromisoformat(checked_at).astimezone(ADELAIDE).date()
        sales_url = WOOLWORTHS["catalogueSalesUrl"]
        parsed_sales_url = urlparse(sales_url)
        api_key = (parse_qs(parsed_sales_url.query).get("apikey") or [""])[0]
        retailer_id = (parse_qs(parsed_sales_url.query).get("id") or [""])[0]
        if not api_key or retailer_id != "126" or parsed_sales_url.hostname != "webservice.salefinder.com.au":
            raise ValueError("Woolworths catalogue service identity was unexpected")

        region_url = WOOLWORTHS["catalogueRegionsUrl"]
        region_payload = json.loads(client.request(region_url, headers={"Accept": "application/json"}).text)
        region_records = [item.get("items") or {} for item in region_payload.get("items") or []]
        exact_regions = [
            item for item in region_records
            if item.get("displayName") == "Woolworths Rundle Mall"
            and str(item.get("postcode")) == "5000"
            and item.get("tag") == "SA"
        ]
        if len(exact_regions) != 1 or not str(exact_regions[0].get("storeId") or ""):
            raise ValueError("Woolworths catalogue store selector did not uniquely verify Rundle Mall")
        catalogue_store_id = str(exact_regions[0]["storeId"])

        store_sales_url = f"{sales_url}&storeId={quote(catalogue_store_id)}"
        sales_payload = json.loads(client.request(store_sales_url, headers={"Accept": "application/json"}).text)
        current_sales: list[dict[str, Any]] = []
        for wrapper in sales_payload.get("items") or []:
            sale = wrapper.get("items") or {}
            try:
                start = datetime.strptime(sale.get("startDate", ""), "%Y-%m-%d %H:%M:%S").date()
                end = datetime.strptime(sale.get("endDate", ""), "%Y-%m-%d %H:%M:%S").date()
            except ValueError:
                continue
            if (
                start <= today <= end
                and sale.get("areaName") == "SA"
                and sale.get("retailerName") == "Woolworths"
                and sale.get("saleId")
            ):
                current_sales.append({**sale, "validFrom": start.isoformat(), "validTo": end.isoformat()})
        if len(current_sales) != 1:
            raise ValueError("Woolworths returned no unique current SA catalogue for Rundle Mall")
        sale = current_sales[0]

        embed_url = WOOLWORTHS["catalogueEmbedUrl"]
        embed_script = client.request(embed_url).text
        token_match = re.search(r"token:'([^']+)'", embed_script)
        if not token_match:
            raise ValueError("Woolworths catalogue reader token was missing")
        callback = f"jQuery123_{int(datetime.now().timestamp() * 1000)}"
        product_list_url = (
            f"https://embed.salefinder.com.au/productlist/view/{quote(str(sale['saleId']))}/"
            f"?locationId={quote(catalogue_store_id)}&token={quote(token_match.group(1))}"
            f"&saleGroup=0&preview=&rows_per_page=999&callback={callback}"
        )
        product_list_text = client.request(
            product_list_url,
            headers={
                "Accept": "application/javascript, */*;q=0.8",
                "Referer": embed_url,
                "X-Requested-With": "XMLHttpRequest",
            },
        ).text
        prefix = f"{callback}("
        if not product_list_text.startswith(prefix) or not product_list_text.rstrip().endswith(")"):
            raise ValueError(
                f"Woolworths catalogue product list was malformed "
                f"(length {len(product_list_text)}, prefix {product_list_text[:24]!r}, "
                f"suffix {product_list_text[-24:]!r})"
            )
        product_list_payload = json.loads(product_list_text[len(prefix):product_list_text.rfind(")")])
        listing_html = product_list_payload.get("content") or ""
        listing_marker = re.search(r'data-stockcode=["\']724514["\']', listing_html)
        if not listing_marker:
            raise ValueError("exact product 724514 was absent from the Rundle Mall catalogue")
        listing = listing_html[listing_marker.start():listing_marker.start() + 2400]
        if not re.search(r'Cocobella\s+Coconut\s+Water\s+1\s*Litre', listing, flags=re.IGNORECASE):
            raise ValueError("catalogue stockcode 724514 had an unexpected product name")
        catalogue_price_match = re.search(r'sf-pricedisplay["\'][^>]*>\$\s*(\d{1,2}(?:\.\d{1,2})?)<', listing)
        if not catalogue_price_match:
            raise ValueError("Rundle Mall catalogue listing had no price")
        catalogue_price = parse_price(catalogue_price_match.group(1))
        save_match = re.search(r'sf-regprice["\'][^>]*>\$\s*(\d{1,2}(?:\.\d{1,2})?)<', listing)
        save_amount = parse_price(save_match.group(1)) if save_match else None
        if catalogue_price is None:
            raise ValueError("exact catalogue product had no valid current price")
        regular_price = round(catalogue_price + save_amount, 2) if save_amount else catalogue_price
        payload = {
            "store": {"storeId": WOOLWORTHS["storeId"], "storeName": "Rundle Mall"},
            "product": {
                "id": WOOLWORTHS["productId"],
                "name": PRODUCT["name"],
                "brand": PRODUCT["brand"],
                "size": PRODUCT["size"],
                "description": "Exact catalogue stockcode 724514",
            },
            "price": catalogue_price,
            "regularPrice": regular_price,
            "special": save_amount is not None,
            "available": True,
            "availabilityVerified": True,
            "catalogue": {
                "storeName": "Woolworths Rundle Mall, 5000",
                "catalogueStoreId": catalogue_store_id,
                "saleId": str(sale["saleId"]),
                "areaName": "SA",
                "validFrom": sale["validFrom"],
                "validTo": sale["validTo"],
                "offerText": unescape(re.sub(r"<[^>]+>", " ", listing)),
            },
        }
        result = parse_woolworths_probe(payload, checked_at)
        return apply_manual_override(result, WOOLWORTHS, checked_at)
    except Exception as error:
        result = unavailable(
            WOOLWORTHS,
            checked_at,
            f"Store-specific price could not be verified: {error}",
            source={"type": "store_selected_catalogue", "url": "https://www.woolworths.com.au/shop/catalogue"},
        )
        return apply_manual_override(result, WOOLWORTHS, checked_at)


def parse_woolworths_probe(payload: dict[str, Any], checked_at: str) -> dict[str, Any]:
    if payload.get("error"):
        raise ValueError(str(payload["error"]))
    store = payload.get("store") or {}
    if not verify_store(store, WOOLWORTHS["storeId"], "Rundle Mall"):
        raise ValueError("Woolworths probe did not verify store 5317 / Rundle Mall")
    product = payload.get("product") or {}
    if not validate_product(
        product_id=product.get("id"),
        expected_id=WOOLWORTHS["productId"],
        name=product.get("name"),
        brand=product.get("brand"),
        size=product.get("size"),
        description=product.get("description"),
    ):
        raise ValueError("Woolworths probe returned the wrong product or package size")
    catalogue = payload.get("catalogue") or {}
    if catalogue.get("storeName") != "Woolworths Rundle Mall, 5000" or catalogue.get("areaName") != "SA":
        raise ValueError("Woolworths probe did not verify the Rundle Mall catalogue context")
    price = parse_price(payload.get("price"))
    if price is None:
        raise ValueError("Woolworths probe returned no valid current price")
    regular_price = parse_price(payload.get("regularPrice")) or price
    result = {
        "retailer": WOOLWORTHS["retailer"],
        "store": WOOLWORTHS["store"],
        "storeId": WOOLWORTHS["storeId"],
        "price": price,
        "regularPrice": regular_price,
        "special": bool(payload.get("special")) or regular_price > price,
        "available": payload.get("available") is True,
        "verified": True,
        "checkedAt": checked_at,
        "validFrom": catalogue.get("validFrom"),
        "validTo": catalogue.get("validTo"),
        "source": {
            "type": "store_selected_catalogue",
            "url": "https://www.woolworths.com.au/shop/catalogue",
            "storeContext": f"Woolworths Rundle Mall {WOOLWORTHS['storeId']}",
            "catalogueStoreId": catalogue.get("catalogueStoreId"),
            "saleId": catalogue.get("saleId"),
        },
        "verification": "Official store selector resolved Rundle Mall and its current catalogue listed exact stockcode 724514.",
        "offer": {
            "description": f"Save ${regular_price - price:.2f}" if regular_price > price else "Catalogue price",
            "type": "CATALOGUE_SPECIAL" if regular_price > price else "CATALOGUE",
            "minimumQuantity": 1,
            "effectiveUnitPrice": price,
        },
        "limitation": "Catalogue availability is subject to current shelf stock.",
    }
    if payload.get("available") is not True:
        result["availabilityStatus"] = "out_of_stock" if payload.get("availabilityVerified") else "unknown"
        result["limitation"] = (
            "The Rundle Mall price is verified, but current shelf availability could not be confirmed."
        )
    return result


def apply_manual_override(result: dict[str, Any], config: dict[str, Any], checked_at: str) -> dict[str, Any]:
    """Accept an explicit, current shelf check supplied during a manual Action run."""
    if result.get("verified"):
        return result
    prefix = f"MANUAL_{config['retailer'].upper()}"
    price = parse_price(os.environ.get(f"{prefix}_PRICE"))
    if price is None:
        return result
    regular = parse_price(os.environ.get(f"{prefix}_REGULAR_PRICE")) or price
    special_text = str(os.environ.get(f"{prefix}_SPECIAL", "")).strip().lower()
    special = special_text in {"1", "true", "yes", "on"} or regular > price
    return {
        "retailer": config["retailer"],
        "store": config["store"],
        "storeId": config.get("storeId"),
        "price": price,
        "regularPrice": regular,
        "special": special,
        "available": True,
        "verified": True,
        "checkedAt": checked_at,
        "source": {
            "type": "manual_shelf_check",
            "url": config.get("storeUrl") or config.get("specialsUrl"),
            "storeContext": config["store"],
        },
        "verification": "Price manually entered for the exact product and store in workflow_dispatch.",
        "limitation": "Manual shelf observation; it is not an automated retailer feed.",
    }


MONTHS = {name.lower(): number for number, name in enumerate(
    ("", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
) if name}


def catalogue_dates(url: str) -> tuple[date, date] | None:
    match = re.search(r"/(20\d{2})/\d{2}/[^/]*?(\d{1,2})-(\d{1,2})-([A-Za-z]{3})[^/]*\.pdf", url)
    if not match:
        return None
    year, start_day, end_day, month_name = match.groups()
    month = MONTHS.get(month_name.lower())
    if month is None:
        return None
    return date(int(year), month, int(start_day)), date(int(year), month, int(end_day))


def extract_catalogue_price(pdf_bytes: bytes) -> float | None:
    try:
        from pypdf import PdfReader
    except ImportError:
        return None
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    normalised = re.sub(r"\s+", " ", text)
    product_match = re.search(
        r"Cocobella\s+Coconut\s+Water\s+Straight\s+Up\s+1\s*L",
        normalised,
        flags=re.IGNORECASE,
    )
    if not product_match:
        return None
    nearby = normalised[max(0, product_match.start() - 80):product_match.end() + 100]
    prices = [parse_price(value) for value in re.findall(r"\$\s*(\d{1,2}(?:\.\d{1,2})?)", nearby)]
    valid = [price for price in prices if price is not None]
    return valid[0] if len(valid) == 1 else None


def foodland_catalogue_metadata(html: str, today: date) -> dict[str, Any]:
    """Read the current official Foodland sale dates and public Issuu document."""
    plain = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", html)))
    dates = re.search(
        r"ON SALE\s+(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})",
        plain,
        flags=re.IGNORECASE,
    )
    if not dates:
        raise ValueError("Foodland catalogue sale dates were missing")
    start_day, start_month, start_year, end_day, end_month, end_year = dates.groups()
    month_lookup = {name.lower(): number for number, name in enumerate(
        ("", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
    ) if name}
    try:
        valid_from = date(int(start_year), month_lookup[start_month.lower()], int(start_day))
        valid_to = date(int(end_year), month_lookup[end_month.lower()], int(end_day))
    except (KeyError, ValueError) as error:
        raise ValueError("Foodland catalogue sale dates were malformed") from error
    if not valid_from <= today <= valid_to:
        raise ValueError("Foodland catalogue is not current")
    iframe = re.search(r'src=["\'](https://e\.issuu\.com/embed\.html\?[^"\']+)["\']', html, flags=re.IGNORECASE)
    if not iframe:
        raise ValueError("Foodland catalogue publication was missing")
    query = parse_qs(urlparse(unescape(iframe.group(1))).query)
    username = (query.get("u") or [""])[0]
    document_name = (query.get("d") or [""])[0]
    if username != "foodlandsupermarkets" or not re.fullmatch(r"foodland_catalogue_[a-z0-9_]+", document_name):
        raise ValueError("Foodland catalogue publication identity was unexpected")
    return {
        "username": username,
        "documentName": document_name,
        "validFrom": valid_from,
        "validTo": valid_to,
    }


def issuu_publication_id(payload: dict[str, Any]) -> str:
    document = payload.get("document") or {}
    publication_id = str(document.get("publicationId") or "")
    pages = document.get("pages")
    if not re.fullmatch(r"[a-f0-9]{32}", publication_id) or not isinstance(pages, list) or not pages:
        raise ValueError("Foodland catalogue reader metadata was malformed")
    return publication_id


def issuu_page_texts(payload: Any) -> list[str]:
    try:
        pages = payload[0]["result"]["data"]["json"]["pageTexts"]
    except (IndexError, KeyError, TypeError) as error:
        raise ValueError("Foodland catalogue text response was malformed") from error
    if not isinstance(pages, list) or not all(isinstance(page, str) for page in pages):
        raise ValueError("Foodland catalogue text response contained invalid pages")
    return pages


def extract_foodland_text_price(pages: list[str]) -> float | None:
    """Accept only an exact Straight Up 1L catalogue listing with one nearby price."""
    target = re.compile(r"Cocobella\s+Coconut\s+Water\s+Straight\s+Up\s+1\s*(?:L|Litre)", re.IGNORECASE)
    candidates: list[float] = []
    for page in pages:
        for match in target.finditer(page):
            nearby = page[max(0, match.start() - 100):match.end() + 120]
            raw_values: list[float] = []
            cleaned = nearby
            ocr_patterns = (
                (r"(?m)^\s*(\d{1,2})[ \t]*\n[ \t]*\$[ \t]*(\d{2})?[ \t]*$", False),
                (r"(?m)^\s*(\d{3,4})[ \t]*\n[ \t]*\$[ \t]*$", True),
            )
            for pattern, compact in ocr_patterns:
                matches = list(re.finditer(pattern, cleaned))
                for price_match in matches:
                    if compact:
                        raw_values.append(float(price_match.group(1)) / 100)
                    else:
                        raw_values.append(
                            float(price_match.group(1))
                            + (float(price_match.group(2)) / 100 if price_match.group(2) else 0)
                        )
                for price_match in reversed(matches):
                    cleaned = cleaned[:price_match.start()] + (" " * (price_match.end() - price_match.start())) + cleaned[price_match.end():]
            for dollars, cents in re.findall(r"\$[ \t]*(\d{1,2})(?:\.(\d{2}))?", cleaned):
                raw_values.append(float(dollars) + (float(cents) / 100 if cents else 0))
            sane = {round(value, 2) for value in raw_values if 0 < value < 100}
            if len(sane) == 1:
                candidates.extend(sane)
    unique = sorted(set(candidates))
    return unique[0] if len(unique) == 1 else None


def collect_foodland_statewide_catalogue(client: HttpClient, today: date, checked_at: str) -> dict[str, Any] | None:
    catalogue_html = client.request(FOODLAND["catalogueUrl"]).text
    if "Henley Square" not in catalogue_html:
        raise ValueError("official Foodland catalogue page did not list Henley Square")
    metadata = foodland_catalogue_metadata(catalogue_html, today)
    reader_url = (
        f"https://publication.issuu.com/{metadata['username']}/{metadata['documentName']}/reader4.json"
    )
    reader_payload = json.loads(client.request(reader_url, headers={"Accept": "application/json"}).text)
    publication_id = issuu_publication_id(reader_payload)
    request_input = json.dumps({"0": {"json": {"publicationId": publication_id}}}, separators=(",", ":"))
    text_url = (
        "https://issuu.com/api/content-service/public.reader.getTextVersionOfDocument"
        f"?batch=1&input={quote(request_input)}"
    )
    text_payload = json.loads(client.request(
        text_url,
        headers={"Accept": "application/json", "x-trpc-source": "nextjs-react"},
    ).text)
    price = extract_foodland_text_price(issuu_page_texts(text_payload))
    if price is None:
        return None
    return {
        "retailer": FOODLAND["retailer"],
        "store": FOODLAND["store"],
        "storeId": None,
        "price": price,
        "regularPrice": None,
        "special": True,
        "available": True,
        "verified": True,
        "checkedAt": checked_at,
        "validFrom": metadata["validFrom"].isoformat(),
        "validTo": metadata["validTo"].isoformat(),
        "source": {
            "type": "official_foodland_catalogue",
            "url": FOODLAND["catalogueUrl"],
            "storeContext": "Henley Square Foodland catalogue",
        },
        "limitation": "Catalogue special only and subject to stock; no everyday Henley Square shelf-price feed exists.",
    }


def collect_foodland(client: HttpClient, checked_at: str) -> dict[str, Any]:
    try:
        page = client.request(FOODLAND["specialsUrl"]).text
        if "Henley Square Foodland" not in page:
            raise ValueError("Henley Square specials page could not be verified")
        hrefs = re.findall(r'href=["\']([^"\']+\.pdf(?:\?[^"\']*)?)["\']', page, flags=re.IGNORECASE)
        today = datetime.fromisoformat(checked_at).astimezone(ADELAIDE).date()
        current: list[tuple[str, date, date]] = []
        for href in hrefs:
            url = urljoin(FOODLAND["specialsUrl"], unescape(href))
            dates = catalogue_dates(url)
            if dates and dates[0] <= today <= dates[1] and urlparse(url).hostname == "henleysquarefoodland.com.au":
                current.append((url, dates[0], dates[1]))
        for url, valid_from, valid_to in current[:2]:
            price = extract_catalogue_price(client.request(url).body)
            if price is not None:
                return {
                    "retailer": FOODLAND["retailer"],
                    "store": FOODLAND["store"],
                    "storeId": None,
                    "price": price,
                    "regularPrice": None,
                    "special": True,
                    "available": True,
                    "verified": True,
                    "checkedAt": checked_at,
                    "validFrom": valid_from.isoformat(),
                    "validTo": valid_to.isoformat(),
                    "source": {"type": "store_catalogue", "url": url, "storeContext": "Henley Square"},
                    "limitation": "Catalogue special only; everyday shelf price is not available online.",
                }
        statewide = collect_foodland_statewide_catalogue(client, today, checked_at)
        if statewide:
            return statewide
        raise ValueError("no exact product match in the current Henley Square or official Foodland catalogues")
    except Exception as error:
        result = unavailable(
            FOODLAND,
            checked_at,
            f"Price unavailable: {error}",
            source={"type": "catalogue_only", "url": FOODLAND["specialsUrl"]},
            limitation="Henley Square publishes catalogues but no reliable everyday product-price feed.",
        )
        return apply_manual_override(result, FOODLAND, checked_at)


def collect_all(client: HttpClient | None = None, now: datetime | None = None) -> list[dict[str, Any]]:
    http = client or HttpClient()
    checked_at = (now or datetime.now(ADELAIDE)).astimezone(ADELAIDE).replace(microsecond=0).isoformat()
    return [
        collect_coles(http, checked_at),
        collect_woolworths(http, checked_at),
        collect_foodland(http, checked_at),
    ]
