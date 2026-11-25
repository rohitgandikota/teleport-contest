// Source-derived lifecycle checks through the real menu, artifact and save APIs.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, clearMessages, messages} from './half-damage-intrinsic-setup.mjs';
import {game} from '../js/gstate.js';
import {wiz_intrinsic} from '../js/wizcmds.js';
import {nh_timeout, wiz_timeout_queue} from '../js/timeout.js';
import {set_itimeout, incr_itimeout} from '../js/potion.js';
import {Half_physical_damage, Half_spell_damage} from '../js/youprop.js';
import {mksobj} from '../js/mkobj.js';
import {artifact_exists} from '../js/artifact.js';
import {addinv, freeinv} from '../js/invent.js';
import {Amulet_on, Amulet_off} from '../js/do_wear.js';
import {dosave0} from '../js/save.js';
import {dorecover} from '../js/restore.js';
import {pushKeys, resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {msgtype_parse_add} from '../js/options.js';
import {ONAMES as O} from '../js/objects_data.js';
import {TIMEOUT, FROMOUTSIDE, W_ART, ONAME_WISH, ECMD_OK} from '../js/const.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const properties = [
    {key:'HALF_PHDAM', h:'HHalf_physical_damage', name:'half physical damage', letter:'o', active:Half_physical_damage},
    {key:'HALF_SPDAM', h:'HHalf_spell_damage', name:'half spell damage', letter:'n', active:Half_spell_damage},
];
const intrinsic = p => game.u.intrinsic?.[p.h] || 0;
const extrinsic = p => game.u.uprops?.[p.key] || 0;
function noLegacy(p) {
    assert.equal(game.u.wiz_intrinsic_timeouts?.[p.key], undefined);
    assert.equal(game.u.wiz_intrinsic_base_props?.[p.key], undefined);
}
async function prepare() {
    const run = await setup();
    game.moves = 1; // Constructed quiet countdown boundary, outside luck adjustment turns.
    game.u.uinvulnerable = false;
    return run;
}
async function orb() {
    const obj = mksobj(O.CRYSTAL_BALL, false, false);
    artifact_exists(obj, 'The Orb of Fate', true, ONAME_WISH);
    await addinv(obj);
    for (const p of properties) assert.equal(extrinsic(p), W_ART);
    return obj;
}
async function select(p, amount = '') {
    clearMessages(); resetInputState();
    pushKeys(`>>${amount}${p.letter}\r`);
    assert.equal(await wiz_intrinsic(), ECMD_OK);
    resetInputState();
}
async function menu(run) {
    clearMessages(); resetInputState(); pushKeys('>>');
    const previous = run._display.onEmptyQueue;
    let text;
    run._display.onEmptyQueue = () => {
        const display = run._display.terminal || run._display;
        text = decodeScreen(display.serialize()).map(row => row.map(renderCell).join('')).join('\n');
        return 27;
    };
    try { await wiz_intrinsic(); }
    finally { run._display.onEmptyQueue = previous; resetInputState(); }
    assert.ok(text, 'real third menu page was read');
    return text;
}

for (const p of properties) {
    test(`${p.name}: already canonical timer expires silently`, async () => {
        await prepare(); incr_itimeout(p.h, 3); clearMessages(); seed();
        for (const remaining of [2,1,0]) {
            await nh_timeout(); assert.equal(intrinsic(p), remaining);
            assert.equal(extrinsic(p), 0); assert.equal(p.active(), remaining > 0);
        }
        assert.equal(messages().trim(), ''); assert.deepEqual(getRngLog(), []); noLegacy(p);
    });
    test(`${p.name}: actual default menu selection stores 30 intrinsically`, async () => {
        await prepare(); seed(); await select(p);
        assert.equal(intrinsic(p), 30); assert.equal(extrinsic(p), 0);
        assert.ok(p.active()); assert.match(messages(), new RegExp(`Timeout for ${p.name} set to 30\\.`));
        noLegacy(p); assert.deepEqual(getRngLog(), []);
    });
    test(`${p.name}: timed count preserves an existing equipment mask through expiry`, async () => {
        await prepare(); await orb(); clearMessages(); seed(); await select(p, 3);
        assert.equal(intrinsic(p), 3); assert.equal(extrinsic(p), W_ART); noLegacy(p);
        for (const remaining of [2,1,0]) {
            await nh_timeout(); assert.equal(intrinsic(p), remaining);
            assert.equal(extrinsic(p), W_ART); assert.ok(p.active());
        }
        assert.deepEqual(getRngLog(), []);
    });
    test(`${p.name}: reader displays low timeout bits and increments the existing intrinsic`, async () => {
        const run = await prepare();
        game.u.intrinsic[p.h] = FROMOUTSIDE; // Source-only permanent intrinsic boundary.
        incr_itimeout(p.h, 7); seed();
        assert.match(await menu(run), new RegExp(`${p.name} +\\[7\\]`));
        await select(p, 5);
        assert.equal(intrinsic(p), FROMOUTSIDE | 12);
        assert.match(messages(), new RegExp(`Timeout for ${p.name} increased by 5\\.`));
        assert.match(await menu(run), new RegExp(`${p.name} +\\[12\\]`));
        noLegacy(p); assert.deepEqual(getRngLog(), []);
    });
    test(`${p.name}: TIMEOUT saturation preserves permanent and equipment sources`, async () => {
        await prepare(); await orb(); game.u.intrinsic[p.h] = FROMOUTSIDE;
        set_itimeout(p.h, TIMEOUT - 2); clearMessages(); seed(); await select(p, 5);
        assert.equal(intrinsic(p), FROMOUTSIDE | TIMEOUT);
        assert.equal(extrinsic(p), W_ART); noLegacy(p); assert.deepEqual(getRngLog(), []);
    });
    test(`${p.name}: cancelling a real menu does not change either source`, async () => {
        const run = await prepare(); await orb(); incr_itimeout(p.h, 9); seed();
        await menu(run); assert.equal(intrinsic(p), 9); assert.equal(extrinsic(p), W_ART);
        noLegacy(p); assert.deepEqual(getRngLog(), []);
    });
    test(`${p.name}: timeout display reads intrinsic low bits, never equipment bits`, async () => {
        const run = await prepare(); await orb(); game.u.intrinsic[p.h] = FROMOUTSIDE;
        await select(p, 3); seed();
        const previous = run._display.onEmptyQueue;
        let text = '';
        run._display.onEmptyQueue = () => {
            const display = run._display.terminal || run._display;
            text += decodeScreen(display.serialize()).map(row => row.map(renderCell).join('')).join('\n');
            return 32;
        };
        try {
            await wiz_timeout_queue();
            assert.match(text, new RegExp(`${p.name} +3`));
            for (let i = 0; i < 3; i++) await nh_timeout();
            text = ''; await wiz_timeout_queue();
            assert.match(text, /No timed properties\./);
            assert.doesNotMatch(text, new RegExp(p.name));
        } finally { run._display.onEmptyQueue = previous; }
        assert.equal(intrinsic(p), FROMOUTSIDE); assert.equal(extrinsic(p), W_ART);
        noLegacy(p); assert.deepEqual(getRngLog(), []);
    });
    test(`${p.name}: adding equipment during the wizard timer survives expiry`, async () => {
        await prepare(); await select(p, 2); await orb(); clearMessages(); seed();
        await nh_timeout(); assert.equal(intrinsic(p), 1); assert.equal(extrinsic(p), W_ART);
        await nh_timeout(); assert.equal(intrinsic(p), 0); assert.equal(extrinsic(p), W_ART);
        assert.ok(p.active()); assert.deepEqual(getRngLog(), []); noLegacy(p);
    });
    test(`${p.name}: removing equipment during the timer cannot resurrect it at expiry`, async () => {
        await prepare(); const obj = await orb(); await select(p, 2);
        await freeinv(obj); clearMessages(); seed();
        assert.equal(intrinsic(p), 2); assert.equal(extrinsic(p), 0); assert.ok(p.active());
        await nh_timeout(); assert.equal(intrinsic(p), 1); assert.equal(extrinsic(p), 0);
        await nh_timeout(); assert.equal(intrinsic(p), 0); assert.equal(extrinsic(p), 0);
        assert.equal(p.active(), false); assert.deepEqual(getRngLog(), []); noLegacy(p);
    });
    test(`${p.name}: explicit zeroing keeps permanent bits and equipment intact`, async () => {
        const run = await prepare(); await orb(); game.u.intrinsic[p.h] = FROMOUTSIDE;
        await select(p, 5); set_itimeout(p.h, 0); clearMessages(); seed(); await nh_timeout();
        assert.equal(intrinsic(p), FROMOUTSIDE); assert.equal(extrinsic(p), W_ART);
        assert.ok(p.active()); assert.doesNotMatch(await menu(run), new RegExp(`${p.name} +\\[`));
        noLegacy(p); assert.deepEqual(getRngLog(), []);
    });
    test(`${p.name}: invulnerability pauses rather than consumes the timer`, async () => {
        await prepare(); await select(p, 2); game.u.uinvulnerable = true; seed();
        await nh_timeout(); assert.equal(intrinsic(p), 2);
        game.u.uinvulnerable = false; await nh_timeout(); assert.equal(intrinsic(p), 1);
        noLegacy(p); assert.deepEqual(getRngLog(), []);
    });
    test(`${p.name}: real save/recover retains timer, source bits and carried artifact`, async () => {
        await prepare(); await orb(); game.u.intrinsic[p.h] = FROMOUTSIDE; await select(p, 3);
        const expected = FROMOUTSIDE | 3;
        assert.equal(await dosave0(), true); assert.ok(game.storage.getItem(`save:${game.plname}`));
        assert.equal(await dorecover(), true);
        assert.equal(intrinsic(p), expected); assert.equal(extrinsic(p), W_ART);
        clearMessages(); seed();
        for (let i = 0; i < 3; i++) await nh_timeout();
        assert.equal(intrinsic(p), FROMOUTSIDE); assert.equal(extrinsic(p), W_ART);
        assert.ok(p.active()); noLegacy(p); assert.deepEqual(getRngLog(), []);
    });
    test(`${p.name}: pending feedback follows assignment and precedes completion`, async () => {
        const run = await prepare(); await orb(); seed();
        assert.ok(msgtype_parse_add(`stop "Timeout for ${p.name}"`));
        let entered, release, timer, done = false;
        const atMore = new Promise(resolve => { entered = resolve; });
        run._display.onEmptyQueue = () => {
            entered(); return new Promise(resolve => { release = resolve; });
        };
        const work = select(p, 5).then(() => { done = true; });
        try {
            await Promise.race([atMore, work.then(() => { throw Error('no More'); }),
                new Promise((_,reject) => { timer=setTimeout(() => reject(Error('More timeout')),2000); })]);
            await setImmediate(); assert.equal(done, false);
            assert.match(game._toplines, new RegExp(`Timeout for ${p.name}`));
            assert.equal(intrinsic(p), 5); assert.equal(extrinsic(p), W_ART);
            assert.deepEqual(getRngLog(), []);
        } finally {
            clearTimeout(timer); run._display.onEmptyQueue = () => 32; release?.(32); await work;
        }
        noLegacy(p);
    });
}
test('both properties selected in one menu have independent countdowns', async () => {
    await prepare(); resetInputState(); pushKeys('>>2n3o\r'); seed();
    await wiz_intrinsic(); assert.equal(intrinsic(properties[0]), 3); assert.equal(intrinsic(properties[1]), 2);
    for (let i=0; i<3; i++) await nh_timeout();
    for (const p of properties) { assert.equal(intrinsic(p), 0); assert.equal(extrinsic(p), 0); noLegacy(p); }
    assert.deepEqual(getRngLog(), []);
});
test('Eye of the Aethiopica conveys spell protection while carried, worn and taken off', async () => {
    await prepare(); const p = properties[1];
    const obj = mksobj(O.AMULET_OF_ESP, false, false);
    artifact_exists(obj, 'The Eye of the Aethiopica', true, ONAME_WISH); await addinv(obj);
    assert.equal(extrinsic(p), W_ART); await select(p, 3); await Amulet_on(obj);
    assert.equal(extrinsic(p), W_ART); await Amulet_off(); assert.equal(extrinsic(p), W_ART);
    await freeinv(obj); assert.equal(extrinsic(p), 0); assert.equal(intrinsic(p), 3);
    seed(); for (let i=0; i<3; i++) await nh_timeout(); assert.equal(p.active(), false); noLegacy(p);
    assert.deepEqual(getRngLog(), []);
});
