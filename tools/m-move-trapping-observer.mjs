import assert from 'node:assert/strict';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {getRngLog, rngLogLength} from '../js/rng.js';

// Existing read-only hooks only. No replacement trap function or runtime loader.
export async function observeTrapping(part) {
    const keys = ['__step_snapshot', '__rng_probe_at', '__rng_trace_sites'];
    const previous = keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
    const stackLimit = Error.stackTraceLimit;
    const states = [], trapCalls = [];
    const monsters = () => (game.level?.monsters || []).map(m => ({
        id:m.m_id, type:m.mnum, dataIndex:m.data?.pmidx,
        x:m.mx, y:m.my, hp:m.mhp, trapped:!!m.mtrapped,
        trap:(game.level.traps || []).find(t => t.tx === m.mx && t.ty === m.my)?.ttyp,
    }));
    let run;
    try {
        Error.stackTraceLimit = 30;
        globalThis.__rng_trace_sites = true;
        globalThis.__rng_probe_at = {
            get at() { return rngLogLength() - 1; },
            cb(index) {
                const stack = new Error().stack;
                if (!/at (?:async )?mintrap \(/.test(stack)) return;
                const arrival = /at (?:async )?postmov \(/.test(stack);
                trapCalls.push({index, call:getRngLog()[index], arrival,
                    initial:!arrival && /at (?:async )?m_move \(/.test(stack),
                    monsters:monsters(), stack});
            },
        };
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, moves:g.moves, hero:[g.u.ux, g.u.uy],
                text:g._toplines || '', monsters:monsters()});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        Error.stackTraceLimit = stackLimit;
        keys.forEach((k, i) => previous[i]
            ? Object.defineProperty(globalThis, k, previous[i]) : delete globalThis[k]);
    }
    assert.deepEqual(keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k)), previous);
    assert.equal(Error.stackTraceLimit, stackLimit);
    return {states, trapCalls, hooksRestored:true,
        boundaries:run.getScreens().length, calls:run.getRngLog().length,
        animations:run.getAnimationFramesByStep().reduce((n, a) => n + a.length, 0)};
}
