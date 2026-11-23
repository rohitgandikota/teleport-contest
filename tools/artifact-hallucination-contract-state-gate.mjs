// Return contracts and C ordering, independent of native screen expectations.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mkobj.js';
import { addinv, freeinv, obfree, useup, useupall, obj_extract_self } from '../js/invent.js';
import { set_artifact_intrinsic } from '../js/artifact.js';
import { setworn, setnotworn } from '../js/worn.js';
import { setuwep, setuswapwep, setuqwep } from '../js/wield.js';
import { oname } from '../js/do_name.js';
import { delobj, delobj_core } from '../js/mon.js';
import { nhl_gamestate_save, nhl_gamestate_restore } from '../js/nhlua.js';
import { ART_GRAYSWANDIR, ART_STING, ART_SUNSWORD } from '../js/artilist_data.js';
import { ONAMES } from '../js/objects_data.js';
import { W_WEP, W_ART, W_SWAPWEP, W_QUIVER, OBJ_DELETED, OBJ_INVENT, ONAME_NO_FLAGS } from '../js/const.js';

const base = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url))).segments[0];
async function setup() {
    const run = await runSegment({ ...base, moves: ' ', storage: new InMemoryStorage() });
    run._display.onEmptyQueue = () => 32;
    game._preNhgetchHook = null;
    for (const obj of [...(game.invent || [])]) freeinv(obj);
    game.invent = [];
    for (const obj of [...game.level.objects]) obj_extract_self(obj);
    game.level.monsters = []; game.level.monAt.clear();
    game.u.uwep = game.u.uswapwep = game.u.uquiver = null;
    game.u.uarm = game.u.uarmc = game.u.uarmh = game.u.uarmg = null;
    game.u.uarms = game.u.uarmf = game.u.uarmu = null;
    game.u.ublindf = game.u.uamul = game.u.uleft = game.u.uright = null;
    game.u.uball = game.u.uchain = null;
    game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
    game.u.twoweap = false;
    game.unweapon = true;
    game.light_sources = []; game.timer_base = [];
    game.gmst = null; game.gmst_stored = false;
    return run;
}
async function object(artifact = 0, otyp = ONAMES.SILVER_SABER) {
    const obj = mksobj(otyp, false, false);
    obj.oartifact = artifact;
    if (artifact === ART_GRAYSWANDIR) obj.oname = 'Grayswandir';
    await addinv(obj);
    return obj;
}
function wield(obj) { game.u.uwep = obj; obj.owornmask = W_WEP; game.unweapon = false; }
const tick = () => new Promise(resolve => setImmediate(resolve));

for (const entry of ['ordinary setter', 'Sting setter', 'carried Grayswandir',
    'ordinary setworn', 'Sting setworn', 'ordinary setnotworn', 'Sting setnotworn',
    'ordinary setuwep', 'same weapon', 'Sunsword old light',
    'ordinary oname', 'Sting oname', 'ordinary obfree', 'ordinary useupall',
    'ordinary singleton useup', 'stack useup', 'Grayswandir secondary', 'Grayswandir quiver']) {
    test(`${entry} retains its synchronous result`, async () => {
        await setup();
        const artifact = entry.startsWith('Sting') ? ART_STING
            : entry.includes('Grayswandir') ? ART_GRAYSWANDIR : 0;
        const obj = await object(artifact, artifact === ART_STING ? ONAMES.ELVEN_DAGGER : ONAMES.SILVER_SABER);
        let result;
        switch (entry) {
        case 'ordinary setter': case 'Sting setter': result = set_artifact_intrinsic(obj, true, W_WEP); break;
        case 'carried Grayswandir': result = set_artifact_intrinsic(obj, true, W_ART); break;
        case 'ordinary setworn': case 'Sting setworn':
            result = setworn(obj, W_WEP); assert.equal(game.u.uwep, obj); break;
        case 'ordinary setnotworn': case 'Sting setnotworn':
            wield(obj); result = setnotworn(obj); assert.equal(game.u.uwep, null); break;
        case 'ordinary setuwep':
            result = setuwep(obj); assert.equal(result, null); assert.equal(game.u.uwep, obj); break;
        case 'same weapon':
            wield(obj); result = setuwep(obj); assert.equal(result, null); break;
        case 'Sunsword old light': {
            const sun = await object(ART_SUNSWORD, ONAMES.LONG_SWORD);
            wield(sun); sun.lamplit = 1;
            result = setuwep(obj); assert.equal(result, sun); assert.equal(sun.lamplit, 0); break;
        }
        case 'ordinary oname': case 'Sting oname':
            // A non-artifact object is required to exercise naming's tail.
            obj.oartifact = 0; wield(obj);
            result = oname(obj, entry === 'Sting oname' ? 'Sting' : 'Test blade', ONAME_NO_FLAGS);
            assert.equal(result, obj); break;
        case 'ordinary obfree': freeinv(obj); result = obfree(obj); assert.equal(obj.where, OBJ_DELETED); break;
        case 'ordinary useupall': result = useupall(obj); assert.equal(obj.where, OBJ_DELETED); break;
        case 'ordinary singleton useup': result = useup(obj); assert.equal(obj.where, OBJ_DELETED); break;
        case 'stack useup':
            obj.quan = 2; result = useup(obj); assert.equal(obj.quan, 1); assert.equal(obj.where, OBJ_INVENT); break;
        case 'Grayswandir secondary': result = setuswapwep(obj); assert.equal(game.u.uswapwep, obj); break;
        case 'Grayswandir quiver': result = setuqwep(obj); assert.equal(game.u.uquiver, obj); break;
        }
        assert.equal(typeof result?.then, 'undefined');
        if (!['ordinary setuwep', 'same weapon', 'Sunsword old light',
            'ordinary oname', 'Sting oname'].includes(entry))
            assert.equal(result, undefined);
    });
}

for (const [name, invoke] of Object.entries({
    useupall, useup, obfree, delobj,
    delobj_core: obj => delobj_core(obj, true),
})) test(`${name} waits before deleting a worn HALRES object`, async () => {
    await setup();
    const obj = await object(ART_GRAYSWANDIR); wield(obj);
    let release, reached = 0, finished = false, completion;
    const pause = new Promise(resolve => { release = resolve; });
    globalThis.__artifactHalresAuditPause = (target, on, mask) => {
        if (target === obj && !on && mask === W_WEP) { reached++; return pause; }
        return null;
    };
    try {
        completion = Promise.resolve(invoke(obj)).then(() => { finished = true; });
        await tick();
        assert.equal(reached, 1);
        assert.equal(finished, false);
        assert.notEqual(obj.where, OBJ_DELETED);
        assert.equal(game.u.uwep, null, 'C clears the slot before its artifact effect');
        if (name === 'useupall' || name === 'useup')
            assert.ok(game.invent.includes(obj), 'C frees inventory after setnotworn');
    } finally { release(); await completion; delete globalThis.__artifactHalresAuditPause; }
    assert.equal(obj.where, OBJ_DELETED);
});

test('setuwep waits and resolves the old light object when gaining HALRES', async () => {
    await setup();
    const sun = await object(ART_SUNSWORD, ONAMES.LONG_SWORD);
    const gray = await object(ART_GRAYSWANDIR);
    wield(sun); sun.lamplit = 1;
    let release, completion;
    const pause = new Promise(resolve => { release = resolve; });
    globalThis.__artifactHalresAuditPause = (obj, on) => obj === gray && on ? pause : null;
    try {
        completion = setuwep(gray);
        assert.equal(typeof completion?.then, 'function');
        await tick();
        assert.equal(game.u.uwep, gray);
        assert.equal(sun.lamplit, 1, 'C light handling follows the completed worn transition');
    } finally { release(); delete globalThis.__artifactHalresAuditPause; }
    assert.equal(await completion, sun);
    assert.equal(sun.lamplit, 0);
});

test('naming a wielded HALRES object resolves the original object', async () => {
    await setup();
    const obj = await object(); wield(obj);
    const pending = oname(obj, 'Grayswandir', ONAME_NO_FLAGS);
    assert.equal(typeof pending?.then, 'function');
    assert.equal(await pending, obj);
    assert.equal(game.u.uprops.HALLUC_RES, W_WEP);
});

test('setworn passes the original combined mask at both C artifact call sites', async () => {
    await setup();
    const gray = await object(ART_GRAYSWANDIR);
    const dagger = await object(0, ONAMES.DAGGER);
    const calls = [], mask = W_WEP | W_QUIVER;
    globalThis.__artifactHalresAuditPause = (obj, on, bits) => {
        calls.push([obj, on, bits]);
        return null;
    };
    try {
        await setworn(gray, mask);
        assert.equal(game.u.uprops.HALLUC_RES, mask);
        await setworn(dagger, mask);
        assert.equal(game.u.uprops.HALLUC_RES || 0, 0);
    } finally { delete globalThis.__artifactHalresAuditPause; }
    assert.deepEqual(calls, [[gray, true, mask], [gray, false, mask]]);
});

test('tutorial save completes each removal before storing inventory and snapshotting u', async () => {
    await setup();
    const gray = await object(ART_GRAYSWANDIR); wield(gray);
    const dagger = await object(0, ONAMES.DAGGER);
    let release, completion;
    const pause = new Promise(resolve => { release = resolve; });
    globalThis.__artifactHalresAuditPause = (obj, on) => obj === gray && !on ? pause : null;
    try {
        completion = nhl_gamestate_save();
        await tick();
        assert.equal(typeof completion?.then, 'function');
        assert.equal(game.gmst_stored, false);
        assert.equal(game.gmst, null);
        assert.deepEqual(game.invent, [gray, dagger]);
        assert.equal(gray.owornmask, 0);
    } finally { release(); await completion; delete globalThis.__artifactHalresAuditPause; }
    assert.equal(game.gmst_stored, true);
    assert.deepEqual(game.gmst.invent, [gray, dagger]);
    assert.equal(gray.owornmask, W_WEP);
    assert.deepEqual(game.invent, []);
});

test('tutorial restore finishes worn effects before restoring the u snapshot', async () => {
    await setup();
    const gray = await object(ART_GRAYSWANDIR); wield(gray);
    await nhl_gamestate_save();
    game.gmst.ubak.uhp = 123; game.u.uhp = 45;
    let release, completion, reached = 0;
    const pause = new Promise(resolve => { release = resolve; });
    globalThis.__artifactHalresAuditPause = (obj, on) => {
        if (obj === gray && on) { reached++; return pause; }
        return null;
    };
    try {
        completion = nhl_gamestate_restore();
        await tick();
        assert.equal(reached, 1);
        assert.equal(game.u.uwep, gray);
        assert.equal(game.u.uhp, 45);
        assert.equal(game.gmst_stored, true);
    } finally { release(); await completion; delete globalThis.__artifactHalresAuditPause; }
    assert.equal(game.u.uhp, 123);
    assert.equal(game.gmst_stored, false);
    assert.equal(game.gmst, null);
});

test('tutorial save without HALRES stays synchronous', async () => {
    await setup();
    const obj = await object(); wield(obj);
    assert.equal(nhl_gamestate_save(), undefined);
    assert.equal(game.gmst_stored, true);
    assert.deepEqual(game.gmst.invent, [obj]);
});
