import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/fit/guide.js';

const G=globalThis.FitGuide;

test('T-shirt guide distinguishes body and flat-garment measurements',()=>{
 const guide=G.content('tee');assert.match(guide.text,/Body measurements/);assert.match(guide.tips[0],/doubled/);assert.match(guide.tips.join(' '),/Shoulder/);assert.match(guide.tips.join(' '),/Sleeve/);
});

test('trouser guide includes waist, hip and inseam without sleeve substitution',()=>{
 const guide=G.content('trousers'),copy=guide.tips.join(' ');assert.match(copy,/Waist/);assert.match(copy,/Hip/);assert.match(copy,/Inseam/);assert.doesNotMatch(copy,/Sleeve/);
});

test('guide content is copied before use',()=>{
 const first=G.content('tee');first.tips[0]='changed';assert.notEqual(G.content('tee').tips[0],'changed');
});

test('page provides labelled body and garment diagrams plus privacy disclosure',()=>{
 const html=readFileSync(new URL('../public/fit/index.html',import.meta.url),'utf8');
 for(const id of ['teeBodyTitle','teeBodyDesc','teeGarmentTitle','teeGarmentDesc','trouserBodyTitle','trouserBodyDesc','trouserGarmentTitle','trouserGarmentDesc'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/Skip to main content/);assert.match(html,/What Fit Reference stores/);assert.match(html,/do not predict fabric stretch, drape or appearance/);
});
