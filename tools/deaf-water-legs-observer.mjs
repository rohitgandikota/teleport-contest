// Observe ordinary input only. Do not change properties, terrain, queues or RNG.
import assert from 'node:assert/strict';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Deaf, Underwater, Wounded_legs, Flying, Levitation,
    Confusion, Stunned, Breathless, Amphibious} from '../js/youprop.js';
import {A_DEX, TIMEOUT} from '../js/const.js';

export async function observe(input) {
    const states = [];
    const hooks = ['__step_snapshot', '__rng_trace_sites'];
    const previous = hooks.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    let run;
    try {
        globalThis.__rng_trace_sites = false;
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.level?.at || !g.youmonst?.data) return;
            globalThis.__rng_trace_sites = true;
            const u = g.u, intr = u.intrinsic || {};
            states.push({step, moves:g.moves, x:u.ux, y:u.uy, form:u.umonnum,
                terrain:g.level.at(u.ux, u.uy).typ,
                deaf:!!Deaf(), hdeaf:intr.HDeaf || 0, edeaf:u.uprops?.DEAF || 0,
                deafConduct:!!u.uroleplay?.deaf, underwater:!!Underwater(),
                underwaterFlatPresent:Object.hasOwn(u.uprops || {}, 'UNDERWATER'),
                flying:!!Flying(), levitating:!!Levitation(),
                blockedFlying:u.blocked?.FLYING || 0,
                blockedLevitation:u.blocked?.LEVITATION || 0,
                breathless:!!Breathless(), amphibious:!!Amphibious(),
                confused:!!Confusion(), stunned:!!Stunned(),
                wounded:!!Wounded_legs(), hwounded:intr.HWounded_legs || 0,
                woundTimer:(intr.HWounded_legs || 0) & TIMEOUT,
                ewounded:u.EWounded_legs || 0, dexTemp:u.atemp.a[A_DEX],
                woundFlat:u.uprops?.WOUNDED_LEGS || 0,
                woundWizardTimer:u.wiz_intrinsic_timeouts?.WOUNDED_LEGS || 0,
                mounted:!!u.usteed, hp:u.uhp, mh:u.mh,
                nearby:[[-1,0], [1,0], [0,-1], [0,1]].map(([dx,dy]) => {
                    const loc = g.level.at(u.ux + dx, u.uy + dy);
                    return {x:u.ux + dx, y:u.uy + dy, typ:loc?.typ, seenv:loc?.seenv};
                }),
                inventory:(g.invent || []).map(o => ({type:o.otyp, invlet:o.invlet,
                    quantity:o.quan, cursed:!!o.cursed, blessed:!!o.blessed})),
                floor:g.level.objectsAt(u.ux, u.uy).map(o => ({type:o.otyp, quantity:o.quan})),
            });
        }};
        run = await runSegment({...input, storage:new InMemoryStorage()});
    } finally {
        for (const [i, key] of hooks.entries()) {
            if (previous[i]) Object.defineProperty(globalThis, key, previous[i]);
            else delete globalThis[key];
        }
    }
    assert.deepEqual(hooks.map(key => Object.getOwnPropertyDescriptor(globalThis, key)), previous);
    return {run, evidence:{name:input.name, boundaries:run.getScreens().length,
        calls:run.getRngLog().length,
        animations:run.getAnimationFramesByStep().reduce((n, frames) => n + frames.length, 0),
        states, hooksRestored:true,
        messages:run.getScreens().map((screen, step) => ({step, text:screen.split('\n')[0]}))
            .filter(m => m.text),
        rng:run.getRngSlices().flatMap((slice, step) => slice.map(call => ({step, call})))}};
}
