import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const outputs = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    calls:run.getRngLog(), slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
export const hashes = out => Object.fromEntries(Object.entries(out).map(([k,v])=>[k,hash(v)]));
const item = o => ({id:o.o_id,type:o.otyp,letter:o.invlet,quantity:o.quan,corpse:o.corpsenm,
    worn:o.owornmask,cursed:o.cursed,where:o.where,spe:o.spe,carrier:o.ocarry?.m_id});
export async function observe(part, keepOutput = false) {
    const old=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[]; let previous,run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            if(!g.u || !g.level) return;
            const state={step,turn:g.moves,hero:[g.u.ux,g.u.uy],form:g.u.umonnum,
                hp:g.u.uhp,mh:g.u.mh,selected:g.m?.has_defense,item:g.m?.defensive?.o_id,
                inventory:(g.invent||[]).map(item),
                floor:(g.level.objects||[]).map(o=>({...item(o),x:o.ox,y:o.oy})),
                monsters:(g.level.monsters||[]).map(m=>({id:m.m_id,type:m.data?.pmidx,
                    x:m.mx,y:m.my,hp:m.mhp,max:m.mhpmax,conf:m.mconf,stun:m.mstun,
                    blind:!m.mcansee,peaceful:m.mpeaceful,flee:m.mflee,sleep:m.msleeping,
                    weapon:m.mw?.o_id,wear:m.misc_worn_check,inventory:(m.minvent||[]).map(item)}))};
            const sig=JSON.stringify({...state,step:0});
            if(sig!==previous)states.push(state);
            previous=sig;
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(old)Object.defineProperty(globalThis,'__step_snapshot',old);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),old);
    const out=outputs(run),lines=[];
    for(const [step,screen] of out.screens.entries()) {
        const text=decodeScreen(screen).slice(0,3).map(r=>r.map(renderCell).join('').trimEnd()).join('\n');
        if(text.trim() && text!==lines.at(-1)?.text)lines.push({step,text});
    }
    const result={name:part.name,seed:part.seed,states,lines,hashes:hashes(out),
        boundaries:out.screens.length,calls:out.calls.length,frames:out.frames.flat().length};
    if(keepOutput)result.output=out;
    return result;
}
export async function unobserved(part) {
    return outputs(await runSegment({...part,storage:new InMemoryStorage()}));
}
