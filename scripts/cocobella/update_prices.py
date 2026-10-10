#!/usr/bin/env python3
"""Collect configured products. Optional providers must pass branch validation first."""
import argparse
import json
import os
from datetime import datetime,timezone
from pathlib import Path
from model import iso,timestamp,cents,expiry,mapping_for,validate_catalog,validate_observation,usable,add_history
from providers import fetch_drakes,fetch_provider,parse_provider,SourceError

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'public/cocobella/data'
DEFAULT_PRODUCT='cocobella-original-1l'

def read(path,default):
    return json.loads(path.read_text()) if path.exists() else default

def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(data,indent=2,allow_nan=False)+'\n')
    temp.replace(path)

def migrate_history(data,catalog):
    target=data/'history-v2.json'
    if target.exists():
        return read(target,{})['observations']
    legacy=read(data/'price-history.json',{'history':{}})['history']
    rows=[]
    # Only these two legacy series were proven branch observations.
    for key in ('drakes_findon','coles_findon'):
        store=next((s for s in catalog['stores'] if s['id']==key),None)
        product=next((p for p in catalog['products'] if p['id']==DEFAULT_PRODUCT),None)
        if not store or not product or not mapping_for(product,store):
            continue
        for point in legacy.get(key,[]):
            if point.get('verified') is not True or point.get('store_specific') is not True:
                continue
            at=timestamp(point['date'])
            rows.append(dict(product_id=DEFAULT_PRODUCT,store_id=key,price_cents=cents(point['price']),
                observed_at=iso(at),expires_at=iso(expiry(at)),currency='AUD',verified=True,
                scope='store_online' if key=='drakes_findon' else 'store_pickup',availability='unknown',
                source='legacy_branch_observation',source_url=mapping_for(product,store)['url'],multibuy=None))
    return add_history([],rows)

def collect(catalog,settings,previous,manual,now,probe=None,probe_store=None):
    records=[]; diagnostics=[]; provider_calls=0
    previous={(r['product_id'],r['store_id']):r for r in previous.get('records',[])}
    for store in catalog['stores']:
        provider=store['connector']
        mapped=[p for p in catalog['products'] if mapping_for(p,store)]
        config=settings.get('providers',{}).get(provider,{})
        approval=config.get('approved_stores',{}).get(store['id'],{})
        approved=(approval.get('validated') is True and bool(approval.get('evidence')) and bool(approval.get('validated_at')))
        if approved:
            try:
                approved=timestamp(approval['validated_at'])<=now
            except (ValueError,TypeError):
                approved=False
        is_probe=bool(probe==provider and probe_store==store['id'])
        enabled=(not probe or is_probe) and provider.startswith('apify_') and (approved or is_probe) and bool(store.get('retailer_store_id')) and bool(mapped)
        rows=None; shared_error=None; attempted=None
        if enabled and os.environ.get('APIFY_TOKEN') and os.environ.get('APIFY_FREE_PLAN_CONFIRMED')=='true':
            if provider_calls>=5:
                shared_error='Provider request budget reached'
            else:
                attempted=iso(now); provider_calls+=1
                try:
                    rows=fetch_provider(provider,mapped,store)
                except (SourceError,ValueError,TypeError) as exc:
                    shared_error=str(exc)
        for product in catalog['products']:
            old=previous.get((product['id'],store['id']),{})
            record={'product_id':product['id'],'store_id':store['id'],'status':'not_connected',
                    'last_attempt_at':old.get('last_attempt_at'),'observation':None,
                    'last_success':old.get('last_success') or old.get('observation'),
                    'message':'No verified automatic price source for this branch yet.'}
            observation=None
            if provider=='drakes' and mapping_for(product,store) and not probe:
                record['last_attempt_at']=iso(now)
                try:
                    observation=fetch_drakes(product,store,now)
                except (SourceError,ValueError,TypeError,KeyError) as exc:
                    record.update(status='failed',message=str(exc))
            elif provider.startswith('apify_'):
                if not store.get('retailer_store_id'):
                    record['message']='Branch mapping needs verification.'
                elif not approved and not is_probe:
                    record['message']='Replacement price source awaits branch validation.'
                elif not os.environ.get('APIFY_TOKEN') or os.environ.get('APIFY_FREE_PLAN_CONFIRMED')!='true':
                    record['message']='Replacement price source is not connected.'
                elif enabled:
                    if attempted:
                        record['last_attempt_at']=attempted
                    try:
                        if shared_error:
                            raise SourceError(shared_error)
                        observation=parse_provider(rows or [],provider,product,store,now)
                    except (SourceError,ValueError,TypeError,KeyError) as exc:
                        record.update(status='failed',message=str(exc))
            if observation:
                record['last_success']=observation
                if usable(observation,now):
                    record.update(status='current',observation=observation,message='Current verified branch observation.')
                else:
                    record.update(status='out_of_stock' if observation['availability']=='out_of_stock' else 'unavailable',message='Source returned a price without current confirmed availability, or an expired observation.')
            if not observation and not probe:
                candidates=[m for m in manual if m.get('product_id')==product['id'] and m.get('store_id')==store['id']]
                valid=[]
                for m in candidates:
                    try:
                        if not m.get('evidence') or m.get('source')!='manual' or not m.get('confirmed_by'):
                            raise ValueError('Manual observation needs confirmation and evidence')
                        clean=validate_observation(m,product,store,now)
                        if usable(clean,now):
                            valid.append(clean)
                    except (ValueError,TypeError) as exc:
                        diagnostics.append({'product_id':product['id'],'store_id':store['id'],'error':str(exc)})
                if valid:
                    observation=max(valid,key=lambda o:o['observed_at'])
                    record.update(observation=observation,last_success=observation,status='manual',message='Dated manual check. Automatic source is not current.')
            # A previous success is preserved for context, but never silently republished as current.
            records.append(record)
            if is_probe:
                diagnostics.append({'product_id':product['id'],'store_id':store['id'],'attempted_at':record['last_attempt_at'],
                                    'result':record['status'],'message':record['message'],'observation':observation})
    return records,diagnostics

def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument('--validate-provider',choices=['apify_coles','apify_woolworths'])
    parser.add_argument('--store')
    args=parser.parse_args(argv)
    catalog=read(DATA/'catalog.json',{})
    validate_catalog(catalog)
    now=datetime.now(timezone.utc)
    settings=read(Path(__file__).with_name('providers.json'),{})
    if args.validate_provider:
        store=next((s for s in catalog['stores'] if s['id']==args.store and s['connector']==args.validate_provider),None)
        if not store:
            parser.error('Validation requires --store with a matching catalog branch ID')
    history=migrate_history(DATA,catalog)
    previous=read(DATA/'state.json',{})
    manual=read(DATA/'manual-observations.json',{'observations':[]})['observations']
    records,diagnostics=collect(catalog,settings,previous,manual,now,args.validate_provider,args.store)
    if args.validate_provider:
        write(ROOT/'artifacts/cocobella/provider-validation.json',{'generated_at':iso(now),'provider':args.validate_provider,'branch':args.store,'results':diagnostics,'approved':False})
        print('Diagnostic only. Branch approval requires an independent price check; nothing was published.')
        return 0 if any(d.get('attempted_at') and d.get('observation') for d in diagnostics) else 1
    observations=[r['last_success'] for r in records if r.get('last_success')]
    history=add_history(history,observations)
    payload={'schema_version':2,'generated_at':iso(now),'records':records,
             'coverage':{'current':sum(usable(r.get('observation'),now) for r in records),'total':len(records)}}
    write(DATA/'history-v2.json',{'schema_version':2,'observations':history})
    write(DATA/'state.json',payload)
    if diagnostics:
        write(ROOT/'artifacts/cocobella/validation-errors.json',diagnostics)
    print(f"Current verified product/branch observations: {payload['coverage']['current']}/{len(records)}")
    for r in records:
        if r['status'] in ('current','manual','failed'):
            print(f"{r['product_id']} / {r['store_id']}: {r['status']}; {r['message']}")
    # All unavailable is valid output, so stale data can still be replaced on the site.
    return 0

if __name__=='__main__':
    raise SystemExit(main())
