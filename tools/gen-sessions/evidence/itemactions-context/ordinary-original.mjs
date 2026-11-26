import fs from 'node:fs';
import assert from 'node:assert/strict';
import {runSegment} from './js/jsmain.js';
import {InMemoryStorage} from './js/storage.js';
import {decodeScreen,renderCell} from './frozen/screen-decode.mjs';
import {outputs,hashes,deferred} from './tools/half-damage-reader-observe.mjs';

const recipe=JSON.parse(fs.readFileSync(new URL('proposal-01.json',import.meta.url)));
const initial=JSON.parse(fs.readFileSync(new URL('probe-01.json',import.meta.url)));
const target=process.argv[2];
assert.ok(target&&!fs.existsSync(target));
const results=[];
for(const part of recipe.segments){
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            if(!g.u||!g.level)return;
            states.push({step,turn:g.moves,weapon:g.u.uwep?.otyp??null,
                inventory:(g.invent||[]).map(o=>({otyp:o.otyp,invlet:o.invlet,quan:o.quan,
                    lamplit:o.lamplit||0,known:g.objects[o.otyp].oc_name_known||false}))});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const output=outputs(run),streamHashes=hashes(output);
    assert.equal(output.screens.length,part.moves.length+1);
    assert.deepEqual(output.slices.flat(),output.calls);
    const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const held=await deferred(part);
    assert.deepEqual(hashes(plain),streamHashes,'passive observer preserves all output');
    assert.deepEqual(hashes(held),streamHashes,'deferred keyboard input preserves all output');
    const texts=output.screens.map(s=>decodeScreen(s).map(r=>r.map(renderCell).join('').trimEnd()).join('\n'));
    const expected=recipe.expectations.find(e=>e.name===part.name);
    const failures=[];
    const check=fn=>{try{fn();}catch(e){failures.push(e.message);}};
    check(()=>assert.ok(texts.some(t=>t.includes(expected.menu)),expected.menu));
    if(expected.result)check(()=>assert.ok(texts.at(-1).includes(expected.result),expected.result));
    const final=states.at(-1);
    if(part.name==='known-oil-light')check(()=>assert.equal(final.inventory[0].lamplit,1,'oil is burning'));
    if(part.name==='known-oil-snuff')check(()=>assert.equal(final.inventory[0].lamplit,0,'oil is snuffed'));
    if(part.name.startsWith('known-oil')){
        check(()=>assert.equal(final.inventory[0].known,1));
        check(()=>assert.ok(!texts.at(-1).includes('What do you want to dip')));
    }
    if(part.name.endsWith('-negative')){
        check(()=>assert.deepEqual(streamHashes,initial.find(r=>r.name===part.name).hashes));
        check(()=>assert.deepEqual(final,initial.find(r=>r.name===part.name).states.at(-1)));
    }
    const result={name:part.name,passed:failures.length===0,failures,hashes:streamHashes,final};
    results.push(result);console.log(JSON.stringify({name:result.name,passed:result.passed,failures}));
}
fs.writeFileSync(target,JSON.stringify(results,null,2)+'\n');
if(results.some(r=>!r.passed))process.exitCode=1;
