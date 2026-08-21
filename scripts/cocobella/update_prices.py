#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DIR = ROOT / "public" / "cocobella"
DATA_DIR = PUBLIC_DIR / "data"

STORE_SEQUENCE = ["coles", "woolworths", "foodland"]


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def format_price(value: float | None) -> str:
    if value is None:
        return "Unavailable"
    return f"${value:.2f}"


def is_available(entry: dict[str, Any] | None) -> bool:
    return bool(entry and entry.get("price") is not None)


def compute_cheapest(prices: dict[str, dict[str, Any]]) -> str | None:
    available = {store: entry for store, entry in prices.items() if is_available(entry)}
    if not available:
        return None
    return min(available, key=lambda store: available[store]["price"])


def build_snapshot() -> dict[str, dict[str, Any]]:
    current = {
        "coles": {
            "name": "Coles Rundle Place",
            "price": 5.5,
            "status": "available",
            "updated_at": now_iso(),
        },
        "woolworths": {
            "name": "Woolworths Rundle Mall",
            "price": 3.3,
            "status": "available",
            "updated_at": now_iso(),
        },
        "foodland": {
            "name": "Foodland Henley Square",
            "price": None,
            "status": "unavailable",
            "updated_at": now_iso(),
        },
    }
    return current


def build_history() -> dict[str, list[dict[str, Any]]]:
    utc_now = datetime.now(timezone.utc)
    history: dict[str, list[dict[str, Any]]] = {}

    samples = {
        "coles": [5.5, 5.65, 5.4, 5.55, 5.35, 5.5],
        "woolworths": [3.4, 3.25, 3.3, 3.2, 3.5, 3.3],
        "foodland": [None, None, None, None, None, None],
    }

    for store, values in samples.items():
        entries = []
        for index, value in enumerate(values):
            date = (utc_now - timedelta(days=(len(values) - index))).replace(hour=12, minute=0, second=0, microsecond=0)
            entries.append({
                "date": date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "price": value,
            })
        history[store] = entries

    return history


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    snapshot = build_snapshot()
    history = build_history()
    cheapest = compute_cheapest(snapshot)
    payload = {
        "generated_at": now_iso(),
        "stores": snapshot,
        "cheapest_store": cheapest,
        "recommended_store": cheapest,
        "history": history,
    }
    write_json(DATA_DIR / "prices.json", payload)
    write_json(DATA_DIR / "price-history.json", {"history": history})


if __name__ == "__main__":
    main()
