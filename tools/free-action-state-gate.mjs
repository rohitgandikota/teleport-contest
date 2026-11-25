// Constructed lifecycle controls using the real menu, timers and equipment APIs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setup, seed, clearMessages, messages} from './half-damage-intrinsic-setup.mjs';
import {game} from '../js/gstate.js';
import {wiz_intrinsic} from '../js/wizcmds.js';
import {nh_timeout} from '../js/timeout.js';
import {set_itimeout, incr_itimeout, peffects, potionbreathe} from '../js/potion.js';
import {Free_action, Sleep_resistance} from '../js/youprop.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {Ring_on, Ring_off} from '../js/do_wear.js';
import {enlightenment} from '../js/insight.js';
import {pushKeys, resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {ONAMES as O} from '../js/objects_data.js';
import {TIMEOUT, FROMOUTSIDE, W_RINGL, W_RINGR, ECMD_OK} from '../js/const.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const results = [];
const deadline = setTimeout(() => process.exit(2), 55000);
const intrinsic = () => game.u.intrinsic?.HFree_action || 0;
const extrinsic = () => game.u.uprops?.FREE_ACTION || 0;
function noLegacy() {
    assert.equal(game.u.wiz_intrinsic_timeouts?.FREE_ACTION, undefined);
    assert.equal(game.u.wiz_intrinsic_base_props?.FREE_ACTION, undefined);
}
async function check(name, operation) {
    try {
        await operation();
        results.push({name, pass:true});
    } catch (error) {
        results.push({name, pass:false, error:error.message.slice(0, 1200)});
    }
}
async function prepare() {
    const run = await setup();
    game.moves = 1;
    game.u.uinvulnerable = false;
    return run;
}
async function ring(slot = W_RINGL) {
    const obj = mksobj(O.RIN_FREE_ACTION, false, false);
    await addinv(obj);
    setworn(obj, slot);
    await Ring_on(obj);
    return obj;
}
async function select(amount = '') {
    clearMessages(); resetInputState();
    pushKeys(`>>${amount}w\r`);
    assert.equal(await wiz_intrinsic(), ECMD_OK);
    resetInputState();
}
async function menu(run) {
    clearMessages(); resetInputState(); pushKeys('>>');
    const previous = run._display.onEmptyQueue;
    let text;
    run._display.onEmptyQueue = () => {
        const display = run._display.terminal || run._display;
        text = decodeScreen(display.serialize())
            .map(row => row.map(renderCell).join('')).join('\n');
        return 27;
    };
    try { await wiz_intrinsic(); }
    finally { run._display.onEmptyQueue = previous; resetInputState(); }
    assert.ok(text, 'third menu page was read');
    return text;
}

await check('default menu stores 30 intrinsically without granting protection', async () => {
    await prepare(); seed(); await select();
    assert.equal(intrinsic(), 30); assert.equal(extrinsic(), 0);
    assert.equal(Free_action(), false); noLegacy();
    assert.match(messages(), /Timeout for free action set to 30\./);
    assert.deepEqual(getRngLog(), []);
});
await check('existing canonical timer expires silently', async () => {
    await prepare(); incr_itimeout('HFree_action', 3); seed();
    for (const remaining of [2, 1, 0]) {
        await nh_timeout(); assert.equal(intrinsic(), remaining);
        assert.equal(extrinsic(), 0); assert.equal(Free_action(), false);
    }
    assert.equal(messages().trim(), ''); assert.deepEqual(getRngLog(), []);
});
await check('menu reads only low timer bits and increments them', async () => {
    const run = await prepare();
    game.u.intrinsic.HFree_action = FROMOUTSIDE;
    incr_itimeout('HFree_action', 7); seed();
    assert.match(await menu(run), /free action +\[7\]/);
    await select(5);
    assert.equal(intrinsic(), FROMOUTSIDE | 12);
    assert.match(messages(), /Timeout for free action increased by 5\./);
    assert.match(await menu(run), /free action +\[12\]/);
    assert.equal(Free_action(), false); noLegacy(); assert.deepEqual(getRngLog(), []);
});
await check('saturation preserves permanent bits and a real worn ring', async () => {
    await prepare(); await ring(); game.u.intrinsic.HFree_action = FROMOUTSIDE;
    set_itimeout('HFree_action', TIMEOUT - 2); seed(); await select(5);
    assert.equal(intrinsic(), FROMOUTSIDE | TIMEOUT);
    assert.equal(extrinsic(), W_RINGL); assert.equal(Free_action(), true);
    noLegacy(); assert.deepEqual(getRngLog(), []);
});
await check('menu cancellation preserves both sources', async () => {
    const run = await prepare(); await ring(); incr_itimeout('HFree_action', 9); seed();
    await menu(run);
    assert.equal(intrinsic(), 9); assert.equal(extrinsic(), W_RINGL);
    noLegacy(); assert.deepEqual(getRngLog(), []);
});
await check('timer expiry preserves two worn ring masks', async () => {
    await prepare(); await ring(); await ring(W_RINGR); seed(); await select(2);
    for (const remaining of [1, 0]) {
        await nh_timeout(); assert.equal(intrinsic(), remaining);
        assert.equal(extrinsic(), W_RINGL | W_RINGR); assert.equal(Free_action(), true);
    }
    noLegacy(); assert.deepEqual(getRngLog(), []);
});
await check('removing the ring during a timer never restores equipment protection', async () => {
    await prepare(); const obj = await ring(); await select(2); await Ring_off(obj);
    clearMessages(); seed();
    assert.equal(extrinsic(), 0); assert.equal(Free_action(), false);
    for (const remaining of [1, 0]) {
        await nh_timeout(); assert.equal(intrinsic(), remaining);
        assert.equal(extrinsic(), 0); assert.equal(Free_action(), false);
    }
    noLegacy(); assert.deepEqual(getRngLog(), []);
});
await check('adding a ring during a timer survives expiry', async () => {
    await prepare(); await select(2); await ring(); clearMessages(); seed();
    await nh_timeout(); await nh_timeout();
    assert.equal(intrinsic(), 0); assert.equal(extrinsic(), W_RINGL);
    assert.equal(Free_action(), true); noLegacy(); assert.deepEqual(getRngLog(), []);
});
await check('invulnerability pauses the canonical timer', async () => {
    await prepare(); incr_itimeout('HFree_action', 2); game.u.uinvulnerable = true;
    seed(); await nh_timeout(); assert.equal(intrinsic(), 2);
    game.u.uinvulnerable = false; await nh_timeout(); assert.equal(intrinsic(), 1);
    assert.equal(Free_action(), false); assert.deepEqual(getRngLog(), []);
});
for (const withRing of [false, true]) {
    await check(`enlightenment uses equipment protection, ring=${withRing}`, async () => {
        await prepare(); incr_itimeout('HFree_action', 20);
        if (withRing) await ring();
        const text = enlightenment().join('\n');
        assert.equal(/You have free action/.test(text), withRing);
    });
}
for (const kind of ['sleeping', 'paralysis']) {
    for (const source of ['none', 'intrinsic', 'ring']) {
        await check(`${kind} potion with ${source} source`, async () => {
            await prepare();
            if (source === 'intrinsic') incr_itimeout('HFree_action', 20);
            if (source === 'ring') await ring();
            const obj = mksobj(kind === 'sleeping' ? O.POT_SLEEPING : O.POT_PARALYSIS, false, false);
            obj.blessed = true; clearMessages(); seed();
            await peffects(obj);
            if (source === 'ring') {
                assert.equal(game.multi, 0);
                assert.match(messages(), kind === 'sleeping' ? /You yawn\./ : /stiffen momentarily/);
                assert.deepEqual(getRngLog(), []);
            } else {
                assert.ok(game.multi < 0);
                assert.match(messages(), kind === 'sleeping' ? /suddenly fall asleep/ : /frozen to/);
                // C rn1(10, 13) is the macro rn2(10) + 13.
                assert.ok(getRngLog().some(call => call.startsWith('rn2(10)=')));
            }
        });
    }
}
await check('real sleep-resistance timer still prevents sleeping potion', async () => {
    await prepare(); incr_itimeout('HSleep_resistance', 20); incr_itimeout('HFree_action', 20);
    assert.equal(Sleep_resistance(), true);
    const obj = mksobj(O.POT_SLEEPING, false, false); clearMessages(); seed();
    await peffects(obj); assert.equal(game.multi, 0); assert.match(messages(), /You yawn\./);
    assert.deepEqual(getRngLog(), []);
});
for (const kind of ['sleeping', 'paralysis']) {
    for (const withRing of [false, true]) {
        await check(`${kind} vapor after real menu timer, ring=${withRing}`, async () => {
            await prepare(); if (withRing) await ring(); await select(20);
            const obj = mksobj(kind === 'sleeping' ? O.POT_SLEEPING : O.POT_PARALYSIS, false, false);
            clearMessages(); seed(); await potionbreathe(obj);
            assert.equal(game.multi < 0, !withRing);
            assert.equal(extrinsic(), withRing ? W_RINGL : 0);
            assert.equal(intrinsic(), 20); noLegacy();
            if (!withRing) assert.match(messages(), kind === 'sleeping' ? /rather tired/ : /holding you/);
        });
    }
}
clearTimeout(deadline);
const report = {passed:results.filter(r => r.pass).length, total:results.length, results};
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (report.passed !== report.total) process.exitCode = 1;
