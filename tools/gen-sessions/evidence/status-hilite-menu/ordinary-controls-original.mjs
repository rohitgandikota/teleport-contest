// Real keyboard source controls on the fixed graph. No C run or runtime edit.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {outputs,hashes,deferred} from './observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './assertions.mjs';

assert.ok(process.argv.length<=3,'optional compact report path only');
const recipe=JSON.parse(readFileSync(new URL('../promotion/tools/gen-sessions/recipes/status-hilite-menu.json',import.meta.url)));
const lock=JSON.parse(readFileSync(new URL('../review/input-lock.json',import.meta.url)));
assert.deepEqual(branchAssertionErrors(recipe),[]);
const results=[],rows=[],allOutputs=[],generated=[];
function check(name,body) {
    try {body();results.push({name,pass:true});}
    catch(e) {results.push({name,pass:false,error:e.message});}
}
for(const [i,part] of recipe.segments.entries()) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step) {
            if(!g.nhDisplay||!g.u)return;
            const text=g.nhDisplay.grid.map(row=>row.map(c=>c.ch).join('').trimEnd());
            states.push({step,key:part.moves[step-1]??null,turn:g.moves,
                botDisabled:!!g.bot_disabled,inGetlin:g.program_state?.in_getlin??null,
                hiliteDelta:g.iflags?.hilite_delta??null,
                rules:Object.entries(g.blstats_thresholds||{}).flatMap(([field,list])=>list.map(r=>({field:Number(field),...r}))),
                conditions:(g.cond_hilites||[]).map((mask,slot)=>({slot,mask})).filter(r=>r.mask),
                lines:text.flatMap((line,row)=>/Select.*hilite|Status hilites|Choose|Enter.*threshold|Exactly|Less than|More than| or less| or more|Added hilite|Current.*hilites|hitpoints\//.test(line)?[{row,text:line.trimStart()}]:[])});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const out=outputs(run);
    const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const pending=await deferred(part);
    const at=step=>states.find(s=>s.step===step);
    const line=step=>at(step).lines.map(s=>s.text);
    const cancelled=i===3,comparison=i===1?12:11;
    const number=i===2?'50':'50%';
    check(`${part.name}: all keys, fresh observer/plain/deferred outputs and negative hashes`,()=>{
        assert.equal(out.screens.length,part.moves.length+1);
        assert.deepEqual(states.map(s=>s.step),Array.from({length:part.moves.length+1},(_,j)=>j));
        assert.deepEqual(states.slice(1).map(s=>s.key).join(''),part.moves);
        assert.deepEqual(out.slices.flat(),out.calls);
        assert.deepEqual(out,plain);assert.deepEqual(out,pending);
        if(i)assert.deepEqual(hashes(out),lock.negativeHashes[part.name]);
    });
    check(`${part.name}: fresh rule lifetime and real hitpoints option route`,()=>{
        assert.deepEqual(at(0).rules,[]);assert.deepEqual(at(0).conditions,[]);
        assert.equal(at(0).botDisabled,false);assert.equal(at(0).hiliteDelta,null);
        assert.deepEqual(line(7),['Select hitpoints field hilite behavior:']);
    });
    check(`${part.name}: actual line-input producer`,()=>{
        assert.equal(at(8).inGetlin,1);assert.deepEqual(at(8).rules,[]);
        assert.deepEqual(line(8),[i===2?'Enter value for hitpoints threshold:':'Enter percentage value for hitpoints threshold:']);
        assert.equal(at(cancelled?9:comparison).inGetlin,0);
    });
    check(`${part.name}: C comparison suffix or empty-input return`,()=>{
        assert.deepEqual(line(cancelled?9:comparison),cancelled
            ?['Select hitpoints field hilite behavior:']
            :[`a - Less than ${number}`,`b - ${number} or less`,`c - Exactly ${number}`,`d - ${number} or more`,`e - More than ${number}`]);
    });
    check(`${part.name}: color and attribute feedback or cancellation bypass`,()=>{
        if(cancelled)assert.ok(states.every(s=>s.lines.every(l=>!l.text.startsWith('Choose '))));
        else {
            assert.deepEqual(line(comparison+1),[`Choose a color for when hitpoints is ${number}:`]);
            assert.deepEqual(line(comparison+2),[`Choose attribute for when hitpoints is ${number}:`]);
            assert.deepEqual(at(comparison+2).rules,[]);
        }
    });
    check(`${part.name}: exact inserted rule or no insertion`,()=>{
        const expected=cancelled?[]:[{field:18,set:true,fld:18,behavior:i===2?101:100,rel:0,value:50,textmatch:'',coloridx:257,anytype:4}];
        assert.deepEqual(states.at(-1).rules,expected);
        assert.ok(states.every(s=>s.conditions.length===0));
        if(cancelled)assert.ok(states.every(s=>s.rules.length===0));
        else assert.deepEqual(at(comparison+3).rules,expected);
    });
    check(`${part.name}: real acknowledgement and field-menu ordering`,()=>{
        if(cancelled)assert.deepEqual(line(10),['Status hilites:']);
        else {
            assert.deepEqual(line(comparison+3),[`Added hilite hitpoints/=${number}/red&normal--More--`]);
            assert.equal(at(comparison+4).key,' ');
            assert.deepEqual(line(comparison+4),['Current hitpoints hilites:',`a - hitpoints/=${number}/red&normal`]);
            assert.deepEqual(line(comparison+5),['Status hilites:']);
        }
    });
    check(`${part.name}: exit cleanup and stored-rule enablement`,()=>{
        assert.equal(states.at(-1).botDisabled,false);assert.equal(states.at(-1).inGetlin,0);
        assert.equal(states.at(-1).hiliteDelta,cancelled?null:3);
        assert.deepEqual(states.at(-1).lines,[]);assert.ok(states.every(s=>s.turn===1));
    });
    rows.push({name:part.name,keys:part.moves.length,boundaries:out.screens.length,calls:out.calls.length,
        frames:out.frames.flat().length,hashes:hashes(out),plainHashes:hashes(plain),deferredHashes:hashes(pending),states});
    allOutputs.push(out);
    generated.push({...part,steps:out.screens.map((screen,j)=>({screen,cursor:out.cursors[j],rng:out.slices[j],key:j?part.moves[j-1]:null}))});
}
check('Bare and explicit percentage paths converge after choosing the comparison',()=>{
    assert.deepEqual(allOutputs[0].calls,allOutputs[1].calls);
    for(const field of ['screens','cursors','slices','frames'])
        assert.deepEqual(allOutputs[0][field].slice(12),allOutputs[1][field].slice(13));
    assert.deepEqual(rows[0].states.at(-1).rules,rows[1].states.at(-1).rules);
});
check('All four menu paths preserve the complete startup RNG stream',()=>{
    for(const out of allOutputs.slice(1))assert.deepEqual(out.calls,allOutputs[0].calls);
});
const session={source:'js',segments:generated};
const primaryErrors=branchAssertionErrors(recipe,session),integrityErrors=recordingIntegrityErrors(session);
assert.deepEqual(integrityErrors,[]);
const report={classification:'Fresh ordinary JS controls against pinned C source; no native comparison',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows,
    primary:{definitionErrors:branchAssertionErrors(recipe),errors:primaryErrors,integrityErrors,branches:4}};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass).map(r=>r.name),primaryErrors}));
if(report.passed!==report.total||primaryErrors.length)process.exitCode=1;
