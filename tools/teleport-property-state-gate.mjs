#!/usr/bin/env node
// Source-derived teleport controls, followed by independent native input checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { scrolltele, level_tele, dotele, domagicportal } from '../js/teleport.js';
import { level_tele_trap } from '../js/trap.js';
import { maketrap } from '../js/mklev.js';
import { make_stunned, make_confused } from '../js/potion.js';
import { Stunned, Confusion } from '../js/youprop.js';
import { force_learn_spell } from '../js/spell.js';
import { makeknown } from '../js/o_init.js';
import { set_uasmon } from '../js/polyself.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { FROMFORM, FROMOUTSIDE, TIMEOUT, LEVEL_TELEP, FORCETRAP, ROOM,
         UTOTYPE_PORTAL, UTOTYPE_DEFERRED } from '../js/const.js';

let prompts;
const config = {
    seed: 31, datetime: '20000112093000', moves: ' ',
    nethackrc: [
        'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug',
        'OPTIONS=!autopickup,!tutorial,!tips,pettype:none,pauper,nudist',
        'OPTIONS=suppress_alert:3.4.3', 'OPTIONS=symset:DECgraphics', '',
    ].join('\n'),
};

async function setup(property, representation = 'clear', value = 37) {
    resetInputState();
    await runSegment({ ...config, storage: new InMemoryStorage() });
    resetInputState();
    game.wizard = false;
    game._toplin = 0;
    game._pending_message = '';
    game._prevmsg = '';
    game._win_stop = false;
    game.u.intrinsic = {};
    game.u.uprops = {};
    game.u.uluck = game.u.moreluck = 0;
    game.u.utotype = 0;
    game.dfr_pre_msg = game.dfr_post_msg = null;
    game.level.traps = [];
    prompts = [];
    game._preNhgetchHook = () => prompts.push(game._pending_message || '');
    // Finite input: ESC cancels getpos/getlin and dismisses More. Empty input throws.
    pushKeys('\x1b'.repeat(32));
    if (representation === 'mirrored') {
        await (property === 'HStun' ? make_stunned : make_confused)(value, false);
        assert.equal(game.u.intrinsic[property], value);
        assert.equal(game.u.uprops[property === 'HStun' ? 'STUNNED' : 'CONFUSION'], 1);
    } else if (representation === 'intrinsic') {
        game.u.intrinsic[property] = value;
    } else if (representation === 'compatibility') {
        game.u.uprops[property === 'HStun' ? 'STUNNED' : 'CONFUSION'] = 1;
    }
    initRng(1);
    enableRngLog();
}

function observe(name, result) {
    const state = { name, result, prompts: [...prompts],
        message: game._prevmsg, pending: game._pending_message,
        rng: [...getRngLog()], xy: [game.u.ux, game.u.uy],
        destination: game.u.utolev, type: game.u.utotype,
        preMessage: game.dfr_pre_msg, postMessage: game.dfr_post_msg,
        stun: game.u.intrinsic.HStun || 0,
        confusion: game.u.intrinsic.HConfusion || 0 };
    return state;
}

// C include/youprop.h:80-84. Flat entries are compatibility state, not C extrinsics.
for (const property of ['HStun', 'HConfusion']) {
    for (const representation of ['clear', 'intrinsic', 'mirrored', 'compatibility']) {
        test(`canonical ${property}: ${representation}`, async () => {
            await setup(property, representation);
            assert.equal((property === 'HStun' ? Stunned : Confusion)(), representation !== 'clear');
            assert.deepEqual(getRngLog(), []);
        });
    }
}

// C teleport.c:872. Both control sources are gated by Stunned; wizard bypasses it.
for (const control of ['intrinsic', 'blessed scroll']) {
    for (const representation of ['clear', 'intrinsic', 'mirrored', 'compatibility']) {
        const name = `scrolltele ${control}: ${representation}`;
        test(name, async () => {
            await setup('HStun', representation);
            if (control === 'intrinsic') game.u.intrinsic.HTeleport_control = FROMOUTSIDE;
            const scroll = control === 'blessed scroll'
                ? { otyp: ONAMES.SCR_TELEPORTATION, blessed: 1, dknown: 1 } : null;
            if (scroll) makeknown(scroll.otyp);
            initRng(1); // object discovery setup may exercise wisdom.
            await scrolltele(scroll);
            const state = observe(name);
            if (representation === 'clear') {
                assert.equal(state.prompts.length, 1, 'controlled destination prompt');
                assert.deepEqual(state.rng, [], 'cancelled destination consumes no RNG');
            } else {
                assert.equal(state.prompts.length, 0, 'stun suppresses destination prompt');
                assert.match(state.rng[0], /^rnd\(79\)=/);
                assert.match(state.rng[1], /^rn2\(21\)=/);
            }
        });
    }
}
test('scrolltele wizard override with intrinsic FROMFORM stun', async () => {
    await setup('HStun', 'intrinsic', FROMFORM);
    game.wizard = true;
    await scrolltele(null);
    const state = observe('scrolltele wizard override');
    assert.equal(state.prompts.length, 1);
    assert.deepEqual(state.rng, []);
});
test('scrolltele form stun produced by public set_uasmon', async () => {
    await setup();
    game.u.umonnum = PMNAMES.PM_BAT;
    game.u.mtimedone = 100;
    set_uasmon();
    assert.equal(game.u.intrinsic.HStun & FROMFORM, FROMFORM);
    assert.ok(Stunned(), 'bat form enables canonical stun');
    game.u.intrinsic.HTeleport_control = FROMOUTSIDE;
    initRng(1);
    enableRngLog();
    await scrolltele(null);
    const state = observe('scrolltele form stun');
    assert.equal(state.prompts.length, 0);
    assert.match(state.rng[0], /^rnd\(79\)=/);
});

// C teleport.c:1190. No prompt or control when stunned; wizard can still cancel.
for (const representation of ['clear', 'intrinsic', 'mirrored', 'compatibility']) {
    const name = `level_tele stun: ${representation}`;
    test(name, async () => {
        await setup('HStun', representation);
        game.u.intrinsic.HTeleport_control = FROMOUTSIDE;
        await level_tele();
        const state = observe(name);
        assert.equal(state.prompts.length, representation === 'clear' ? 1 : 0);
        if (representation === 'clear') assert.deepEqual(state.rng, []);
        else assert.match(state.rng[0], /^rn2\(5\)=/);
    });
}
test('level_tele wizard override with intrinsic stun', async () => {
    await setup('HStun', 'intrinsic', FROMFORM);
    game.wizard = true;
    await level_tele();
    const state = observe('level_tele wizard override');
    assert.equal(state.prompts.length, 1);
    assert.deepEqual(state.rng, []);
});

// C teleport.c:1213-1218. '*' short circuits confusion; confusion precedes ESC.
for (const seed of [1, 2]) {
  for (const representation of ['clear', 'intrinsic', 'mirrored', 'compatibility']) {
    const name = `level_tele confused cancel seed ${seed}: ${representation}`;
    test(name, async () => {
        await setup('HConfusion', representation);
        game.u.intrinsic.HTeleport_control = FROMOUTSIDE;
        initRng(seed);
        await level_tele();
        const state = observe(name);
        assert.equal(state.prompts.length, 1);
        if (representation === 'clear') {
            assert.deepEqual(state.rng, []);
            assert.equal(state.type, 0);
        } else if (seed === 1) {
            assert.deepEqual(state.rng, ['rnl(5)=0']);
            assert.equal(state.type, 0, 'zero roll allows ESC cancellation');
        } else {
            assert.equal(state.rng[0], 'rnl(5)=3');
            assert.match(state.rng[1], /^rn2\(5\)=/);
            assert.match(state.pending, /Oops\.\.\./);
        }
    });
  }
}
test('level_tele explicit random destination skips confusion roll', async () => {
    await setup('HConfusion', 'intrinsic');
    game.u.intrinsic.HTeleport_control = FROMOUTSIDE;
    resetInputState();
    pushKeys('*\r' + '\x1b'.repeat(16));
    await level_tele();
    const state = observe('level_tele star');
    assert.match(state.rng[0], /^rn2\(5\)=/);
    assert.ok(!state.rng.some(draw => draw.startsWith('rnl(')));
});

// C teleport.c:1079-1088,1105. Low energy stops after spell eligibility.
// Thus confusion and stun can be distinguished without mocking spelleffects.
for (const property of ['HConfusion', 'HStun']) {
    for (const representation of ['clear', 'intrinsic', 'mirrored', 'compatibility']) {
        const name = `dotele spell ${property}: ${representation}`;
        test(name, async () => {
            await setup(property, representation);
            force_learn_spell(ONAMES.SPE_TELEPORT_AWAY);
            game.u.uen = 0;
            const state = observe(name, await dotele(false));
            assert.equal(state.result, 0);
            assert.equal(state.message, property === 'HConfusion' && representation !== 'clear'
                ? "You can't cast that spell."
                : 'You lack the energy for a teleport spell.');
            assert.deepEqual(state.rng, []);
        });
    }
}

// C teleport.c:1483-1486. Message uses full HStun; extension uses timeout bits.
for (const representation of ['clear', 'intrinsic', 'mirrored', 'compatibility']) {
    const name = `domagicportal: ${representation}`;
    test(name, async () => {
        await setup('HStun', representation);
        game.u.uz0 = { ...game.u.uz };
        const dst = { dnum: game.u.uz.dnum, dlevel: 2 };
        await domagicportal({ dst });
        const state = observe(name);
        assert.equal(state.preMessage, representation === 'clear'
            ? 'You feel slightly dizzy.' : 'You feel dizzier.');
        assert.equal(state.stun, ['intrinsic', 'mirrored'].includes(representation) ? 40 : 3);
        assert.equal(state.type, UTOTYPE_PORTAL | UTOTYPE_DEFERRED);
        assert.deepEqual(state.destination, dst);
        assert.deepEqual(state.rng, []);
    });
}
test('domagicportal FROMFORM persists while timeout grows', async () => {
    await setup('HStun', 'intrinsic', FROMFORM | 7);
    game.u.uz0 = { ...game.u.uz };
    await domagicportal({ dst: { dnum: game.u.uz.dnum, dlevel: 2 } });
    const state = observe('domagicportal FROMFORM');
    assert.equal(state.preMessage, 'You feel dizzier.');
    assert.equal(state.stun & FROMFORM, FROMFORM);
    assert.equal(state.stun & TIMEOUT, 10);
    assert.deepEqual(state.rng, []);
});

// C teleport.c:1564. Confusion is read before the timeout extension at 1570.
for (const representation of ['clear', 'intrinsic', 'mirrored', 'compatibility']) {
    const name = `level_tele_trap message: ${representation}`;
    test(name, async () => {
        await setup('HConfusion', representation);
        game.u.uhave.amulet = true; // level_tele refuses before its own prompt/RNG.
        game.level.at(game.u.ux, game.u.uy).typ = ROOM; // trap cannot replace stairs.
        const trap = maketrap(game.u.ux, game.u.uy, LEVEL_TELEP);
        assert.ok(trap);
        initRng(1);
        enableRngLog();
        const state = observe(name, await level_tele_trap(trap, FORCETRAP));
        assert.equal(state.confusion, ['intrinsic', 'mirrored'].includes(representation) ? 40 : 3);
        assert.deepEqual(state.rng, []);
        assert.equal(state.message, representation === 'clear'
            ? 'You feel disoriented.' : 'You feel even more disoriented.');
    });
}

const native = JSON.parse(readFileSync(new URL(
    'gen-sessions/generated/teleport-property-contracts.session.json', import.meta.url)));
const stripCaller = call => call.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
for (const [index, segment] of native.segments.entries()) {
    test(`native teleport case ${index}: every input retains its RNG slice`, async () => {
        resetInputState(); // Discard unused keys from the constructed controls.
        const run = await runSegment({...segment, storage:new InMemoryStorage()});
        const slices = run.getRngSlices();
        for (const [step, expected] of segment.steps.entries())
            assert.deepEqual((slices[step] || []).map(stripCaller),
                expected.rng.map(stripCaller), `input ${step}`);
        assert.equal(run.getRngLog().length, segment.steps.reduce((n,s) => n+s.rng.length, 0));
        assert.deepEqual(run.getCursors(), segment.steps.map(s => s.cursor));
    });
}
