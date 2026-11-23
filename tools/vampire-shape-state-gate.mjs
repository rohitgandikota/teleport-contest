// node --test tools/vampire-shape-state-gate.mjs
// C mon.c:4941-4977, wizard.c:117-130. Reach private pickvampshape through newcham.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { newcham, decide_to_shapeshift } from '../js/mon.js';
import { makemon, newmonhp } from '../js/makemon.js';
import { set_mon_data } from '../js/mondata.js';
import { mksobj, add_to_minv, add_to_container } from '../js/mkobj.js';
import { TOPLINE_EMPTY } from '../js/display.js';
import { find_defensive, use_defensive } from '../js/muse.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ART_ORB_OF_DETECTION, ART_EYE_OF_THE_AETHIOPICA, ART_STING } from '../js/artilist_data.js';
import { ROOM, STAIRS, POOL, MOAT, WATER, LAVAPOOL, LAVAWALL, ICE,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, DB_MOAT, DB_LAVA, DB_ICE, DB_FLOOR, DB_EAST,
    NO_MINVENT, MM_NOCOUNTBIRTH, MM_NOMSG, MM_ASLEEP, G_GENOD, G_EXTINCT,
    STRAT_WAITFORU, MON_DETACH } from '../js/const.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

const X = 30, Y = 10;
const VAMP = PMNAMES.PM_VAMPIRE, LORD = PMNAMES.PM_VAMPIRE_LEADER;
const VLAD = PMNAMES.PM_VLAD_THE_IMPALER, BAT = PMNAMES.PM_VAMPIRE_BAT;
const FOG = PMNAMES.PM_FOG_CLOUD, WOLF = PMNAMES.PM_WOLF;

async function setup(base, current = base) {
    const run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game._toplin = TOPLINE_EMPTY; game._toplines = ''; game._pending_message = '';
    run._display.onEmptyQueue = () => { throw new Error('Unexpected input: ' + game._toplines); };
    game.level.monsters = []; game.level.monAt.clear();
    game.level.traps = []; game.level.objects = []; game.level.objAt.clear();
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.rogue_level = { dnum: 0, dlevel: 18 };
    game.juiblex_level = { dnum: 2, dlevel: 6 };
    for (let x = X - 1; x <= X + 1; x++)
        for (let y = Y - 1; y <= Y + 1; y++)
            Object.assign(game.level.at(x, y), { typ: ROOM, drawbridgemask: 0, roomno: 0 });
    // An ordinary bat avoids makemon's initial vampire shape roll. Set a valid
    // vampire state with the canonical data pointer before resetting RNG.
    const mon = makemon(game.mons[BAT], X, Y,
        NO_MINVENT | MM_NOCOUNTBIRTH | MM_NOMSG | MM_ASLEEP);
    assert.ok(mon);
    set_mon_data(mon, game.mons[current]);
    newmonhp(mon, current);
    Object.assign(mon, { cham: base, mstrategy: 0, minvent: [], mflee: 1 });
    return mon;
}

async function select(mon, seed, expected, prefix, unchanged = false) {
    const old = mon.mnum, base = mon.cham, position = [mon.mx, mon.my];
    const terrain = { ...game.level.at(mon.mx, mon.my) };
    initRng(seed); enableRngLog();
    const changed = await newcham(mon, null, 0);
    const calls = getRngLog().map(s => s.replace(/\s*@.*$/, ''));
    assert.equal(mon.mnum, expected);
    assert.equal(mon.data, game.mons[expected]);
    assert.equal(mon.cham, base);
    assert.equal(changed, expected === old ? 0 : 1);
    assert.deepEqual([mon.mx, mon.my], position);
    assert.deepEqual(game.level.at(mon.mx, mon.my), terrain);
    assert.deepEqual(calls.slice(0, prefix.length), prefix);
    if (unchanged) assert.deepEqual(calls, prefix, 'no HP/gender rolls when the form is unchanged');
    return calls;
}

// Literal C outcomes and ISAAC-seeded calls, not a second selector implementation.
test('Rogue suppresses fog after its roll, and still draws the alternate-form roll', async () => {
    const mon = await setup(VAMP, BAT); game.u.uz = { ...game.rogue_level };
    await select(mon, 5, BAT, ['rn2(4)=0', 'rn2(4)=2'], true);
});
test('Rogue suppresses wolf after its roll, then draws fog and alternate rolls', async () => {
    const mon = await setup(LORD, BAT); game.u.uz = { ...game.rogue_level };
    await select(mon, 21, BAT, ['rn2(10)=0', 'rn2(4)=1', 'rn2(4)=1'], true);
});
test('ordinary vampire can retain fog', async () => {
    await select(await setup(VAMP, FOG), 5, FOG, ['rn2(4)=0', 'rn2(4)=2'], true);
});
test('ordinary leader can retain wolf without drawing for fog', async () => {
    await select(await setup(LORD, WOLF), 21, WOLF, ['rn2(10)=0', 'rn2(4)=1'], true);
});
test('empty-handed Vlad uses wolfchance three', async () => {
    await select(await setup(VLAD, WOLF), 1, WOLF, ['rn2(3)=0', 'rn2(4)=2'], true);
});
test('Rogue also suppresses empty-handed Vlad wolf selection', async () => {
    const mon = await setup(VLAD, BAT); game.u.uz = { ...game.rogue_level };
    await select(mon, 10, BAT, ['rn2(3)=0', 'rn2(4)=3', 'rn2(4)=2'], true);
});

for (const [name, typ, under, liquid, juiblex] of [
    ['room', ROOM, 0, false], ['pool', POOL, 0, true],
    ['moat', MOAT, 0, true], ['water wall', WATER, 0, true],
    ['lava pool', LAVAPOOL, 0, true], ['lava wall', LAVAWALL, 0, true],
    ['ice', ICE, 0, false], ['raised moat', DRAWBRIDGE_UP, DB_MOAT, true],
    ['raised lava', DRAWBRIDGE_UP, DB_LAVA, true],
    ['raised ice', DRAWBRIDGE_UP, DB_ICE, false],
    ['raised floor', DRAWBRIDGE_UP, DB_FLOOR, false],
    ['lowered lava', DRAWBRIDGE_DOWN, DB_LAVA, false],
    ['Juiblex direct moat', MOAT, 0, true, true],
    ['Juiblex raised moat', DRAWBRIDGE_UP, DB_MOAT, false, true],
]) test(`walking form terrain: ${name}`, async () => {
    const current = liquid ? BAT : WOLF;
    const mon = await setup(LORD, current);
    Object.assign(game.level.at(X, Y), { typ, drawbridgemask: under | DB_EAST });
    if (juiblex) game.u.uz = { ...game.juiblex_level };
    await select(mon, 21, current,
        liquid ? ['rn2(10)=0', 'rn2(4)=1', 'rn2(4)=1'] : ['rn2(10)=0', 'rn2(4)=1'], true);
});

test('genocided wolf returns the unshifted base without a second draw', async () => {
    const mon = await setup(LORD); game.mvitals[WOLF].mvflags |= G_GENOD;
    await select(mon, 21, LORD, ['rn2(10)=0'], true);
});
test('genocided fog returns the unshifted base without a second draw', async () => {
    const mon = await setup(VAMP); game.mvitals[FOG].mvflags |= G_GENOD;
    await select(mon, 5, VAMP, ['rn2(4)=0'], true);
});
test('genocide short-circuits even when the current form is alternate', async () => {
    const mon = await setup(LORD, BAT); game.mvitals[WOLF].mvflags |= G_GENOD;
    // The next draw is newcham's gender roll, not pickvampshape's rn2(4).
    await select(mon, 21, LORD, ['rn2(10)=0', 'rn2(10)=5']);
});
test('extinction alone does not prevent the selected form', async () => {
    const mon = await setup(LORD, WOLF); game.mvitals[WOLF].mvflags |= G_EXTINCT;
    await select(mon, 21, WOLF, ['rn2(10)=0', 'rn2(4)=1'], true);
});
test('an alternate form can randomly return to its base', async () => {
    await select(await setup(LORD, BAT), 11, LORD, ['rn2(10)=0', 'rn2(4)=0']);
});
test('the natural base does not draw the alternate-form roll', async () => {
    await select(await setup(VAMP), 4, BAT, ['rn2(4)=2', 'rn2(10)=7']);
});

function object(type, artifact = 0) {
    const obj = mksobj(type, false, false); obj.oartifact = artifact; return obj;
}
const specialItems = [
    ['Amulet', ONAMES.AMULET_OF_YENDOR], ['Bell', ONAMES.BELL_OF_OPENING],
    ['Candelabrum', ONAMES.CANDELABRUM_OF_INVOCATION], ['Book', ONAMES.SPE_BOOK_OF_THE_DEAD],
    ['another role quest artifact', ONAMES.CRYSTAL_BALL, ART_ORB_OF_DETECTION],
    ['own role quest artifact', ONAMES.AMULET_OF_ESP, ART_EYE_OF_THE_AETHIOPICA],
];
for (const [name, type, artifact] of specialItems)
    test(`Vlad retains a carrying form for ${name}`, async () => {
        const mon = await setup(VLAD);
        add_to_minv(mon, object(type, artifact));
        add_to_minv(mon, object(ONAMES.DAGGER));
        const inventory = [...mon.minvent];
        await select(mon, 1, VLAD, [], true);
        assert.deepEqual(mon.minvent, inventory);
    });
for (const [name, makeItem] of [
    ['fake Amulet', () => object(ONAMES.FAKE_AMULET_OF_YENDOR)],
    ['ordinary artifact', () => object(ONAMES.ELVEN_DAGGER, ART_STING)],
    ['special inside container', () => {
        const bag = object(ONAMES.SACK); add_to_container(bag, object(ONAMES.BELL_OF_OPENING)); return bag;
    }],
]) test(`Vlad may shift with ${name}`, async () => {
    const mon = await setup(VLAD, WOLF); add_to_minv(mon, makeItem());
    await select(mon, 1, WOLF, ['rn2(3)=0', 'rn2(4)=2'], true);
});
test('special-item switch break still draws when Vlad is already alternate', async () => {
    const mon = await setup(VLAD, BAT);
    add_to_minv(mon, object(ONAMES.CANDELABRUM_OF_INVOCATION));
    await select(mon, 1, VLAD, ['rn2(4)=1']);
});
test('a special item does not lock an ordinary vampire in base form', async () => {
    const mon = await setup(VAMP, FOG); add_to_minv(mon, object(ONAMES.BELL_OF_OPENING));
    await select(mon, 5, FOG, ['rn2(4)=0', 'rn2(4)=2'], true);
});

test('natural fog caller reaches the same Rogue selector', async () => {
    const mon = await setup(LORD, FOG); game.u.uz = { ...game.rogue_level };
    mon.minvis = mon.perminvis = 1;
    initRng(5); enableRngLog();
    await decide_to_shapeshift(mon);
    assert.equal(mon.mnum, BAT);
    assert.deepEqual(getRngLog().slice(0, 4), ['rn2(4)=0', 'rn2(10)=0', 'rn2(4)=2', 'rn2(4)=2']);
});
test('WAITFORU leaves the natural caller and RNG alone', async () => {
    const mon = await setup(LORD, FOG); mon.mstrategy = STRAT_WAITFORU;
    initRng(5); enableRngLog(); await decide_to_shapeshift(mon);
    assert.equal(mon.mnum, FOG); assert.deepEqual(getRngLog(), []);
});
test('natural Vlad caller retains its base and special item after the change roll', async () => {
    const mon = await setup(VLAD);
    add_to_minv(mon, object(ONAMES.CANDELABRUM_OF_INVOCATION));
    mon.minvis = mon.perminvis = 1;
    initRng(10); enableRngLog(); await decide_to_shapeshift(mon);
    assert.equal(mon.mnum, VLAD);
    assert.equal(mon.minvent[0].otyp, ONAMES.CANDELABRUM_OF_INVOCATION);
    assert.deepEqual(getRngLog(), ['rn2(6)=0']);
});

for (const [name, type, remains] of [
    ['special item', ONAMES.CANDELABRUM_OF_INVOCATION, true],
    ['ordinary item', ONAMES.DAGGER, false],
]) test(`muse escape caller retains its ${name} behavior`, async () => {
    const mon = await setup(LORD); add_to_minv(mon, object(type));
    game.level.at(X, Y).typ = STAIRS;
    game.stairs = { sx: X, sy: Y, up: true, tolev: { dnum: 0, dlevel: 0 }, next: null };
    assert.equal(find_defensive(mon, true), true);
    initRng(3); enableRngLog();
    assert.equal(await use_defensive(mon), remains ? 0 : 2);
    // C m_detach removes the grid slot now; dmonsfree purges the chain later.
    assert.equal(game.level.monsters.includes(mon), true);
    assert.equal(game.level.monAt.get(`${X},${Y}`) === mon, remains);
    assert.equal(!!(mon.mstate & MON_DETACH), !remains);
    assert.equal(mon.mhp > 0, remains);
    assert.equal(mon.minvent.length, remains ? 1 : 0);
    // Ordinary inventory is examined once by mongone's obj_resists(0, 0).
    assert.deepEqual(getRngLog(), remains ? [] : ['rn2(100)=31']);
});
