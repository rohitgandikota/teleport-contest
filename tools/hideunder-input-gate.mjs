// Read-only actual-input conditions. Native parity is checked separately.
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Underwater } from '../js/youprop.js';
import { canseemon } from '../js/display.js';
import { couldsee } from '../js/vision.js';
async function observe(part) {
    const states=[],messages=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const mon=g.level.monsters.find(m=>m.mnum===PMNAMES.PM_GIANT_EEL);
            const text=g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd();
            if(messages.at(-1)?.text!==text)messages.push({step,text});
            states.push({step,turn:g.moves,hero:{x:g.u.ux,y:g.u.uy,hp:g.u.uhp,mh:g.u.mh,form:g.u.umonnum,
                hidden:g.u.uundetected,underwater:Underwater(),typ:g.level.at(g.u.ux,g.u.uy).typ},
                mon:mon?{id:mon.m_id,x:mon.mx,y:mon.my,hp:mon.mhp,hidden:mon.mundetected,
                    couldsee:couldsee(mon.mx,mon.my),canseemon:canseemon(mon),typ:g.level.at(mon.mx,mon.my).typ}:null});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    const row={name:part.name,boundaries:run.getScreens().length,rngCalls:run.getRngLog().length,
        firstMonster:states.find(s=>s.mon),last:states.at(-1),states,messages};
    return row;
}

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {PMNAMES} from '../js/monst_data.js';
import {POOL} from '../js/const.js';
const {segments}=JSON.parse(readFileSync(new URL('gen-sessions/recipes/hideunder-underwater.json',import.meta.url)));
const native=JSON.parse(readFileSync(new URL('gen-sessions/generated/hideunder-underwater.session.json',import.meta.url)));
assert.equal(native.source,'c');
assert.equal(native.segments.length,segments.length);
for(const [index,part] of segments.entries())
    for(const key of ['seed','datetime','nethackrc','moves'])
        assert.deepEqual(part[key],native.segments[index][key],`${part.name}: unchanged ${key}`);
for(const [index,part] of segments.entries())test(part.name,async()=>{
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const row=await observe(part);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    assert.equal(row.boundaries,native.segments[index].steps.length);
    assert.equal(row.rngCalls,native.segments[index].steps.reduce((n,s)=>n+s.rng.length,0));
    const present=row.states.filter(s=>s.mon);
    assert.ok(present.length>10,'requested live eel is observed over real turns');
    assert.ok(row.last.turn-row.firstMonster.turn>=10);
    assert.ok(new Set(present.map(s=>`${s.mon.x},${s.mon.y}`)).size>1,
        'two adjacent pools permit actual monster movement');
    for(const state of present){
        assert.equal(state.hero.form,PMNAMES.PM_GIANT_EEL);
        assert.ok(state.hero.hp>0 && state.hero.mh>0 && state.mon.hp>0);
        assert.equal(state.hero.underwater,index===0);
        assert.equal(state.mon.typ,POOL);
        assert.equal(state.mon.couldsee,true,'line of sight remains open throughout');
        assert.ok((state.mon.x-state.hero.x)**2+(state.mon.y-state.hero.y)**2<=2,
            'target stays within underwater visual range');
    }
    const text=row.messages.map(m=>m.text).join('\n');
    if(index===0){
        assert.ok(present.every(s=>!s.mon.hidden),'a visible eel cannot conceal itself from an underwater hero');
        assert.ok(present.some(s=>s.mon.hidden===0),'post-movement hideunder attempt cleared the field');
        assert.ok(present.every(s=>s.mon.canseemon));
        assert.match(text,/But you aren't drowning/,'real polymorph/pool entry sets Underwater');
        assert.doesNotMatch(text,/giant eel dive under the water/);
    }else{
        assert.equal(row.last.mon.hidden,1,'dry-hero control permits concealment');
        assert.equal(row.last.mon.canseemon,false);
        assert.match(text,/You see the giant eel dive under the water/);
    }
    console.log(JSON.stringify({name:part.name,boundaries:row.boundaries,rngCalls:row.rngCalls}));
});
