// src/vision.c:512 vision_recalc, display.c:917 newsym, monmove.c:2198 set_apparxy.
// Constructed geometry, real status/form producers, and the ordinary RNG.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {game} from '../js/gstate.js';
import {set_uinwater} from '../js/hack.js';
import {make_blinded} from '../js/potion.js';
import {set_utrap} from '../js/trap.js';
import {set_levltyp} from '../js/mkmaze.js';
import {u_on_newpos} from '../js/teleport.js';
import {vision_reset, vision_recalc, couldsee, cansee} from '../js/vision.js';
import {newsym, clear_glyph_buffer, gbuf_at} from '../js/display.js';
import {makemon} from '../js/makemon.js';
import {set_apparxy} from '../js/monmove.js';
import {Blind, Underwater} from '../js/youprop.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES} from '../js/monst_data.js';
import {POOL, WATER, ICE, LAVAPOOL, ROOM, TT_PIT, FROMFORM,
    NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG} from '../js/const.js';
import {setup, form, seed, x, y} from './status-followup-test-setup.mjs';

async function submerge(id = PMNAMES.PM_GIANT_EEL) {
    form(id);
    set_levltyp(x, y, POOL);
    set_levltyp(x + 1, y, WATER);
    await set_uinwater(1);
    vision_reset(); vision_recalc();
    assert.equal(Underwater(), true);
}

for (const kind of ['eyeless form', 'timed blindness']) {
    test(`${kind} retains normal line of sight underwater without visible cells`, async () => {
        await setup();
        if (kind === 'timed blindness') await make_blinded(100, false);
        await submerge(kind === 'eyeless form' ? PMNAMES.PM_WATER_ELEMENTAL : PMNAMES.PM_GIANT_EEL);
        assert.equal(Blind(), true);
        if (kind === 'eyeless form') assert.ok(game.u.intrinsic.HBlinded & FROMFORM);
        assert.ok(couldsee(x, y + 1), 'adjacent dry floor remains in geometric line of sight');
        assert.ok(couldsee(x, y + 3), 'blind geometry is not the underwater three by three mask');
        assert.equal(!!couldsee(x + 3, y), false, 'the water wall still blocks ordinary line of sight');
        assert.equal(!!cansee(x, y + 1), false);
    });
}

test('sighted underwater hero keeps the adjacent water mask', async () => {
    await setup(); await submerge();
    assert.equal(Blind(), false);
    assert.ok(couldsee(x + 1, y));
    assert.equal(!!couldsee(x, y + 1), false);
    assert.equal(!!couldsee(x + 3, y), false);
});

for (const blind of [false, true]) {
    test(`${blind ? 'blind' : 'sighted'} pit uses the C priority relative to the pit mask`, async () => {
        await setup();
        set_utrap(10, TT_PIT);
        if (blind) await make_blinded(100, false);
        vision_reset(); vision_recalc();
        assert.equal(!!couldsee(x + 3, y), blind);
        assert.equal(!!cansee(x + 3, y), false);
    });
}

test('monster accepts the first adjacent dry-floor target for a blind underwater hero', async () => {
    await setup();
    u_on_newpos(x + 1, y);
    const mon = await makemon(game.mons[PMNAMES.PM_KOBOLD], x + 3, y,
        NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG);
    assert.ok(mon);
    set_apparxy(mon);
    assert.deepEqual([mon.mux, mon.muy], [x + 1, y]);
    u_on_newpos(x, y);
    await submerge(PMNAMES.PM_WATER_ELEMENTAL);
    seed(7); // Ordinary ISAAC seed: its first two rn2(3) results are 1, 2.
    set_apparxy(mon);
    assert.deepEqual([mon.mux, mon.muy], [x, y + 1]);
    assert.deepEqual(getRngLog(), ['rn2(3)=1', 'rn2(3)=2']);
});

test('newsym suppresses the transient underwater hero on dry floor before terrain exit', async () => {
    await setup(); await submerge(PMNAMES.PM_WATER_ELEMENTAL);
    set_levltyp(x, y, ROOM);
    clear_glyph_buffer();
    const before = structuredClone(gbuf_at(x, y));
    newsym(x, y);
    assert.deepEqual(gbuf_at(x, y), before);
    assert.equal(Underwater(), true);
});

for (const [label, dx, dy, terrain, draws] of [
    ['adjacent dry floor', 0, 1, ROOM, false],
    ['distant pool', 3, 0, POOL, false],
    ['adjacent pool', 1, 0, POOL, true],
    ['adjacent water', 1, 0, WATER, true],
    ['adjacent ice', 1, 0, ICE, true],
    ['adjacent lava', 1, 0, LAVAPOOL, true],
]) {
    test(`newsym ${draws ? 'retains' : 'suppresses'} ${label} while underwater`, async () => {
        await setup(); set_levltyp(x + dx, y + dy, terrain);
        // Establish legitimate remembered terrain before the underwater mask.
        vision_reset(); vision_recalc(); newsym(x + dx, y + dy);
        await submerge();
        set_levltyp(x + dx, y + dy, terrain);
        clear_glyph_buffer();
        const before = structuredClone(gbuf_at(x + dx, y + dy));
        newsym(x + dx, y + dy);
        if (draws) assert.notDeepEqual(gbuf_at(x + dx, y + dy), before);
        else assert.deepEqual(gbuf_at(x + dx, y + dy), before);
    });
}

test('ordinary dry hero redraw remains enabled', async () => {
    await setup(); clear_glyph_buffer();
    const before = structuredClone(gbuf_at(x, y));
    newsym(x, y);
    assert.notDeepEqual(gbuf_at(x, y), before);
});
