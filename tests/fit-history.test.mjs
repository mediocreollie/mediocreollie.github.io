import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/fit/history.js';

const H=globalThis.FitHistory;
function draft(){return {measurementVersion:2,brand:'Test',item:'Tee',category:'tee',reference:'g1',measurements:{chest:'53'},referenceSnapshot:{name:'Favourite',values:{chest:104}},result:{rows:[{key:'chest',difference:2}]}}}

test('save adds an immutable copy only when explicitly called',()=>{
 const profile={comparisons:[]},source=draft();
 const saved=H.save(profile,source,'c1','2026-09-17T12:00:00.000Z');
 source.measurements.chest='60';source.referenceSnapshot.values.chest=120;source.result.rows[0].difference=16;
 assert.equal(profile.comparisons.length,1);assert.equal(saved.id,'c1');assert.equal(saved.date,'2026-09-17T12:00:00.000Z');
 assert.equal(saved.measurements.chest,'53');assert.equal(saved.referenceSnapshot.values.chest,104);assert.equal(saved.result.rows[0].difference,2);
});

test('save rejects a missing or legacy draft',()=>{
 assert.throws(()=>H.save({comparisons:[]},null,'c1','now'),/Run a measurement comparison/);
 assert.throws(()=>H.save({comparisons:[]},{measurementVersion:1},'c1','now'),/Run a measurement comparison/);
});

test('find returns the requested saved check',()=>{
 const item={id:'c2'};assert.equal(H.find({comparisons:[{id:'c1'},item]},'c2'),item);assert.equal(H.find({comparisons:[]},'missing'),null);
});

test('compare again copies the chart and keeps an available reference',()=>{
 const check={...draft(),size:'M',sourceUnit:'cm',chartType:'garment',girthMethod:'flat',url:'https://example.test'};
 const replay=H.replay(check,{garments:[{id:'g1'}]});check.measurements.chest='99';
 assert.equal(replay.reference,'g1');assert.equal(replay.referenceMissing,false);assert.equal(replay.values.chest,'53');assert.equal(replay.size,'M');
});

test('compare again falls back to body when the original garment was deleted',()=>{
 const replay=H.replay(draft(),{garments:[]});assert.equal(replay.reference,'body');assert.equal(replay.referenceMissing,true);
});

test('legacy summaries cannot be rebuilt',()=>assert.throws(()=>H.replay({measurementVersion:1},{garments:[]}),/cannot be rebuilt/));
