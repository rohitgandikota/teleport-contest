// Source-derived feedback controls through public mintrap and real producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, clearMessages, messages, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {maketrap} from '../js/mklev.js';
import {mintrap, Trap_Is_Gone, Trap_Effect_Finished} from '../js/trap.js';
import {make_blinded} from '../js/potion.js';
import {mon_set_minvis} from '../js/worn.js';
import {canseemon, pline} from '../js/display.js';
import {cansee} from '../js/vision.js';
import {set_msg_xy} from '../js/pline.js';
import {christen_monst, mon_nam} from '../js/do_name.js';
import {resists_fire} from '../js/mondata.js';
import {rn2, d, getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function monster(type, species = P.PM_LARGE_CAT) {
    await setup();
    const mon = await makemon(game.mons[species], x + 1, y,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    mon.mhp = mon.mhpmax = 200; // Constructed nonlethal boundary, not a native setup.
    assert.equal((mon.minvent || []).length, 0);
    const trap = await maketrap(mon.mx, mon.my, type);
    trap.madeby_u = 0;
    game.iflags.getpos_coords = C.GPCOORDS_NONE;
    clearMessages();
    return {mon, trap};
}

function depletionSeed() {
    for (let value = 1; value <= 100; value++) {
        seed(value);
        if (rn2(15) === 0) return value;
    }
    assert.fail('no depletion seed in bounded search');
}

for (const [accessible, blind, invisible] of [
    [true, false, false], [false, false, false], [true, true, false], [true, false, true],
])
test(`depleted rock: accessible=${accessible}, blind=${blind}, invisible=${invisible}`, async () => {
    const {mon, trap} = await monster(C.ROCKTRAP);
    trap.once = trap.tseen = 1;
    game.flags.accessiblemsg = accessible;
    if (invisible) mon_set_minvis(mon, false);
    if (blind) await make_blinded(10, false);
    seed(depletionSeed()); clearMessages();
    assert.equal(await mintrap(mon, C.FORCETRAP), Trap_Is_Gone);
    assert.deepEqual(getRngLog(), ['rn2(15)=0']);
    assert.equal(mon.mhp, 200);
    assert.ok(!game.level.traps.includes(trap));
    if (blind || invisible) assert.equal(messages().trim(), '');
    else {
        const text = 'A trap door above the large cat opens, but nothing falls out!';
        assert.ok(messages().includes(text));
        assert.equal(messages().includes('(east): ' + text), accessible);
        assert.deepEqual(game.a11y.msg_loc, {x: 0, y: 0});
    }
});

for (const [once, seen] of [[0, 1], [1, 0]])
test(`rock depletion guards: once=${once}, seen=${seen}`, async () => {
    const {mon, trap} = await monster(C.ROCKTRAP, P.PM_XORN);
    trap.once = once; trap.tseen = seen;
    seed(depletionSeed()); clearMessages();
    assert.equal(await mintrap(mon, C.FORCETRAP), Trap_Effect_Finished);
    assert.ok(!getRngLog().some(call => call.startsWith('rn2(15)')));
    assert.ok(game.level.traps.includes(trap));
    assert.equal(mon.mhp, 200);
    assert.equal(game.level.objectsAt(mon.mx, mon.my).filter(o => o.otyp === O.ROCK).length, 1);
    assert.ok(!messages().includes('nothing falls out'));
});

// C trap.c:1744-1812: damage, nonresistant max-HP loss, then burnarmor.
// Empty monster inventory means burnarmor retries empty slots until torso,
// which returns true and short-circuits the caller's rn2(3). destroy_items
// still spends its limit-rounding draw before finding the empty inventory.
function fireDraws(value, resistant, magic = false) {
    seed(value);
    if (magic) assert.equal(rn2(21), 0);
    const damage = d(2, 4);
    const maxLoss = resistant ? 0 : rn2(damage + 1);
    while (rn2(5) !== 1) { /* empty armor slots */ }
    rn2(5); // C destroy_items: DMG_DESTROY_SCALE, even with no carried items.
    return {damage, maxLoss, calls: [...getRngLog()]};
}

async function fireCase({accessible, invisible = false, blind = false,
    resistant = false, stale = false, named = false, magic = false}) {
    const {mon, trap} = await monster(magic ? C.MAGIC_TRAP : C.FIRE_TRAP,
        resistant ? P.PM_RED_DRAGON : P.PM_LARGE_CAT);
    game.flags.accessiblemsg = accessible;
    if (invisible) mon_set_minvis(mon, false);
    if (blind) await make_blinded(10, false);
    if (named) christen_monst(mon, 'Elsie');
    assert.equal(resists_fire(mon), resistant);
    assert.equal(canseemon(mon), !blind && !invisible);
    assert.equal(cansee(mon.mx, mon.my), !blind);
    const name = mon_nam(mon);
    let value = 2;
    if (magic) {
        for (value = 1; value <= 100; value++) {
            seed(value); if (rn2(21) === 0) break;
        }
        assert.ok(value <= 100);
    }
    const expected = fireDraws(value, resistant, magic);
    seed(value); clearMessages();
    if (stale) set_msg_xy(x - 1, y);
    assert.equal(await mintrap(mon, C.FORCETRAP), Trap_Effect_Finished);
    assert.deepEqual(getRngLog(), expected.calls);
    assert.equal(mon.mhp, resistant ? 200 : 200 - expected.damage);
    assert.equal(mon.mhpmax, 200 - expected.maxLoss);
    assert.ok(game.level.traps.includes(trap));
    const text = invisible ? 'You see a tower of flame erupt from the floor!'
        : `A tower of flame erupts from the floor under ${name}!`;
    if (blind) assert.ok(!messages().includes('tower of flame'));
    else {
        assert.ok(messages().includes(text));
        assert.equal(messages().includes('(east): ' + text), accessible);
        assert.ok(!messages().includes('(west):'));
        assert.deepEqual(game.a11y.msg_loc, {x: 0, y: 0});
    }
    if (resistant && !blind && !invisible) {
        assert.ok(messages().includes('The red dragon is uninjured.'));
        assert.ok(!messages().includes('(east): The red dragon is uninjured.'));
    }
    clearMessages();
    await pline('A later message.');
    assert.equal(messages().trim(), 'A later message.');
}

for (const accessible of [false, true])
for (const [invisible, blind] of [[false, false], [true, false], [false, true]])
test(`fire location: accessible=${accessible}, invisible=${invisible}, blind=${blind}`,
    () => fireCase({accessible, invisible, blind}));

for (const accessible of [false, true])
test(`resistant fire: accessible=${accessible}, next message has no location`,
    () => fireCase({accessible, resistant: true}));

for (const accessible of [false, true])
test(`magic-trap fire dispatch: accessible=${accessible}`,
    () => fireCase({accessible, magic: true}));

for (const invisible of [false, true])
test(`fire replaces stale location: invisible=${invisible}`,
    () => fireCase({accessible: true, invisible, stale: true}));

test('named monster uses existing mon_nam before the location wrapper',
    () => fireCase({accessible: true, named: true}));
