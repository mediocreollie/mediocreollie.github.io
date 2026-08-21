import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "cocobella_updater",
    ROOT / "scripts" / "cocobella" / "update_prices.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_currency_and_availability_logic():
    assert MODULE.format_price(5.5) == "$5.50"
    assert MODULE.format_price(None) == "Unavailable"
    assert MODULE.is_available({"price": None}) is False
    assert MODULE.is_available({"price": 3.3}) is True


def test_cheapest_store_selection_prefers_current_available():
    prices = {
        "coles": {"price": 5.5, "name": "Coles Rundle Place"},
        "woolworths": {"price": 3.3, "name": "Woolworths Rundle Mall"},
        "foodland": {"price": None, "name": "Foodland Henley Square"},
    }
    assert MODULE.compute_cheapest(prices) == "woolworths"


def test_history_snapshot_contains_store_entries():
    snapshot = MODULE.build_snapshot()
    assert set(snapshot.keys()) >= {"coles", "woolworths", "foodland"}
    assert snapshot["coles"]["name"] == "Coles Rundle Place"
    assert snapshot["woolworths"]["name"] == "Woolworths Rundle Mall"
    assert snapshot["foodland"]["status"] == "unavailable"
