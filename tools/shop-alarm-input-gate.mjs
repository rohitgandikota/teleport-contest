// Independent C recording and actual command reach for shop alarm responses.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Deaf} from '../js/youprop.js';
import {PMNAMES} from '../js/monst_data.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import requirements from './gen-sessions/coverage-requirements.json' with {type:'json'};
const bytes=fs.readFileSync(process.argv[2]||new URL('gen-sessions/generated/shop-alarm-response.session.json',import.meta.url));
const native=JSON.parse(bytes);
const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/shop-alarm-response.json',import.meta.url)));
const bounds=[100,109,134,108],calls=[8138,8773,8773,7276];
test('original C bytes, all input fields and keys, native messages and branch assertions',()=>{
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
        '5e88c2c85d5c78efabede75838678db81cf40455bef25b05ece49bbcc2dacf18');
    assert.equal(native.source,'c');assert.equal(native.version,5);
    assert.equal(native.segments.length,4);assert.equal(recipe.segments.length,4);
    assert.ok(recipe.coverage.every(tag=>requirements.requirements.some(r=>r.id===tag)));
    assert.deepEqual(recordingIntegrityErrors(native),[]);
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
    for(const [i,part] of native.segments.entries()){
        for(const field of ['name','seed','datetime','nethackrc','moves'])
            assert.deepEqual(part[field],recipe.segments[i][field]);
        assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
        assert.equal(part.steps.length,bounds[i]);
        assert.equal(part.steps.reduce((n,s)=>n+s.rng.length,0),calls[i]);
        assert.ok(part.steps.every(s=>!s.animation_frames?.length));
        const messages=part.steps.map(s=>decodeScreen(s.screen)[0].map(c=>c.ch).join('').trimEnd());
        assert.equal(messages.some(s=>s.includes('An alarm sounds!')),i===1);
        assert.equal(messages.some(s=>s.includes('The guard wakes up.')),i===1);
    }
});
for(const [i,part] of recipe.segments.entries())test(part.name,async()=>{
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let owner,guard,run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            owner ||=g.level.monsters.find(m=>m.isshk);
            guard ||=g.level.monsters.find(m=>m.mnum===PMNAMES.PM_WATCHMAN);
            states.push({step,hp:g.u.uhp,over:!!g.program_state?.gameover,deaf:!!Deaf(),
                level:{...g.u.uz},guard:guard&&{id:guard.m_id,peaceful:guard.mpeaceful,
                    asleep:guard.msleeping,present:g.level.monsters.includes(guard)},
                owner:owner&&{bill:owner.eshk.billct,robbed:owner.eshk.robbed,following:owner.eshk.following},
                text:g.nhDisplay.grid.map(row=>row.map(c=>c.ch).join('').trimEnd()).join('\n')});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length,bounds[i]);
    assert.ok(states.every(s=>s.hp===12&&!s.over));
    const billed=states.find(s=>s.owner?.bill===1);assert.ok(billed);
    const end=states.at(-1);assert.deepEqual(end.level,{dnum:0,dlevel:3});
    assert.equal(end.deaf,i!==1);assert.equal(end.owner.bill,0);
    assert.equal(end.owner.robbed,i<3?60:0);assert.equal(end.owner.following,i<3?1:0);
    if(i===1||i===2){
        const initial=states.find(s=>s.guard);assert.ok(initial.guard.peaceful&&initial.guard.asleep);
        assert.equal(end.guard.id,initial.guard.id);assert.equal(end.guard.peaceful,0);
        assert.equal(end.guard.asleep,0);assert.equal(end.guard.present,true);
        const awakened=states.find(s=>s.guard&&!s.guard.peaceful);
        assert.ok(awakened);assert.equal(awakened.deaf,i===2);
    }else assert.ok(states.every(s=>!s.guard));
    const observed={segments:recipe.segments.map((_,j)=>({steps:j===i?states.map(s=>({screen:s.text})):[]}))};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[recipe.branches[i]],
        branchAssertions:[recipe.branchAssertions[i]]},observed),[]);
});
