// Unchanged parent C provenance and actual commands with read-only observations.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};
const recipe=JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/launch-obj-contract.json',import.meta.url)));
const raw=readFileSync(new URL('gen-sessions/generated/launch-obj-contract.session.json',import.meta.url));
const native=JSON.parse(raw);

test('recipe name, coverage tags, and branch assertions are registered and complete',()=>{
    assert.equal(recipe.name,'launch-obj-contract');
    const registered=new Set(tags.requirements.map(r=>r.id));
    for(const tag of recipe.coverage)assert.ok(registered.has(tag),tag);
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '8f1906a01b8bbd81ed3d6098000a061a3ff3b4111994a00dd881c32110fc83b1');
    assert.equal(native.source,'c'); assert.equal(native.version,5);
    assert.equal(native.segments.length,4); assert.equal(recipe.segments.length,4);
    assert.deepEqual(recordingIntegrityErrors(native),[]);
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
    const expected=[[64,2604,4],[68,2613,4],[66,2587,4],[95,2584,16]];
    for(const [i,part] of native.segments.entries()) {
        for(const field of ['name','seed','datetime','nethackrc','moves'])
            assert.deepEqual(part[field],recipe.segments[i][field]);
        assert.equal(part.steps.length,part.moves.length+1);
        assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
        assert.deepEqual([part.steps.length,part.steps.reduce((n,s)=>n+(s.rng||[]).length,0),
            part.steps.reduce((n,s)=>n+(s.animation_frames||[]).length,0)],expected[i]);
    }
});

for(const [i,part] of recipe.segments.entries()) test(part.name,async()=>{
    const states=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            states.push({step,hp:g.u.uhp,max:g.u.uhpmax,mortality:g.u.umortality||0,
                xy:[g.u.ux,g.u.uy],intrinsicHalf:g.u.intrinsic?.HHalf_physical_damage||0,
                extrinsicHalf:g.u.uprops?.HALF_PHDAM||0,
                traps:g.level.traps.map(t=>({type:t.ttyp,x:t.tx,y:t.ty,seen:!!t.tseen,
                    launch:t.launch?{...t.launch}:null,end:t.launch2?{...t.launch2}:null})),
                objects:g.level.objects.filter(o=>[O.BOULDER,O.ROCK].includes(o.otyp))
                    .map(o=>({id:o.o_id,type:o.otyp,x:o.ox,y:o.oy,quantity:o.quan})),
                migration:(g.migrating_objs||[]).map(o=>({id:o.o_id,type:o.otyp,
                    x:o.ox,y:o.oy,where:o.where,mask:o.owornmask,trapped:o.otrapped})),
                text:g._toplines||''});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length,part.moves.length+1);
    for(const s of states) {
        assert.equal(s.mortality,0,'no Wizard death recovery masks this route');
        assert.ok(s.hp>0); assert.equal(s.intrinsicHalf,0); assert.equal(s.extrinsicHalf,0);
    }
    const created=states.find(s=>s.traps.some(t=>t.type===C.ROLLING_BOULDER_TRAP));
    const rolling=created.traps.find(t=>t.type===C.ROLLING_BOULDER_TRAP);
    assert.deepEqual(rolling.launch,{x:21,y:15}); assert.deepEqual(rolling.end,{x:13,y:15});
    const ammo=created.objects.find(o=>o.type===O.BOULDER&&o.x===21&&o.y===15);
    assert.ok(ammo);
    const targetType=[C.LANDMINE,C.TELEP_TRAP,C.LEVEL_TELEP,C.ARROW_TRAP][i];
    assert.ok(states.some(s=>s.traps.some(t=>t.type===targetType&&t.x===19&&t.y===15)));
    const last=states.at(-1); assert.deepEqual(last.xy,[17,15]);
    assert.equal(last.hp,[9,12,12,18][i]); assert.equal(last.max,i===3?20:12);
    assert.ok(last.traps.find(t=>t.type===C.ROLLING_BOULDER_TRAP)?.seen);
    const final=last.objects.find(o=>o.id===ammo.id);
    if(i===0) {
        assert.equal(last.traps.some(t=>t.type===C.LANDMINE),false);
        assert.equal(final.type,O.ROCK); assert.deepEqual([final.x,final.y],[17,15]);
    } else if(i===1) {
        assert.equal(final.type,O.BOULDER); assert.deepEqual([final.x,final.y],[51,4]);
        assert.ok(last.traps.find(t=>t.type===C.TELEP_TRAP).seen);
    } else if(i===2) {
        assert.equal(final,undefined);
        assert.deepEqual(last.migration,[{id:ammo.id,type:O.BOULDER,x:0,y:4,
            where:C.OBJ_MIGRATING,mask:C.MIGR_RANDOM,trapped:0}]);
    } else {
        assert.equal(final.type,O.BOULDER); assert.deepEqual([final.x,final.y],[13,15]);
        assert.equal(last.traps.find(t=>t.type===C.ARROW_TRAP).seen,false);
        assert.ok(states.some(s=>s.hp===20&&s.max===20),'actual full-healing producer');
    }
    if(i!==2)assert.deepEqual(last.migration,[]);
    const text=run.getScreens().map(s=>decodeScreen(s).map(row=>row.map(c=>c.ch).join('')).join('\n')).join('\n');
    for(const s of recipe.branchAssertions[i].screenIncludes)assert.ok(text.includes(s),s);
    for(const s of recipe.branchAssertions[i].screenExcludes)assert.equal(text.includes(s),false,s);
});
