import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {getRngLog} from '../js/rng.js';
import {is_edible} from '../js/eat.js';
import {OCLASSES, MATERIALS} from '../js/objects_data.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const outputs = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    calls:run.getRngLog(), slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
export const hashes = output => Object.fromEntries(Object.entries(output).map(([key,value])=>[key,hash(value)]));
const materialName = value => Object.entries(MATERIALS).find(([,number])=>number===value)?.[0];

export async function observe(part, {keepOutput = false} = {}) {
    const old = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const objects = new Map(), states = [];
    let prior, run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.objects || !g.youmonst?.data) return;
            for (const obj of g.invent || [])
                if (obj.oclass===OCLASSES.RING_CLASS || obj.oclass===OCLASSES.AMULET_CLASS)
                    objects.set(obj.o_id,{obj,id:obj.o_id,type:obj.otyp,
                        material:materialName(g.objects[obj.otyp].oc_material)});
            const state = {turn:g.moves, form:g.u.umonnum, female:g.flags.female,
                food:g.u.uconduct.food || 0, hunger:g.u.uhunger, hp:g.u.uhp, mh:g.u.mh,
                mortality:g.u.umortality || 0, hit:g.u.uhitinc || 0, damage:g.u.udaminc || 0,
                protection:g.u.ublessed || 0, intrinsic:{...g.u.intrinsic},
                attributes:structuredClone(g.u.acurr), left:g.u.uleft?.o_id || null,
                right:g.u.uright?.o_id || null, inventory:(g.invent || []).map(o=>o.o_id),
                objects:[...objects.values()].map(({obj:o,id,type,material})=>({id,type,spe:o.spe,
                    letter:o.invlet,known:o.known,dknown:o.dknown,worn:o.owornmask,where:o.where,
                    material,deallocated:o.otyp===undefined,edible:o.otyp===undefined?null:is_edible(o),
                    discovered:!!g.objects[type].oc_name_known}))};
            const signature=JSON.stringify(state);
            if(signature!==prior)states.push({step,rngLength:getRngLog().length,...state});
            prior=signature;
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(old)Object.defineProperty(globalThis,'__step_snapshot',old);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),old);
    const out=outputs(run),lines=[];
    for(const [step,screen] of out.screens.entries()) {
        const text=decodeScreen(screen).slice(0,3).map(row=>row.map(renderCell).join('').trimEnd()).join('\n');
        if(text.trim() && text!==lines.at(-1)?.text)lines.push({step,text});
    }
    const meals=[];
    for(let i=1;i<states.length;i++)if(states[i].food>states[i-1].food)
        meals.push({before:states[i-1],during:states[i]});
    const result={name:part.name,seed:part.seed,boundaries:out.screens.length,calls:out.calls.length,
        frames:out.frames.flat().length,hashes:hashes(out),states,meals,lines,
        effectMessages:lines.filter(l=>l.text.includes('Magic spreads')),
        mealSlices:meals.map(m=>({step:m.during.step,slices:out.slices.slice(Math.max(0,m.during.step-1),m.during.step+10)}))};
    if(keepOutput)result.output=out;
    return result;
}

export async function unobserved(part) {
    return outputs(await runSegment({...part,storage:new InMemoryStorage()}));
}
