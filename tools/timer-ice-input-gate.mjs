// Read-only observations of the timer-dispatch-ice-tie native input recipe.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { TIMER_OBJECT, ROT_CORPSE, MELT_ICE_AWAY } from '../js/timeout.js';
import { OBJ_FLOOR, ICE } from '../js/const.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/timer-dispatch-ice-tie.json', import.meta.url)));
const storage = new InMemoryStorage();
for (const [index, part] of recipe.segments.entries()) {
    const states = [];
    globalThis.__step_snapshot = { step: '*', cb(g, step) {
        const corpse = [...g.invent || [], ...g.level.objects]
            .find(obj => obj.otyp === ONAMES.CORPSE && obj.corpsenm === PMNAMES.PM_NEWT);
        states.push({ step, moves: g.moves, terrain: g.level.at(g.u.ux, g.u.uy).typ,
            queue: (g.timer_base || []).map(timer => ({ tid: timer.tid,
                action: timer.func_index, timeout: timer.timeout,
                linked: timer.kind !== TIMER_OBJECT || g.level.objects.includes(timer.arg),
                fixup: timer.needs_fixup,
                timed: timer.kind === TIMER_OBJECT ? timer.arg.timed : null })),
            corpse: corpse ? { id: corpse.o_id, age: corpse.age, ice: corpse.on_ice || 0,
                timed: corpse.timed, where: corpse.where } : null,
            monsters: g.level.monsters.filter(mon => mon.mhp > 0).length,
            debug: [!!g.iflags.debug_hunger, !!g.iflags.debug_mongen] });
    }};
    let run;
    try { run = await runSegment({ ...part, storage }); }
    finally { delete globalThis.__step_snapshot; }

    const tied = states.find(state => state.moves === 154 && state.queue.length === 2);
    assert.ok(tied, 'exact pre-expiry tie reached');
    assert.equal(tied.monsters, 0);
    assert.deepEqual(tied.queue.map(timer => timer.timeout), [337, 337]);
    assert.deepEqual(tied.queue.map(timer => timer.action), index === 2
        ? [MELT_ICE_AWAY, ROT_CORPSE] : [ROT_CORPSE, MELT_ICE_AWAY]);
    assert.deepEqual(tied.queue.map(timer => timer.tid), index === 2 ? [1, 3] : [3, 1]);
    assert.equal(tied.terrain, ICE);
    assert.deepEqual(tied.corpse, { id: 77, age: -145, ice: 1, timed: 1, where: OBJ_FLOOR });
    for (const timer of tied.queue) {
        assert.equal(timer.linked, true);
        assert.equal(timer.fixup, 0);
        if (timer.timed !== null) assert.equal(timer.timed, 1);
    }
    if (index !== 1) {
        assert.ok(states.some(state => state.moves === 336 && state.corpse));
        const final = states.at(-1);
        assert.equal(final.moves, 337);
        assert.deepEqual(final.queue, []);
        assert.deepEqual(final.debug, [true, true]);
        if (index === 0) assert.equal(final.corpse, null);
        else assert.deepEqual(final.corpse, { ...tied.corpse, timed: 0 });
        const screens = run.getScreens().map(screen => decodeScreen(screen)
            .map(row => row.map(cell => cell.ch).join('')).join('\n'));
        assert.ok(screens.some(screen => screen.includes('Some ice melts away.')));
        if (index === 2) assert.ok(screens.at(-1).includes('You see here a newt corpse.'));
    }
    assert.equal(!!game.program_state_gameover, index === 1);
    console.log(JSON.stringify({ name: part.name, boundaries: run.getScreens().length,
        rngCalls: run.getRngLog().length, tied, final: states.at(-1) }));
}
