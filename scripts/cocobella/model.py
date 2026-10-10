"""Product and branch identity, integer money, freshness and history rules."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo
import re

ADELAIDE = ZoneInfo('Australia/Adelaide')
SCOPES = {'store_online', 'store_shelf', 'store_pickup'}

def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('Missing observation time')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Observation time must include timezone')
    return result.astimezone(timezone.utc)

def iso(value):
    return value.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

def cents(value):
    if isinstance(value, bool) or value is None:
        raise ValueError('Missing or invalid money')
    try:
        amount = Decimal(str(value)) * 100
        if not amount.is_finite() or amount <= 0 or amount != amount.to_integral_value():
            raise ValueError('Invalid money precision or amount')
        return int(amount)
    except (InvalidOperation, TypeError) as exc:
        raise ValueError('Invalid money') from exc

def normal(value):
    return re.sub(r'\s+', ' ', str(value).replace('|', ' ')).strip().casefold()

def expiry(observed, explicit=None):
    # Never carry Tuesday's price over Wednesday's specials change.
    local = observed.astimezone(ADELAIDE)
    days = (2-local.weekday()) % 7 or 7
    next_wednesday = (local + timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
    limit = min(observed+timedelta(hours=36), next_wednesday.astimezone(timezone.utc))
    return min(limit, timestamp(explicit)) if explicit else limit

def validate_catalog(catalog):
    if catalog.get('schema_version') != 2:
        raise ValueError('Unsupported catalog version')
    for group in ('products', 'stores'):
        ids = [x['id'] for x in catalog[group]]
        if not ids or len(ids) != len(set(ids)) or any(not re.fullmatch(r'[a-z0-9_-]+', x) for x in ids):
            raise ValueError('Invalid or duplicate '+group+' identifiers')
    if catalog['default_product_id'] not in [x['id'] for x in catalog['products']]:
        raise ValueError('Default product missing')
    for p in catalog['products']:
        low, high = p['price_bounds_cents']
        if not (0 < low < high) or not p['mappings']:
            raise ValueError('Invalid product configuration')
        for mapping in p['mappings'].values():
            if not mapping.get('product_id') or not mapping.get('names') or not mapping.get('sizes') or not mapping.get('url','').startswith('https://'):
                raise ValueError('Incomplete exact-product mapping')

def mapping_for(product, store):
    m = product['mappings'].get(store['retailer'])
    if m and ('store_ids' not in m or store['id'] in m['store_ids']):
        return m
    return None

def validate_observation(row, product, store, now):
    if row.get('product_id') != product['id'] or row.get('store_id') != store['id']:
        raise ValueError('Product or branch mismatch')
    if row.get('scope') not in SCOPES or row.get('verified') is not True or row.get('currency') != 'AUD':
        raise ValueError('Unverified branch price or currency')
    value = row.get('price_cents')
    low, high = product['price_bounds_cents']
    if type(value) is not int or not low <= value <= high:
        raise ValueError('Price outside product bounds')
    observed = timestamp(row.get('observed_at'))
    if observed > now:
        raise ValueError('Future observation rejected')
    if not row.get('source') or not row.get('source_url','').startswith('https://'):
        raise ValueError('Missing source evidence')
    if row.get('availability') not in ('in_stock', 'out_of_stock', 'unknown'):
        raise ValueError('Invalid availability')
    row = dict(row, observed_at=iso(observed), expires_at=iso(expiry(observed,row.get('expires_at'))))
    if timestamp(row['expires_at']) <= observed:
        raise ValueError('Offer ended before observation')
    offer=row.get('multibuy')
    if offer and (type(offer.get('quantity')) is not int or offer['quantity'] < 2 or type(offer.get('total_cents')) is not int or offer['total_cents'] <= 0 or offer.get('unconditional') is not True):
        raise ValueError('Unusable multibuy conditions')
    return row

def usable(row, now):
    return bool(row and row.get('verified') is True and row.get('scope') in SCOPES and row.get('availability') == 'in_stock' and timestamp(row['observed_at']) <= now < timestamp(row['expires_at']))

def add_history(history, observations):
    known={(x['product_id'],x['store_id'],x['observed_at'],x['source'],x.get('scope')) for x in history}
    for row in observations:
        key=(row['product_id'],row['store_id'],row['observed_at'],row['source'],row['scope'])
        if key not in known:
            history.append(row.copy()); known.add(key)
    return sorted(history,key=lambda x:(x['observed_at'],x['product_id'],x['store_id']))
