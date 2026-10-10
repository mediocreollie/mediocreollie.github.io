/* Shared comparison rules, also exercised by Node's built-in test runner. */
(function(root){
  const fresh=(o,now=Date.now())=>!!o && o.verified===true && ['store_online','store_shelf','store_pickup'].includes(o.scope) && o.currency==='AUD' && Number.isInteger(o.price_cents) && o.price_cents>0 && o.availability==='in_stock' && Number.isFinite(Date.parse(o.observed_at)) && Date.parse(o.observed_at)<=now && now<Date.parse(o.expires_at);
  const cost=(o,q)=>{
    if(!Number.isInteger(q)||q<1||q>99)throw Error('Quantity must be 1 to 99');
    let total=o.price_cents*q;
    const d=o.multibuy;
    if(d?.unconditional===true && Number.isInteger(d.quantity) && d.quantity>=2 && Number.isInteger(d.total_cents) && d.total_cents>0){
      total=Math.min(total,Math.floor(q/d.quantity)*d.total_cents+(q%d.quantity)*o.price_cents);
    }
    return total;
  };
  function compare(basket,stores,records,now=Date.now()){
    const items=Object.entries(basket).filter(([,q])=>Number.isInteger(q)&&q>0&&q<=99);
    const prices=new Map(records.filter(r=>fresh(r.observation,now)).map(r=>[`${r.product_id}|${r.store_id}`,r.observation]));
    const options=stores.map(s=>{
      const lines=items.map(([id,q])=>{const observation=prices.get(`${id}|${s.id}`);return {product_id:id,quantity:q,observation,total_cents:observation?cost(observation,q):null};});
      return {store:s,lines,complete:items.length>0&&lines.every(l=>l.total_cents!==null),known:lines.filter(l=>l.total_cents!==null).length,total_cents:lines.reduce((sum,l)=>sum+(l.total_cents??0),0)};
    });
    const complete=options.filter(o=>o.complete).sort((a,b)=>a.total_cents-b.total_cents);
    const winners=complete.filter(o=>o.total_cents===complete[0]?.total_cents);
    let split=null;
    for(let i=0;i<options.length;i++)for(let j=i+1;j<options.length;j++){
      const a=options[i],b=options[j];
      const lines=a.lines.map((x,k)=>{const y=b.lines[k];if(x.total_cents===null&&y.total_cents===null)return null;return (y.total_cents===null||(x.total_cents!==null&&x.total_cents<=y.total_cents))?{...x,store:a.store}:{...y,store:b.store};});
      if(!lines.length||lines.some(x=>!x)||new Set(lines.map(x=>x.store.id)).size<2)continue;
      const total=lines.reduce((v,x)=>v+x.total_cents,0);
      if(!split||total<split.total_cents)split={lines,total_cents:total,savings_cents:complete.length?complete[0].total_cents-total:null};
    }
    return {options,winners,split,items:items.length};
  }
  const api={fresh,cost,compare};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CocobellaRules=api;
})(typeof globalThis!=='undefined'?globalThis:this);
