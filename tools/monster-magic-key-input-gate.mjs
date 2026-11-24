// Ordinary input only. C parity must be verified separately after recording.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {has_magic_key} from '../js/artifact.js';
import {PMNAMES} from '../js/monst_data.js';
import {ART_MASTER_KEY_OF_THIEVERY} from '../js/artilist_data.js';
import {DOOR, D_LOCKED, D_TRAPPED, D_ISOPEN, D_NODOOR,
    OBJ_INVENT, OBJ_FLOOR, OBJ_MINVENT, TRAPPED_DOOR} from '../js/const.js';

const file=process.argv[2] || new URL(
    'gen-sessions/generated/monster-magic-key-doors.session.json',import.meta.url);
const input=JSON.parse(fs.readFileSync(file));
assert.equal(input.segments.length,2);
const cases=[
    {name:'magic-key-blessed-disarms-locked-door',step:112,blessed:true,calls:3008},
    {name:'magic-key-uncursed-keeps-door-trap',step:113,blessed:false,calls:3009},
];
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cleanCall=call=>call.replace(/\s+@.*$/,'');
const hooks=['__step_snapshot','__rng_trace_sites'];
const copyKey=o=>o && ({id:o.o_id,artifact:o.oartifact,where:o.where,
    blessed:!!o.blessed,cursed:!!o.cursed,owner:o.ocarry?.m_id});
const findKey=items=>items?.find(o=>o.oartifact===ART_MASTER_KEY_OF_THIEVERY);

for(const [index,expected] of cases.entries()) {
    const part=input.segments[index];
    assert.equal(part.name,expected.name);
    const previous=hooks.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
    const states=[];
    let run;
    try {
        globalThis.__rng_trace_sites=true;
        globalThis.__step_snapshot={step:'*',cb(g,step){
            if(!g.level||!g.u)return;
            const actor=g.level.monsters.find(m=>m.mnum===PMNAMES.PM_MASTER_ASSASSIN);
            const tile=g.level.at(52,6);
            const floorKey=findKey(g.level.objects);
            states.push({step,hero:[g.u.ux,g.u.uy],text:g._toplines||'',
                gameover:!!g.program_state?.gameover,
                inventoryKey:copyKey(findKey(g.invent)),
                floorKey:floorKey&&{...copyKey(floorKey),x:floorKey.ox,y:floorKey.oy},
                door:{type:tile.typ,mask:tile.doormask},
                actor:actor&&{id:actor.m_id,type:actor.mnum,x:actor.mx,y:actor.my,
                    hp:actor.mhp,stun:!!actor.mstun,traps:actor.mtrapseen||0,
                    key:copyKey(findKey(actor.minvent)),magicKey:has_magic_key(actor)?.o_id||null}});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        hooks.forEach((key,i)=>previous[i]?Object.defineProperty(globalThis,key,previous[i])
                                        :delete globalThis[key]);
    }
    const held=states.find(s=>s.inventoryKey)?.inventoryKey;
    const dropped=states.find(s=>s.floorKey)?.floorKey;
    const before=states.find(s=>s.step===expected.step-1);
    const after=states.find(s=>s.step===expected.step);
    const calls=run.getRngLog().map(cleanCall);
    const slices=run.getRngSlices().map(slice=>slice.map(cleanCall));
    const frames=run.getAnimationFramesByStep();

    await test(`${part.name}: the wished artifact passes through hero and floor inventories`,()=>{
        assert.equal(held.artifact,ART_MASTER_KEY_OF_THIEVERY);
        assert.equal(held.where,OBJ_INVENT);assert.equal(held.blessed,expected.blessed);
        assert.equal(held.cursed,false);
        assert.equal(dropped.id,held.id);assert.equal(dropped.where,OBJ_FLOOR);
        assert.deepEqual([dropped.x,dropped.y],[53,6]);
        assert.deepEqual(before.door,{type:DOOR,mask:D_LOCKED|D_TRAPPED});
        assert.equal(before.actor.key,undefined);
    });
    await test(`${part.name}: the real Master Assassin acquires the same key and enters the door`,()=>{
        assert.equal(after.actor.id,before.actor.id);
        assert.equal(after.actor.type,PMNAMES.PM_MASTER_ASSASSIN);
        assert.equal(after.actor.key.id,held.id);assert.equal(after.actor.key.where,OBJ_MINVENT);
        assert.equal(after.actor.key.owner,after.actor.id);
        assert.equal(after.floorKey,undefined);assert.equal(after.inventoryKey,undefined);
        assert.deepEqual([after.actor.x,after.actor.y],[52,6]);
        assert.equal(after.actor.magicKey,expected.blessed?held.id:null);
    });
    await test(`${part.name}: beatitude controls disarm before feedback, damage and RNG`,()=>{
        const blast=slices[expected.step].filter(call=>/^rnd\(15\)=/.test(call));
        assert.equal(after.door.mask,expected.blessed?D_ISOPEN:D_NODOOR);
        assert.equal(after.actor.hp,before.actor.hp-(expected.blessed?0:13));
        assert.equal(after.actor.stun,!expected.blessed);
        assert.equal(after.actor.traps,expected.blessed?before.actor.traps
            :before.actor.traps|(1<<(TRAPPED_DOOR-1)));
        assert.deepEqual(blast,expected.blessed?[]:['rnd(15)=13']);
        assert.equal(after.text,expected.blessed?'The Master Assassin unlocks and opens a door.'
                                             :'KABOOM!!  You see a door explode.');
    });
    await test(`${part.name}: every key is consumed without combat, frames or leaked hooks`,()=>{
        assert.equal(run.getScreens().length,part.moves.length+1);
        assert.equal(run._display.inputQueueLength,0);
        assert.equal(calls.length,expected.calls);
        assert.equal(frames.reduce((sum,slice)=>sum+slice.length,0),0);
        assert.equal(states.some(s=>s.gameover||/You die|Master Assassin hits/.test(s.text)),false);
        assert.deepEqual(hooks.map(key=>Object.getOwnPropertyDescriptor(globalThis,key)),previous);
    });
    console.log(JSON.stringify({name:part.name,boundaries:run.getScreens().length,calls:calls.length,
        frames:frames.reduce((sum,slice)=>sum+slice.length,0),before,after,
        digests:{screens:digest(run.getScreens()),cursors:digest(run.getCursors()),
            calls:digest(calls),slices:digest(slices),animations:digest(frames)}}));
}
