#!/usr/bin/env node

// C apply.c:2398, potion.c:914 and timeout.c:932. Replay checks use C
// timer draws and visible timeout rows; source controls earn no C coverage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { FIG_TRANSFORM, nh_timeout } from '../js/timeout.js';
import { Detect_monsters } from '../js/youprop.js';
import { set_itimeout, incr_itimeout, peffects } from '../js/potion.js';
import { map_invisible, glyph_is_invisible_at } from '../js/display.js';
import { mksobj } from '../js/mkobj.js';
import { enableRngLog, getRngLog } from '../js/rng.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_INVENT, OBJ_MINVENT, OBJ_FLOOR, TIMEOUT, FROMOUTSIDE,
         I_SPECIAL } from '../js/const.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
let count = 0;
for (const name of ['figurine-perception', 'figurine-carriers',
                    'monster-detection-timeout']) {
    const input = read(`gen-sessions/recipes/${name}.json`);
    const oracle = read(`gen-sessions/generated/${name}.session.json`);
    for (const [i, segment] of input.segments.entries()) {
        const events = new Map(), owners = new Set();
        const menus = new Map();
        for (const [step, frame] of oracle.segments[i].steps.entries()) {
            if (frame.key !== '\r')
                continue;
            const row = decodeScreen(frame.screen)
                .find(r => / t - monster detection/.test(r));
            if (row)
                menus.set(step, Number(/\[(\d+)\]/.exec(row)?.[1] || 0));
        }
        let original, previousMove, checkedMenus = 0;
        globalThis.__step_snapshot = { step: '*', cb: (state, step) => {
            for (const timer of state.timer_base || []) {
                if (timer.func_index !== FIG_TRANSFORM)
                    continue;
                original ||= timer.arg;
                owners.add(timer.arg.where);
                if (!events.has(timer.tid))
                    events.set(timer.tid, { start: previousMove ?? state.moves,
                        timeout: timer.timeout });
            }
            if (menus.has(step)) {
                assert.equal((state.u.intrinsic?.HDetect_monsters | 0) & TIMEOUT,
                    menus.get(step), segment.name + ': C remaining timeout');
                checkedMenus++;
            }
            previousMove = state.moves;
        } };
        try {
            await runSegment({ ...segment, storage: new InMemoryStorage() });
        } finally {
            delete globalThis.__step_snapshot;
        }
        assert.equal(checkedMenus, menus.size);
        const rng = oracle.segments[i].steps.flatMap(t => t.rng || []);
        const draws = rng.filter(r => r.includes('attach_fig_transform_timeout'))
            .map(r => Number(/=(\d+)/.exec(r)[1]));
        assert.equal(events.size, draws.length);
        for (const [j, event] of [...events.values()].entries())
            assert.equal(event.timeout, event.start + draws[j] + 200,
                segment.name + ': C acquisition deadline');

        if (name.startsWith('figurine-')) {
            assert.ok(original);
            assert.equal(original.timed, 0);
            assert.ok(!game.invent.includes(original));
            assert.ok(!game.level.objects.includes(original));
            assert.ok(game.level.monsters.every(m =>
                !m.minvent?.includes(original)));
            assert.ok(!game.timer_base.some(t => t.func_index === FIG_TRANSFORM));
            assert.ok(owners.has(OBJ_INVENT));
            if (name === 'figurine-carriers') {
                assert.ok(owners.has(OBJ_MINVENT));
                assert.equal(owners.has(OBJ_FLOOR), segment.name.startsWith('floor-'));
                const carrier = game.level.monsters.find(m =>
                    m.mnum === PMNAMES.PM_WOOD_NYMPH);
                assert.equal(!!carrier, segment.name === 'minvent-unseen');
            }
            const species = name === 'figurine-carriers' ? PMNAMES.PM_KITTEN
                : [PMNAMES.PM_STALKER, PMNAMES.PM_SMALL_MIMIC, PMNAMES.PM_BAT,
                   PMNAMES.PM_GIANT_EEL, PMNAMES.PM_KITTEN, PMNAMES.PM_SNAKE][i];
            const monster = game.level.monsters.find(m => m.mnum === species);
            assert.ok(monster);
            assert.equal(monster.msleeping, 0);
            if (segment.name === 'named-kitten')
                assert.equal(monster.mgivenname, 'Keepsake');
            if (segment.name.startsWith('floor-'))
                assert.equal(Detect_monsters(), false,
                    'floor transformation follows C detection expiration');
        }
        count++;
    }
}

// Intrinsic source bits and temporary extrinsic detection must survive
// timeout updates independently (include/youprop.h:188-190).
const intr = game.u.intrinsic;
intr.HDetect_monsters = FROMOUTSIDE | 7;
incr_itimeout('HDetect_monsters', 3);
assert.equal(intr.HDetect_monsters, FROMOUTSIDE | 10);
set_itimeout('HDetect_monsters', 0);
assert.equal(intr.HDetect_monsters, FROMOUTSIDE);
assert.ok(Detect_monsters());
intr.HDetect_monsters = 1;
(game.u.uprops ||= {}).DETECT_MONSTERS = I_SPECIAL;
await nh_timeout();
assert.equal(intr.HDetect_monsters, 0);
assert.equal(game.u.uprops.DETECT_MONSTERS, I_SPECIAL);
assert.ok(Detect_monsters());
game.u.uprops.DETECT_MONSTERS = 0;
assert.equal(Detect_monsters(), false);

// The full potion effect uses the spell's shorter duration and clears stale
// invisible markers. This is a source control, not a recorded spell cast.
game._preNhgetchHook = null;
pushKeys(' '.repeat(40));
try {
    const spell = mksobj(ONAMES.SPE_DETECT_MONSTERS, false, false);
    spell.blessed = 1;
    const x = game.u.ux - 1, y = game.u.uy;
    map_invisible(x, y);
    assert.ok(glyph_is_invisible_at(x, y));
    enableRngLog();
    await peffects(spell);
    const draw = getRngLog().find(r => r.startsWith('rn2(40)='));
    assert.ok(draw);
    assert.equal(intr.HDetect_monsters, Number(/=(\d+)/.exec(draw)[1]) + 21);
    assert.equal(glyph_is_invisible_at(x, y), false);
} finally {
    resetInputState();
}
console.log(`figurine and detection state: PASS (${count} C replays plus source controls)`);
