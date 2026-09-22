"""Read-only Woolworths API diagnostic. Never publishes prices."""
import json
from http.cookiejar import CookieJar
from urllib.request import build_opener, HTTPCookieProcessor, Request
from urllib.error import HTTPError

BASE = "https://www.woolworths.com.au"
client = build_opener(HTTPCookieProcessor(CookieJar()))
client.addheaders = [("User-Agent", "CocobellaPriceTracker/1.0 (+https://olliewritesthings.com/cocobella/)")]

def request(path, body=None):
    req = Request(BASE + path, data=json.dumps(body).encode() if body else None,
                  headers={"Accept": "application/json, text/html", "Content-Type": "application/json"})
    try:
        with client.open(req, timeout=25) as response:
            status, raw = response.status, response.read().decode(errors="replace")
    except HTTPError as exc:
        status, raw = exc.code, exc.read().decode(errors="replace")
    print(json.dumps({"path": path, "http_status": status, "bytes": len(raw)}))
    if status in (401, 403, 429) or any(x in raw.lower() for x in ("access denied", "verify you are human", "captcha", "request blocked")):
        raise RuntimeError("Access or security check prevented retrieval; stopping without retry")
    return json.loads(raw) if raw.lstrip().startswith(("{", "[")) else None

def products(value):
    if isinstance(value, dict):
        if str(value.get("Stockcode")) == "724514":
            yield {k: value.get(k) for k in ("Stockcode", "Name", "DisplayName", "PackageSize", "Price", "InstorePrice", "WasPrice", "FulfilmentStoreId", "IsAvailable")}
        for child in value.values():
            yield from products(child)
    elif isinstance(value, list):
        for child in value:
            yield from products(child)

try:
    # Standard anonymous cookie session, no copied credentials or fingerprint changes.
    request("/shop/productdetails/724514/cocobella-coconut-water-straight-up")
    payload = request("/apis/ui/Search/products", {
        "Filters": [], "IsSpecial": False,
        "Location": "/shop/search/products?searchTerm=Cocobella",
        "PageNumber": 1, "PageSize": 24, "SearchTerm": "Cocobella",
        "SortType": "TraderRelevance", "GroupEdmVariants": False,
        "ExcludeSearchTypes": ["UntraceableVendors"]
    })
    matches = list(products(payload))
    print(json.dumps({"matches": matches, "store_verified": False,
                      "note": "No selected store in this anonymous diagnostic. Do not publish as a branch price."}))
except Exception as exc:
    print(json.dumps({"result": "unavailable", "reason": str(exc)}))
