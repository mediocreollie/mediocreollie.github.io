import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import '../public/fit/measurements.js';
import '../public/fit/chart-import.js';
function harness(){
 class Element{constructor(){this.value='';this.children=[];this.listeners={};this.classList={add(){},remove(){}};this.files=[]}setAttribute(){}removeAttribute(){}append(...n){this.children.push(...n)}replaceChildren(){this.children=[]}addEventListener(n,f){this.listeners[n]=f}focus(){}click(){}}
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 let finish,terminated=0;const revoked=[];const worker={recognize:()=>new Promise(resolve=>finish=resolve),terminate:async()=>{terminated++}};
 const win={addEventListener(){}};const context={window:win,document:{getElementById:get,createElement:()=>new Element()},FitChart:globalThis.FitChart,FitMeasurements:globalThis.FitMeasurements,dimensionNames:{},clearComparison(){},structuredClone,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:u=>revoked.push(u)},Image:class{set src(v){this.width=100;this.height=100;queueMicrotask(()=>this.onload())}},loadOcrLibrary:async()=>({createWorker:async()=>worker})};
 runInNewContext(readFileSync(new URL('../public/fit/import-review.js',import.meta.url),'utf8'),context);
 const upload=async()=>{get('sizeImage').files=[{type:'image/png',size:100}];get('sizeImage').onchange();await new Promise(r=>setImmediate(r));};
 return {get,win,upload,finish:text=>finish({data:{text}}),revoked,terminated:()=>terminated};
}
test('review is required and applies only the selected size with a copied table snapshot',()=>{
 const h=harness();h.get('sourceText').value='Size S M L\nChest 50 53 56';h.get('parseText').onclick();assert.equal(h.get('cChest').value,'');h.get('reviewSize').value='1';h.get('applyImport').onclick();assert.match(h.get('reviewWarnings').textContent,/Confirm/);h.get('reviewConfirmed').checked=true;h.get('applyImport').onclick();assert.equal(h.get('cChest').value,'53');assert.equal(h.get('sizeName').value,'M');assert.equal(h.get('confirmChart').checked,false);const snapshot=h.win.FitImport.snapshot();snapshot.rows[1].values.chest='999';assert.equal(h.win.FitImport.snapshot().rows[1].values.chest,'53');
});
test('cancel terminates active OCR and ignores late results',async()=>{
 const h=harness();await h.upload();h.get('cancelImport').onclick();assert.equal(h.terminated(),1);h.finish('Size S M\nChest 50 53');await new Promise(r=>setImmediate(r));assert.equal(h.get('sourceText').value,'');assert.equal(h.get('cChest').value,'');
});
test('account/profile reset releases image and clears extracted content',async()=>{
 const h=harness();await h.upload();h.win.FitImport.reset();h.finish('Size S M\nChest 50 53');await new Promise(r=>setImmediate(r));assert.equal(h.get('reviewPanel').hidden,true);assert.equal(h.get('sourceText').value,'');assert.equal(h.win.FitImport.snapshot(),null);assert.deepEqual(h.revoked,['blob:test']);
});
test('unsupported file preserves current manual draft',()=>{
 const h=harness();h.get('cChest').value='104';h.get('sizeImage').files=[{type:'application/pdf',size:100}];h.get('sizeImage').onchange();assert.equal(h.get('cChest').value,'104');assert.match(h.get('ocrStatus').textContent,/PNG/);
});
