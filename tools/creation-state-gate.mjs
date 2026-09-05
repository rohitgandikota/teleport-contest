#!/usr/bin/env node

// C makemon.c:1472-1506 and apply.c:2398. C replays check timer ownership,
// group disposition and occupation boundaries. Source controls earn no C credit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { makemon } from '../js/makemon.js';
import { mongone } from '../js/mon.js';
import { canspotmon } from '../js/display.js';
import { set_occupation } from '../js/allmain.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { FIG_TRANSFORM } from '../js/timeout.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_INVENT, OBJ_MINVENT, MM_NOGRP, MM_NOMSG, MM_MINVIS,
         NO_MINVENT } from '../js/const.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
let count = 0;
for (const name of ['creation-carriers', 'creation-groups', 'creation-occupation']) {
    const input = read(`gen-sessions/recipes/${name}.json`);
    const oracle = read(`gen-sessions/generated/${name}.session.json`);
    for (const [i, segment] of input.segments.entries()) {
        const events = new Map(), owners = new Set();
        let original, previousMove, checkedBirth = false;
        const birth = oracle.segments[i].steps.findIndex(t =>
            t.rng?.some(r => r.includes('make_familiar')));
        globalThis.__step_snapshot = { step: '*', cb: (state, step) => {
            for (const timer of state.timer_base || []) {
                if (timer.func_index !== FIG_TRANSFORM) continue;
                original ||= timer.arg;
                owners.add(timer.arg.where);
                if (!events.has(timer.tid))
                    events.set(timer.tid, { start: previousMove ?? state.moves,
                        timeout: timer.timeout });
            }
            if (name === 'creation-occupation' && step === birth) {
                assert.equal(!!state.occupation, segment.name === 'stalker',
                    segment.name + ': C creation interruption boundary');
                checkedBirth = true;
            }
            previousMove = state.moves;
        } };
        try {
            await runSegment({ ...segment, storage: new InMemoryStorage() });
        } finally {
            delete globalThis.__step_snapshot;
        }
        const rng = oracle.segments[i].steps.flatMap(t => t.rng || []);
        const draws = rng.filter(r => r.includes('attach_fig_transform_timeout'))
            .map(r => Number(/=(\d+)/.exec(r)[1]));
        assert.equal(events.size, draws.length);
        for (const [j, event] of [...events.values()].entries())
            assert.equal(event.timeout, event.start + draws[j] + 200,
                segment.name + ': C acquisition deadline');

        if (name === 'creation-groups') {
            const bag = game.invent.find(o => o.otyp === ONAMES.BAG_OF_TRICKS);
            assert.ok(bag);
            assert.equal(bag.spe, 0);
            assert.ok(bag.cknown);
            if (i !== 1) {
                const species = i === 0 ? PMNAMES.PM_GRID_BUG : PMNAMES.PM_JACKAL;
                const group = game.level.monsters.filter(m => m.mnum === species);
                assert.ok(group.length >= 2);
                assert.ok(group.every(m => !m.mpeaceful && !m.mavenge));
            }
        } else {
            assert.ok(original);
            assert.equal(original.timed, 0);
            assert.ok(!game.invent.includes(original));
            assert.ok(game.level.monsters.every(m => !m.minvent?.includes(original)));
            assert.ok(!game.timer_base.some(t => t.func_index === FIG_TRANSFORM));
            assert.ok(owners.has(OBJ_INVENT));
            assert.equal(owners.has(OBJ_MINVENT), name === 'creation-carriers');
            if (name === 'creation-carriers') {
                const carrier = game.level.monsters.find(m => m.mnum === PMNAMES.PM_WOOD_NYMPH);
                assert.ok(carrier);
                assert.equal(!!carrier.minvis, segment.name.startsWith('invisible-'));
                assert.ok(game.level.monsters.some(m => m.mnum === PMNAMES.PM_KITTEN));
            } else {
                assert.ok(checkedBirth);
                const species = [PMNAMES.PM_KITTEN, PMNAMES.PM_BAT,
                    PMNAMES.PM_STALKER, PMNAMES.PM_SMALL_MIMIC][i];
                const monster = game.level.monsters.find(m => m.mnum === species);
                assert.ok(monster);
                if (segment.name === 'named-kitten')
                    assert.equal(monster.mgivenname, 'Keepsake');
            }
        }
        count++;
    }
}

// Level generation completes synchronously and never runs the occupation
// tail. At runtime MM_NOMSG suppresses the arrival, not the threat check.
const base = read('gen-sessions/recipes/creation-groups.json').segments[0];
await runSegment({ ...base, moves: base.moves.slice(0,
    base.moves.indexOf('\x17blessed bag')), storage: new InMemoryStorage() });
game._preNhgetchHook = null;
game.iflags.debug_mongen = false;
pushKeys(' '.repeat(40));
try {
    set_occupation(async () => 1, 'searching', false);
    const occupation = game.occupation;
    game.in_mklev = true;
    const generated = makemon(game.mons[PMNAMES.PM_GOBLIN], 0, 0, MM_NOGRP | MM_NOMSG);
    assert.ok(generated && !(generated instanceof Promise));
    assert.equal(game.occupation, occupation);
    assert.ok((generated.minvent || []).every(o => o.where === OBJ_MINVENT));
    mongone(generated);
    game.in_mklev = false;

    const visible = await makemon(game.mons[PMNAMES.PM_GOBLIN], game.u.ux, game.u.uy,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(visible && canspotmon(visible));
    assert.equal(game.occupation, null);
    mongone(visible);

    set_occupation(async () => 1, 'searching', false);
    const unseenOccupation = game.occupation;
    const unseen = await makemon(game.mons[PMNAMES.PM_GOBLIN], game.u.ux, game.u.uy,
        MM_NOGRP | MM_NOMSG | MM_MINVIS | NO_MINVENT);
    assert.ok(unseen && !canspotmon(unseen));
    assert.equal(game.occupation, unseenOccupation);
} finally {
    game.in_mklev = false;
    game.occupation = null;
    resetInputState();
}
console.log(`monster creation state: PASS (${count} C replays plus source controls)`);
