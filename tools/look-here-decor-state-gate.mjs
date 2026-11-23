// Source contracts from pickup.c:317-425 and timeout.c:902-930.
// Constructed state uses real messages, properties, timers and input waits.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import * as pickup from '../js/pickup.js';
import { obj_extract_self, dfeature_at, look_here } from '../js/invent.js';
import { ice_descr, waterbody_name } from '../js/pager.js';
import { read_engr_at } from '../js/engrave.js';
import { vtense } from '../js/objnam.js';
import { make_blinded, make_hallucinated } from '../js/potion.js';
import { Blind, Underwater } from '../js/youprop.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { initRng, enableRngLog, getRngLog, rnd } from '../js/rng.js';
import { nh_timeout, start_timer, TIMER_LEVEL, MELT_ICE_AWAY } from '../js/timeout.js';
import { pline, TOPLINE_EMPTY } from '../js/display.js';
import { COLNO, ROWNO, ROOM, STONE, ICE, DRAWBRIDGE_UP, DB_ICE, DB_FLOOR,
    POOL, MOAT, WATER, LAVAPOOL, LAVAWALL, FOUNTAIN, DOOR, D_NODOOR, D_ISOPEN,
    D_BROKEN, D_CLOSED, FROMOUTSIDE, FROMEXPER, TIMEOUT, PLNMSG_BACK_ON_GROUND,
    LOOKHERE_SKIP_DFEATURE, IRONBARS } from '../js/const.js';
import { IN_SIGHT } from '../js/vision.js';
import { ONAMES } from '../js/objects_data.js';

const x = 35, y = 10;
function clearMessages() {
    Object.assign(game, { _toplin: TOPLINE_EMPTY, _toplines: '', _prevmsg: '',
        _pending_message: '', _msg_history: [], _msg_maxrow: 0, _msg_maxcol: 0,
        _win_stop: false });
    game.iflags.last_msg = 0;
}
function messages() { return [...game._msg_history, game._toplines, game._prevmsg].join('\n'); }
function resetRng() { initRng(6202); enableRngLog(); }
async function setup({ typ = ICE, blind = false, mention = true } = {}) {
    const run = await runSegment({ seed: 6202, datetime: '20000110090000', moves: ' ',
        storage: new InMemoryStorage(),
        nethackrc: 'OPTIONS=role:Barbarian,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' });
    run._display.onEmptyQueue = () => 32;
    game._preNhgetchHook = null;
    game.level.monsters = []; game.level.monAt.clear(); game.level.traps = [];
    for (const obj of [...game.level.objects]) await obj_extract_self(obj);
    Object.assign(game.u, { ux: x, uy: y, uinwater: 0, utrap: 0, uswallow: false,
        ustuck: null, usteed: null, uprops: {}, intrinsic: {}, blocked: {}, umoved: false,
        uinvulnerable: false, xray_range: 0 });
    Object.assign(game.level.at(x, y), { typ, drawbridgemask: DB_ICE, lastseentyp: FOUNTAIN });
    Object.assign(game.flags, { mention_decor: mention, verbose: true });
    Object.assign(game.iflags, { prev_decor: ROOM, defer_decor: false, ice_rating: 99 });
    game.decor_fumble_override = game.decor_levitate_override = false;
    game.timer_base = [];
    await make_blinded(blind ? 100 : 0, false);
    assert.equal(Blind(), blind);
    game.viz_array = Array.from({ length: ROWNO }, () => new Uint8Array(COLNO));
    if (!blind) game.viz_array[y][x] = IN_SIGHT;
    game.vision_full_recalc = 0;
    game.level.at(x, y).lastseentyp = FOUNTAIN;
    clearMessages(); resetRng();
    return run;
}
async function describe() {
    const result = await pickup.describe_decor();
    assert.deepEqual(getRngLog(), [], 'ordinary decor spends no core RNG');
    return result;
}
async function deferred(setup) {
    assert.equal(typeof pickup.deferred_decor, 'function', 'C deferred_decor is a runtime helper');
    return await pickup.deferred_decor(setup);
}
async function displayLog(action) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__rng_log_disp');
    try { globalThis.__rng_log_disp = true; await action(); }
    finally {
        if (previous) Object.defineProperty(globalThis, '__rng_log_disp', previous);
        else delete globalThis.__rng_log_disp;
    }
}

for (const mention of [false, true]) for (const typ of [ICE, DRAWBRIDGE_UP])
    test(`force_decor: mention=${mention}, terrain=${typ}`, async () => {
        await setup({ typ, mention });
        game.u.intrinsic.HFumbling = FROMOUTSIDE | 1;
        const intrinsic = { ...game.u.intrinsic }, extrinsic = { ...game.u.uprops };
        assert.equal(await pickup.force_decor(false), undefined, 'C returns void');
        assert.match(messages(), /There is solid ice here\./);
        assert.equal(game.iflags.prev_decor, mention ? ICE : STONE);
        assert.equal(game.level.at(x, y).lastseentyp, typ, 'raw tile, not SURFACE_AT');
        assert.equal(game.decor_fumble_override, false);
        assert.equal(game.decor_levitate_override, false);
        assert.equal(game.iflags.defer_decor, false, 'forced feedback never defers');
        assert.deepEqual(game.u.intrinsic, intrinsic);
        assert.deepEqual(game.u.uprops, extrinsic);
        assert.deepEqual(getRngLog(), []);
    });

for (const probing of [false, true]) test(`force_decor: blind levitation probing=${probing}`, async () => {
    await setup({ blind: true }); game.u.intrinsic.HLevitation = FROMOUTSIDE;
    start_timer(14, TIMER_LEVEL, MELT_ICE_AWAY, (x << 16) | y);
    const timers = structuredClone(game.timer_base), nextId = game.timer_id;
    await pickup.force_decor(probing);
    assert.match(messages(), probing ? /There is slushy ice here\./ : /There is ice here\./);
    assert.equal(game.iflags.ice_rating, probing ? 5 : -1);
    assert.equal(game.decor_levitate_override, false);
    assert.equal(ice_descr(x, y), 'ice', 'override cannot leak into a later ordinary lookup');
    assert.equal(game.iflags.ice_rating, -1);
    assert.deepEqual(game.timer_base, timers); assert.equal(game.timer_id, nextId);
    assert.equal(game.u.intrinsic.HLevitation, FROMOUTSIDE);
    assert.deepEqual(getRngLog(), []);
});

for (const value of [1, FROMOUTSIDE | 1, FROMEXPER | 1])
    test(`describe_decor: masked intrinsic ${value} defers before any helper/RNG`, async () => {
        await setup(); await make_hallucinated(100, false); clearMessages();
        game.u.intrinsic.HFumbling = value; game.iflags.prev_decor = FOUNTAIN;
        const lastseentyp = game.level.at(x, y).lastseentyp;
        await displayLog(async () => {
            resetRng();
            assert.equal(await pickup.describe_decor(), false);
            assert.deepEqual(getRngLog(), [], 'deferral precedes hallucinated dfeature_at');
        });
        assert.equal(game.iflags.defer_decor, true);
        assert.equal(game.iflags.prev_decor, FOUNTAIN);
        assert.equal(game.iflags.ice_rating, 99);
        assert.equal(game.level.at(x, y).lastseentyp, lastseentyp);
        assert.equal(messages(), '\n');
    });
for (const [intrinsic, extrinsic] of [[0, 0], [2, 0], [FROMOUTSIDE, 0], [0, 1]])
    test(`describe_decor: non-expiring intrinsic=${intrinsic}, extrinsic=${extrinsic}`, async () => {
        await setup(); game.u.intrinsic.HFumbling = intrinsic; game.u.uprops.FUMBLING = extrinsic;
        assert.equal(await describe(), true);
        assert.match(messages(), /There is solid ice here\./);
        assert.equal(game.iflags.defer_decor, false);
        assert.equal(game.iflags.prev_decor, ICE);
    });
test('describe_decor: existing deferral permits catch-up at intrinsic one', async () => {
    await setup(); game.u.intrinsic.HFumbling = 1; game.iflags.defer_decor = true;
    assert.equal(await describe(), true);
    assert.match(messages(), /solid ice/);
    assert.equal(game.iflags.defer_decor, true, 'describe_decor does not clear its caller flag');
});
test('describe_decor: disabled mention still returns false on the deferral arm', async () => {
    await setup({ mention: false }); game.u.intrinsic.HFumbling = 1;
    assert.equal(await describe(), false);
    assert.equal(game.iflags.defer_decor, false); assert.equal(game.iflags.prev_decor, ROOM);
    assert.equal(messages(), '\n');
});

for (const setting of [true, false]) test(`deferred_decor: mention off, setup=${setting}`, async () => {
    await setup({ mention: false }); game.iflags.defer_decor = true;
    assert.equal(await deferred(setting), undefined);
    assert.equal(game.iflags.defer_decor, false); assert.equal(game.iflags.prev_decor, ROOM);
    assert.equal(game.iflags.ice_rating, 99); assert.equal(messages(), '\n');
    assert.deepEqual(getRngLog(), []);
});
test('deferred_decor: setup preserves terrain memory and performs no description', async () => {
    await setup(); assert.equal(await deferred(true), undefined);
    assert.equal(game.iflags.defer_decor, true); assert.equal(game.iflags.prev_decor, ROOM);
    assert.equal(game.iflags.ice_rating, 99); assert.equal(messages(), '\n');
    assert.deepEqual(getRngLog(), []);
});
test('deferred_decor: catch-up describes before clearing its flag', async () => {
    await setup(); game.iflags.defer_decor = true; game.u.intrinsic.HFumbling = 1;
    assert.equal(await deferred(false), undefined);
    assert.match(messages(), /There is solid ice here\./);
    assert.equal(game.iflags.defer_decor, false); assert.equal(game.iflags.prev_decor, ICE);
    assert.equal(game.level.at(x, y).lastseentyp, FOUNTAIN, 'only force_decor writes lastseentyp');
    assert.deepEqual(getRngLog(), []);
});

for (const typ of [ROOM, ICE, FOUNTAIN]) test(`describe_decor: repeated terrain ${typ}`, async () => {
    await setup({ typ }); game.iflags.prev_decor = typ;
    assert.equal(await describe(), typ === FOUNTAIN, 'furniture repeats; ordinary terrain does not');
    assert.equal(messages().includes('There is'), typ === FOUNTAIN);
    assert.equal(game.iflags.prev_decor, typ);
});
for (const verbose of [false, true]) for (const mention of [false, true])
    test(`describe_decor: ice repetition, verbose=${verbose}, mention=${mention}`, async () => {
        await setup({ mention }); game.flags.verbose = verbose;
        const line = verbose ? 'There is solid ice here.' : 'Solid ice.';
        await pline(line); game.iflags.prev_decor = ROOM;
        const history = [...game._msg_history], top = game._toplines;
        assert.equal(await describe(), true, 'return is true even when Norep suppresses feedback');
        assert.deepEqual(game._msg_history, history, 'short appended messages do not bank tty history');
        assert.equal(game._toplines, mention ? top : `${top}  ${line}`);
        assert.equal(game.pline_flags ?? 0, 0, 'Norep flag does not leak');
        assert.equal(game.iflags.prev_decor, mention ? ICE : STONE);
    });

for (const prev of [POOL, MOAT, WATER, DRAWBRIDGE_UP])
    test(`describe_decor: ice reached from pool type ${prev} uses back_on_ground`, async () => {
        await setup(); game.iflags.prev_decor = prev;
        assert.equal(await describe(), true);
        assert.doesNotMatch(messages(), /There is/);
        assert.match(messages(), /You are back on solid ice\./);
        assert.equal(game.iflags.last_msg, PLNMSG_BACK_ON_GROUND);
        assert.equal(game.iflags.prev_decor, ICE);
    });
for (const prev of [POOL, DRAWBRIDGE_UP, LAVAPOOL, LAVAWALL, ICE])
    test(`describe_decor: dry floor after ${prev}`, async () => {
        await setup({ typ: ROOM }); game.iflags.prev_decor = prev;
        assert.equal(await describe(), true);
        assert.match(messages(), /You are back on solid ground\./);
        assert.equal(game.iflags.last_msg, PLNMSG_BACK_ON_GROUND);
    });
test('describe_decor: existing back-on-ground marker suppresses duplicate feedback', async () => {
    await setup({ typ: ROOM }); game.iflags.prev_decor = LAVAWALL;
    game.iflags.last_msg = PLNMSG_BACK_ON_GROUND;
    assert.equal(await describe(), true); assert.equal(messages(), '\n');
    assert.equal(game.iflags.prev_decor, ROOM);
});

for (const underwater of [false, true]) for (const raw of [0, 1])
    test(`describe_decor: canonical Underwater=${underwater}, raw=${raw}`, async () => {
        await setup({ typ: FOUNTAIN }); game.u.uinwater = +underwater; game.u.uprops.UNDERWATER = raw;
        assert.equal(Underwater(), underwater); assert.equal(await describe(), true);
        assert.equal(messages().includes('There is a fountain here.'), !underwater);
        assert.equal(game.iflags.prev_decor, FOUNTAIN);
    });
for (const underwater of [false, true]) test(`describe_decor: canonical dry-ground gate ${underwater}`, async () => {
    await setup({ typ: ROOM }); game.iflags.prev_decor = ICE;
    game.u.uinwater = +underwater; game.u.uprops.UNDERWATER = +!underwater;
    assert.equal(await describe(), true);
    assert.equal(messages().includes('You are back on solid ground.'), !underwater);
    assert.equal(game.iflags.prev_decor, ROOM);
});
for (const [mask, feature] of [[D_NODOOR, null], [D_ISOPEN, null], [D_BROKEN, 'broken door'], [D_CLOSED, 'closed door']])
    test(`describe_decor: door mask ${mask}`, async () => {
        await setup({ typ: DOOR }); game.level.at(x, y).doormask = mask;
        assert.equal(await describe(), true);
        if (feature) assert.match(messages(), new RegExp('There is a ' + feature + ' here\\.'));
        else assert.equal(messages(), '\n');
        assert.equal(game.iflags.prev_decor, DOOR);
    });
test('describe_decor: raised drawbridge floor compares surface type', async () => {
    await setup({ typ: DRAWBRIDGE_UP }); game.level.at(x, y).drawbridgemask = DB_FLOOR;
    game.iflags.prev_decor = STONE; // C dbridge.c:128 maps DB_FLOOR to STONE.
    assert.equal(await describe(), false); assert.equal(messages(), '\n');
    assert.equal(game.iflags.prev_decor, STONE);
});
test('describe_decor: waterbody name preserves the no-article swamp exception', async () => {
    await setup({ typ: MOAT }); game.juiblex_level = { ...game.u.uz };
    assert.equal(waterbody_name(x, y), 'swamp');
    assert.equal(await describe(), true); assert.match(messages(), /There is swamp here\./);
});

for (const active of [false, true]) test(`timeout: deferred decor after Fumbling expiry, renewal=${active}`, async () => {
    await setup({ typ: ROOM }); game.iflags.prev_decor = ICE;
    game.u.intrinsic.HFumbling = FROMOUTSIDE | 1; game.u.uprops.FUMBLING = +active;
    game.iflags.defer_decor = true;
    resetRng(); const renewal = active ? rnd(20) : 0, expected = [...getRngLog()]; resetRng();
    await nh_timeout();
    assert.equal(game.iflags.defer_decor, false);
    assert.equal(game.u.intrinsic.HFumbling, renewal, 'FROMOUTSIDE cleared before optional renewal');
    assert.match(messages(), /You are back on solid ground\./);
    assert.deepEqual(getRngLog(), expected, 'no extra decor RNG after the C renewal draw');
});
test('timeout: movement trip message precedes deferred back-on-ground feedback', async () => {
    await setup({ typ: ROOM });
    const obj = mksobj(ONAMES.DAGGER, false, false); await place_object(obj, x, y);
    await look_here(0, LOOKHERE_SKIP_DFEATURE); clearMessages();
    game.iflags.prev_decor = ICE; game.iflags.defer_decor = true;
    game.u.intrinsic.HFumbling = 1; game.u.umoved = true; resetRng();
    await nh_timeout();
    const text = messages();
    assert.match(text, /You trip over a dagger\./);
    assert.ok(text.indexOf('trip over') < text.indexOf('You are back on solid ground.'));
    assert.equal(game.multi, -2); assert.equal(game.iflags.defer_decor, false);
    assert.equal(game.u.intrinsic.HFumbling, 0); assert.deepEqual(getRngLog(), []);
});
test('timeout: disabled mention clears pending decor without feedback', async () => {
    await setup({ mention: false }); game.iflags.defer_decor = true; game.u.intrinsic.HFumbling = 1;
    await nh_timeout(); assert.equal(game.iflags.defer_decor, false);
    assert.equal(game.iflags.prev_decor, ROOM); assert.equal(messages(), '\n');
    assert.deepEqual(getRngLog(), []);
});
test('timeout: no pending decor does not describe after expiry', async () => {
    await setup(); game.u.intrinsic.HFumbling = 1;
    await nh_timeout(); assert.equal(game.iflags.defer_decor, false);
    assert.equal(game.iflags.prev_decor, ROOM); assert.equal(messages(), '\n');
    assert.deepEqual(getRngLog(), []);
});
test('timeout: renewed intrinsic precedes hallucinated deferred description', async () => {
    await setup(); await make_hallucinated(100, false); clearMessages();
    game.u.intrinsic.HFumbling = FROMOUTSIDE | 1; game.u.uprops.FUMBLING = 1;
    game.iflags.defer_decor = true;
    await displayLog(async () => {
        game.dispCtx = null; resetRng(); const renewed = rnd(20); dfeature_at(x, y);
        const expected = [...getRngLog()]; assert.equal(expected.length, 2);
        game.dispCtx = null; resetRng(); await nh_timeout();
        assert.deepEqual(getRngLog(), expected, 'C rnd(20), then ice waterbody display sample');
        assert.equal(game.u.intrinsic.HFumbling & TIMEOUT, renewed);
    });
    assert.equal(game.iflags.defer_decor, false); assert.match(messages(), /frozen/);
});

for (const mode of ['force', 'deferred', 'timeout']) test(`${mode}: bookkeeping waits for the real More prompt`, async () => {
    const run = await setup({ blind: true });
    if (mode === 'deferred') assert.equal(typeof pickup.deferred_decor, 'function');
    if (mode === 'force') game.u.intrinsic.HLevitation = FROMOUTSIDE;
    else { game.iflags.defer_decor = true; game.u.intrinsic.HFumbling = 1; }
    await pline('The previous message is long enough to require acknowledgment before the ice.');
    let entered, release, timer;
    const waiting = new Promise(resolve => { entered = resolve; });
    run._display.onEmptyQueue = () => { entered(); return new Promise(resolve => { release = resolve; }); };
    const pending = mode === 'force' ? pickup.force_decor(true)
        : mode === 'deferred' ? deferred(false) : nh_timeout();
    try {
        await Promise.race([waiting, new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('More not reached')), 2000);
        })]);
        assert.equal(game.iflags.prev_decor, mode === 'force' ? STONE : ROOM);
        assert.equal(game.level.at(x, y).lastseentyp, FOUNTAIN);
        assert.equal(game.decor_fumble_override, mode === 'force');
        assert.equal(game.decor_levitate_override, mode === 'force');
        assert.equal(game.iflags.defer_decor, mode !== 'force');
        if (mode === 'timeout') assert.equal(game.u.intrinsic.HFumbling, 0);
    } finally {
        clearTimeout(timer); run._display.onEmptyQueue = () => 32; release?.(32);
        await pending;
    }
    assert.equal(game.iflags.prev_decor, ICE); assert.equal(game.iflags.defer_decor, false);
    assert.equal(game.decor_fumble_override, false); assert.equal(game.decor_levitate_override, false);
    assert.equal(game.level.at(x, y).lastseentyp, mode === 'force' ? ICE : FOUNTAIN);
});

// Grammar controls are regression-only: the current C liquid table is singular.
for (const mode of ['empty', 'single', 'summary', 'menu'])
    test(`look_here: shared feature sentence in the ${mode} branch`, async () => {
        const run = await setup({ typ: FOUNTAIN }), screens = [];
        if (mode !== 'empty') {
            await place_object(mksobj(ONAMES.DAGGER, false, false), x, y);
            if (mode === 'menu') await place_object(mksobj(ONAMES.ARROW, false, false), x, y);
        }
        game.flags.pile_limit = mode === 'summary' ? 1 : 5;
        run._display.onEmptyQueue = () => {
            screens.push(game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
            return 32;
        };
        resetRng(); await look_here(mode === 'summary' ? 1 : 0, 0);
        assert.match(messages() + '\n' + screens.join('\n'), /There is a fountain here\./);
        if (mode === 'summary') assert.match(messages(), /There is an object here\./);
        if (mode === 'single') assert.match(messages(), /You see here a dagger\./);
        if (mode === 'menu') assert.match(screens.join('\n'), /Things that are here:/);
        assert.deepEqual(getRngLog(), []);
    });
for (const [typ, sentence] of [[LAVAPOOL, 'There is molten lava here.'],
    [IRONBARS, 'There is a set of iron bars here.'], [ICE, 'There is solid ice here.']])
    test(`look_here: mass or singular terrain ${typ}`, async () => {
        await setup({ typ }); await look_here(0, 0);
        assert.ok(messages().includes(sentence)); assert.deepEqual(getRngLog(), []);
    });
for (const thickness of [false, true]) test(`look_here: hallucinated ice, thickness=${thickness}`, async () => {
    await setup(); await make_hallucinated(100, false); clearMessages();
    if (!thickness) { game.u.intrinsic.HLevitation = FROMOUTSIDE; game.viz_array[y][x] = 0; }
    await displayLog(async () => {
        game.dispCtx = null; resetRng();
        const feature = dfeature_at(x, y); await read_engr_at(x, y);
        const expectedCalls = [...getRngLog()]; assert.equal(expectedCalls.length, 1);
        assert.ok(feature.startsWith(thickness ? 'solid frozen ' : 'frozen '));
        const sentence = `There is ${thickness ? 'a ' : ''}${feature} here.`;
        game.dispCtx = null; resetRng(); await look_here(0, 0);
        assert.ok(messages().includes(sentence)); assert.deepEqual(getRngLog(), expectedCalls);
    });
});
test('C liquid inventory: no current frozen terrain requests plural are', () => {
    const c = readFileSync(new URL('../nethack-c/recorder/src/do_name.c', import.meta.url), 'utf8');
    const body = c.slice(c.indexOf('hliquids[]'), c.indexOf('};', c.indexOf('hliquids[]')))
        .replace(/\/\*[\s\S]*?\*\//g, '');
    const liquids = [...body.matchAll(/"([^"]+)"/g)].map(match => match[1]);
    assert.equal(liquids.length, 40);
    for (const liquid of [...liquids, 'water']) assert.equal(vtense(`frozen ${liquid}`, 'are'), 'is', liquid);
    assert.equal(vtense('frozen bubbles', 'are'), 'are', 'hypothetical plural, absent from the pinned producer');
});

for (const mode of ['same terrain', 'underwater', 'ice after pool'])
    test(`describe_decor: discarded hallucination draws for ${mode}`, async () => {
        await setup(); await make_hallucinated(100, false); clearMessages();
        game.iflags.prev_decor = mode === 'same terrain' ? ICE : mode === 'ice after pool' ? POOL : ROOM;
        game.u.uinwater = mode === 'underwater' ? 1 : 0;
        await displayLog(async () => {
            game.dispCtx = null; resetRng(); dfeature_at(x, y);
            const finalFeature = mode === 'ice after pool' ? ice_descr(x, y) : null;
            const expected = [...getRngLog()];
            assert.equal(expected.length, mode === 'ice after pool' ? 2 : 1);
            game.dispCtx = null; resetRng();
            assert.equal(await pickup.describe_decor(), mode !== 'same terrain');
            assert.deepEqual(getRngLog(), expected, 'dfeature sample precedes suppression or back_on_ground sample');
            if (mode === 'ice after pool') assert.ok(messages().includes(`You are back on ${finalFeature}.`));
            else assert.equal(messages(), '\n');
        });
    });
test('look_here: forced blind ice retains the discarded first hallucination sample', async () => {
    await setup({ blind: true, mention: false }); await make_hallucinated(100, false); clearMessages();
    await displayLog(async () => {
        game.dispCtx = null; resetRng(); dfeature_at(x, y); const forced = ice_descr(x, y);
        await read_engr_at(x, y);
        const expected = [...getRngLog()]; assert.equal(expected.length, 2);
        game.dispCtx = null; resetRng(); await look_here(0, 0);
        assert.deepEqual(getRngLog(), expected, 'C look_here samples first, then force_decor samples again');
        assert.ok(messages().includes(`There is ${forced} here.`));
        assert.match(messages(), /You try to feel what is on it\./);
        assert.equal(game.iflags.prev_decor, STONE);
    });
});
