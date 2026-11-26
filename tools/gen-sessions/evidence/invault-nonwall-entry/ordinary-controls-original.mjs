import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../baseline/js/jsmain.js';
import {InMemoryStorage} from '../baseline/js/storage.js';
import {DOOR,VWALL} from '../baseline/js/const.js';
import {observed} from './observer.mjs';
import {outputs,hashes,deferred} from '../baseline/tools/observe.mjs';
import {decodeScreen} from '../baseline/tools/screen-decode.mjs';

const [input,output]=process.argv.slice(2);
assert.ok(input&&output&&process.argv.length===4);
const recipe=JSON.parse(readFileSync(input));
const lock=JSON.parse(readFileSync(new URL('../review/input-lock.json',import.meta.url)));
const results=[],rows=[];
function check(name,fn){try{fn();results.push({name,pass:true});}
    catch(e){results.push({name,pass:false,error:e.message.slice(0,600)});}}
for(const [i,part] of recipe.segments.entries()) {
    const probe=await observed(part);
    const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const held=await deferred(part),plainHashes=hashes(plain),heldHashes=hashes(held);
    const at=step=>probe.states.find(s=>s.step===step),last=probe.states.at(-1);
    check(part.name+': fresh observer and complete input',()=>{
        assert.equal(probe.error,null);assert.equal(probe.allKeysCaptured,true);
        assert.equal(plain.screens.length,part.moves.length+1);assert.deepEqual(plain.slices.flat(),plain.calls);
    });
    check(part.name+': passive observer neutral',()=>assert.deepEqual(probe.hashes,plainHashes));
    check(part.name+': deferred and exhausted input equal',()=>assert.deepEqual(heldHashes,plainHashes));
    check(part.name+': actual wand and whistle producers',()=>{
        const setup=at(103);assert.deepEqual(setup.hero,[23,5]);assert.equal(setup.guard,null);
        assert.equal(setup.entry.typ,VWALL);assert.deepEqual(setup.wand,{letter:'o',charges:8});
        assert.deepEqual(setup.whistle,{letter:'p',cursed:1});
        if(i!==1){assert.equal(at(106).entry.typ,DOOR);assert.equal(at(106).wand.charges,7);}
        if(i<2){const s=at(i===0?108:105);assert.equal(s.guard.first,null);
            assert.deepEqual(s.guard.xy,[25,5]);assert.equal(s.guard.peaceful,1);}
        assert.ok(probe.states.every(s=>s.timers===0),'these inputs do not reach ice timer cleanup');
    });
    check(part.name+': C entry initialization or early-return policy',()=>{
        if(i<2){const s=at(i===0?121:118);assert.equal(s.guard.end,1);assert.equal(s.guard.begin,0);
            assert.equal(s.guard.room,8);assert.equal(s.guard.first.ftyp,VWALL);}
        else if(i===2){assert.equal(last.guard,null);assert.equal(last.entry.typ,DOOR);}
        else {assert.ok(probe.states.some(s=>s.guard&&s.guard.first===null));
            assert.equal(last.guard,null);assert.equal(last.entry.typ,DOOR);}
    });
    check(part.name+': C restoration and movement or paired negative',()=>{
        assert.equal(last.guard,null);
        if(i<2){assert.equal(at(i===0?147:144).entry.typ,VWALL);
            assert.equal(last.entry.typ,VWALL);assert.deepEqual(last.hero,[24,5]);}
        else {assert.equal(last.entry.typ,DOOR);assert.deepEqual(last.hero,[23,5]);}
    });
    if(i===0)check(part.name+': C reconstructed wall flags saved',()=>{
        assert.equal(at(121).guard.first.flags,2,'C WM_W_RIGHT from the outer rock/corridor side');
    });
    if(i>0)check(part.name+': five original negative hashes',()=>assert.deepEqual(plainHashes,lock.negativeHashes[part.name]));
    const grid=decodeScreen(plain.screens.at(-1));
    rows.push({name:part.name,keys:part.moves.length,boundaries:plain.screens.length,calls:plain.calls.length,
        hashes:plainHashes,deferredHashes:heldHashes,
        milestones:probe.states.filter(s=>[103,105,106,108,118,121,124,127,144,147,174,177,178,179,180,182,183].includes(s.step)),
        finalRow5Columns22To26:grid[5].slice(21,26)});
}
const report={classification:'Fresh ordinary JS controls against C source contracts; no candidate or native comparison',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows};
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass),
    finalRows:rows.map(r=>({name:r.name,row:r.finalRow5Columns22To26}))}));
if(report.passed!==report.total)process.exitCode=1;
