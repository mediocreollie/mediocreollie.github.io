"""Small polite HTTP client with bounded retry behavior."""

from __future__ import annotations

import json
import gzip
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class FetchError(RuntimeError):
    pass


@dataclass
class Response:
    body: bytes
    status: int
    headers: Any

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")


class HttpClient:
    USER_AGENT = "CocobellaPriceTracker/1.0 (+GitHub Actions; one scheduled check daily)"

    def request(
        self,
        url: str,
        *,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
        timeout: int = 25,
    ) -> Response:
        request_headers = {"User-Agent": self.USER_AGENT, "Accept": "text/html,application/json"}
        request_headers.update(headers or {})
        data = None
        if json_body is not None:
            data = json.dumps(json_body, separators=(",", ":")).encode("utf-8")
            request_headers["Content-Type"] = "application/json"

        for attempt in range(2):
            request = Request(url, data=data, headers=request_headers, method=method)
            try:
                with urlopen(request, timeout=timeout) as response:
                    body = response.read(8_000_000)
                    if response.headers.get("Content-Encoding", "").lower() == "gzip":
                        body = gzip.decompress(body)
                    return Response(body=body, status=response.status, headers=response.headers)
            except HTTPError as error:
                body = error.read(10_000).decode("utf-8", errors="replace")
                if error.code in {429, 500, 502, 503, 504} and attempt == 0:
                    time.sleep(2)
                    continue
                raise FetchError(f"HTTP {error.code} from {url}: {body[:180]}") from error
            except (URLError, TimeoutError, OSError) as error:
                if attempt == 0:
                    time.sleep(2)
                    continue
                raise FetchError(f"Request failed for {url}: {error}") from error
        raise FetchError(f"Request failed for {url}")
