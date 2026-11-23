// Read-only observations of actual commands. No property or RNG injection.
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Hallucination, Halluc_resistance, Blind, Confusion, Stunned } from '../js/youprop.js';
import { is_safemon, canspotmon } from '../js/display.js';
import { waterbody_name } from '../js/pager.js';
import { ICE, MOAT, A_WIS } from '../js/const.js';

export async function observe(segment) {
    const states = [];
    const hooks = ['__step_snapshot', '__rng_trace_sites'];
    const previous = hooks.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    let run;
    try {
        globalThis.__rng_trace_sites = false;
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.level?.at || !g.youmonst?.data) return;
            globalThis.__rng_trace_sites = true;
            const hallucinating = !!Hallucination();
            const terrain = g.level.at(g.u.ux, g.u.uy).typ;
            states.push({step, moves:g.moves, x:g.u.ux, y:g.u.uy, terrain,
                timeout:g.u.intrinsic?.HHallucination || 0,
                alias:g.u.uprops?.HALLUC || 0, hallucinating,
                resistance:!!Halluc_resistance(),
                intrinsicResistance:g.u.intrinsic?.HHalluc_resistance || 0,
                extrinsicResistance:g.u.uprops?.HALLUC_RES || 0,
                confused:!!Confusion(), stunned:!!Stunned(), blind:!!Blind(),
                confusion:g.u.intrinsic?.HConfusion || 0, confusionAlias:g.u.uprops?.CONFUSION || 0,
                stun:g.u.intrinsic?.HStun || 0, stunAlias:g.u.uprops?.STUNNED || 0,
                formId:g.u.umonnum, armorType:g.u.uarm?.otyp ?? null,
                safeDog:g.flags.safe_dog !== false, confirm:g.flags.confirm !== false,
                forcefight:!!g.context.forcefight,
                sick:!!g.u.uprops?.SICK, vomiting:!!g.u.uprops?.VOMITING,
                fumbling:!!g.u.uprops?.FUMBLING, woundedLegs:!!g.u.intrinsic?.HWounded_legs,
                wisdomExercise:g.u.aexe?.a?.[A_WIS],
                // hliquid draws no RNG when canonical Hallucination is false.
                waterName:!hallucinating && (terrain === ICE || terrain === MOAT)
                    ? waterbody_name(g.u.ux, g.u.uy) : null,
                peaceful:g.level.monsters.filter(m => m.mpeaceful).map(m => ({
                    mnum:m.mnum, x:m.mx, y:m.my, hp:m.mhp,
                    actualSafe:is_safemon(m), visible:!!canspotmon(m),
                    expectedSafe:g.flags.safe_dog !== false && !!canspotmon(m)
                        && !Confusion() && !hallucinating && !Stunned()}))});
        }};
        run = await runSegment({...segment, storage:new InMemoryStorage()});
    } finally {
        for (const [i, key] of hooks.entries()) {
            if (previous[i]) Object.defineProperty(globalThis, key, previous[i]);
            else delete globalThis[key];
        }
    }
    assert.deepEqual(hooks.map(key => Object.getOwnPropertyDescriptor(globalThis, key)), previous);
    const screens = run.getScreens();
    const evidence = {boundaries:screens.length, rngCalls:run.getRngLog().length, states,
        messages:screens.map((s, step) => ({step, text:s.split('\n')[0]})).filter(r => r.text),
        rng:run.getRngSlices().flatMap((slice, step) => slice.filter(call =>
            / @js\/(attrib|read|fountain|uhitm|hack)\.js:/.test(call)).map(call => ({step, call}))),
        hooksRestored:true};
    return {run, evidence};
}
