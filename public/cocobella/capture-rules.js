(function(root){
 const time=value=>Date.parse(value);
 function candidates(text){return [...new Set(Array.from(String(text).matchAll(/\$\s*(\d{1,3})(?:[.,](\d{2}))?(?!\d)/g),m=>Number(m[1])*100+Number(m[2]||0)))].filter(n=>n>0&&n<=100000);}
 function identity(url,catalog){
  let u;try{u=new URL(url);}catch{throw Error('Enter the full retailer product URL.');}
  if(u.protocol!=='https:')throw Error('Use an HTTPS retailer product URL.');
  for(const p of catalog.products)for(const [retailer,m] of Object.entries(p.mappings)){
   const expected=new URL(m.url);
   if(u.hostname===expected.hostname&&u.pathname.replace(/\/$/,'')===expected.pathname.replace(/\/$/,''))return {product:p,retailer,mapping:m,url:expected.href};
  }
  throw Error('This URL does not match an exact product in your watchlist. Open the product link provided below.');
 }
 function expires(at){
  let limit=at+36*3600000;
  // Find the next Wednesday 00:00 in Adelaide, including daylight-saving changes.
  const f=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Adelaide',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(let t=Math.floor(at/60000)*60000+60000;t<=limit;t+=60000){const parts=Object.fromEntries(f.formatToParts(new Date(t)).map(p=>[p.type,p.value]));if(parts.weekday==='Wed'&&parts.hour==='00'&&parts.minute==='00'){limit=t;break;}}
  return new Date(limit).toISOString();
 }
 function validate(input,catalog,now=Date.now()){
  const {product,retailer,mapping,url}=identity(input.source_url,catalog);
  const store=catalog.stores.find(s=>s.id===input.store_id&&s.retailer===retailer);
  if(!store||(mapping.store_ids&&!mapping.store_ids.includes(store.id)))throw Error('The product URL and selected shop do not match.');
  if(input.product_id!==product.id)throw Error('Wrong product.');
  const at=time(input.observed_at);
  if(!Number.isFinite(at)||at>now||now-at>36*3600000)throw Error('Use the actual check time, within the last 36 hours and not in the future.');
  const end=expires(at);if(time(end)<=now)throw Error('This check expired at the Wednesday specials change. Please check again.');
  if(!Number.isInteger(input.price_cents)||input.price_cents<product.price_bounds_cents[0]||input.price_cents>product.price_bounds_cents[1])throw Error('Enter a plausible single-item price for this exact product.');
  if(input.confirmed!==true)throw Error('Confirm the selected store, exact product, single-item price and availability first.');
  if(!['store_online','store_pickup','store_shelf'].includes(input.scope))throw Error('Choose the price type shown by the source.');
  return {product_id:product.id,store_id:store.id,price_cents:input.price_cents,observed_at:new Date(at).toISOString(),expires_at:end,scope:input.scope,currency:'AUD',availability:'in_stock',verified:true,source:'manual_browser',source_url:url,confirmed_by:'owner',evidence:'User confirmed exact product, selected branch, single-item price and availability.',multibuy:null};
 }
 function merge(records,history,local,catalog,now=Date.now()){
  records=records.slice();history=history.slice();
  for(const raw of local){let o;try{o=validate({...raw,confirmed:true},catalog,Math.min(now,time(raw.observed_at)));}catch{continue;}
   const i=records.findIndex(r=>r.store_id===o.store_id&&r.product_id===o.product_id);
   const old=i<0?null:records[i];
   if(time(o.expires_at)>now&&(!old?.observation||time(old.observation.expires_at)<=now||time(old.observation.observed_at)<time(o.observed_at))){
    const row={product_id:o.product_id,store_id:o.store_id,status:'manual',observation:o,last_success:o,last_attempt_at:old?.last_attempt_at||null,message:'Your confirmed browser check, saved on this device.'};
    if(i<0)records.push(row);else records[i]=row;
   }
   if(!history.some(x=>x.product_id===o.product_id&&x.store_id===o.store_id&&x.observed_at===o.observed_at&&x.source===o.source))history.push(o);
  }
  return {records,history};
 }
 root.CocobellaCapture={candidates,identity,expires,validate,merge};
})(globalThis);
