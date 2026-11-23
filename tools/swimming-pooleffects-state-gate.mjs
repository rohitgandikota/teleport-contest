// Constructed source controls, not native coverage. Expectations follow
// mkmaze.c:1687-1722, hack.c:3230-3308, youprop.h:258-267,
// vision.c:545-621 and display.c:939-949. No runtime instrumentation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { obj_extract_self } from '../js/invent.js';
import { water_friction } from '../js/mkmaze.js';
import { pooleffects } from '../js/hack.js';
import { set_uasmon } from '../js/polyself.js';
import { makemon, remove_monster } from '../js/makemon.js';
import { PMNAMES } from '../js/monst_data.js';
import { make_blinded } from '../js/potion.js';
import { Blind, Swimming, Wwalking } from '../js/youprop.js';
import { initRng, enableRngLog, getRngLog, rn2 } from '../js/rng.js';
import { vision_reset, vision_recalc, COULD_SEE, IN_SIGHT } from '../js/vision.js';
import { pline, TOPLINE_EMPTY, newsym, show_glyph_cell, glyph_at, gbuf_at } from '../js/display.js';
import { ROOM, POOL, MOAT, WATER, LAVAPOOL, ICE, DOOR, D_NODOOR, ALTAR, AIR,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, DB_MOAT, DB_ICE, FROMOUTSIDE, FROMFORM,
    PLNMSG_BACK_ON_GROUND, TT_PIT, COLNO, ROWNO } from '../js/const.js';

const x = 35, y = 10;
function clearMessages() {
    Object.assign(game, { _toplin: TOPLINE_EMPTY, _toplines: '', _prevmsg: '',
        _pending_message: '', _msg_history: [], _msg_maxrow: 0, _msg_maxcol: 0,
        _win_stop: false });
    game.iflags.last_msg = 0;
}
function messages() { return [...game._msg_history, game._toplines, game._prevmsg].join('\n'); }
function resetRng(seed = 6202) { initRng(seed); enableRngLog(); }
function calls() { return getRngLog().map(call => call.replace(/\s*@\s.*$/, '')); }
async function setup(typ = ROOM) {
    const run = await runSegment({ seed: 6202, datetime: '20000110090000', moves: ' ',
        storage: new InMemoryStorage(),
        nethackrc: 'OPTIONS=role:Barbarian,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' });
    run._display.onEmptyQueue = () => 32;
    game._preNhgetchHook = null;
    game.level.monsters = []; game.level.monAt.clear(); game.level.traps = [];
    for (const obj of [...game.level.objects]) await obj_extract_self(obj);
    Object.assign(game.u, { ux: x, uy: y, dx: 1, dy: 0, uinwater: 0, utrap: 0,
        uundetected: false, uswallow: false, ustuck: null, usteed: null,
        uprops: {}, intrinsic: {}, blocked: {}, umoved: false, uinvulnerable: false,
        xray_range: 0, mh: 50, mhmax: 50 });
    for (let row = y - 4; row <= y + 4; row++)
        for (let col = x - 4; col <= x + 4; col++)
            Object.assign(game.level.at(col, row), { typ: ROOM, lit: 1,
                waslit: 0, doormask: D_NODOOR, drawbridgemask: DB_MOAT });
    game.level.at(x, y).typ = typ;
    game.flags.verbose = true; game.flags.mention_decor = false;
    game.vision_full_recalc = 0;
    clearMessages(); resetRng();
    return run;
}
function form(mnum) { game.u.umonnum = mnum; set_uasmon(); }
function monster(mnum) {
    const mon = makemon(game.mons[mnum], x + 3, y, 0);
    assert.ok(mon); remove_monster(mon.mx, mon.my);
    game.level.monsters = game.level.monsters.filter(item => item !== mon);
    return mon;
}
// Search only the primitive RNG for a small C branch input, never the function
// under test. Each control states its complete expected range/order explicitly.
function seedFor(ranges, accept) {
    for (let seed = 1; seed <= 10000; seed++) {
        resetRng(seed);
        const values = ranges.map(range => rn2(range));
        if (accept(values)) return { seed, values, calls: calls() };
    }
    throw Error('No seed for the requested primitive RNG branch');
}
async function friction(expected, dx, dy, turbulent) {
    resetRng(expected.seed);
    assert.equal(await water_friction(), undefined);
    assert.deepEqual(calls(), expected.calls);
    assert.deepEqual([game.u.dx, game.u.dy], [dx, dy]);
    assert.equal(messages().includes('Water turbulence affects your movements.'), turbulent);
}

for (const source of ['intrinsic', 'form', 'extrinsic', 'both', 'steed'])
    test(`water_friction: ${source} Swimming rolls rn2(4) first`, async () => {
        await setup(POOL);
        if (source === 'form') form(PMNAMES.PM_WATER_ELEMENTAL);
        if (source === 'intrinsic' || source === 'both') game.u.intrinsic.HSwimming = FROMOUTSIDE;
        if (source === 'extrinsic' || source === 'both') game.u.uprops.SWIMMING = 1;
        if (source === 'steed') game.u.usteed = monster(PMNAMES.PM_WATER_ELEMENTAL);
        assert.equal(Swimming(), true);
        if (source === 'form') assert.equal(game.u.intrinsic.HSwimming & FROMFORM, FROMFORM);
        const expected = seedFor([4], values => values[0] !== 0);
        const properties = structuredClone({ intrinsic: game.u.intrinsic, extrinsic: game.u.uprops });
        await friction(expected, 1, 0, false);
        assert.deepEqual({ intrinsic: game.u.intrinsic, extrinsic: game.u.uprops }, properties);
    });
test('water_friction: no Swimming skips rn2(4)', async () => {
    await setup(POOL); assert.equal(Swimming(), false);
    await friction(seedFor([3], values => values[0] !== 0), 1, 0, false);
});
test('water_friction: failed Swimming advantage precedes the direction draw', async () => {
    await setup(POOL); game.u.intrinsic.HSwimming = FROMOUTSIDE;
    await friction(seedFor([4, 3], values => values[0] === 0 && values[1] !== 0), 1, 0, false);
});
for (const swimming of [false, true]) test(`water_friction: stationary Swimming=${swimming}`, async () => {
    await setup(POOL); game.u.dx = game.u.dy = 0;
    if (swimming) game.u.intrinsic.HSwimming = FROMOUTSIDE;
    await friction(swimming ? seedFor([4], () => true) : { seed: 4, calls: [] }, 0, 0, false);
});
for (const [name, typ, juiblex] of [
    ['pool', POOL, false], ['moat', MOAT, false], ['water wall', WATER, false],
    ['raised moat bridge', DRAWBRIDGE_UP, false], ['Juiblex moat', MOAT, true],
]) test(`water_friction: x cancellation accepts ${name}`, async () => {
    await setup(POOL); game.level.at(x, y + 1).typ = typ;
    if (juiblex) game.juiblex_level = { ...game.u.uz };
    await friction(seedFor([3, 3], values => values[0] === 0 && values[1] === 2), 0, 1, true);
});
for (const juiblex of [false, true]) test(`water_friction: retry dry/Juiblex bridge, Juiblex=${juiblex}`, async () => {
    await setup(POOL);
    game.level.at(x, y + 1).typ = juiblex ? DRAWBRIDGE_UP : ROOM;
    if (juiblex) game.juiblex_level = { ...game.u.uz };
    await friction(seedFor([3, 3, 3], v => v[0] === 0 && v[1] === 2 && v[2] === 1), 0, 0, true);
});
test('water_friction: y cancellation uses the canonical raised moat bridge', async () => {
    await setup(POOL); game.u.dx = 0; game.u.dy = 1;
    game.level.at(x + 1, y).typ = DRAWBRIDGE_UP;
    await friction(seedFor([3, 3], v => v[0] === 0 && v[1] === 2), 1, 0, true);
});
test('water_friction: diagonal tries rn2(6), then rn2(5), then displacement', async () => {
    await setup(POOL); game.u.dy = 1; game.level.at(x + 1, y).typ = POOL;
    await friction(seedFor([6, 5, 3], v => v[0] !== 0 && v[1] === 0 && v[2] === 2), 1, 0, true);
});
test('water_friction: diagonal x cancellation omits the second decision draw', async () => {
    await setup(POOL); game.u.dy = 1; game.level.at(x, y + 1).typ = POOL;
    await friction(seedFor([6, 3], v => v[0] === 0 && v[1] === 2), 0, 1, true);
});

for (const [name, typ, text] of [
    ['floor', ROOM, 'You are back on solid ground.'],
    ['doorway', DOOR, 'You are back in a doorway.'],
    ['altar', ALTAR, 'You are back on an altar.'],
    ['bridge', DRAWBRIDGE_DOWN, 'You are back on a bridge.'],
    ['ice', ICE, 'You are back on solid ice.'],
]) test(`pooleffects: leaving water for ${name} uses back_on_ground`, async () => {
    await setup(typ); game.u.uinwater = 1;
    assert.equal(await pooleffects(true), false);
    assert.ok(messages().includes(text), messages());
    assert.equal(game.u.uinwater, 0); assert.equal(game.vision_full_recalc, 1);
    assert.equal(game.iflags.last_msg, PLNMSG_BACK_ON_GROUND);
    assert.deepEqual(calls(), []);
});
test('pooleffects: terse back_on_ground keeps its marker', async () => {
    await setup(DOOR); game.u.uinwater = 1; game.flags.verbose = false;
    assert.equal(await pooleffects(false), false); assert.match(messages(), /Back in a doorway\./);
    assert.equal(game.iflags.last_msg, PLNMSG_BACK_ON_GROUND); assert.deepEqual(calls(), []);
});
for (const bubble of [false, true]) test(`pooleffects: leaving-water feedback completes before state, bubble=${bubble}`, async () => {
    const run = await setup(bubble ? AIR : DOOR); game.u.uinwater = 1;
    if (bubble) game.water_level = { ...game.u.uz };
    await pline('The previous message is long enough to require acknowledgment before moving.');
    let entered, release, timer;
    const waiting = new Promise(resolve => { entered = resolve; });
    run._display.onEmptyQueue = () => { entered(); return new Promise(resolve => { release = resolve; }); };
    const pending = pooleffects(true);
    try {
        await Promise.race([waiting, new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('More not reached')), 2000);
        })]);
        assert.equal(game.u.uinwater, 1); assert.equal(game.iflags.last_msg, 0);
    } finally {
        clearTimeout(timer); run._display.onEmptyQueue = () => 32; release?.(32);
        assert.equal(await pending, false);
    }
    assert.equal(game.u.uinwater, 0); assert.equal(game.iflags.last_msg, PLNMSG_BACK_ON_GROUND);
    assert.match(messages(), bubble ? /You pop into an air bubble\./ : /You are back in a doorway\./);
    assert.equal(game.vision_full_recalc, bubble ? 0 : 1); assert.deepEqual(calls(), []);
});
for (const source of ['intrinsic', 'extrinsic', 'both'])
    test(`pooleffects: ${source} Wwalking prevents entering and causes leaving`, async () => {
        await setup(POOL); game.u.intrinsic.HSwimming = FROMOUTSIDE;
        if (source !== 'extrinsic') game.u.intrinsic.HWwalking = FROMOUTSIDE;
        if (source !== 'intrinsic') game.u.uprops.WWALKING = 1;
        const props = structuredClone({ intrinsic: game.u.intrinsic, extrinsic: game.u.uprops });
        assert.equal(await pooleffects(true), false);
        assert.equal(game.u.uinwater, 0); assert.equal(messages(), '\n');
        game.u.uinwater = 1;
        assert.equal(await pooleffects(false), false);
        assert.equal(game.u.uinwater, 0); assert.match(messages(), /slowly rise above the surface/);
        assert.deepEqual({ intrinsic: game.u.intrinsic, extrinsic: game.u.uprops }, props);
        assert.deepEqual(calls(), []);
    });
for (const [name, typ, walking, waterPlane] of [
    ['ordinary swimmer', POOL, false, false], ['water wall overrides walking', WATER, true, false],
    ['Water plane suppresses walking', POOL, true, true],
]) test(`pooleffects: ${name} enters safely`, async () => {
    await setup(typ); game.u.intrinsic.HSwimming = FROMOUTSIDE;
    if (walking) game.u.intrinsic.HWwalking = FROMOUTSIDE;
    if (waterPlane) game.water_level = { ...game.u.uz };
    assert.equal(await pooleffects(true), false); assert.equal(game.u.uinwater, 1);
    assert.match(messages(), typ === WATER ? /You plunge into/ : /You fall into/);
    assert.deepEqual(calls(), []); assert.equal(game.invent?.length ?? 0, 0);
});
for (const guard of ['levitation', 'flight', 'held', 'floating steed'])
    test(`pooleffects: retained ${guard} entry guard`, async () => {
        await setup(POOL);
        if (guard === 'levitation') game.u.intrinsic.HLevitation = FROMOUTSIDE;
        if (guard === 'flight') game.u.intrinsic.HFlying = FROMOUTSIDE;
        if (guard === 'held') game.u.ustuck = monster(PMNAMES.PM_LARGE_MIMIC);
        if (guard === 'floating steed') game.u.usteed = monster(PMNAMES.PM_FLOATING_EYE);
        resetRng(); assert.equal(await pooleffects(true), false);
        assert.equal(game.u.uinwater, 0); assert.equal(messages(), '\n'); assert.deepEqual(calls(), []);
    });
for (const [name, mnum, hidden, enters] of [
    ['hidden piercer', PMNAMES.PM_ROCK_PIERCER, true, false],
    ['visible piercer', PMNAMES.PM_ROCK_PIERCER, false, true],
    ['hidden mimic', PMNAMES.PM_LARGE_MIMIC, true, true],
    ['ordinary hero', null, true, true],
]) test(`pooleffects: ${name} ceiling predicate`, async () => {
    await setup(POOL); if (mnum !== null) form(mnum);
    game.u.intrinsic.HSwimming = FROMOUTSIDE; game.u.uundetected = hidden;
    clearMessages(); resetRng();
    assert.equal(await pooleffects(true), false);
    assert.equal(game.u.uinwater, +enters); assert.equal(messages().includes('You fall into'), enters);
    assert.equal(game.u.uundetected, hidden); assert.deepEqual(calls(), []);
});
test('pooleffects: stationary swimmer avoids drowning draws; a new step retains rn2(5)', async () => {
    await setup(POOL); game.u.intrinsic.HSwimming = FROMOUTSIDE; game.u.uinwater = 1;
    game.level.at(x - 1, y).typ = POOL;
    assert.equal(await pooleffects(false), false); assert.deepEqual(calls(), []);
    const expected = seedFor([5], v => v[0] !== 0); resetRng(expected.seed);
    assert.equal(await pooleffects(true), false); assert.deepEqual(calls(), expected.calls);
    assert.equal(game.u.uinwater, 1); assert.equal(messages(), '\n');
});

for (const source of ['none', 'intrinsic', 'extrinsic', 'both'])
    test(`Wwalking: ${source} is excluded only on Water plane`, async () => {
        await setup();
        if (source === 'intrinsic' || source === 'both') game.u.intrinsic.HWwalking = FROMOUTSIDE;
        if (source === 'extrinsic' || source === 'both') game.u.uprops.WWALKING = 1;
        const before = structuredClone({ intrinsic: game.u.intrinsic, extrinsic: game.u.uprops });
        assert.equal(Wwalking(), source !== 'none');
        game.air_level = { ...game.u.uz }; assert.equal(Wwalking(), source !== 'none');
        game.water_level = { ...game.u.uz }; assert.equal(Wwalking(), false);
        assert.deepEqual({ intrinsic: game.u.intrinsic, extrinsic: game.u.uprops }, before);
        assert.deepEqual(calls(), []);
    });
for (const blind of [false, true]) for (const place of ['ordinary', 'underwater', 'pit'])
    test(`vision_recalc: ${place}, blind=${blind}`, async () => {
        await setup(POOL); await make_blinded(blind ? 100 : 0, false);
        assert.equal(Blind(), blind);
        if (place === 'underwater') game.u.uinwater = 1;
        if (place === 'pit') { game.u.utrap = 5; game.u.utraptype = TT_PIT; }
        game.level.at(x, y + 1).typ = POOL;
        vision_reset(); resetRng(); vision_recalc(0);
        const far = game.viz_array[y][x + 3], dryAdjacent = game.viz_array[y][x + 1];
        assert.equal(!!(far & COULD_SEE), blind || place === 'ordinary');
        assert.equal(!!(dryAdjacent & COULD_SEE), blind || place !== 'underwater');
        assert.equal(!!(game.viz_array[y + 1][x] & COULD_SEE), true);
        assert.equal(game.viz_array.some(row => row.some(bits => bits & IN_SIGHT)), !blind);
        assert.deepEqual(calls(), []);
    });
for (const control of ['swallowed', 'disabled'])
    test(`vision_recalc: ${control} wins over blind underwater geometry`, async () => {
        await setup(POOL); await make_blinded(100, false); game.u.uinwater = 1;
        if (control === 'swallowed') game.u.uswallow = true;
        vision_reset(); resetRng(); vision_recalc(control === 'disabled' ? 2 : 0);
        assert.equal(game.viz_array.some(row => row.some(bits => bits & COULD_SEE)), false);
        assert.deepEqual(calls(), []);
    });
for (const [name, dx, dy, typ, underwater, waterPlane, updates] of [
    ['dry hero', 0, 0, DOOR, true, false, false],
    ['dry neighbor', 1, 0, ROOM, true, false, false],
    ['far pool', 2, 0, POOL, true, false, false],
    ['adjacent pool', 1, 0, POOL, true, false, true],
    ['diagonal lava', 1, 1, LAVAPOOL, true, false, true],
    ['adjacent ice', 1, 0, ICE, true, false, true],
    ['raised ice bridge', 1, 0, DRAWBRIDGE_UP, true, false, true],
    ['Water plane dry neighbor', 1, 0, ROOM, true, true, true],
    ['ordinary dry neighbor', 1, 0, ROOM, false, false, true],
]) test(`newsym: ${name}`, async () => {
    await setup(POOL); game.u.uinwater = +underwater;
    if (waterPlane) game.water_level = { ...game.u.uz };
    const tx = x + dx, ty = y + dy, loc = game.level.at(tx, ty);
    Object.assign(loc, { typ, waslit: 0, lit: 1, drawbridgemask: DB_ICE });
    game.viz_array = Array.from({ length: ROWNO }, () => new Uint8Array(COLNO));
    game.viz_array[ty][tx] = IN_SIGHT | COULD_SEE;
    show_glyph_cell(tx, ty, 'I', 0, false, 0, { kind: 'invis' });
    const before = structuredClone({ glyph: glyph_at(tx, ty), cell: gbuf_at(tx, ty) });
    resetRng(); newsym(tx, ty);
    assert.equal(loc.waslit, +updates);
    if (updates) assert.notDeepEqual(glyph_at(tx, ty), before.glyph);
    else assert.deepEqual({ glyph: glyph_at(tx, ty), cell: gbuf_at(tx, ty) }, before);
    assert.deepEqual(calls(), []);
});
