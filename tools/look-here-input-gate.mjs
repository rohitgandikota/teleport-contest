// Actual JS inputs prove reach and outcomes; they do not supply a native oracle.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { observe } from './look-here-input-observer.mjs';
import { ALTAR, ICE, PIT, HOLE } from '../js/const.js';
import { ONAMES } from '../js/objects_data.js';
const {segments}=JSON.parse(readFileSync(new URL('gen-sessions/recipes/look-here-lifecycle.json',import.meta.url)));
for(const [index,part] of segments.entries())test(part.name,async()=>{
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const row=await observe(part);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    assert.equal(row.boundaries,part.moves.length+1,'entire actual input is consumed');
    assert.ok(row.states.every(s=>s.hp>0&&s.mortality===0&&!s.swallowed),'live, unengulfed hero throughout');
    const find=predicate=>{const state=row.states.find(predicate);assert.ok(state,'required input condition');return state;};
    if(index===0){
        find(s=>s.typ===ALTAR&&s.blind&&s.text.includes('You try to feel what is here.'));
        const ice=find(s=>s.typ===ICE&&s.blind&&s.text.includes('There is solid ice here.')
            &&s.text.includes('You try to feel what is on it.'));
        assert.equal(ice.mentionDecor,false,'force_decor is required with mention_decor disabled');
    }else if(index===1){
        const hole=find(s=>s.trap?.type===HOLE&&s.trap.seen&&s.blind
            &&s.text.includes('lying beneath you'));
        const bottom=find(s=>s.step>hole.step&&s.trap?.type===HOLE&&s.text.includes('You feel no objects here.'));
        assert.equal(hole.flying,false);assert.equal(hole.levitating,false);assert.ok(!hole.utrap);
        assert.equal(bottom.turn,hole.turn+1,'successful blind shaft inspection consumes a turn');
        assert.ok(!row.states.some(s=>s.trap?.type===HOLE&&s.text.includes("can't reach")));
        const pit=find(s=>s.trap?.type===PIT&&s.trap.seen&&s.blind&&s.text.includes('lying beneath you'));
        const blocked=find(s=>s.step>pit.step&&s.trap?.type===PIT&&s.text.includes("But you can't reach it!"));
        assert.equal(blocked.turn,pit.turn,'seen pit edge rejects inspection without spending a turn');
    }else if(index===2){
        const timed=find(s=>s.intrinsic.HFumbling===1);
        const trip=find(s=>s.text.includes('You see here a dagger.')&&s.text.includes('You trip over it.'));
        assert.equal(trip.x,timed.x-1);assert.equal(trip.y,timed.y);
        assert.equal(trip.flying,false);assert.equal(trip.levitating,false);
        assert.equal(trip.floor.length,1);assert.equal(trip.floor[0].type,ONAMES.DAGGER);
        assert.equal(trip.floor[0].quantity,1);
        assert.equal(trip.intrinsic.HFumbling,0);
    }else{
        const air=find(s=>s.air&&s.blind&&s.text.includes('You try to feel what is floating here.'));
        const water=find(s=>s.water&&s.blind&&s.text.includes('You try to feel what is floating here.'));
        assert.ok(water.step>air.step);
        assert.ok(air.intrinsic.HBlinded>0&&water.intrinsic.HBlinded>0);
        assert.ok(water.intrinsic.HMagical_breathing>0,'ordinary intrinsic prevents incidental drowning');
        assert.equal(row.last.water,true);
    }
    console.log(JSON.stringify({name:part.name,boundaries:row.boundaries,rngCalls:row.rngCalls}));
});
