import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {observed} from './observer.mjs';
const [output]=process.argv.slice(2);
assert.ok(output&&process.argv.length===3);
const {runSegment}=await import('../baseline/js/jsmain.js');
const {InMemoryStorage}=await import('../baseline/js/storage.js');
const {outputs,hashes,deferred}=await import('../baseline/tools/observe.mjs');
const read=f=>JSON.parse(readFileSync(new URL('../'+f,import.meta.url)));
const lock=read('review/input-lock.json'),recipe=read(lock.recipe);
const results=[],rows=[];
function check(name,fn){try{fn();results.push({name,pass:true});}
    catch(e){results.push({name,pass:false,error:e.message.slice(0,600)});}}
for(const [i,part] of recipe.segments.entries()) {
    const probe=await observed(part);
    const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const held=await deferred(part);
    const plainHashes=hashes(plain),heldHashes=hashes(held);
    check(part.name+': passive observer neutral',()=>assert.deepEqual(probe.hashes,plainHashes));
    check(part.name+': deferred and exhausted input equal',()=>assert.deepEqual(heldHashes,plainHashes));
    check(part.name+': all keys and RNG boundaries retained',()=>{
        assert.equal(probe.error,null);assert.equal(probe.allKeysCaptured,true);
        assert.equal(plain.screens.length,part.moves.length+1);assert.deepEqual(plain.slices.flat(),plain.calls);
    });
    check(part.name+': actual guard and restoration producers',()=>{
        if(i===4){assert.equal(probe.states.find(s=>s.step===187).guard.end,3);return;}
        const s=probe.states.find(s=>s.step===205);
        assert.deepEqual(s.hero,[28,18]);assert.equal(s.gold+s.hiddenGold,0);
        assert.equal(s.guard.id,122);assert.equal(s.guard.hp,47);assert.equal(s.guard.peaceful,1);
        assert.equal(s.guard.done,0);assert.equal(s.guard.end,i===2?2:3);
        assert.equal(s.guard.begin,i===2?1:2);
        assert.equal(s.terms.entryRestored,true);assert.equal(s.terms.heroOutside,true);
        assert.equal(s.terms.guardInside,true);assert.equal(s.eligible,i!==2);
    });
    check(part.name+': C cleanup policy or paired negative',()=>{
        const last=probe.states.at(-1);
        if(i<2){
            const s=probe.states.find(s=>s.step===211);
            assert.equal(s.guard,null,'C disposes the restored-entry guard on the next turn');
            assert.equal(last.guard,null);
            const said=probe.states.some(s=>s.top.includes('The guard, confused, disappears.'));
            assert.equal(said,i===0);
            assert.ok(!probe.states.some(s=>s.step>=205&&s.top.startsWith('Suddenly,')));
        }else if(i===2){assert.equal(last.guard.id,122);assert.equal(last.guard.end,2);assert.equal(last.guard.done,0);}
        else if(i===3){assert.equal(last.step,205);assert.equal(last.guard.id,122);assert.equal(last.eligible,true);}
        else {assert.equal(last.guard,null);assert.ok(probe.states.some(s=>s.top.startsWith('Suddenly, the guard disappears.')));}
    });
    if(i>=2)check(part.name+': all five original negative hashes',()=>assert.deepEqual(plainHashes,lock.negativeHashes[part.name]));
    rows.push({name:part.name,keys:part.moves.length,boundaries:plain.screens.length,
        calls:plain.calls.length,hashes:plainHashes,deferredHashes:heldHashes});
}
const report={classification:'Fresh ordinary JS controls against C source contracts; native comparison remains parent-only',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows};
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass)}));
if(report.passed!==report.total)process.exitCode=1;
