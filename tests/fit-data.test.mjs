import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/fit/data.js';

const valid=globalThis.FitData.valid;
const legacy={active:'p1',profiles:[{id:'p1',name:'Legacy',unit:'cm',measurements:{chest:100},garments:[{id:'g1',measurements:{chest:104}}],comparisons:[{id:'c1',score:80}]}]};

test('legacy profile payload remains valid without new optional fields',()=>assert.equal(valid(legacy),true));
test('new purchase and snapshot fields remain additive',()=>{const evolved=structuredClone(legacy);evolved.profiles[0].comparisons[0]={id:'c1',measurementVersion:2,result:{rows:[]},purchase:{status:'bought',garmentId:'g1'}};assert.equal(valid(evolved),true)});
test('malformed or unowned profile shapes are rejected',()=>{for(const value of [null,{}, {profiles:[]},{profiles:[{id:'p1',name:'Bad',unit:'yards',measurements:{},garments:[],comparisons:[]}]}])assert.equal(valid(value),false)});
test('Supabase policy restricts rows to the authenticated owner',()=>{const sql=readFileSync(new URL('../supabase/fit-setup.sql',import.meta.url),'utf8');assert.match(sql,/enable row level security/i);assert.match(sql,/to authenticated/i);assert.match(sql,/auth\.uid\(\).*user_id/is);assert.doesNotMatch(sql,/to anon/i)});
