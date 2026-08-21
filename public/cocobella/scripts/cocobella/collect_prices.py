#!/usr/bin/env python3
"""Collect current prices and append verified observations to history."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from tempfile import NamedTemporaryFile

SCRIPT_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from tracker.collector import collect_all  # noqa: E402
from tracker.config import PRODUCT  # noqa: E402
from tracker.domain import cheapest, configured_product  # noqa: E402
from tracker.history import append_observations  # noqa: E402

def load_json(path: Path, default: dict) -> dict:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False, newline="\n") as handle:
        json.dump(value, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
        temporary = Path(handle.name)
    os.replace(temporary, path)


def run(current_path: Path, history_path: Path) -> tuple[dict, int]:
    stores = collect_all()
    checked_at = max(store["checkedAt"] for store in stores)
    successful = [store["checkedAt"] for store in stores if store.get("verified") and store.get("price")]
    history = load_json(
        history_path,
        {
            "schemaVersion": 1,
            "product": {"name": PRODUCT["name"], "size": PRODUCT["size"]},
            "observations": [],
        },
    )
    previous_successes = [item.get("observedAt") for item in history.get("observations", []) if item.get("verified")]
    last_successful = max(successful or previous_successes, default=None)
    winners = cheapest(stores)
    current = {
        "schemaVersion": 1,
        "checkedAt": checked_at,
        "lastSuccessfulCheck": last_successful,
        "updated": last_successful or checked_at,
        "product": configured_product(),
        "stores": stores,
        "cheapestStoreIds": [store.get("storeId") or store["store"] for store in winners],
    }
    added = append_observations(history, stores)
    write_json_atomic(current_path, current)
    write_json_atomic(history_path, history)
    return current, added


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
    current, added = run(args.current, args.history)
    verified = [store["retailer"] for store in current["stores"] if store["verified"]]
    unavailable = [store["retailer"] for store in current["stores"] if not store["verified"]]
    print(f"Verified: {', '.join(verified) if verified else 'none'}")
    print(f"Unavailable: {', '.join(unavailable) if unavailable else 'none'}")
    print(f"History observations added: {added}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
