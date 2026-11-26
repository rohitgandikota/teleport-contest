// Source-only reach and observation controls. Does not assert native parity.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const [output]=process.argv.slice(2);
assert.ok(output && process.argv.length===3);
const {runSegment}=await import('../baseline/js/jsmain.js');
const {InMemoryStorage}=await import('../baseline/js/storage.js');
const {outputs,hashes,deferred}=await import('../baseline/tools/observe.mjs');
const read=f=>JSON.parse(readFileSync(new URL('../'+f,import.meta.url)));
const recipe=read('ordinary/guard-hallucinated-name.json');
const probes=[...read('review/probe-02.json').results,...read('review/probe-03.json').results];
const results=[],rows=[];
function check(name,fn) {try {fn();results.push({name,pass:true});}
    catch(e) {results.push({name,pass:false,error:e.message.slice(0,700)});}}
const timer=setTimeout(()=>{throw new Error('bounded ordinary controls exceeded55s');},55000);
try {
    for(const [i,part] of recipe.segments.entries()) {
        const probe=probes[i];
        const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        const held=await deferred(part);
        const plainHashes=hashes(plain),heldHashes=hashes(held);
        check(part.name+': observer neutral',()=>assert.deepEqual(plainHashes,probe.hashes));
        check(part.name+': deferred and exhausted input equal',()=>assert.deepEqual(heldHashes,plainHashes));
        check(part.name+': every key and RNG boundary retained',()=>{
            assert.equal(plain.screens.length,part.moves.length+1);
            assert.deepEqual(plain.slices.flat(),plain.calls);
            assert.equal(probe.error,null);assert.equal(probe.allKeysCaptured,true);
        });
        check(part.name+': real guard and property producers',()=>{
            const before=probe.states.find(s=>s.step===187);
            assert.equal(before.guard.id,122);assert.equal(before.guard.done,0);
            assert.deepEqual(before.guard.xy,[27,5]);assert.equal(before.hallu,false);
            assert.equal(probe.states.at(-1).hallu,i!==0);
            assert.equal(probe.states.at(-1).blind,i===3||i===5);
        });
        check(part.name+': cleanup branch or paired prefix',()=>{
            const first=probe.states.find(s=>s.guard?.done);
            if(i>=4) {assert.equal(first,undefined);assert.equal(probe.states.at(-1).guard.done,0);}
            else {
                assert.equal(first.step,[188,211,211,215][i]);
                assert.equal(first.guard.id,122);assert.equal(first.guard.hp,47);
                assert.deepEqual(first.guard.xy,[0,0]);assert.equal(first.guard.heroInCorridor,true);
                assert.equal(probe.states.at(-1).guard,null);
                if(i<2) assert.ok(first.top.startsWith('Suddenly, '));
                else assert.ok(first.top.startsWith('newsym: attempting screen update'));
            }
        });
        rows.push({name:part.name,keys:part.moves.length,boundaries:plain.screens.length,
            calls:plain.calls.length,hashes:plainHashes,deferredHashes:heldHashes});
    }
} finally {clearTimeout(timer);}
const report={classification:'Ordinary keyboard reach only; no candidate or native comparison',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows};
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total}));
if(report.passed!==report.total)process.exitCode=1;
