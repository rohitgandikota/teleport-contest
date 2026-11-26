// Fresh ordinary controls against original C contracts. Baseline failures are required evidence.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {DOOR,VWALL,IRONBARS,W_NONDIGGABLE} from '../js/const.js';
import {outputs,hashes,deferred} from './observe.mjs';
import {observed} from './observer.mjs';

const [output]=process.argv.slice(2);
assert.ok(output&&process.argv.length===3);
const recipe=JSON.parse(readFileSync(new URL('../promotion/tools/gen-sessions/recipes/fakecorr-saved-flags.json',import.meta.url)));
const lock=JSON.parse(readFileSync(new URL('../review/input-lock.json',import.meta.url)));
const results=[],rows=[];
function check(name,fn){try{fn();results.push({name,pass:true});}
    catch(e){results.push({name,pass:false,error:e.message.slice(0,600)});}}
for(const [i,part] of recipe.segments.entries()) {
    const probe=await observed(part);
    const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const held=await deferred(part),plainHashes=hashes(plain),heldHashes=hashes(held);
    const at=step=>probe.states.find(s=>s.step===step),last=probe.states.at(-1);
    const wish='\x17undiggable iron bars\r';
    const mutation=part.moves.indexOf(wish);
    const mutationStep=mutation<0?null:mutation+wish.length;
    const beforeDig=part.moves.lastIndexOf('zol');
    check(part.name+': complete input and observer',()=>{
        assert.equal(probe.error,null);assert.equal(probe.allKeysCaptured,true);
        assert.equal(plain.screens.length,part.moves.length+1);
        assert.deepEqual(plain.slices.flat(),plain.calls);
    });
    check(part.name+': passive observer neutral',()=>assert.deepEqual(probe.hashes,plainHashes));
    check(part.name+': deferred and exhausted input equal',()=>assert.deepEqual(heldHashes,plainHashes));
    check(part.name+': real snapshot and typed-field producer',()=>{
        const saved=at(118),entry=at(126);
        assert.deepEqual(saved.hero,[23,5]);assert.equal(saved.guard.end,1);
        assert.deepEqual(saved.guard.corridor[0],{fx:25,fy:5,ftyp:VWALL,flags:2,doormask:0});
        assert.deepEqual(entry.hero,[25,5]);assert.equal(entry.entry.typ,DOOR);
        assert.equal(entry.entry.wall,2);assert.equal(entry.guard.end,3);
        assert.deepEqual(entry.wand,{letter:'o',charges:8});
        if(mutationStep!==null) {
            const changed=at(mutationStep);
            assert.equal(changed.here.typ,IRONBARS);
            assert.equal(changed.here.wall,W_NONDIGGABLE);
            if(i===2){assert.deepEqual(changed.hero,[24,5]);assert.equal(changed.guard,null);
                assert.equal(changed.entry.typ,VWALL);assert.equal(changed.entry.wall,2);}
            else {assert.deepEqual(changed.hero,[25,5]);assert.equal(changed.guard.begin,0);
                assert.equal(changed.guard.corridor[0].flags,2);}
        }
    });
    check(part.name+': C saved wall flags restoration or pending-cleanup control',()=>{
        if(i<3) {
            const restored=at(beforeDig);
            assert.equal(restored.guard,null);assert.deepEqual(restored.hero,[24,5]);
            assert.equal(restored.entry.typ,VWALL);assert.equal(restored.entry.flags,2);
            assert.equal(restored.entry.wall,2,'C flags assignment restores wall_info, not temporary terrain flags');
        } else {
            assert.equal(beforeDig,-1);assert.equal(last.guard.begin,0);
            assert.equal(last.guard.end,3);assert.equal(last.entry.typ,IRONBARS);
            assert.equal(last.entry.wall,W_NONDIGGABLE);
        }
    });
    check(part.name+': C post-cleanup digging and move or stopped-before-cleanup control',()=>{
        if(i<3) {
            assert.equal(last.guard,null);assert.equal(last.wand.charges,7);
            assert.equal(last.entry.typ,DOOR,'restored original wall is diggable');
            assert.deepEqual(last.hero,[25,5]);
        } else {
            assert.equal(last.wand.charges,8);assert.deepEqual(last.hero,[25,5]);
            assert.equal(last.turn,at(126).turn,'debug terrain wish does not advance the guard');
        }
    });
    if(i>0)check(part.name+': five original negative hashes',()=>assert.deepEqual(plainHashes,lock.negativeHashes[part.name]));
    const marks=[118,126,mutationStep,beforeDig,part.moves.length];
    rows.push({name:part.name,keys:part.moves.length,boundaries:plain.screens.length,calls:plain.calls.length,
        hashes:plainHashes,deferredHashes:heldHashes,milestones:probe.states.filter(s=>marks.includes(s.step))});
}
const report={classification:'Fresh keyboard reach and original C source predictions; no candidate or native comparison',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows};
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass)}));
if(report.passed!==report.total)process.exitCode=1;
