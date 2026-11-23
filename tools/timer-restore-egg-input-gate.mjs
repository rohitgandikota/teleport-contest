// Read-only observations of the full-save-timer-order native input recipe.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { HATCH_EGG } from '../js/timeout.js';
import { OBJ_INVENT } from '../js/const.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/full-save-timer-order.json', import.meta.url)));
const storage = new InMemoryStorage();
for (const [index, part] of recipe.segments.entries()) {
    const states = [];
    globalThis.__step_snapshot = { step: '*', cb(g, step) {
        states.push({ step, moves: g.moves,
            queue: (g.timer_base || []).map(timer => ({ tid: timer.tid,
                action: timer.func_index, timeout: timer.timeout,
                species: timer.arg.corpsenm, linked: (g.invent || []).includes(timer.arg),
                fixup: timer.needs_fixup, timed: timer.arg.timed, where: timer.arg.where })),
            monsters: g.level.monsters.filter(mon => mon.mhp > 0)
                .map(mon => ({ id: mon.m_id, species: mon.mnum })).sort((a, b) => a.id - b.id),
            debug: [!!g.iflags.debug_hunger, !!g.iflags.debug_mongen] });
    }};
    let run;
    try { run = await runSegment({ ...part, storage }); }
    finally { delete globalThis.__step_snapshot; }

    const tied = states.find(state => state.moves === 159 && state.queue.length === 2);
    assert.ok(tied, 'exact pre-expiry tie reached');
    assert.equal(tied.monsters.length, 0);
    assert.deepEqual(tied.queue.map(timer => timer.timeout), [160, 160]);
    assert.deepEqual(tied.queue.map(timer => timer.action), [HATCH_EGG, HATCH_EGG]);
    assert.deepEqual(tied.queue.map(timer => timer.tid), index === 2 ? [1, 2] : [2, 1]);
    assert.deepEqual(tied.queue.map(timer => timer.species), index === 2
        ? [PMNAMES.PM_RED_DRAGON, PMNAMES.PM_BLUE_DRAGON]
        : [PMNAMES.PM_BLUE_DRAGON, PMNAMES.PM_RED_DRAGON]);
    for (const timer of tied.queue) {
        assert.equal(timer.linked, true);
        assert.equal(timer.fixup, 0);
        assert.equal(timer.timed, 1);
        assert.equal(timer.where, OBJ_INVENT);
    }
    if (index !== 1) {
        const final = states.at(-1);
        assert.equal(final.moves, 160);
        assert.deepEqual(final.queue, []);
        assert.deepEqual(final.monsters.map(mon => mon.species), index === 2
            ? [PMNAMES.PM_BABY_RED_DRAGON, PMNAMES.PM_BABY_BLUE_DRAGON]
            : [PMNAMES.PM_BABY_BLUE_DRAGON, PMNAMES.PM_BABY_RED_DRAGON]);
        assert.deepEqual(final.debug, [true, false]);
        const screens = run.getScreens().map(screen => decodeScreen(screen)
            .map(row => row.map(cell => cell.ch).join('')).join('\n'));
        assert.ok(screens.some(screen => screen.includes('You see a baby red dragon fly out of your pack!')));
        // Native restored boundaries show red; blue's hatch message is not captured there.
        if (index === 0) assert.ok(screens.some(screen =>
            screen.includes('You see a baby blue dragon fly out of your pack!')));
    }
    assert.equal(!!game.program_state_gameover, index === 1);
    console.log(JSON.stringify({ name: part.name, boundaries: run.getScreens().length,
        rngCalls: run.getRngLog().length, tied, final: states.at(-1) }));
}
