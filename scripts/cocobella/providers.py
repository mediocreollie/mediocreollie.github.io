"""Small interchangeable sources. No browser automation or security-check retries."""
import html
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from model import cents, normal, iso, mapping_for, validate_observation

UA='CocobellaPriceTracker/2.0 (+https://olliewritesthings.com/cocobella/)'
ACTORS={'apify_woolworths':'crawlplant~woolworths-au','apify_coles':'cylindrical_lighthouse~au-grocery-prices'}

class SourceError(Exception):
    pass

def read_url(url, payload=None, token=None):
    headers={'User-Agent':UA,'Accept':'application/json, text/html'}
    if token:
        headers['Authorization']='Bearer '+token
    data=None if payload is None else json.dumps(payload).encode()
    if data is not None:
        headers['Content-Type']='application/json'
    try:
        with urlopen(Request(url,data=data,headers=headers),timeout=55) as response:
            body=response.read(5_000_001)
            if len(body)>5_000_000:
                raise SourceError('Response exceeded the small-watchlist limit')
            return body.decode('utf-8')
    except HTTPError as exc:
        raise SourceError(f'Source returned HTTP {exc.code}; no automatic retry') from None
    except (URLError,TimeoutError,OSError):
        raise SourceError('Source connection failed; no automatic retry') from None

def base_observation(product,store,source,observed,scope):
    m=mapping_for(product,store)
    return dict(product_id=product['id'],store_id=store['id'],retailer_product_id=m['product_id'],
                retailer_store_id=store['retailer_store_id'],source=source,source_url=m['url'],
                currency='AUD',scope=scope,verified=True,observed_at=iso(observed),
                availability='unknown',multibuy=None,offer_text=None)

def parse_drakes(page,product,store,now):
    visible=html.unescape(re.sub(r'<[^>]+>',' ',page))
    visible=re.sub(r'\s+',' ',visible)
    if store['shop_identity'] not in visible:
        raise ValueError('Drakes branch identity missing')
    m=mapping_for(product,store)
    found=[]
    for script in re.findall(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',page,re.I|re.S):
        try:
            document=json.loads(script)
        except ValueError:
            continue
        candidates=document if isinstance(document,list) else document.get('@graph',[document]) if isinstance(document,dict) else []
        for item in candidates:
            if not isinstance(item,dict) or item.get('@type')!='Product' or item.get('url')!=m['url']:
                continue
            if normal(item.get('name')) not in {normal(n) for n in m['names']}:
                raise ValueError('Wrong Drakes product variant or size')
            offer=item.get('offers',{})
            if not isinstance(offer,dict) or offer.get('priceCurrency')!='AUD':
                raise ValueError('Missing exact AUD offer')
            row=base_observation(product,store,'drakes_direct',now,'store_online')
            availability=str(offer.get('availability','')).rsplit('/',1)[-1]
            row.update(price_cents=cents(offer.get('price')),availability={'InStock':'in_stock','OutOfStock':'out_of_stock'}.get(availability,'unknown'))
            if offer.get('priceValidUntil'):
                # A date-only end date lasts until midnight in Adelaide.
                from datetime import datetime,timedelta
                from model import ADELAIDE
                value=str(offer['priceValidUntil'])
                if len(value)==10:
                    value=iso(datetime.fromisoformat(value).replace(tzinfo=ADELAIDE)+timedelta(days=1))
                row['expires_at']=value
            found.append(validate_observation(row,product,store,now))
    if len(found)!=1:
        raise ValueError('Expected one exact Drakes product offer')
    return found[0]

def fetch_drakes(product,store,now):
    return parse_drakes(read_url(mapping_for(product,store)['url']),product,store,now)

def provider_input(provider,products,store):
    if not store.get('retailer_store_id'):
        raise ValueError('Branch ID has not been confirmed')
    if provider=='apify_woolworths':
        return {'mode':'products','productIds':[mapping_for(p,store)['product_id'] for p in products],
                'storeIds':[store['retailer_store_id']],'maxItems':len(products),'maxAgeHours':0,
                'includeMarketplace':False,'fetchFullDetails':False}
    if provider=='apify_coles':
        return {'chains':['coles'],'productUrls':[mapping_for(p,store)['url'] for p in products],
                'colesStoreId':store['retailer_store_id'],'maxItems':len(products),
                'maxItemsPerSource':len(products),'includeDetails':False,'monitorPriceChanges':False}
    raise ValueError('Unknown provider')

def fetch_provider(provider,products,store):
    token=os.environ.get('APIFY_TOKEN','')
    if not token:
        raise SourceError('Provider connection not configured')
    if os.environ.get('APIFY_FREE_PLAN_CONFIRMED')!='true':
        raise SourceError('Free-plan connection has not been confirmed')
    payload=provider_input(provider,products,store)
    query=urlencode({'timeout':45,'maxTotalChargeUsd':'0.02','clean':'true'})
    url=f'https://api.apify.com/v2/actors/{ACTORS[provider]}/run-sync-get-dataset-items?{query}'
    result=json.loads(read_url(url,payload,token))
    if not isinstance(result,list):
        raise ValueError('Provider did not return product rows')
    return result

def parse_provider(rows,provider,product,store,now):
    m=mapping_for(product,store)
    matches=[r for r in rows if isinstance(r,dict) and str(r.get('productId',''))==m['product_id'] and str(r.get('storeId',''))==store['retailer_store_id']]
    if len(matches)!=1:
        raise ValueError('Missing or ambiguous exact product and branch response')
    raw=matches[0]
    if raw.get('isComplete') is False or raw.get('isMarketplace') is True:
        raise ValueError('Incomplete or marketplace response')
    name=normal(raw.get('name'))
    names={normal(n) for n in m['names']}
    size=normal(raw.get('size','')).replace(' ','')
    if name not in names or size not in m['sizes']:
        raise ValueError('Product variant or pack size does not match')
    if provider=='apify_woolworths':
        if raw.get('priceScope')!='store' or raw.get('source')!='live':
            raise ValueError('Woolworths response is not a live branch price')
        if normal(store['name'].removeprefix('Woolworths ')) not in normal(raw.get('storeName','')):
            raise ValueError('Woolworths branch name mismatch')
        scope='store_shelf'
    else:
        if raw.get('chain')!='coles' or raw.get('currency')!='AUD':
            raise ValueError('Coles currency or retailer mismatch')
        scope='store_pickup'
    if raw.get('currency','AUD')!='AUD':
        raise ValueError('Wrong currency')
    from model import timestamp
    row=base_observation(product,store,provider,timestamp(raw.get('scrapedAt')),scope)
    row.update(price_cents=cents(raw.get('price')),availability={True:'in_stock',False:'out_of_stock'}.get(raw.get('inStock'),'unknown'))
    # Offer text is informative only. Do not infer quantity/eligibility from prose.
    offer=raw.get('offerDescription') or raw.get('promoText')
    row['offer_text']=str(offer)[:300] if offer else None
    if raw.get('wasPrice') is not None:
        regular=cents(raw['wasPrice'])
        if regular>row['price_cents']:
            row['regular_price_cents']=regular
    return validate_observation(row,product,store,now)
