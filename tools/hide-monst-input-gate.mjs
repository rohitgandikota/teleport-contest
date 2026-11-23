// Read-only actual-input level-return conditions. These are regression controls,
// not direct reproducers of the hide_monst vision mask or a native parity gate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { PMNAMES } from '../js/monst_data.js';
import { Protection_from_shape_changers } from '../js/youprop.js';
const {segments}=JSON.parse(readFileSync(new URL('gen-sessions/recipes/hide-monst-level-return.json',import.meta.url)));
for (const [index,part] of segments.entries()) {
    const states=[],messages=[];let id=null,run;
    const species=index===2?PMNAMES.PM_TRAPPER:PMNAMES.PM_SMALL_MIMIC;
    const hooks=['__step_snapshot','__rng_trace_sites'];
    const previous=hooks.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
    try {
        globalThis.__rng_trace_sites=true;
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const here=g.level.monsters||[];
            id ??= here.find(m=>m.mnum===species)?.m_id;
            const mon=here.find(m=>m.m_id===id)
                || [...(g.saved_levels?.values()||[])].flatMap(l=>l.monsters||[]).find(m=>m.m_id===id);
            const text=g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd();
            if(text!==messages.at(-1)?.text)messages.push({step,text});
            states.push({step,move:g.moves,level:{...g.u.uz},hp:g.u.uhp,
                protected:Protection_from_shape_changers(),id:id??null,here:!!mon&&here.includes(mon),
                mon:mon?{id:mon.m_id,x:mon.mx,y:mon.my,hidden:!!mon.mundetected,
                    appearance:mon.m_ap_type||0,sleeping:!!mon.msleeping,hp:mon.mhp,cancelled:!!mon.mcan}:null});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        for (const [i,key] of hooks.entries()) {
            if(previous[i])Object.defineProperty(globalThis,key,previous[i]);else delete globalThis[key];
        }
    }
    assert.deepEqual(hooks.map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),previous);
    const final=states.at(-1),depart=states.findIndex(s=>s.level.dlevel===2);
    const returnStep=states.findIndex((s,i)=>i>depart&&s.level.dlevel===1);
    const row={name:part.name,beforeDeparture:states[depart-1],returned:states[returnStep]};
    console.log(JSON.stringify({name:row.name,boundaries:run.getScreens().length,
        rngCalls:run.getRngLog().length,depart,returnStep,
        beforeDeparture:row.beforeDeparture,returned:row.returned,final}));
    assert.ok(id!==null,part.name+': requested monster created');
    assert.ok(depart>0&&returnStep>depart,part.name+': real level leave and return');
    assert.ok(row.beforeDeparture.mon&&row.returned.mon,part.name+': target survives return');
    assert.ok(row.beforeDeparture.here&&row.returned.here,part.name+': target is present on the returned level');
    assert.ok(row.returned.move-row.beforeDeparture.move>10,part.name+': elapsed > rnd(10)');
    if(index===0) {
        assert.ok(row.beforeDeparture.protected);
        assert.equal(row.returned.mon.appearance,0,'shape protection exposes the returned mimic');
    }
    if(index===1) {
        assert.equal(row.beforeDeparture.mon.appearance,0,'detect reveals the awake mimic before departure');
        assert.equal(row.beforeDeparture.mon.sleeping,false);
        assert.ok(row.returned.mon.appearance,'the revealed mimic disguises itself on return');
    }
    if(index===3)assert.equal(row.returned.mon.appearance,row.beforeDeparture.mon.appearance,
        'an already disguised mimic keeps its appearance');
    assert.ok(final.hp>0);
}
