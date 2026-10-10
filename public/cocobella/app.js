const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=url=>{try{const u=new URL(url);return u.protocol==='https:'?esc(u.href):'#';}catch{return '#';}};
const money=c=>Number.isInteger(c)?new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(c/100):'Unavailable';
const date=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-AU',{timeZone:'Australia/Adelaide'}):'Not yet checked';
const scope=s=>({store_online:'Branch online price',store_pickup:'Branch Click & Collect',store_shelf:'Branch shelf price'}[s]||'Historical branch check');
const state={catalog:null,records:[],history:[],basket:{},selected:[],product:null,warnings:[]};
const STORAGE='cocobella-basket-v2';
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({basket:state.basket,selected:state.selected}));}catch{$('notice').textContent='Your browser could not save preferences. Comparisons still work.';}}
function chosen(){return state.catalog.stores.filter(s=>state.selected.includes(s.id));}
function initControls(){
 let saved={};try{saved=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{};}catch{}
 state.basket=Object.fromEntries(state.catalog.products.map(p=>[p.id,Number.isInteger(saved.basket?.[p.id])&&saved.basket[p.id]>=0&&saved.basket[p.id]<=99?saved.basket[p.id]:p.id===state.catalog.default_product_id?1:0]));
 state.selected=Array.isArray(saved.selected)?saved.selected.filter(id=>state.catalog.stores.some(s=>s.id===id)):state.catalog.stores.filter(s=>s.nearby).map(s=>s.id);
 state.product=state.catalog.default_product_id;
 $('basket').innerHTML=state.catalog.products.map(p=>`<div class="basket-row"><label for="quantity-${p.id}">${esc(p.name)}</label><input id="quantity-${p.id}" data-product="${p.id}" type="number" min="0" max="99" step="1" value="${state.basket[p.id]}" aria-label="Quantity of ${esc(p.name)}"></div>`).join('');
 $('basket').addEventListener('change',e=>{const id=e.target.dataset.product;if(!id)return;const q=Number(e.target.value);if(!Number.isInteger(q)||q<0||q>99){e.target.value=state.basket[id];return;}state.basket[id]=q;save();render();});
 $('product-view').innerHTML=state.catalog.products.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
 $('product-view').value=state.product;
 $('product-view').addEventListener('change',e=>{state.product=e.target.value;render();});
 $('store-options').innerHTML=state.catalog.stores.map(s=>`<label><input type="checkbox" value="${s.id}" ${state.selected.includes(s.id)?'checked':''}>${esc(s.name)}${s.distance_km!==undefined?' · '+s.distance_km.toFixed(1)+' km':''}</label>`).join('');
 $('store-options').addEventListener('change',e=>{if(e.target.type!=='checkbox')return;state.selected=Array.from($('store-options').querySelectorAll('input:checked')).map(x=>x.value);save();render();});
 const select=all=>{state.selected=state.catalog.stores.filter(s=>all||s.nearby).map(s=>s.id);$('store-options').querySelectorAll('input').forEach(i=>{i.checked=state.selected.includes(i.value);});save();render();};
 $('nearby').addEventListener('click',()=>select(false));$('all-stores').addEventListener('click',()=>select(true));
}
function render(){
 const stores=chosen(),result=CocobellaRules.compare(state.basket,stores,state.records);
 $('best').textContent=!result.items?'Add a quantity to start':!stores.length?'Choose at least one shop':result.winners.length?result.winners.map(x=>x.store.name).join(' / ')+' · '+money(result.winners[0].total_cents):'No complete verified basket';
 $('coverage').textContent=`${result.options.filter(x=>x.complete).length} of ${stores.length} selected shops have prices for every basket item. This is not a claim about unchecked shops.`;
 const split=result.split;
 $('split').textContent=split && (split.savings_cents===null||split.savings_cents>0)?money(split.total_cents):'No extra verified saving';
 $('split-detail').textContent=split && (split.savings_cents===null||split.savings_cents>0)?split.lines.map(x=>`${x.quantity} × ${state.catalog.products.find(p=>p.id===x.product_id).name} at ${x.store.name}`).join('; ')+(split.savings_cents===null?'. No complete single-shop basket to compare.':'. Save '+money(split.savings_cents)+' before travel costs.'):'Each product’s full quantity stays at one shop.';
 $('basket-totals').innerHTML=result.options.map(o=>`<tr><th scope="row">${esc(o.store.name)}</th><td>${o.known}/${result.items}</td><td>${o.complete?money(o.total_cents):'Incomplete'+(o.known?' · '+money(o.total_cents)+' known subtotal':'')}</td></tr>`).join('');
 const product=state.catalog.products.find(p=>p.id===state.product);
 $('product-detail').textContent=`${product.variant} · ${product.pack_count} pack · ${product.size_ml?product.size_ml+' mL':product.size_g?product.size_g+' g':product.size_label||''}`;
 $('stores').innerHTML=stores.map(s=>{
 const r=state.records.find(r=>r.store_id===s.id&&r.product_id===state.product);
 const o=r?.observation,current=CocobellaRules.fresh(o),last=r?.last_success;
 const m=product.mappings[s.retailer];const source=m&&(!m.store_ids||m.store_ids.includes(s.id))?m.url:s.source;
 let status=current?(r.status==='manual'?'Manual check':'Verified price'):o?'Expired':r?.status==='failed'?'Check failed':r?.status==='out_of_stock'?'Out of stock':'Not connected';
 return `<article class="store-card"><h3>${esc(s.name)}</h3><span class="status ${current?'available':'unavailable'}">${status}</span><p class="price">${current?money(o.price_cents):'Unavailable'}</p>${current?`<p>${scope(o.scope)}</p><p class="meta">Observed ${date(o.observed_at)}<br>Valid until ${date(o.expires_at)}</p>${o.offer_text?`<p class="meta">${esc(o.offer_text)}. Offer conditions are not deducted from basket totals.</p>`:''}`:''}<p class="meta">${esc(current?'':r?.message||'No verified price source for this branch yet.')}</p>${!current&&last?`<p class="meta">Last recorded: ${money(last.price_cents)} on ${date(last.observed_at)}. Excluded from totals.</p>`:''}<p class="meta">Last request: ${date(r?.last_attempt_at)}</p><a href="${link(source)}" target="_blank" rel="noopener">Check ${m?'product':'shop'}</a></article>`;
 }).join('')||'<p>No shops selected.</p>';
 $('directory').innerHTML=state.catalog.stores.map(s=>`<article class="store-card"><h3>${esc(s.name)}</h3><p>${esc(s.address||'Rundle Mall, Adelaide')}</p><p class="meta">${s.distance_km!==undefined?s.distance_km.toFixed(1)+' km straight-line':'Outside the nearby filter'}</p><a href="${link(s.source)}" target="_blank" rel="noopener">Shop website</a> · <a href="https://www.google.com/maps/dir/?api=1&amp;destination=${encodeURIComponent(s.name+' '+(s.address||'Adelaide'))}" target="_blank" rel="noopener">Directions</a></article>`).join('');
 chart(stores);
}
function chart(stores){
 const palette=['#2d7d46','#235f9b','#a34429','#8054a8','#93650b'];
 const points=state.history.filter(p=>p.product_id===state.product&&stores.some(s=>s.id===p.store_id)&&p.verified===true&&Number.isInteger(p.price_cents)&&p.price_cents>0&&Number.isFinite(Date.parse(p.observed_at))&&Date.parse(p.observed_at)<=Date.now());
 points.sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at));
 $('history-table').innerHTML=points.slice().reverse().map(p=>`<tr><td>${date(p.observed_at)}</td><th scope="row">${esc(stores.find(s=>s.id===p.store_id).name)}</th><td>${money(p.price_cents)}</td><td>${scope(p.scope)}</td></tr>`).join('');
 if(!points.length){$('history-chart').innerHTML='<text x="24" y="110">No verified observations for this selection yet.</text>';$('chart-legend').textContent='';return;}
 const series=new Map();for(const p of points){const key=p.store_id+'|'+p.scope;if(!series.has(key))series.set(key,[]);series.get(key).push(p);}
 const start=Date.parse(points[0].observed_at),end=Date.parse(points.at(-1).observed_at);
 const low=Math.max(0,Math.min(...points.map(p=>p.price_cents))-25),high=Math.max(...points.map(p=>p.price_cents))+25;
 const x=p=>start===end?350:65+(Date.parse(p.observed_at)-start)/(end-start)*570,y=c=>190-(c-low)/(high-low)*160;
 let svg=[0,1,2,3].map(i=>{const c=Math.round(low+(high-low)*i/3);return `<line x1="65" x2="650" y1="${y(c)}" y2="${y(c)}" stroke="#dfe5e3"/><text x="4" y="${y(c)+4}" font-size="12">${money(c)}</text>`;}).join('');
 let legend=[],idx=0;
 for(const [key,ps] of series){const color=palette[idx++%palette.length];const name=stores.find(s=>s.id===ps[0].store_id).name;legend.push(`${name} (${scope(ps[0].scope)})`);svg+=`<path d="${ps.map((p,i)=>`${i&&Date.parse(p.observed_at)-Date.parse(ps[i-1].observed_at)<=36*3600000?'L':'M'} ${x(p)} ${y(p.price_cents)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`;svg+=ps.map(p=>`<circle cx="${x(p)}" cy="${y(p.price_cents)}" r="3" fill="${color}"><title>${esc(name)}: ${money(p.price_cents)} · ${date(p.observed_at)}</title></circle>`).join('');}
 const day=d=>new Date(d).toLocaleDateString('en-AU',{timeZone:'Australia/Adelaide'});
 $('history-chart').innerHTML=svg+`<text x="65" y="220" font-size="12">${day(start)}</text><text x="650" y="220" text-anchor="end" font-size="12">${day(end)}</text>`;
 $('chart-legend').innerHTML=legend.map((t,i)=>`<span style="color:${palette[i%palette.length]}">● ${esc(t)}</span>`).join(' · ');
}
async function load(){
 const names=['catalog','state','history-v2'];
 const results=await Promise.allSettled(names.map(async n=>{const r=await fetch(`./data/${n}.json`,{cache:'no-store'});if(!r.ok)throw Error(n);return r.json();}));
 if(results[0].status!=='fulfilled'||results[0].value.schema_version!==2)throw Error('Catalog unavailable');
 state.catalog=results[0].value;
 if(results[1].status==='fulfilled'&&results[1].value.schema_version===2){state.records=results[1].value.records||[];$('published').textContent='Site data updated: '+date(results[1].value.generated_at)+' (Adelaide).';}else state.warnings.push('Price data could not be loaded. Prices are unavailable.');
 if(results[2].status==='fulfilled')state.history=results[2].value.observations||[];else state.warnings.push('History could not be loaded. Current prices are still shown.');
 $('notice').textContent=state.warnings.join(' ')||'Only current, verified branch prices count towards your basket. Unchecked shops may be cheaper.';
 initControls();render();setInterval(render,60000);
}
load().catch(()=>{$('notice').textContent='The watchlist could not be loaded. Please reload the page.';$('best').textContent='Unavailable';$('split').textContent='Unavailable';});
