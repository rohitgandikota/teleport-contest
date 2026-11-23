// Run: node --loader ./tools/stormbringer-routing-state-loader.mjs --test tools/stormbringer-routing-state-gate.mjs
// Source-derived state controls for uhitm.c:308-326 and 462-521.
// Real gameplay helpers and RNG; no dependency mocks and no native claims.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { stormbringerSetup } from './stormbringer-routing-cases.mjs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { setuwep } from '../js/wield.js';
import { artifact_exists } from '../js/artifact.js';
import { makemon, NO_MINVENT, MM_NOMSG } from '../js/makemon.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ART_STORMBRINGER, ART_ORCRIST } from '../js/artilist_data.js';
import { ROOM, IN_SIGHT, COULD_SEE, STRAT_WAITMASK } from '../js/const.js';
import { initRng, enableRngLog, getRngLog, rn2, rnd } from '../js/rng.js';
import { do_attack, attack_checks } from '../js/uhitm.js';

let events, prompts;
const seed = (n = 3) => { initRng(n); enableRngLog(); };
const text = () => [...game._msg_history, game._toplines].join('\n');
const entered = name => events.find(e => e.name === name);
const queried = () => prompts.some(m => m.includes('Really attack'));
async function setup({ storm = true, tame = false, safe = true, confirm = true,
    force = false, sleeping = true } = {}) {
    const run = await runSegment({ ...stormbringerSetup, moves: ' ', storage: new InMemoryStorage() });
    prompts = []; events = [];
    run._display.onEmptyQueue = () => {
        const m = game.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd();
        prompts.push(m);
        if (prompts.length > 30) throw Error('unexpected repeated prompt');
        return m.includes('Really attack') ? 110 : 27; // decline or dismiss
    };
    game._preNhgetchHook = null;
    game.level.monsters = []; game.level.monAt.clear();
    game.level.objects = []; game.level.traps = []; game.regions = [];
    Object.assign(game.u, { ux: 31, uy: 10, dx: 1, dy: 0, uswallow: false,
        ustuck: null, usteed: null, intrinsic: {}, uprops: {}, blocked: {},
        ublind: 0, ublindf: null, uhp: 1000, uhpmax: 1000, uball: null,
        uwep: null, twoweap: false });
    Object.assign(game.flags, { safe_dog: safe, confirm, verbose: true });
    Object.assign(game.context, { forcefight: force, move: 1, run: 0, travel: false });
    game.bhitpos = { x: 32, y: 10 }; game.override_confirmation = false;
    game.invent = [];
    for (let x = 23; x <= 39; x++) for (let y = 2; y <= 18; y++) {
        Object.assign(game.level.at(x, y), { typ: ROOM, doormask: 0,
            lit: 1, waslit: 1, seenv: 255, roomno: 0 });
        game.viz_array[y][x] = IN_SIGHT | COULD_SEE;
    }
    const weapon = mksobj(storm ? ONAMES.RUNESWORD : ONAMES.BROADSWORD, false, false);
    weapon.spe = 20;
    if (storm) { weapon.oname = 'Stormbringer'; artifact_exists(weapon, weapon.oname, true, 0); }
    assert.equal(weapon.oartifact === ART_STORMBRINGER, storm);
    await addinv(weapon); setuwep(weapon);
    const mon = await makemon(game.mons[PMNAMES.PM_WUMPUS], 32, 10, NO_MINVENT | MM_NOMSG);
    Object.assign(mon, { mpeaceful: 1, mtame: tame ? 5 : 0, msleeping: sleeping ? 1 : 0,
        mcanmove: 1, mfrozen: 0, mflee: 0, mfleetim: 0, mhp: 1000, mhpmax: 1000,
        mstrategy: STRAT_WAITMASK, minvis: 0, mundetected: 0, m_ap_type: 0 });
    game._toplines = ''; game._msg_history = []; game._toplin = 0; game._win_stop = false;
    globalThis.__stormbringer_routing_probe = name =>
        events.push({ name, rng: getRngLog().length });
    seed();
    return { mon, weapon };
}

let refusalSeed = 1;
for (; refusalSeed < 256; refusalSeed++) { seed(refusalSeed); if (rn2(7) === 0) break; }
assert.ok(refusalSeed < 256);

// Both routes must reach real combat without the safe-displacement draw.
for (const [name, options] of [
    ['tame safe target', { tame: true }],
    ['peaceful safe target', {}],
    ['peaceful unsafe target', { safe: false }],
    ['confirm disabled', { safe: false, confirm: false }],
    ['forcefight', { force: true }],
]) test(`Stormbringer: ${name}`, async () => {
    const { mon } = await setup(options);
    game.override_confirmation = true; // do_attack must reset a previous turn's flag
    assert.equal(await do_attack(mon), true);
    assert.ok(entered('attack_checks'), 'attack_checks reached');
    assert.equal(entered('attack_checks').rng, 0, 'no displacement RNG before attack_checks');
    assert.ok(entered('known_hitum'), 'real weapon attack reached');
    assert.ok(mon.mhp < 1000, 'real attack deals damage');
    const override = options.confirm !== false && !options.force;
    assert.equal(game.override_confirmation, override);
    assert.equal(/bloodthirsty blade attacks/.test(text()), override);
    assert.equal(queried(), false);
    assert.deepEqual([game.u.ux, game.u.uy, mon.mx, mon.my], [31, 10, 32, 10]);
});

// A source-derived RNG oracle pins ordinary displacement/refusal order.
for (const tame of [false, true]) test(`ordinary random refusal, tame=${tame}`, async () => {
    const { mon } = await setup({ storm: false, tame, sleeping: false });
    seed(refusalSeed); assert.equal(rn2(7), 0); const flee = tame ? rnd(6) : 0;
    const expected = [...getRngLog()]; seed(refusalSeed);
    assert.equal(await do_attack(mon), true);
    assert.deepEqual(getRngLog(), expected);
    assert.equal(mon.mfleetim, flee);
    assert.equal(!!mon.mflee, tame);
    assert.equal(mon.mhp, 1000);
    assert.equal(entered('attack_checks'), undefined);
    assert.match(text(), /is in the way/);
});
test('ordinary awake safe target permits caller displacement', async () => {
    const { mon } = await setup({ storm: false, tame: true, sleeping: false });
    seed(); assert.notEqual(rn2(7), 0); const expected = [...getRngLog()]; seed();
    assert.equal(await do_attack(mon), false);
    assert.deepEqual(getRngLog(), expected);
    assert.equal(mon.mhp, 1000); assert.equal(entered('attack_checks'), undefined);
});
test('ordinary sleeping safe target refuses after rn2(7)', async () => {
    const { mon } = await setup({ storm: false, tame: true });
    seed(); assert.notEqual(rn2(7), 0); const expected = [...getRngLog()]; seed();
    assert.equal(await do_attack(mon), true);
    assert.deepEqual(getRngLog(), expected);
    assert.match(text(), /doesn't seem to move/);
    assert.equal(entered('attack_checks'), undefined);
});
for (const storm of [false, true]) test(`punishment short circuit, Stormbringer=${storm}`, async () => {
    const { mon } = await setup({ storm });
    game.u.uball = mksobj(ONAMES.HEAVY_IRON_BALL, false, false);
    seed();
    await do_attack(mon);
    if (storm) {
        assert.equal(entered('attack_checks')?.rng, 0);
        assert.ok(entered('known_hitum'));
    } else {
        assert.deepEqual(getRngLog(), []);
        assert.equal(entered('attack_checks'), undefined);
        assert.match(text(), /is in the way/);
    }
});

test('ordinary unsafe target declines with no RNG or damage', async () => {
    const { mon } = await setup({ storm: false, safe: false });
    assert.equal(await do_attack(mon), true);
    assert.equal(queried(), true);
    assert.equal(game.context.move, 0); assert.equal(mon.mhp, 1000);
    assert.equal(mon.mpeaceful, 1); assert.deepEqual(getRngLog(), []);
    assert.equal(entered('hitum'), undefined);
});
for (const mode of ['ordinary-argument', 'storm-argument', 'other-artifact', 'unarmed'])
test(`attack_checks uses weapon argument: ${mode}`, async () => {
    const { mon, weapon } = await setup({ storm: mode !== 'storm-argument', safe: false });
    const argument = mode === 'unarmed' ? null : { ...weapon, oartifact:
        mode === 'storm-argument' ? ART_STORMBRINGER : mode === 'other-artifact' ? ART_ORCRIST : 0 };
    assert.equal(await attack_checks(mon, argument), mode !== 'storm-argument');
    assert.equal(queried(), mode !== 'storm-argument');
    assert.equal(game.override_confirmation, mode === 'storm-argument');
    assert.deepEqual(getRngLog(), []);
    assert.equal(mon.mstrategy & STRAT_WAITMASK, 0);
});
for (const guard of ['hostile', 'CONFUSION', 'HALLUC', 'STUNNED', 'forcefight', 'engulfing'])
test(`attack_checks keeps earlier/outer guard: ${guard}`, async () => {
    const { mon, weapon } = await setup({ safe: false });
    if (guard === 'hostile') mon.mpeaceful = 0;
    else if (guard === 'forcefight') game.context.forcefight = true;
    else if (guard === 'engulfing') { game.u.uswallow = true; game.u.ustuck = mon; }
    else game.u.uprops[guard] = 1; // preserve existing raw compatibility guard
    assert.equal(await attack_checks(mon, weapon), false);
    assert.equal(game.override_confirmation, false);
    assert.equal(queried(), false); assert.deepEqual(getRngLog(), []);
    assert.equal(mon.mstrategy & STRAT_WAITMASK, 0);
});
test('default-on confirm still overrides for Stormbringer', async () => {
    const { mon, weapon } = await setup({ safe: false });
    delete game.flags.confirm;
    assert.equal(await attack_checks(mon, weapon), false);
    assert.equal(game.override_confirmation, true);
    assert.equal(queried(), false); assert.deepEqual(getRngLog(), []);
});
test('quiet mode changes feedback, not the override flag', async () => {
    const { mon } = await setup(); game.flags.verbose = false;
    await do_attack(mon);
    assert.ok(entered('known_hitum')); assert.equal(game.override_confirmation, true);
    assert.doesNotMatch(text(), /bloodthirsty blade attacks/);
});
after(() => { delete globalThis.__stormbringer_routing_probe; });
