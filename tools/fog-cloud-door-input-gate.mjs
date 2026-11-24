// Ordinary terrain wishes and real monster creation. No runtime replacements.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {PMNAMES} from '../js/monst_data.js';
import {DOOR, D_CLOSED} from '../js/const.js';

const input=JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/fog-cloud-door-feedback.session.json', import.meta.url)));
const recipe=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/fog-cloud-door-feedback.json', import.meta.url)));
assert.equal(input.version,5);
assert.equal(input.source,'c');
assert.equal(input.segments.length,2);
const fields=['name','seed','datetime','nethackrc','moves'];
const types=[PMNAMES.PM_FOG_CLOUD,PMNAMES.PM_ACID_BLOB];
const messages=['The fog cloud flows under the door.','The acid blob oozes under the door.'];
for(const [index,part] of input.segments.entries()) {
    assert.deepEqual(fields.map(k=>part[k]),fields.map(k=>recipe.segments[index][k]));
    const states=[];
    const keys=['__step_snapshot','__rng_trace_sites'];
    const previous=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
    let run;
    try {
        globalThis.__rng_trace_sites=true;
        globalThis.__step_snapshot={step:'*',cb(g,step){
            if(!g.u||!g.level)return;
            const mon=g.level.monsters.find(m=>m.mnum===types[index]);
            const door=g.level.at(39,5);
            states.push({step,hero:[g.u.ux,g.u.uy],text:g._toplines||'',
                door:{type:door.typ,mask:door.doormask},
                mon:mon?{id:mon.m_id,at:[mon.mx,mon.my],tame:mon.mtame,
                    peaceful:mon.mpeaceful,shape:mon.cham,inventory:mon.minvent,
                    positions:[...g.level.monAt].filter(([,v])=>v===mon).map(([k])=>k)}:null});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        keys.forEach((k,i)=>previous[i]?Object.defineProperty(globalThis,k,previous[i]):delete globalThis[k]);
    }
    const before=states.find(s=>s.step===68),after=states.find(s=>s.step===69);
    await test(`${part.name}: real monster approaches the closed door`,()=>{
        assert.deepEqual(before.door,{type:DOOR,mask:D_CLOSED});
        assert.deepEqual(before.hero,[38,5]);
        assert.deepEqual(before.mon.at,[40,5]);
        assert.equal(before.mon.tame,0);
        assert.equal(before.mon.peaceful,0);
        assert.equal(before.mon.inventory,null);
    });
    await test(`${part.name}: same monster passes with source-derived wording`,()=>{
        assert.equal(after.mon.id,before.mon.id);
        assert.deepEqual(after.mon.at,[39,5]);
        assert.equal(after.door.mask,D_CLOSED);
        assert.equal(after.text,messages[index]);
        assert.deepEqual(after.mon.positions,['39,5']);
    });
    await test(`${part.name}: no door opening or smashing draw`,()=>{
        assert.equal(run.getRngSlices()[69].some(c=>/^rn2\(2\)=.*@js\/monmove\.js:/.test(c)),false);
        assert.equal(run.getRngLog().length,[2448,2449][index]);
    });
    await test(`${part.name}: all keys complete and observer hooks are restored`,()=>{
        assert.equal(run.getScreens().length,72);
        assert.equal(run.getCursors().length,72);
        assert.equal(run._display.inputQueueLength,0);
        assert.equal(run.getAnimationFramesByStep().reduce((n,s)=>n+s.length,0),0);
        assert.deepEqual(keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),previous);
    });
    console.log(JSON.stringify({name:part.name,before,after,
        boundaries:run.getScreens().length,calls:run.getRngLog().length}));
}
