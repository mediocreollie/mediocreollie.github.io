import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/fit/index.html',import.meta.url),'utf8');
const account=readFileSync(new URL('../public/fit/account.js',import.meta.url),'utf8');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);

test('page IDs are unique and every static script reference resolves',()=>{
 assert.equal(new Set(ids).size,ids.length);
 const references=[...html.matchAll(/getElementById\("([^"]+)"\)/g),...account.matchAll(/\$\("([^"]+)"\)/g)].map(match=>match[1]);
 const missing=[...new Set(references.filter(id=>id!=='saveComparison'&&!ids.includes(id)))];assert.deepEqual(missing,[]);
});

test('label targets and dialog accessible names resolve',()=>{
 const targets=[...html.matchAll(/<label[^>]+for="([^"]+)"/g)].map(match=>match[1]);assert.deepEqual(targets.filter(id=>!ids.includes(id)),[]);
 const names=[...html.matchAll(/<dialog[^>]+aria-labelledby="([^"]+)"/g)].map(match=>match[1]);assert.equal(names.length,5);assert.deepEqual(names.filter(id=>!ids.includes(id)),[]);
});

test('keyboard skip link, live results and visible focus styles are present',()=>{
 assert.match(html,/class="skip-link" href="#mainContent"/);assert.match(html,/id="result" aria-live="polite"/);assert.match(html,/aria-label="Add profile"/);
 const css=readFileSync(new URL('../public/fit/task-layout.css',import.meta.url),'utf8');assert.match(css,/:focus-visible/);assert.match(css,/\.skip-link:focus/);
});
