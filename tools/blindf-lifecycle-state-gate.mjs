#!/usr/bin/env node
// Pinned do_wear.c:1461-1533 source contracts. These constructed states
// are not a native oracle or a claim that every state is input-reachable.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { Blindf_on, Blindf_off } from '../js/do_wear.js';
import { setworn } from '../js/worn.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { addinv, obj_extract_self } from '../js/invent.js';
import { makemon } from '../js/makemon.js';
import { punish } from '../js/read.js';
import { newsym } from '../js/display.js';
import { Blind, Unaware } from '../js/youprop.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES, ATTKS } from '../js/monst_data.js';
import { ART_EYES_OF_THE_OVERWORLD } from '../js/artilist_data.js';
import { W_TOOL, W_WEP, W_SWAPWEP, W_QUIVER, W_ARM, FROMOUTSIDE, FROMFORM,
    ROOM, IN_SIGHT, COULD_SEE, BC_BALL, BC_CHAIN, MM_NOGRP, MM_NOMSG,
    NO_MINVENT, OBJ_INVENT, OBJ_FLOOR, OBJ_FREE } from '../js/const.js';
import { initRng, enableRngLog, getRngLog, d, rn2 } from '../js/rng.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url))).segments[0];
async function setup() {
    const run = await runSegment({ ...segment, moves: ' ', storage: new InMemoryStorage() });
    let dismissals = 0;
    run._display.onEmptyQueue = () => {
        if (++dismissals > 30) throw Error('unexpected repeated prompt');
        return 0x1b;
    };
    game._preNhgetchHook = null;
    game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
    game.u.ublind = 0; game.u.ublindf = null;
    game.u.uswallow = false; game.u.ustuck = null; game.u.uswldtim = 0;
    game.u.uball = null; game.u.uchain = null;
    game.u.ux = 31; game.u.uy = 10;
    game.u.uhp = game.u.uhpmax = 1000;
    game.u.uroleplay.blind = false;
    game.u.ucreamed = 0; game.multi = 0;
    game.level.monsters = []; game.level.monAt.clear();
    game.level.objects = []; game.level.traps = [];
    game.level.objAt.clear();
    game.regions = []; game.context_takeoff = { mask: 0, what: 0 };
    game.invent = []; game.flags.verbose = true;
    for (let x = 26; x <= 36; x++) for (let y = 5; y <= 15; y++) {
        Object.assign(game.level.at(x, y), { typ: ROOM, lit: 1,
            waslit: 1, seenv: 255, roomno: 0 });
        game.viz_array[y][x] = IN_SIGHT | COULD_SEE;
    }
    clearMessages();
}
function clearMessages() {
    game._toplines = ''; game._msg_history = []; game._toplin = 0;
    game._pending_message = ''; game._win_stop = false;
}
function messages() { return [...game._msg_history, game._toplines].join('\n'); }
function eyewear(type = 'BLINDFOLD', eyes = false) {
    const obj = mksobj(ONAMES[type], false, false);
    if (eyes) { obj.oartifact = ART_EYES_OF_THE_OVERWORLD; obj.oname = 'The Eyes of the Overworld'; }
    addinv(obj);
    return obj;
}
function seed() { initRng(3); enableRngLog(); }
function noDraws() { assert.deepEqual(getRngLog(), []); }

for (const [mask, slot] of [[W_WEP, 'uwep'], [W_SWAPWEP, 'uswapwep'], [W_QUIVER, 'uquiver']]) {
    test(`wearing releases ${slot} before the wear message`, async () => {
        await setup();
        const obj = eyewear(); setworn(obj, mask);
        seed(); await Blindf_on(obj);
        assert.equal(game.u[slot], null);
        assert.equal(obj.owornmask, W_TOOL);
        assert.equal(game.u.ublindf, obj);
        assert.equal(Blind(), true); assert.equal(game.u.ublind, 1);
        assert.doesNotMatch(messages(), /wielded|weapon in hand|in quiver/);
        noDraws();
    });
}
for (const type of ['BLINDFOLD', 'TOWEL', 'LENSES']) {
    test(`${type} ordinary wear and removal`, async () => {
        await setup(); const obj = eyewear(type); seed();
        await Blindf_on(obj);
        assert.equal(Blind(), type !== 'LENSES');
        assert.equal(game.u.ublind, type !== 'LENSES' ? 1 : 0);
        assert.equal(/see any more/.test(messages()), type !== 'LENSES');
        clearMessages(); await Blindf_off(obj);
        assert.equal(game.u.ublindf, null); assert.equal(obj.owornmask, 0);
        assert.equal(Blind(), false); assert.equal(game.u.ublind, 0);
        assert.equal(/can see again/.test(messages()), type !== 'LENSES');
        noDraws();
    });
    test(`${type} does not clear an existing intrinsic or report a false recovery`, async () => {
        await setup(); game.u.intrinsic.HBlinded = 7; game.u.ublind = 1;
        const obj = eyewear(type); seed(); await Blindf_on(obj);
        assert.doesNotMatch(messages(), /see any more|can see!/);
        clearMessages(); await Blindf_off(obj);
        assert.equal(game.u.intrinsic.HBlinded, 7);
        assert.equal(Blind(), true); assert.equal(game.u.ublind, 1);
        assert.equal(/still cannot see/.test(messages()), type !== 'LENSES');
        noDraws();
    });
}
for (const birth of [false, true]) {
    test(`Eyes suppress blindness without removing its source, birth=${birth}`, async () => {
        await setup(); game.u.intrinsic.HBlinded = birth ? FROMOUTSIDE : 7;
        game.u.uroleplay.blind = birth; game.u.ublind = 1;
        const obj = eyewear('LENSES', true); seed(); await Blindf_on(obj);
        assert.equal(Blind(), false); assert.equal(game.u.ublind, 0);
        assert.equal(game.u.blocked.BLINDED, W_TOOL);
        assert.equal(game.u.uroleplay.blind, false);
        assert.match(messages(), birth ? /For the first time in your life, you can see!/
            : /You can see!/);
        if (birth) assert.doesNotMatch(messages(), /You can see!/);
        clearMessages(); await Blindf_off(obj);
        assert.equal(game.u.intrinsic.HBlinded, birth ? FROMOUTSIDE : 7);
        assert.equal(Blind(), true); assert.equal(game.u.ublind, 1);
        assert.equal(game.u.blocked.BLINDED || 0, 0);
        assert.equal(game.u.uroleplay.blind, false);
        assert.match(messages(), /You can't see anything now!/);
        noDraws();
    });
}
test('quiet wear suppresses only the optional message', async () => {
    await setup(); const obj = eyewear(); game.flags.verbose = false;
    seed(); await Blindf_on(obj);
    assert.equal(Blind(), true); assert.doesNotMatch(messages(), /see any more/);
    clearMessages(); await Blindf_off(obj);
    assert.doesNotMatch(messages(), /were wearing/);
    assert.match(messages(), /You can see again/); noDraws();
});
test('implicit removal suppresses off_msg and clears only W_TOOL from takeoff', async () => {
    await setup(); const obj = eyewear(); await Blindf_on(obj);
    game.context_takeoff.mask = W_TOOL | W_ARM;
    clearMessages(); seed(); await Blindf_off(null);
    assert.equal(game.context_takeoff.mask, W_ARM);
    assert.equal(game.u.ublindf, null); assert.equal(obj.owornmask, 0);
    assert.doesNotMatch(messages(), /were wearing/);
    assert.match(messages(), /You can see again/); noDraws();
});
test('missing implicit eyewear reports the C impossible diagnostic', async () => {
    await setup(); seed(); await Blindf_off(null);
    assert.ok(game.impossible_log?.includes('Blindf_off without eyewear?')); noDraws();
});

for (const removeEyes of [false, true]) for (const carried of [false, true]) {
    test(`blindness captures ball and chain, removeEyes=${removeEyes}, carried=${carried}`, async () => {
        await setup();
        const obj = eyewear(removeEyes ? 'LENSES' : 'TOWEL', removeEyes);
        if (removeEyes) {
            game.u.intrinsic.HBlinded = 9; game.u.ublind = 1;
            await Blindf_on(obj);
        }
        await punish(null);
        const { uball: ball, uchain: chain } = game.u;
        obj_extract_self(chain); place_object(chain, 32, 10);
        obj_extract_self(ball);
        if (carried) addinv(ball); else place_object(ball, 33, 10);
        newsym(32, 10); newsym(33, 10);
        // set_bc marks both pieces before toggle_blindness redraws. The
        // redraw's feel_location can subsequently clear those felt bits.
        const feltStores = [];
        let felt = 0;
        Object.defineProperty(game.u, 'bc_felt', { configurable: true,
            get: () => felt, set: value => { felt = value; feltStores.push(value); } });
        game.u.bc_order = -1;
        game.u.cglyph = -1; game.u.bglyph = -1;
        seed();
        if (removeEyes) await Blindf_off(obj); else await Blindf_on(obj);
        assert.ok(feltStores.includes(carried ? BC_CHAIN : BC_CHAIN | BC_BALL));
        assert.equal(game.u.bc_order, 0, 'different positions');
        assert.notEqual(game.u.cglyph, -1);
        if (!carried) assert.notEqual(game.u.bglyph, -1);
        assert.equal(chain.where, OBJ_FLOOR);
        assert.equal(ball.where, carried ? OBJ_INVENT : OBJ_FLOOR);
        assert.deepEqual([chain.ox, chain.oy], [32, 10]);
        if (!carried) assert.deepEqual([ball.ox, ball.oy], [33, 10]);
        noDraws();
    });
}
test('already blind wear does not recapture ball and chain', async () => {
    await setup(); await punish(null);
    game.u.intrinsic.HBlinded = 7; game.u.ublind = 1;
    game.u.bc_felt = 0; const obj = eyewear();
    seed(); await Blindf_on(obj); assert.equal(game.u.bc_felt, 0); noDraws();
});

async function swallowed(mnum) {
    const mon = await makemon(game.mons[mnum], 32, 10, MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(mon);
    game.u.uswallow = true; game.u.ustuck = mon; game.u.uswldtim = 7;
    return mon;
}
for (const blocked of ['none', 'intrinsic', 'cream', 'eyeless', 'nonblinding']) {
    test(`removing a blindfold inside an engulfer: ${blocked}`, async () => {
        await setup(); const obj = eyewear(); await Blindf_on(obj);
        const mon = await swallowed(blocked === 'nonblinding' ? PMNAMES.PM_FOG_CLOUD
            : PMNAMES.PM_DUST_VORTEX);
        if (blocked === 'intrinsic') game.u.intrinsic.HBlinded = 9;
        if (blocked === 'cream') game.u.ucreamed = 4;
        if (blocked === 'eyeless') {
            game.u.umonnum = PMNAMES.PM_YELLOW_LIGHT;
            game.youmonst.data = game.mons[PMNAMES.PM_YELLOW_LIGHT];
            game.u.intrinsic.HBlinded = FROMFORM;
        }
        clearMessages(); seed();
        const atk = mon.data.mattk.find(a => a[0] === ATTKS.AT_ENGL);
        const duration = blocked === 'none' ? d(atk[2], atk[3]) : 0;
        const expected = [...getRngLog()]; const next = rn2(19);
        seed(); await Blindf_off(obj);
        assert.deepEqual(getRngLog(), expected);
        assert.equal(game.u.uswldtim, 7, 'gulp check compensates for gulpmu decrement');
        assert.equal(game.u.uhp, 1000, 'blindness does no damage');
        assert.equal(game.u.uswallow, true);
        if (blocked === 'none') {
            assert.equal(game.u.intrinsic.HBlinded, duration);
            assert.equal(Blind(), true); assert.equal(game.u.ublind, 1);
            assert.match(messages(), /You can't see in here!/);
            assert.doesNotMatch(messages(), /You can see again/);
        } else if (blocked === 'intrinsic' || blocked === 'eyeless') {
            assert.equal(Blind(), true);
            assert.equal(game.u.intrinsic.HBlinded, blocked === 'intrinsic' ? 9 : FROMFORM);
            assert.match(messages(), /still cannot see/);
        } else {
            assert.equal(Blind(), false); assert.equal(game.u.ublind, 0);
            assert.match(messages(), /You can see again/);
        }
        assert.equal(rn2(19), next, 'no extra random draws');
    });
}

// Follow-up controls add boundary cases without changing the candidate.
test('follow-up: ordinary sighted Eyes wear has no blindness transition', async () => {
    await setup(); const obj = eyewear('LENSES', true);
    seed(); await Blindf_on(obj);
    assert.equal(Blind(), false); assert.equal(game.u.ublind, 0);
    assert.equal(game.u.uroleplay.blind, false);
    assert.equal(game.u.blocked.BLINDED, W_TOOL);
    assert.doesNotMatch(messages(), /can see|first time|see any more/);
    clearMessages(); await Blindf_off(obj);
    assert.equal(Blind(), false); assert.equal(game.u.ublind, 0);
    assert.equal(game.u.blocked.BLINDED || 0, 0);
    assert.doesNotMatch(messages(), /can see|cannot see|see anything/);
    noDraws();
});
test('follow-up: first-sight conduct stays broken on a second Eyes wear', async () => {
    await setup(); game.u.intrinsic.HBlinded = FROMOUTSIDE;
    game.u.uroleplay.blind = true; game.u.ublind = 1;
    const obj = eyewear('LENSES', true);
    seed(); await Blindf_on(obj);
    assert.equal(game.u.uroleplay.blind, false);
    await Blindf_off(obj);
    assert.equal(game.u.intrinsic.HBlinded, FROMOUTSIDE);
    assert.equal(Blind(), true);
    clearMessages(); await Blindf_on(obj);
    assert.match(messages(), /You can see!/);
    assert.doesNotMatch(messages(), /first time/);
    assert.equal(game.u.uroleplay.blind, false);
    assert.equal(game.u.intrinsic.HBlinded, FROMOUTSIDE);
    assert.equal(Blind(), false); noDraws();
});
test('follow-up: unconscious engulf removal does not roll or apply blinding', async () => {
    await setup(); const obj = eyewear(); await Blindf_on(obj);
    await swallowed(PMNAMES.PM_DUST_VORTEX);
    game.multi = -3; game.u.usleep = 1;
    assert.equal(Unaware(), true);
    clearMessages(); seed(); await Blindf_off(obj);
    assert.equal(game.u.intrinsic.HBlinded || 0, 0);
    assert.equal(Blind(), false); assert.equal(game.u.ublind, 0);
    assert.equal(game.u.uswldtim, 7); assert.equal(game.u.uhp, 1000);
    assert.equal(game.multi, -3); assert.equal(game.u.usleep, 1);
    assert.doesNotMatch(messages(), /can't see in here/);
    noDraws();
});
for (const removeEyes of [false, true]) {
    test(`follow-up: swallowed punishment capture, removeEyes=${removeEyes}`, async () => {
        await setup();
        const obj = eyewear(removeEyes ? 'LENSES' : 'TOWEL', removeEyes);
        if (removeEyes) {
            game.u.intrinsic.HBlinded = 9; game.u.ublind = 1;
            await Blindf_on(obj);
        }
        newsym(game.u.ux, game.u.uy);
        await swallowed(PMNAMES.PM_FOG_CLOUD);
        await punish(null);
        const ball = game.u.uball, chain = game.u.uchain;
        assert.equal(ball.where, OBJ_FREE); assert.equal(chain.where, OBJ_FREE);
        const glyph = game.level.at(game.u.ux, game.u.uy).remembered_glyph;
        assert.ok(glyph);
        game.u.cglyph = game.u.bglyph = -1; game.u.bc_order = -1;
        clearMessages(); seed();
        if (removeEyes) await Blindf_off(obj); else await Blindf_on(obj);
        assert.deepEqual(game.u.cglyph, glyph);
        assert.deepEqual(game.u.bglyph, glyph);
        assert.equal(game.u.bc_order, 0);
        assert.equal(ball.where, OBJ_FREE); assert.equal(chain.where, OBJ_FREE);
        assert.equal(game.level.objects.includes(ball), false);
        assert.equal(game.level.objects.includes(chain), false);
        assert.equal(game.u.uswldtim, 7); assert.equal(Blind(), true);
        noDraws();
    });
}
test('follow-up: removal honors the supplied full mask, a constructed contract', async () => {
    await setup(); const obj = eyewear();
    // This duplicate-slot state was produced by the old JS wear bug. It is
    // not claimed as a valid native input state; C removes otmp->owornmask.
    setworn(obj, W_TOOL | W_WEP); game.u.ublind = 1;
    game.context_takeoff.mask = W_TOOL | W_WEP | W_ARM;
    seed(); await Blindf_off(obj);
    assert.equal(game.u.ublindf, null); assert.equal(game.u.uwep, null);
    assert.equal(obj.owornmask, 0);
    assert.equal(game.context_takeoff.mask, W_ARM);
    assert.equal(Blind(), false); assert.equal(game.u.ublind, 0);
    noDraws();
});
