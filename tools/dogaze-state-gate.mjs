// C polyself.c:1642-1774. Actual polymorph, monster creation and gaze owners.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, clearMessages, messages, seed, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {polymon, dogaze} from '../js/polyself.js';
import {domonability} from '../js/cmd.js';
import {makemon} from '../js/makemon.js';
import {tamedog} from '../js/dog.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {Amulet_on, Ring_on} from '../js/do_wear.js';
import {setworn} from '../js/worn.js';
import {delayed_killer, find_delayed_killer} from '../js/end.js';
import {make_blinded, make_hallucinated, make_confused} from '../js/potion.js';
import {Blind, Hallucination, Free_action, Stone_resistance, Detect_monsters} from '../js/youprop.js';
import {canseemon} from '../js/display.js';
import {couldsee, vision_reset, vision_recalc} from '../js/vision.js';
import {helpless, haseyes, perceives} from '../js/mondata.js';
import {rn2, d, getRngLog} from '../js/rng.js';
import {PMNAMES as P, mons as initialMons} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {ECMD_OK, ECMD_TIME, NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG,
    FROMOUTSIDE, W_RINGL, M_AP_OBJECT} from '../js/const.js';

async function prepare(form = P.PM_UMBER_HULK) {
    const run = await setup();
    let reads = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++reads < 100, 'bounded actual message/prompt completion');
        return 32;
    };
    assert.equal(await polymon(form), 1);
    game.u.ulevel = 10;
    game.u.uen = 80;
    game.flags.safe_dog = false;
    game.flags.confirm = false;
    game.multi = 0;
    vision_reset(); vision_recalc();
    clearMessages(); seed(19);
    return run;
}
async function monster(id = P.PM_FLOATING_EYE, dx = 1) {
    const mon = await makemon(game.mons[id], x + dx, y,
        NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG);
    assert.ok(mon);
    assert.equal(mon.data, game.mons[id]);
    assert.notEqual(mon.data, initialMons[id]);
    assert.ok(canseemon(mon) && couldsee(mon.mx, mon.my));
    mon.mpeaceful = 0;
    mon.msleeping = 0;
    clearMessages(); seed(19);
    return mon;
}
async function lifesaver() {
    const obj = await addinv(mksobj(O.AMULET_OF_LIFE_SAVING, false, false));
    await Amulet_on(obj);
    assert.equal(game.u.uamul, obj);
    assert.ok(game.u.uprops.LIFESAVED);
    return obj;
}
const calls = () => getRngLog().map(s => s.replace(/\s*@\s.*$/, ''));
function receipt(name, mon, result) {
    console.log('STATE_RECEIPT ' + JSON.stringify({name, result, multi:game.multi,
        energy:game.u.uen, confused:mon?.mconf || 0, mortality:game.u.umortality || 0,
        rng:calls(), text:messages()}));
}

for (const [label, level, rngSeed] of [['high-level',10,19], ['low-level',1,19], ['long-freeze',1,5]]) {
    test(`floating-eye ${label} keeps C short-circuit and dice order`, async () => {
        await prepare(); const mon = await monster(); game.u.ulevel = level;
        seed(rngSeed);
        const roll = level > 6 ? true : rn2(4);
        const expected = roll ? -d(mon.m_lev + 1, mon.data.mattk[0][3]) : -200;
        const expectedCalls = calls();
        seed(rngSeed);
        const result = await dogaze(); receipt(label, mon, result);
        assert.equal(result, ECMD_TIME); assert.equal(game.u.uen, 65);
        assert.equal(mon.mconf, 1); assert.equal(game.multi, expected);
        assert.equal(game.multi_reason, "frozen by a monster's gaze");
        assert.equal(game.nomovemsg, null); assert.deepEqual(calls(), expectedCalls);
        assert.match(messages(), /You are frozen by the floating eye's gaze!/);
        if (label === 'high-level') assert.equal(expectedCalls.length, 1);
        if (label === 'long-freeze') assert.equal(roll, 0, 'fixed control selects C -200 arm');
    });
}

test('floating-eye paralysis returns before the next live monster', async () => {
    await prepare(); const later = await monster(P.PM_NEWT, 2); const eye = await monster();
    assert.equal(game.level.monsters[0], eye);
    assert.equal(await domonability(), ECMD_TIME);
    assert.equal(eye.mconf, 1); assert.ok(game.multi < 0); assert.ok(!later.mconf);
});
test('real free-action ring emits stiffness and continues to the next monster', async () => {
    await prepare();
    const ring = await addinv(mksobj(O.RIN_FREE_ACTION, false, false));
    await setworn(ring, W_RINGL); await Ring_on(ring);
    assert.equal(Free_action(), true);
    const later = await monster(P.PM_NEWT, 2); const eye = await monster();
    assert.equal(await dogaze(), ECMD_TIME);
    assert.equal(game.multi, 0); assert.equal(eye.mconf, 1); assert.equal(later.mconf, 1);
    assert.match(messages(), /stiffen momentarily under the floating eye's gaze/);
    assert.deepEqual(calls(), []);
});

for (const [label, change] of [
    ['cancelled', m => { m.mcan = 1; }],
    ['sleeping', m => { m.msleeping = 1; }],
    ['paralyzed', m => { m.mcanmove = 0; }],
    ['stunned', m => { m.mstun = 1; }],
    ['blind', m => { m.mcansee = 0; }],
    ['dead', m => { m.mhp = 0; }]
]) test(`floating-eye ${label} control does not paralyze`, async () => {
    await prepare(); const mon = await monster(); change(mon);
    if (label === 'sleeping' || label === 'paralyzed') assert.ok(helpless(mon));
    const result = await dogaze(); receipt(label, mon, result);
    assert.equal(result, ECMD_TIME); assert.equal(game.multi, 0); assert.equal(game.u.uen, 65);
    assert.equal(!!mon.mconf, label === 'cancelled');
    assert.doesNotMatch(messages(), /frozen by|stiffen momentarily/);
    assert.deepEqual(calls(), []);
});

test('ordinary live newt is confused without a counter-gaze', async () => {
    await prepare(); const mon = await monster(P.PM_NEWT);
    assert.equal(await dogaze(), ECMD_TIME); assert.equal(mon.mconf, 1);
    assert.equal(game.multi, 0); assert.deepEqual(calls(), []);
});
test('eyeless monster is skipped after the real anger helper', async () => {
    await prepare(); const mon = await monster(P.PM_ACID_BLOB);
    assert.equal(haseyes(mon.data), false);
    assert.equal(await dogaze(), ECMD_TIME); assert.ok(!mon.mconf);
    assert.match(messages(), /gaze at no place in particular/);
});
test('object disguise is skipped without confusion or counter-gaze', async () => {
    await prepare(); const mon = await monster(); mon.m_ap_type = M_AP_OBJECT;
    assert.equal(await dogaze(), ECMD_TIME); assert.ok(!mon.mconf);
    assert.equal(game.multi, 0); assert.match(messages(), /gaze at no place in particular/);
});

for (const status of ['blind','hallucinating','both']) test(`hero ${status} exits before spending energy`, async () => {
    await prepare(); const eye = await monster();
    if (status !== 'blind') await make_hallucinated(50, false);
    if (status !== 'hallucinating') await make_blinded(50, false);
    assert.equal(Blind(), status !== 'hallucinating');
    assert.equal(Hallucination(), status !== 'blind');
    clearMessages(); seed(19);
    assert.equal(await dogaze(), ECMD_OK); assert.equal(game.u.uen, 80);
    assert.ok(!eye.mconf); assert.equal(game.multi, 0); assert.deepEqual(calls(), []);
    assert.match(messages(), status === 'hallucinating'
        ? /can't gaze at anything you can see/ : /can't see anything to gaze at/);
});
test('insufficient energy exits before looking at a real eye', async () => {
    await prepare(); const eye = await monster(); game.u.uen = 14;
    assert.equal(await dogaze(), ECMD_OK); assert.equal(game.u.uen, 14); assert.ok(!eye.mconf);
    assert.match(messages(), /lack the energy/); assert.deepEqual(calls(), []);
});
test('an unseen eye is outside the gaze loop even with monster detection', async () => {
    await prepare(P.PM_PYROLISK); const eye = await monster(); eye.minvis = 1;
    game.u.intrinsic.HDetect_monsters = FROMOUTSIDE;
    assert.equal(Detect_monsters(), true);
    assert.equal(canseemon(eye), false);
    assert.equal(await dogaze(), ECMD_TIME); assert.equal(game.multi, 0); assert.ok(!eye.mconf);
    assert.match(messages(), /gaze at no place in particular/);
});
test('invisible hero is not noticed by an eye that cannot perceive invisibility', async () => {
    await prepare(); const eye = await monster(); game.u.intrinsic.HInvis = FROMOUTSIDE;
    assert.equal(perceives(eye.data), false);
    assert.equal(await dogaze(), ECMD_TIME); assert.ok(!eye.mconf); assert.equal(game.multi, 0);
    assert.match(messages(), /seems not to notice your gaze/);
});
for (const confused of [false, true]) test(`safe pet guard with hero confusion ${confused}`, async () => {
    await prepare(); const eye = await monster();
    assert.ok(await tamedog(eye, null, false)); assert.ok(eye.mtame);
    game.flags.safe_dog = true;
    if (confused) await make_confused(50, false);
    clearMessages(); seed(19);
    assert.equal(await dogaze(), ECMD_TIME);
    assert.equal(!!eye.mconf, confused); assert.equal(game.multi < 0, confused);
    if (!confused) assert.match(messages(), /avoid gazing at/);
});
for (const answer of ['n','y']) test(`peaceful confirmation ${answer} precedes anger and counter-gaze`, async () => {
    const run = await prepare(); const eye = await monster(); eye.mpeaceful = 1;
    game.flags.confirm = true; let answered = 0;
    run._display.onEmptyQueue = () => {
        if (game.nhDisplay.grid[0].map(c => c.ch).join('').includes('Really confuse')) {
            answered++; return answer.charCodeAt(0);
        }
        return 32;
    };
    assert.equal(await dogaze(), ECMD_TIME); assert.equal(answered, 1);
    assert.equal(!!eye.mpeaceful, answer === 'n'); assert.equal(!!eye.mconf, answer === 'y');
    assert.equal(game.multi < 0, answer === 'y');
});

test('fire gaze kills the eye before checking its counter-gaze', async () => {
    await prepare(P.PM_PYROLISK); const eye = await monster(); eye.mhp = 1;
    assert.equal(await dogaze(), ECMD_TIME); assert.ok(eye.mhp <= 0); assert.equal(game.multi, 0);
    assert.match(messages(), /fiery gaze/); assert.doesNotMatch(messages(), /frozen by/);
});
test('surviving eye counter-gaze follows fire dice and item-destruction roll', async () => {
    await prepare(P.PM_PYROLISK); const eye = await monster(); eye.mhp = 1000;
    seed(19); const damage = d(2, 6); rn2(20);
    const frozen = -d(eye.m_lev + 1, eye.data.mattk[0][3]); const expectedCalls = calls();
    seed(19); assert.equal(await dogaze(), ECMD_TIME);
    assert.equal(eye.mhp, 1000 - damage); assert.equal(game.multi, frozen);
    assert.deepEqual(calls(), expectedCalls);
});

test('cancelled Medusa is confused without invoking death', async () => {
    await prepare(); const medusa = await monster(P.PM_MEDUSA); medusa.mcan = 1;
    assert.equal(await dogaze(), ECMD_TIME); assert.equal(medusa.mconf, 1);
    assert.equal(game.u.umortality || 0, 0); assert.equal(game.killer, undefined);
    assert.doesNotMatch(messages(), /turn to stone/);
});
for (const stoneResistance of [false, true]) test(`Medusa lifesaving completes with stone resistance ${stoneResistance}`, async () => {
    await prepare(); const amulet = await lifesaver();
    const later = await monster(P.PM_NEWT, 2); const medusa = await monster(P.PM_MEDUSA);
    assert.equal(game.killer, undefined, 'fresh runtime must not rely on a previous death');
    if (stoneResistance) game.u.intrinsic.HStone_resistance = FROMOUTSIDE;
    assert.equal(Stone_resistance(), stoneResistance);
    assert.equal(await dogaze(), ECMD_TIME);
    assert.equal(game.u.umortality, 1); assert.equal(game.u.uamul, null);
    assert.ok(!game.invent.includes(amulet)); assert.ok(!game.u.uprops.LIFESAVED);
    assert.ok(game.u.uhp > 0 && game.u.mh > 0); assert.equal(medusa.mconf, 1);
    assert.equal(later.mconf, 1, 'C continues the monster chain after lifesaving returns');
    assert.equal(game.killer.name, ''); assert.equal(game.multi, -1);
    assert.match(messages(), /turn to stone/); assert.match(messages(), /medallion crumbles to dust/);
});
test('Medusa messages suspend the real caller before death and inventory cleanup', async () => {
    const run = await prepare(); const amulet = await lifesaver();
    const later = await monster(P.PM_NEWT, 2); await monster(P.PM_MEDUSA);
    let release, held = false, finished = false;
    run._display.onEmptyQueue = () => {
        if (!held) { held = true; return new Promise(resolve => { release = () => resolve(32); }); }
        return 32;
    };
    const pending = domonability().then(value => { finished = true; return value; });
    for (let n = 0; n < 30 && !release; n++) await new Promise(resolve => setImmediate(resolve));
    assert.ok(release, 'real message input boundary reached'); assert.equal(finished, false);
    assert.equal(game.u.uamul, amulet); assert.ok(!later.mconf);
    release(); assert.equal(await pending, ECMD_TIME);
    assert.equal(game.u.umortality, 1); assert.ok(!game.invent.includes(amulet));
    assert.equal(later.mconf, 1);
});
test('fatal Medusa completion leaves the following monster untouched', async () => {
    const run = await prepare(); const later = await monster(P.PM_NEWT, 2);
    await monster(P.PM_MEDUSA); game.wizard = false; game.discover = false;
    let reads = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++reads < 100, 'bounded death disclosure completion');
        const screen = game.nhDisplay.grid.map(row => row.map(c => c.ch).join('')).join('\n');
        return screen.includes('--More--') ? 32 : 'n'.charCodeAt(0);
    };
    await assert.rejects(domonability(), e => e.__nh_gameover === true);
    assert.equal(game.u.umortality, 1); assert.ok(game.program_state_gameover);
    assert.equal(game.killer.name, "deliberately meeting Medusa's gaze");
    assert.ok(!later.mconf);
});

test('Medusa keeps the existing killer record and pending-death chain', async () => {
    await prepare(); await lifesaver(); await monster(P.PM_MEDUSA);
    delayed_killer(1, 1, 'a pending cause');
    const record = game.killer, pending = find_delayed_killer(1);
    assert.ok(pending);
    assert.equal(await dogaze(), ECMD_TIME);
    assert.equal(game.killer, record); assert.equal(find_delayed_killer(1), pending);
    assert.equal(pending.name, 'a pending cause'); assert.equal(game.u.umortality, 1);
});
