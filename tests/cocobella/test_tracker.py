import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from datetime import datetime,timezone,timedelta

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/cocobella'))
import model
import providers
import update_prices as updater

CATALOG=json.loads((ROOT/'public/cocobella/data/catalog.json').read_text())
P=CATALOG['products'][0]
NOW=datetime(2026,10,10,0,0,tzinfo=timezone.utc)
D=next(s for s in CATALOG['stores'] if s['id']=='drakes_findon')
W=next(s for s in CATALOG['stores'] if s['id']=='woolworths')
C=next(s for s in CATALOG['stores'] if s['id']=='coles_findon')

def observation(**changes):
    result=dict(product_id=P['id'],store_id=D['id'],currency='AUD',price_cents=550,scope='store_online',verified=True,
        availability='in_stock',source='drakes_direct',source_url=P['mappings']['drakes']['url'],observed_at=model.iso(NOW),expires_at=model.iso(NOW+timedelta(hours=36)),multibuy=None)
    result.update(changes)
    return result

class TrackerTests(unittest.TestCase):
    def test_catalog_unique_and_configurable_bounds(self):
        model.validate_catalog(CATALOG)
        bad=json.loads(json.dumps(CATALOG));bad['products'].append(bad['products'][0])
        with self.assertRaises(ValueError):model.validate_catalog(bad)
        p=dict(P,price_bounds_cents=[1,50000])
        self.assertEqual(model.validate_observation(observation(price_cents=30000),p,D,NOW)['price_cents'],30000)

    def test_money_rejects_bools_nan_precision(self):
        for x in [True,None,'nan',float('inf'),-2,0,'3.333']:
            with self.assertRaises(ValueError):model.cents(x)
        self.assertEqual(model.cents('3.30'),330)

    def test_future_wrong_store_scope_and_currency_rejected(self):
        for changes in [dict(store_id='coles'),dict(product_id='coffee'),dict(scope='chain'),dict(currency='USD'),dict(observed_at=model.iso(NOW+timedelta(seconds=1))),dict(price_cents=True)]:
            with self.assertRaises(ValueError):model.validate_observation(observation(**changes),P,D,NOW)

    def test_specials_change_and_dst_expiry(self):
        t=model.timestamp('2026-10-06T22:00:00+10:30')
        self.assertEqual(model.expiry(t),model.timestamp('2026-10-07T00:00:00+10:30'))
        t=model.timestamp('2026-10-03T23:00:00+09:30')
        self.assertEqual((model.expiry(t)-t).total_seconds(),36*3600)
        self.assertFalse(model.usable(observation(),NOW+timedelta(hours=36)))
        self.assertFalse(model.usable(observation(availability='unknown'),NOW))

    def drakes(self,**changes):
        item={'@type':'Product','name':'Cocobella Straight Up Coconut Water 1L','url':P['mappings']['drakes']['url'],
              'offers':{'price':5.5,'priceCurrency':'AUD','availability':'https://schema.org/InStock'}}
        item.update(changes)
        return 'Serviced by Drakes Online Findon<script type="application/ld+json">'+json.dumps(item)+'</script>'

    def test_drakes_uses_exact_structured_offer(self):
        row=providers.parse_drakes('Save $9.99'+self.drakes(),P,D,NOW)
        self.assertEqual(row['price_cents'],550)
        for page in [self.drakes(name='Cocobella Chocolate 1L'),self.drakes(name='Cocobella Straight Up Coconut Water 1L x6'),self.drakes().replace('Findon','Grange'),self.drakes().replace('AUD','USD')]:
            with self.assertRaises(ValueError):providers.parse_drakes(page,P,D,NOW)

    def ww(self,**changes):
        row=dict(productId='724514',storeId='5317',storeName='Rundle Mall',name='Cocobella Coconut Water Straight Up',size='1L',
                 price=2.75,wasPrice=5.5,priceScope='store',source='live',inStock=True,scrapedAt=model.iso(NOW))
        row.update(changes);return row

    def test_woolworths_rejects_default_stale_wrong_variant_and_unknown_stock(self):
        self.assertEqual(providers.parse_provider([self.ww()],'apify_woolworths',P,W,NOW)['price_cents'],275)
        for changes in [dict(storeId='1101'),dict(storeName='Sydney'),dict(source='cache'),dict(priceScope='online'),dict(size='1L x 6'),dict(name='Cocobella Coffee'),dict(scrapedAt=model.iso(NOW+timedelta(days=1)))]:
            with self.assertRaises(ValueError):providers.parse_provider([self.ww(**changes)],'apify_woolworths',P,W,NOW)
        row=providers.parse_provider([self.ww(inStock=None)],'apify_woolworths',P,W,NOW)
        self.assertFalse(model.usable(row,NOW))
        with self.assertRaises(ValueError):providers.parse_provider([self.ww(),self.ww()],'apify_woolworths',P,W,NOW)

    def test_coles_branch_and_conditions(self):
        row=dict(productId='1251527',storeId='403',chain='coles',currency='AUD',name='Cocobella Coconut Water Straight Up',size='1L',price=5.5,inStock=True,scrapedAt=model.iso(NOW),promoText='Pick any 6 for $27',multibuyQuantity=6,multibuyPrice=27)
        result=providers.parse_provider([row],'apify_coles',P,C,NOW)
        self.assertIsNone(result['multibuy'])
        self.assertEqual(result['scope'],'store_pickup')
        row['storeId']='4964'
        with self.assertRaises(ValueError):providers.parse_provider([row],'apify_coles',P,C,NOW)

    def test_not_connected_makes_no_requests_and_no_new_attempt(self):
        catalog=dict(CATALOG,stores=[W,C])
        with patch.object(updater,'fetch_provider') as fetch:
            records,_=updater.collect(catalog,{'providers':{}},{},[],NOW)
        fetch.assert_not_called()
        self.assertTrue(all(r['last_attempt_at'] is None and r['status']=='not_connected' for r in records))

    def test_provider_needs_token_free_plan_and_approval(self):
        settings={'providers':{'apify_woolworths':{'approved_stores':{W['id']:{'validated':True,'validated_at':model.iso(NOW),'evidence':'Independent branch check'}}}}}
        with patch.dict('os.environ',{},clear=True),patch.object(updater,'fetch_provider') as fetch:
            records,_=updater.collect(dict(CATALOG,stores=[W]),settings,{},[],NOW)
        fetch.assert_not_called();self.assertIsNone(records[0]['last_attempt_at'])

    def test_provider_rejection_is_isolated(self):
        with patch.object(updater,'fetch_drakes',side_effect=providers.SourceError('HTTP 403')):
            records,_=updater.collect(dict(CATALOG,stores=[D,W]),{}, {},[],NOW)
        self.assertEqual(records[0]['status'],'failed');self.assertEqual(records[1]['status'],'not_connected')

    def test_cached_success_never_masquerades_as_new_fetch(self):
        old={'records':[dict(product_id=P['id'],store_id=D['id'],last_success=observation(),observation=observation())]}
        with patch.object(updater,'fetch_drakes',side_effect=providers.SourceError('offline')):
            records,_=updater.collect(dict(CATALOG,stores=[D]),{},old,[],NOW+timedelta(hours=1))
        self.assertIsNone(records[0]['observation']);self.assertEqual(records[0]['last_success']['observed_at'],model.iso(NOW))

    def test_manual_requires_evidence_and_expires(self):
        m=observation(store_id=W['id'],source='manual',evidence='Shelf photo',confirmed_by='Owner')
        records,_=updater.collect(dict(CATALOG,stores=[W]),{}, {},[m],NOW)
        self.assertEqual(records[0]['status'],'manual')
        records,_=updater.collect(dict(CATALOG,stores=[W]),{}, {},[m],NOW+timedelta(days=2))
        self.assertIsNone(records[0]['observation'])

    def test_history_idempotent_and_separates_products(self):
        h=model.add_history([], [observation(),observation()])
        self.assertEqual(len(h),1)
        h=model.add_history(h,[observation(product_id='second-product')])
        self.assertEqual(len(h),2)

    def test_legacy_migration_preserves_files_and_excludes_chain_prices(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder);legacy={'history':{'coles':[{'date':model.iso(NOW),'price':5.5,'verified':True,'store_specific':False}],'drakes_findon':[{'date':model.iso(NOW),'price':5.5,'verified':True,'store_specific':True}]}}
            text=json.dumps(legacy);(path/'price-history.json').write_text(text)
            rows=updater.migrate_history(path,CATALOG)
            self.assertEqual(len(rows),1);self.assertEqual((path/'price-history.json').read_text(),text)

    def test_all_unavailable_is_published(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder);(path/'catalog.json').write_text(json.dumps(dict(CATALOG,stores=[W])))
            with patch.object(updater,'DATA',path):self.assertEqual(updater.main([]),0)
            data=json.loads((path/'state.json').read_text());self.assertEqual(data['coverage']['current'],0)
            self.assertIsNone(data['records'][0]['last_attempt_at'])

    def test_probe_does_not_publish(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder);(path/'catalog.json').write_text(json.dumps(dict(CATALOG,stores=[W])))
            with patch.object(updater,'DATA',path),patch.object(updater,'ROOT',path),patch.dict('os.environ',{},clear=True):
                self.assertEqual(updater.main(['--validate-provider','apify_woolworths','--store','woolworths']),1)
            self.assertFalse((path/'state.json').exists());self.assertFalse((path/'history-v2.json').exists())

if __name__=='__main__':unittest.main()
