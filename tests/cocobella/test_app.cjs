const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../../public/cocobella');
async function page(failed=[]){
 const nodes={};
 for(const [,id] of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/id="([^"]+)"/g))nodes[id]={textContent:'',innerHTML:'',value:'',addEventListener(){},querySelectorAll(){return [];}};
 const sandbox={document:{getElementById:id=>{assert.ok(nodes[id],`Missing element ${id}`);return nodes[id];}},localStorage:{getItem(){return null;},setItem(){}},URL,Intl,Date,setInterval(){},fetch:async url=>{
  const name=url.split('/').at(-1).replace('.json','');if(failed.includes(name))throw Error('Offline');return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'data',name+'.json'),'utf8'))};
 }};
 vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(root,'core.js'),'utf8'),sandbox);
 vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),sandbox);
 await new Promise(resolve=>setImmediate(resolve));return nodes;
}
test('actual catalog and data render without DOM or integration errors',async()=>{const n=await page();assert.match(n['basket'].innerHTML,/Cocobella/);assert.match(n.stores.innerHTML,/Drakes Findon/);assert.doesNotMatch(n.notice.textContent,/could not be loaded/);assert.match(n['basket-totals'].innerHTML,/Incomplete/);});
test('history failure does not suppress available price data',async()=>{const n=await page(['history-v2']);assert.match(n.notice.textContent,/History could not be loaded/);assert.match(n.stores.innerHTML,/Drakes Findon/);assert.match(n.published.textContent,/Site data updated/);});
test('state failure cannot create a winner from historical prices',async()=>{const n=await page(['state']);assert.equal(n.best.textContent,'No complete verified basket');assert.match(n.notice.textContent,/Prices are unavailable/);});
test('catalog failure gives an explicit unavailable state',async()=>{const n=await page(['catalog']);assert.equal(n.best.textContent,'Unavailable');assert.match(n.notice.textContent,/watchlist could not be loaded/);});
