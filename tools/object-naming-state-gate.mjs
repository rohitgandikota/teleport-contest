// node --test tools/object-naming-state-gate.mjs
// Exercise private do_oname through the real queued docallcmd entry point.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { docallcmd, oname } from '../js/do_name.js';
import { cmdq_add_key, cmdq_clear } from '../js/cmd.js';
import { mksobj } from '../js/mkobj.js';
import { addinv, weight, fully_identify_obj } from '../js/invent.js';
import { discover_artifact } from '../js/artifact.js';
import { is_plural } from '../js/obj.js';
import { xname } from '../js/objnam.js';
import { ONAMES } from '../js/objects_data.js';
import { ART_STING, ART_EYES_OF_THE_OVERWORLD } from '../js/artilist_data.js';
import { CQ_CANNED, QBUFSZ, ECMD_OK } from '../js/const.js';
import { TOPLINE_EMPTY } from '../js/display.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

async function setup(type = ONAMES.DAGGER, quantity = 1) {
    const run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
        nethackrc: 'OPTIONS=name:State,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    const obj = mksobj(type, false, false);
    Object.assign(obj, { quan: quantity, dknown: 1 });
    obj.owt = weight(obj);
    await addinv(obj);
    return { run, obj };
}

async function nameObject(state, response, seed = 3) {
    const { run, obj } = state;
    const snapshots = [];
    const previousHook = game._preNhgetchHook;
    const previousDisp = Object.getOwnPropertyDescriptor(globalThis, '__rng_log_disp');
    const inventory = [...game.invent], id = obj.o_id, quantity = obj.quan, mass = obj.owt;
    const called = game.objects[obj.otyp].oc_uname;
    game._toplin = TOPLINE_EMPTY; game._toplines = ''; game._pending_message = '';
    game._win_stop = false;
    cmdq_clear(CQ_CANNED);
    cmdq_add_key(CQ_CANNED, 'i'); cmdq_add_key(CQ_CANNED, obj.invlet);
    for (const ch of response) run._display.pushKey(ch.charCodeAt(0));
    let acknowledgements = 0;
    run._display.onEmptyQueue = () => {
        assert.match(run._display.terminal.serialize(), /--More--/);
        assert.ok(++acknowledgements <= 2, 'bounded message acknowledgements');
        return 32;
    };
    game._preNhgetchHook = () => snapshots.push(game._toplines);
    initRng(seed); game.dispCtx = null; enableRngLog();
    globalThis.__rng_log_disp = true;
    try { assert.equal(await docallcmd(), ECMD_OK); }
    finally {
        game._preNhgetchHook = previousHook;
        if (previousDisp) Object.defineProperty(globalThis, '__rng_log_disp', previousDisp);
        else delete globalThis.__rng_log_disp;
    }
    const calls = getRngLog().map(s => s.replace(/\s*@.*$/, ''));
    assert.equal(game.invent.length, inventory.length);
    for (const [i, item] of inventory.entries())
        assert.equal(game.invent[i], item, 'naming preserves inventory order and object identity');
    assert.equal(obj.o_id, id); assert.equal(obj.quan, quantity); assert.equal(obj.owt, mass);
    assert.equal(game.objects[obj.otyp].oc_uname, called, 'shortening a prompt must restore the type name');
    return { calls, snapshots, message: game._toplines, acknowledgements,
        core: calls.filter(s => !s.startsWith('~d')),
        display: calls.filter(s => s.startsWith('~d')) };
}

test('ordinary note normalizes spaces without conduct or RNG', async () => {
    const state = await setup();
    const r = await nameObject(state, '  travel   knife  \r');
    assert.equal(state.obj.oname, 'travel knife');
    assert.equal(state.obj.oartifact || 0, 0);
    assert.equal(game.u.uconduct.literate, 0); assert.deepEqual(r.calls, []);
});
for (const [name, response, expected] of [
    ['spaces erase', '   \r', undefined], ['empty cancels', '\r', 'old note'],
    ['escape cancels', '\x1b', 'old note'],
]) test(name, async () => {
    const state = await setup(); await oname(state.obj, 'old note', 0);
    const r = await nameObject(state, response);
    assert.equal(state.obj.oname, expected);
    assert.equal(game.u.uconduct.literate, 0); assert.deepEqual(r.calls, []);
});
for (const [type, response, expected] of [
    [ONAMES.ELVEN_DAGGER, 'sTiNg', 'Sting'],
    [ONAMES.ELVEN_BROADSWORD, 'or-crist', 'Orcrist'],
]) test(`canonical unrestricted artifact: ${expected}`, async () => {
    const state = await setup(type);
    const r = await nameObject(state, response + '\r');
    assert.equal(state.obj.oname, expected); assert.ok(state.obj.oartifact);
    assert.equal(game.u.uconduct.literate, 1); assert.deepEqual(r.calls, []);
});
test('wrong base type retains the requested spelling and ordinary conduct', async () => {
    const state = await setup(ONAMES.DAGGER);
    const r = await nameObject(state, 'mAgIcBaNe\r');
    assert.equal(state.obj.oname, 'mAgIcBaNe'); assert.equal(state.obj.oartifact || 0, 0);
    assert.equal(game.u.uconduct.literate, 0); assert.deepEqual(r.calls, []);
});
for (const [name, type, quantity, request, canonical, duplicate] of [
    ['restricted', ONAMES.ATHAME, 1, 'mAgIcBaNe', 'Magicbane', false],
    ['stack', ONAMES.ELVEN_DAGGER, 3, 'Sting', 'Sting', false],
    ['duplicate', ONAMES.ELVEN_DAGGER, 1, 'sting', 'Sting', true],
    ['leading The', ONAMES.CRYSTAL_BALL, 1, 'orb of fate', 'The Orb of Fate', false],
]) test(`scuff ${name} after canonicalization`, async () => {
    const state = await setup(type, quantity);
    if (duplicate) {
        const other = mksobj(ONAMES.ELVEN_DAGGER, false, false);
        await oname(other, 'Sting', 0); await addinv(other);
    }
    const r = await nameObject(state, request + '\r');
    assert.notEqual(state.obj.oname, canonical); assert.equal(state.obj.oartifact || 0, 0);
    if (name === 'leading The') assert.ok(state.obj.oname.startsWith('The '));
    assert.equal(game.u.uconduct.literate, 1);
    assert.ok(r.display.length >= 1); assert.ok(r.core.length >= 2);
    assert.match(r.calls[0], /^~drn2\(2\)=/);
    assert.match(r.calls[1], new RegExp('^rn2\\(' + (canonical.startsWith('The ') ? canonical.length - 4 : canonical.length) + '\\)='));
    assert.ok(r.snapshots.includes('While engraving, your hand slips.'));
    assert.equal(r.acknowledgements, 1, 'flush the slip message before showing the engraved name');
    assert.equal(r.message, `You engrave: "${state.obj.oname}".`);
});
test('space-only scuff retries with a fresh display count and preserves The', async () => {
    const state = await setup(ONAMES.CRYSTAL_BALL);
    const r = await nameObject(state, 'orb of fate\r', 10);
    // ISAAC seed10: first count1 picks the space at index3 of "Orb of Fate".
    assert.deepEqual(r.calls.slice(0,5), [
        '~drn2(2)=0', 'rn2(11)=3', 'rn2(4)=3', '~drn2(2)=1', 'rn2(11)=9']);
    assert.ok(state.obj.oname.startsWith('The '));
    assert.notEqual(state.obj.oname, 'The Orb of Fate');
    assert.equal(game.u.uconduct.literate, 1);
});
for (const [name, response, resisted] of [
    ['rename', 'new blade\r', true], ['empty cancel', '\r', false], ['escape cancel', '\x1b', false],
]) test(`existing artifact ${name}`, async () => {
    const state = await setup(ONAMES.ELVEN_DAGGER); await oname(state.obj, 'Sting', 0);
    const r = await nameObject(state, response);
    assert.equal(state.obj.oname, 'Sting'); assert.equal(state.obj.oartifact, ART_STING);
    assert.equal(game.u.uconduct.literate, 0); assert.deepEqual(r.calls, []);
    assert.equal(r.message.includes('resists the attempt.'), resisted);
});
test('novel uses the owner/simple name and never asks for text', async () => {
    const state = await setup(ONAMES.SPE_NOVEL); state.obj.oname = 'The Light Fantastic';
    const r = await nameObject(state, 'unused\r');
    assert.equal(r.message, 'Your paperback book already has a published name.');
    assert.deepEqual(r.snapshots, []); assert.deepEqual(r.calls, []);
    assert.equal(state.obj.oname, 'The Light Fantastic');
});
for (const discovered of [false, true]) test(`Eyes prompt, discovered=${discovered}`, async () => {
    const state = await setup(ONAMES.LENSES);
    await oname(state.obj, 'The Eyes of the Overworld', 0);
    state.obj.known = 1;
    if (discovered) fully_identify_obj(state.obj);
    const r = await nameObject(state, '\x1b');
    assert.equal(is_plural(state.obj), discovered);
    assert.equal(r.snapshots[0], discovered
        ? 'What do you want to name these Eyes of the Overworld? '
        : 'What do you want to name this pair of lenses named the Eyes of the Overworld? ');
    assert.deepEqual(r.calls, []);
});
test('shared plural predicate follows discovery identity, not other artifacts or object knowledge', async () => {
    await setup(); discover_artifact(ART_STING);
    const eyes = { quan: 1, oartifact: ART_EYES_OF_THE_OVERWORLD, known: 1 };
    assert.equal(is_plural(eyes), false);
    discover_artifact(ART_EYES_OF_THE_OVERWORLD);
    assert.equal(is_plural(eyes), true);
    assert.equal(is_plural({ quan: 1, oartifact: ART_STING }), false);
    assert.equal(is_plural({ quan: 2, oartifact: 0 }), true);
    assert.equal(is_plural({ quan: 1, oartifact: 0 }), false);
    assert.equal(is_plural({ quan: 0, oartifact: 0 }), true);
});
test('long prompt uses safe_qbuf without truncating either stored name', async () => {
    const state = await setup(ONAMES.POT_GAIN_ENERGY);
    game.objects[state.obj.otyp].oc_uname = 'M'.repeat(62);
    state.obj.oname = 'N'.repeat(62);
    assert.ok(('What do you want to name this ' + xname(state.obj) + '?').length >= QBUFSZ);
    const r = await nameObject(state, '\x1b');
    assert.equal(r.snapshots[0].trimEnd(), 'What do you want to name this potion called MMMMMMMM... named '
        + 'N'.repeat(62) + '?');
    assert.ok(r.snapshots[0].trimEnd().length < QBUFSZ);
    assert.equal(state.obj.oname, 'N'.repeat(62)); assert.deepEqual(r.calls, []);
});
