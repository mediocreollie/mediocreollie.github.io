import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/fit/measurements.js';
import '../public/fit/guide.js';
const F=globalThis.FitMeasurements;
const Guide=globalThis.FitGuide;
const request={category:'tee',chartType:'garment',unit:'cm',flat:true,confirmed:true,values:{chest:'53',length:'69'},reference:{kind:'garment',unit:'cm',values:{chest:104,length:70}}};
test('flat chest doubles, length does not, missing shoulders remain unknown',()=>{const r=F.compare(request).rows;assert.equal(r[0].difference,2);assert.equal(r[2].difference,-1);assert.equal(r[1].status,'unknown')});
test('unit conversion retains precision',()=>{assert.equal(F.normalise('20','in','chest',true).low,101.6);assert.equal(F.normalise('20','in','shoulder',true).low,50.8)});
test('body range boundary and outside range',()=>{let q={...request,chartType:'body',values:{chest:'100-104'},reference:{kind:'body',unit:'cm',values:{chest:104}}};assert.equal(F.compare(q).rows[0].status,'within');q.reference.values.chest=106;assert.equal(F.compare(q).rows[0].difference,2)});
test('body chart cannot compare with garment reference',()=>assert.throws(()=>F.compare({...request,chartType:'body'}),/body measurements/));
test('no guessed values or unconfirmed comparison',()=>{assert.throws(()=>F.compare({...request,confirmed:false}),/Confirm/);assert.throws(()=>F.compare({...request,values:{}}),/No compatible/)});
test('reject invalid, reversed, zero and negative measurements',()=>{for(const n of ['0','-1','abc','102-96','96/102'])assert.throws(()=>F.parse(n,true));assert.equal(F.parse(''),null)});
test('body to garment reports ease only and excludes sleeve method mismatch',()=>{const r=F.compare({...request,values:{chest:53,sleeve:60},reference:{kind:'body',unit:'cm',values:{chest:100,sleeve:60}}}).rows;assert.equal(r[0].status,'ease');assert.equal(r[0].difference,6);assert.equal(r[3].status,'unknown')});
test('trouser inseam is distinct from legacy sleeve',()=>{assert.throws(()=>F.compare({...request,category:'trousers',values:{inseam:80},reference:{kind:'garment',unit:'cm',values:{sleeve:80}}}),/No compatible/)});

test('UI submit creates an unsaved result and preserves saved history',async()=>{
 const {readFileSync}=await import('node:fs');const {runInNewContext}=await import('node:vm');
 const html=readFileSync(new URL('../public/fit/index.html',import.meta.url),'utf8');
 const fragment=html.slice(html.indexOf('const dimensionNames='),html.indexOf('function loadOcrLibrary'));
 const fields={category:'tee',reference:'g1',chartType:'garment',chartUnit:'cm',girthMethod:'flat',cChest:'53',cShoulder:'',cLength:'69',cSleeve:'',brand:'Test',itemName:'Tee',sizeName:'M',productUrl:'',fitPreference:'regular'};
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{value:fields[id]||'',checked:id==='confirmChart',textContent:'',innerHTML:'',addEventListener(){},closest(){return {hidden:false}}});return nodes.get(id)};
 const legacy={id:'old',score:80};const profile={name:'Person',unit:'cm',garments:[{id:'g1',name:'Favourite',category:'Top',measurements:{chest:104,length:70}}],comparisons:[legacy]};let saves=0;
 const context={window:{},FitMeasurements:F,FitGuide:Guide,document:{getElementById:get},val:id=>get(id).value,current:()=>profile,structuredClone,crypto:{randomUUID:()=> 'new-id'},esc:s=>String(s),save:()=>saves++,renderHistory(){},toast(){}};
 runInNewContext(fragment,context);get('compareForm').onsubmit({preventDefault(){}});
 assert.equal(saves,0);assert.deepEqual(profile.comparisons,[legacy]);assert.match(get('result').innerHTML,/Save comparison/);assert.match(get('result').innerHTML,/not in Previous checks/);
 get('chartType').value='body';get('confirmChart').checked=true;get('compareForm').onsubmit({preventDefault(){}});assert.equal(saves,0);assert.match(get('compareError').textContent,/Body size charts/);
});
