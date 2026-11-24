// Read-only actual-input reach. Native parity is checked separately by the scorer.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Stealth,Flying,Levitation} from '../js/youprop.js';
import {FROMOUTSIDE,FROMEXPER} from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/stealth-mount.json',import.meta.url)));
const raw=readFileSync(new URL('gen-sessions/generated/stealth-mount.session.json',import.meta.url));
const native=JSON.parse(raw);
test('unchanged C recording, input tuples and asserted branches',()=>{
    assert.equal(native.source,'c');assert.equal(native.version,5);
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '78d1a20dd402d80b2bf7c1477b2ac01be220be7ee3dc39fa207584c063329533');
    assert.equal(recipe.name,'stealth-mount');assert.equal(native.segments.length,2);
    for(const [index,part] of recipe.segments.entries())
        for(const field of ['name','seed','datetime','nethackrc','moves'])
            assert.deepEqual(part[field],native.segments[index][field]);
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
    assert.deepEqual(recordingIntegrityErrors(native),[]);
});
for(const [index,part] of recipe.segments.entries())test(part.name,async()=>{
    const states=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){states.push({step,
            stealth:Stealth(),blocked:g.u.blocked?.STEALTH??0,
            intrinsic:g.u.intrinsic?.HStealth??0,extrinsic:g.u.uprops?.STEALTH??0,
            flying:Flying(),levitating:Levitation(),
            intrinsicFlight:g.u.intrinsic?.HFlying??0,extrinsicFlight:g.u.uprops?.FLYING??0,
            mounted:!!g.u.usteed,steed:g.u.usteed?.mnum,
            hp:g.u.uhp,mortality:g.u.umortality??0,
            screen:g.nhDisplay.grid.map(row=>row.map(c=>c.ch).join('').trimEnd()).join('\n')});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    assert.equal(run.getScreens().length,part.moves.length+1);
    assert.deepEqual(run.getAnimationFramesByStep(),native.segments[index].steps.map(s=>s.animation_frames||[]));
    assert.ok(part.nethackrc.includes('role:Rogue'));
    assert.ok(!part.moves.includes('wizintrinsic'));
    assert.ok(states.every(s=>s.hp>0&&s.mortality===0));
    assert.ok(states.some(s=>s.screen.includes('Force the mount to succeed?')));
    const mounted=states.filter(s=>s.mounted);
    assert.ok(mounted.length>0,'real mount succeeds');
    const before=states.find(s=>s.step<mounted[0].step&&!s.mounted&&(s.intrinsic&FROMEXPER));
    assert.ok(before);assert.equal(before.stealth,true);assert.equal(before.blocked,0);
    const after=states.find(s=>s.step>mounted.at(-1).step&&!s.mounted);
    assert.ok(after,'real dismount completes');
    console.log('INPUT_RECEIPT '+JSON.stringify({name:part.name,boundaries:run.getScreens().length,
        calls:run.getRngLog().length,mountStep:mounted[0].step,dismountStep:after.step,
        mountedStates:mounted.length,mountedStealth:mounted[0].stealth,
        mountedBlocked:mounted[0].blocked,dismountedStealth:after.stealth,
        dismountedBlocked:after.blocked}));
    for(const s of mounted){
        assert.equal(s.steed,index===0?PMNAMES.PM_PONY:PMNAMES.PM_KI_RIN);
        assert.ok(s.intrinsic&FROMEXPER);assert.equal(s.extrinsic,0);
        assert.equal(s.levitating,false);assert.equal(s.flying,index===1);
        assert.equal(s.intrinsicFlight,0);assert.equal(s.extrinsicFlight,0);
        assert.equal(s.blocked&FROMOUTSIDE,index===0?FROMOUTSIDE:0);
        assert.equal(s.stealth,index===1);
    }
    assert.equal(after.blocked,0);assert.equal(after.stealth,true);
    assert.ok(after.intrinsic&FROMEXPER);assert.equal(after.flying,false);
    const text=states.map(s=>s.screen).join('\n');
    assert.equal(text.includes("You aren't stealthy anymore."),index===0);
    assert.equal(text.includes('You seem less noisy now.'),index===0);
});
