// Read-only actual JS input reach plus C recording provenance and branch assertions.
// Complete native frame and RNG parity is checked separately by the scorer and slice gate.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Blind} from '../js/youprop.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {POLY_TRAP,FROMFORM,TIMEOUT} from '../js/const.js';
import {t_at} from '../js/mon.js';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const input=JSON.parse(readFileSync(new URL('gen-sessions/recipes/look-here-lifesaving.json',import.meta.url)));
const raw=readFileSync(new URL('gen-sessions/generated/look-here-lifesaving.session.json',import.meta.url));
const native=JSON.parse(raw);
test('unchanged C recording and asserted source branches',()=>{
    assert.equal(native.version,5);assert.equal(native.source,'c');
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '98673865680874190170e8e090398f3d62ce3729e27663f9582f078710f6a8e9');
    assert.equal(native.segments.length,input.segments.length);
    for(const [index,part] of input.segments.entries()){
        for(const key of ['name','seed','datetime','nethackrc','moves'])
            assert.deepEqual(native.segments[index][key],part[key],`segment ${index} ${key}`);
    }
    assert.deepEqual(recordingIntegrityErrors(native),[]);
    assert.deepEqual(branchAssertionErrors(input,native),[]);
});
for(const [index,part] of input.segments.entries())test(part.name,async()=>{
    const states=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){states.push({step,
            blind:Blind(),intrinsicBlind:g.u.intrinsic?.HBlinded??0,
            form:g.u.umonnum,swallowed:!!g.u.uswallow,trap:t_at(g.u.ux,g.u.uy)?.ttyp,
            amulet:g.u.uamul?.otyp,life:g.u.uprops?.LIFESAVED??0,
            contents:g.u.ustuck?.minvent?.map(o=>({type:o.otyp,corpse:o.corpsenm}))??[],
            mortality:g.u.umortality??0,hp:g.u.uhp,mh:g.u.mh,
            screen:g.nhDisplay.grid.map(row=>row.map(c=>c.ch).join('').trimEnd()).join('\n')});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    assert.equal(run.getScreens().length,part.moves.length+1);
    assert.deepEqual(run.getAnimationFramesByStep(),
        native.segments[index].steps.map(step=>step.animation_frames||[]),
        'complete animation slices, including any extra JS frames');
    assert.ok(!states.some(s=>/Die\?|OK, so you don't die/.test(s.screen)),
        'primary and control use actual worn amulet lifesaving, never wizard refusal');
    const contact=states.find(s=>s.swallowed&&s.contents.some(o=>o.type===ONAMES.CORPSE&&o.corpse===PMNAMES.PM_COCKATRICE));
    assert.ok(contact);assert.equal(contact.blind,true);assert.equal(contact.form,PMNAMES.PM_SMALL_MIMIC);
    assert.equal(contact.intrinsicBlind&FROMFORM,FROMFORM);
    assert.equal(contact.trap,POLY_TRAP);assert.equal(contact.amulet,ONAMES.AMULET_OF_LIFE_SAVING);
    assert.ok(contact.life);assert.equal(contact.mortality,0);
    const stone=states.find(s=>s.step>contact.step&&s.mortality===1&&s.screen.includes('Your medallion feels warm!'));
    assert.ok(stone);
    const expelled=states.find(s=>s.step>stone.step&&!s.swallowed&&s.screen.includes('You get expelled from the fog cloud!'));
    assert.ok(expelled);
    assert.ok(states.some(s=>s.step>expelled.step&&s.screen.includes('onto a polymorph trap!')));
    const menu=states.find(s=>s.step>expelled.step&&s.screen.includes('a - a cockatrice corpse')&&s.screen.includes('(end)'));
    assert.ok(menu);assert.equal(menu.mortality,1);assert.equal(menu.life,0);
    assert.equal(menu.amulet,undefined);assert.equal(menu.form,PMNAMES.PM_BARBARIAN);
    assert.equal(menu.swallowed,false);assert.equal(menu.trap,undefined);
    if(index===0){
        assert.equal(menu.blind,false);assert.equal(menu.intrinsicBlind,0);
        assert.match(menu.screen,/Contents of the fog cloud's interior:/);
        assert.doesNotMatch(menu.screen,/You feel:/);
    }else{
        assert.equal(menu.blind,true);assert.ok(menu.intrinsicBlind&TIMEOUT);
        assert.equal(menu.intrinsicBlind&FROMFORM,0);
        assert.match(menu.screen,/You feel:/);
    }
    assert.ok(states.at(-1).hp>0);assert.equal(states.at(-1).mortality,1);
    console.log('INPUT_RECEIPT '+JSON.stringify({name:part.name,boundaries:run.getScreens().length,
        calls:run.getRngLog().length,contact:contact.step,stone:stone.step,expelled:expelled.step,
        menu:menu.step,blind:menu.blind,nativeParityChecked:false,recordingInputIntegrityChecked:true}));
});
