// Unchanged C recordings and read-only observations of actual monster movement.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/rolling-boulder-monster-trigger.json',import.meta.url)));
const raw=readFileSync(new URL('gen-sessions/generated/rolling-boulder-monster-trigger.session.json',import.meta.url));
const native=JSON.parse(raw);

test('raw C provenance, exact inputs and native branch evidence',()=>{
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        'd460812a6feb8b1418ea3a4147721cd849b669e6e7c35330dcd519837b9cfd28');
    assert.equal(native.source,'c');assert.equal(native.version,5);
    assert.equal(native.segments.length,4);assert.equal(recipe.segments.length,4);
    assert.deepEqual(recordingIntegrityErrors(native),[]);
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
    const registered=new Set(tags.requirements.map(r=>r.id));
    for(const id of recipe.coverage)assert.ok(registered.has(id));
    for(const [i,part] of native.segments.entries()) {
        for(const field of ['name','seed','datetime','nethackrc','moves'])
            assert.deepEqual(part[field],recipe.segments[i][field]);
        assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
        assert.equal(part.steps.length,102);
        assert.equal(part.steps.reduce((n,s)=>n+(s.rng||[]).length,0),i===3?2777:2947);
        assert.equal(part.steps.reduce((n,s)=>n+(s.animation_frames||[]).length,0),16);
    }
});

for(const [i,part] of recipe.segments.entries()) test(part.name,async()=>{
    const states=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){states.push({step,
            xy:[g.u.ux,g.u.uy],hp:g.u.uhp,mortality:g.u.umortality||0,
            deaf:!!g.u.uroleplay.deaf,accessible:!!g.flags.accessiblemsg,text:g._toplines||'',
            kittens:g.level.monsters.filter(m=>m.mnum===P.PM_KITTEN)
                .map(m=>({id:m.m_id,x:m.mx,y:m.my,hp:m.mhp,tame:m.mtame})),
            boulders:g.level.objects.filter(o=>o.otyp===O.BOULDER)
                .map(o=>({id:o.o_id,x:o.ox,y:o.oy})),
            trap:g.level.traps.find(t=>t.ttyp===C.ROLLING_BOULDER_TRAP)?.tseen});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length,102);
    assert.ok(states.every(s=>s.hp>0&&!s.mortality),'no Wizard death recovery');
    assert.ok(states.every(s=>s.deaf===(i===1)&&s.accessible===(i!==2)));
    const created=states.find(s=>s.kittens.length);
    assert.ok(created.kittens[0].tame>0);assert.equal(created.trap,false);
    assert.deepEqual([created.kittens[0].x,created.kittens[0].y],i===3?[19,15]:[18,15]);
    const triggered=states.find(s=>s.text.includes('The kitten triggers something.'));
    assert.equal(triggered.step,i===3?90:96);
    assert.ok(triggered.kittens.some(m=>m.x===17&&m.y===15));
    const last=states.at(-1);assert.equal(!!last.trap,true);
    assert.equal(last.hp,20);assert.deepEqual(last.xy,i===3?[18,14]:[17,16]);
    const ammo=created.boulders.find(o=>o.x===21&&o.y===15);
    assert.ok(ammo);assert.deepEqual(last.boulders.find(o=>o.id===ammo.id),{id:ammo.id,x:13,y:15});
    assert.equal(last.kittens.length,i===3?0:1);
    if(i!==3)assert.equal(last.kittens[0].hp,2);
    const text=run.getScreens().map(s=>decodeScreen(s).map(r=>r.map(c=>c.ch).join('')).join('\n')).join('\n');
    for(const s of recipe.branchAssertions[i].screenIncludes)assert.ok(text.includes(s),s);
    for(const s of recipe.branchAssertions[i].screenExcludes)assert.equal(text.includes(s),false,s);
});
