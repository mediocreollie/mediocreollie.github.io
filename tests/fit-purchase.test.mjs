import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/fit/measurements.js';
import '../public/fit/garments.js';
import '../public/fit/purchase.js';

const P=globalThis.FitPurchase;
const saved=()=>({id:'c1',measurementVersion:2,result:{rows:[{key:'chest',difference:2}]},category:'tee',measurements:{chest:'53'},referenceSnapshot:{values:{chest:104}}});
const fields=()=>({name:'Bought tee',brand:'Example',size:'M',fit:'Just right',notes:'Good shoulders'});
const profile=()=>({unit:'cm',garments:[],comparisons:[saved()]});

test('recording a purchase links a new owned item without copying chart measurements',()=>{
 const p=profile();const {check,garment}=P.record(p,'c1',fields(),'g1','2026-09-18T10:00:00.000Z');
 assert.equal(check.purchase.status,'bought');assert.equal(check.purchase.garmentId,'g1');assert.equal(garment.sourceComparisonId,'c1');assert.equal(garment.category,'T-shirt');
 assert.equal(garment.measurements.chest,null);assert.equal(garment.fit,'Just right');assert.equal(p.garments.length,1);
});

test('purchase outcome leaves the saved comparison snapshot unchanged',()=>{
 const p=profile(),before=structuredClone(p.comparisons[0]);P.record(p,'c1',fields(),'g1','now');
 const after=p.comparisons[0];assert.deepEqual(after.measurements,before.measurements);assert.deepEqual(after.referenceSnapshot,before.referenceSnapshot);assert.deepEqual(after.result,before.result);
});

test('updating a purchase preserves garment identity and measured values',()=>{
 const p=profile();P.record(p,'c1',fields(),'g1','first');p.garments[0].measurements.chest=104;
 const update=fields();update.fit='Too tight';update.notes='Tight at chest';const {garment}=P.record(p,'c1',update,'ignored','second');
 assert.equal(p.garments.length,1);assert.equal(garment.id,'g1');assert.equal(garment.measurements.chest,104);assert.equal(p.comparisons[0].purchase.fit,'Too tight');
});

test('a deleted linked garment is recreated without restoring retailer measurements',()=>{
 const p=profile();P.record(p,'c1',fields(),'g1','first');p.garments=[];const {garment}=P.record(p,'c1',fields(),'g2','second');
 assert.equal(garment.id,'g2');assert.equal(garment.measurements.chest,null);assert.equal(p.comparisons[0].purchase.garmentId,'g2');
});

test('trouser purchases use the owned-clothing category',()=>{
 const p=profile();p.comparisons[0].category='trousers';const {garment}=P.record(p,'c1',fields(),'g1','now');assert.equal(garment.category,'Trousers');assert.equal(garment.measurements.inseam,null);
});

test('invalid outcomes fail before changing the profile',()=>{
 const p=profile(),before=structuredClone(p);assert.throws(()=>P.record(p,'missing',fields(),'g1','now'),/saved measurement/);assert.deepEqual(p,before);
 const bad=fields();bad.fit='Perfect';assert.throws(()=>P.record(p,'c1',bad,'g1','now'),/Choose how/);assert.deepEqual(p,before);
});
