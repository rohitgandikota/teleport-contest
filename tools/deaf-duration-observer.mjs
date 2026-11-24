// Observe actual input without modifying status, terrain, queues or RNG.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Deaf, Unaware} from '../js/youprop.js';
import {TIMEOUT, FROMEXPER, COLNO, ROWNO} from '../js/const.js';

export async function observeDuration(part) {
    const keys = ['__step_snapshot', '__rng_trace_sites'];
    const previous = keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
    const states = [], messages = [];
    let firstStormyMap;
    let run;
    try {
        globalThis.__rng_trace_sites = true;
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            const u = g.u;
            if (!u || !g.level) return;
            if (g.level.flags?.stormy && !firstStormyMap) {
                firstStormyMap = {x:u.ux, y:u.uy, cells:[]};
                for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++)
                    firstStormyMap.cells.push({x, y, typ:g.level.at(x, y)?.typ});
            }
            const raw = u.intrinsic?.HDeaf || 0;
            const text = g._toplines || '';
            if (text && messages.at(-1)?.text !== text) messages.push({step, text});
            states.push({step, moves:g.moves, x:u.ux, y:u.uy, level:{...u.uz},
                hdeaf:raw, timeout:raw & TIMEOUT, sourceBits:raw & ~TIMEOUT,
                fromExperience:!!(raw & FROMEXPER), deaf:!!Deaf(), unaware:!!Unaware(),
                conduct:!!u.uroleplay?.deaf, multi:g.multi, reason:g.multi_reason || '',
                terrain:g.level.at(u.ux, u.uy)?.typ, stormy:!!g.level.flags?.stormy,
                hp:u.uhp, mh:u.mh, mortality:u.umortality || 0,
                inventory:(g.invent || []).map(o => ({type:o.otyp, letter:o.invlet,
                    cursed:!!o.cursed, quantity:o.quan})), text});
        }};
        run = await runSegment({seed:part.seed, datetime:part.datetime,
            nethackrc:part.nethackrc, moves:part.moves, storage:new InMemoryStorage()});
    } finally {
        keys.forEach((k, i) => previous[i]
            ? Object.defineProperty(globalThis, k, previous[i]) : delete globalThis[k]);
    }
    assert.deepEqual(keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k)), previous);
    const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const evidence = {states, messages, boundaries:run.getScreens().length,
        calls:run.getRngLog().length, hooksRestored:true,
        animations:run.getAnimationFramesByStep().reduce((n, frames) => n + frames.length, 0),
        outputSHA256:{screens:digest(run.getScreens()), cursors:digest(run.getCursors()),
            rng:digest(run.getRngLog().map(call => call.replace(/\s*@.*$/, ''))),
            animations:digest(run.getAnimationFramesByStep())},
        firstStormyMap};
    return {run, evidence};
}
