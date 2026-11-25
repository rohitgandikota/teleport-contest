import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const {runSegment}=await import(new URL(`../js/jsmain.js`,import.meta.url));
const {InMemoryStorage}=await import(new URL(`../js/storage.js`,import.meta.url));
const {decodeScreen,renderCell}=await import(new URL(`../frozen/screen-decode.mjs`,import.meta.url));
const {ONAMES:O}=await import(new URL(`../js/objects_data.js`,import.meta.url));
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/catch-lit-owner.json',import.meta.url)));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs=run=>({screens:run.getScreens(),cursors:run.getCursors(),calls:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const native=JSON.parse(readFileSync(new URL('gen-sessions/generated/catch-lit-owner.session.json',import.meta.url)));
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
const tuple=p=>['name','seed','datetime','nethackrc','moves'].map(k=>[k,Object.hasOwn(p,k),p[k]]);
assert.deepEqual(recipe.segments.map(tuple),native.segments.map(tuple));
const report={kind:'ordinary ignition and empty-inventory controls',cases:[]};
for(const part of recipe.segments) {
    const row={name:part.name};const states=[];
    try {
        const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
        let run;
        try {
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level)return;
                const items=[...(g.invent||[]),...(g.level.objects||[])];
                states.push({step,hasInventory:Array.isArray(g.invent),count:g.invent?.length||0,
                    hp:g.u.uhp,mortality:g.u.umortality||0,
                    lit:items.filter(o=>o.lamplit).map(o=>({type:o.otyp,where:o.where})),
                    oilKnown:!!g.objects[O.POT_OIL].oc_name_known});
            }};
            run=await runSegment({...part,storage:new InMemoryStorage()});
        } finally {
            if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
            else delete globalThis.__step_snapshot;
        }
        const output=outputs(run),plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        assert.deepEqual(output,plain,'all-five observer neutrality');
        assert.deepEqual(output,await deferred(part),'all-five deferred-input equality');
        assert.deepEqual(output.slices.flat(),output.calls);
        const texts=output.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        assert.match(texts.at(-1),/NetHack Version/,'final command completed');
        assert.ok(states.every(s=>s.hp>0 && !s.mortality),'survives without resurrection');
        if(part.name.startsWith('empty-inventory')) {
            assert.ok(states.every(s=>s.count===0));
            if(part.name.endsWith('-fire') && !part.name.endsWith('-no-fire'))
                assert.ok(texts.some(t=>t.includes('tower of flame erupts')));
        } else {
            assert.ok(states.some(s=>s.lit.length>0),'real source caught light');
            if(part.name.startsWith('floor-oil'))assert.ok(states.at(-1).oilKnown);
        }
        assert.ok(states.every(s=>s.hasInventory),'inventory chain is initialized');
        Object.assign(row,{pass:true,boundaries:output.screens.length,calls:output.calls.length,
            frames:output.frames.flat().length,inventoryAlwaysInitialized:states.every(s=>s.hasInventory),
            hashes:Object.fromEntries(Object.entries(output).map(([k,v])=>[k,hash(v)])),
            lightMessages:texts.flatMap(t=>t.split('\n').filter(s=>/catch(?:es)? light|feels warm|in addition to the cost/.test(s))).filter((s,i,a)=>a.indexOf(s)===i).slice(0,8)});
        if(recipe.unchangedOutputHashes[part.name])assert.deepEqual(row.hashes,recipe.unchangedOutputHashes[part.name]);
    } catch(error) {Object.assign(row,{pass:false,error:error.message.slice(0,500)});}
    report.cases.push(row);
}
report.passed=report.cases.filter(r=>r.pass).length;report.total=report.cases.length;
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));if(report.passed!==report.total)process.exitCode=1;
