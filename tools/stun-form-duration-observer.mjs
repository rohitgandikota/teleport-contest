// Observe ordinary input without changing properties, objects, RNG or captures.
import assert from 'node:assert/strict';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Stunned, Confusion, Flying, Hallucination} from '../js/youprop.js';
import {unfixable_trouble_count} from '../js/apply.js';
import {TIMEOUT} from '../js/const.js';

export async function observe(input) {
    const states = [];
    const hooks = ['__step_snapshot', '__rng_trace_sites'];
    const previous = hooks.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
    let run;
    try {
        globalThis.__rng_trace_sites = false;
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.level?.at || !g.youmonst?.data) return;
            globalThis.__rng_trace_sites = true;
            const intr = g.u.intrinsic || {}, props = g.u.uprops || {};
            states.push({step, moves:g.moves, x:g.u.ux, y:g.u.uy, form:g.u.umonnum,
                stun:intr.HStun || 0, stunTimer:(intr.HStun || 0) & TIMEOUT,
                stunAlias:props.STUNNED || 0, stunned:!!Stunned(),
                confusion:intr.HConfusion || 0, confusionAlias:props.CONFUSION || 0,
                pluralIntrinsicsPresent:Object.hasOwn(g.u, 'intrinsics'),
                confused:!!Confusion(), flying:!!Flying(), hallucinating:!!Hallucination(),
                vomiting:props.VOMITING || 0, unfixable:unfixable_trouble_count(false),
                hp:g.u.mh, maxHp:g.u.mhmax,
                nearby:[[-1,0], [1,0], [0,-1], [0,1]].map(([dx,dy]) => {
                    const loc = g.level.at(g.u.ux + dx, g.u.uy + dy);
                    return {x:g.u.ux + dx, y:g.u.uy + dy, typ:loc?.typ, seenv:loc?.seenv};
                }),
                objects:[...(g.invent || []), ...(g.level.objects || [])].map(o => ({
                    id:o.o_id, type:o.otyp, where:o.where, trapped:o.otrapped,
                    locked:o.olocked, invlet:o.invlet})),
            });
        }};
        run = await runSegment({...input, storage:new InMemoryStorage()});
    } finally {
        for (const [i, key] of hooks.entries()) {
            if (previous[i]) Object.defineProperty(globalThis, key, previous[i]);
            else delete globalThis[key];
        }
    }
    assert.deepEqual(hooks.map(k => Object.getOwnPropertyDescriptor(globalThis, k)), previous);
    return {run, evidence:{name:input.name, boundaries:run.getScreens().length,
        calls:run.getRngLog().length, states, hooksRestored:true,
        messages:run.getScreens().map((s, step) => ({step, text:s.split('\n')[0]})).filter(m => m.text),
        rng:run.getRngSlices().flatMap((slice, step) => slice.map(call => ({step, call})))}};
}
