"""Append-only, compact daily observation history."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

ADELAIDE = ZoneInfo("Australia/Adelaide")


def observation_from_store(store: dict[str, Any]) -> dict[str, Any] | None:
    if not store.get("verified") or not store.get("available") or store.get("price") is None:
        return None
    observed_at = datetime.fromisoformat(store["checkedAt"])
    return {
        "observedAt": observed_at.isoformat(),
        "date": observed_at.astimezone(ADELAIDE).date().isoformat(),
        "retailer": store["retailer"],
        "store": store["store"],
        "storeId": store.get("storeId"),
        "price": store["price"],
        "regularPrice": store.get("regularPrice"),
        "special": bool(store.get("special")),
        "verified": True,
    }


def append_observations(history: dict[str, Any], stores: list[dict[str, Any]]) -> int:
    observations = history.setdefault("observations", [])
    existing = {
        (
            item.get("date"),
            item.get("retailer"),
            item.get("store"),
            item.get("price"),
            item.get("regularPrice"),
            bool(item.get("special")),
        )
        for item in observations
    }
    added = 0
    for store in stores:
        item = observation_from_store(store)
        if item is None:
            continue
        key = (
            item["date"],
            item["retailer"],
            item["store"],
            item["price"],
            item["regularPrice"],
            item["special"],
        )
        if key in existing:
            continue
        observations.append(item)
        existing.add(key)
        added += 1
    observations.sort(key=lambda item: item["observedAt"])
    return added

