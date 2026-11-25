import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';

export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const outputs = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    calls:run.getRngLog(), slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
export const hashes = result => Object.fromEntries(Object.entries(result).map(([k,v]) => [k,hash(v)]));
export async function unobserved(part) {
    return outputs(await runSegment({...part, storage:new InMemoryStorage()}));
}
export async function observe(part, keepOutput = false) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let signature, run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level) return;
            const state = {step, turn:g.moves, hero:[g.u.ux,g.u.uy], form:g.u.umonnum,
                hp:g.u.uhp, mh:g.u.mh, intelligence:g.u.acurr?.a?.[1], stuck:g.u.ustuck?.m_id,
                accessible:g.flags.accessiblemsg, coordinates:g.iflags.getpos_coords,
                cloak:g.u.uarmc?.o_id, armor:g.u.uarm?.o_id, shirt:g.u.uarmu?.o_id,
                helmet:g.u.uarmh?.o_id, multi:g.multi,
                inventory:(g.invent || []).map(o => ({id:o.o_id,type:o.otyp,letter:o.invlet,
                    where:o.where,worn:o.owornmask,greased:o.greased,cursed:o.cursed,
                    spe:o.spe,known:o.known,dknown:o.dknown,typeKnown:g.objects[o.otyp]?.oc_name_known})),
                monsters:(g.level.monsters || []).map(m => ({id:m.m_id,type:m.data?.pmidx,
                    x:m.mx,y:m.my,hp:m.mhp,peaceful:m.mpeaceful}))};
            const next = JSON.stringify({...state, step:0});
            if (next !== signature) states.push(state);
            signature = next;
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output = outputs(run), lines = [];
    for (const [step, screen] of output.screens.entries()) {
        const text = decodeScreen(screen).slice(0,3)
            .map(row => row.map(renderCell).join('').trimEnd()).join('\n');
        if (text.trim() && text !== lines.at(-1)?.text) lines.push({step,text});
    }
    const result = {name:part.name, states, lines, hashes:hashes(output),
        boundaries:output.screens.length, calls:output.calls.length, frames:output.frames.flat().length};
    if (keepOutput) result.output = output;
    return result;
}
