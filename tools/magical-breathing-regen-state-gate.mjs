#!/usr/bin/env node
// Source-derived controls, not a new native oracle or full-game coverage claim.
import { register } from 'node:module';
register('./magical-breathing-state-loader.mjs', import.meta.url);
// Source-derived regen_pw controls using real equipment, properties and RNG.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const { runSegment } = await import('../js/jsmain.js');
const { InMemoryStorage } = await import('../js/storage.js');
import { game } from '../js/gstate.js';
const { regen_pw } = await import('../js/allmain.js');
const { Amulet_on, Amulet_off } = await import('../js/do_wear.js');
const { mksobj } = await import('../js/mkobj.js');
const { addinv } = await import('../js/invent.js');
const { Breathless } = await import('../js/youprop.js');
const { ACURR } = await import('../js/attrib.js');
const { ONAMES } = await import('../js/objects_data.js');
const { PMNAMES } = await import('../js/monst_data.js');
const { A_WIS, A_INT, W_AMUL, W_ART, FROMOUTSIDE, MOD_ENCUMBER } = await import('../js/const.js');
const { initRng, enableRngLog, getRngLog, rn1, rn2 } = await import('../js/rng.js');

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url))).segments[0];

async function setup(sample) {
    const run = await runSegment({ ...recipe, moves: ' ', storage: new InMemoryStorage() });
    let dismissals = 0;
    run._display.onEmptyQueue = () => {
        if (++dismissals > 20) throw Error('unexpected repeated prompt');
        return 0x1b;
    };
    game._preNhgetchHook = null;
    game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
    game.u.uinwater = false;
    game.regions = [];
    game.u.acurr.a[A_WIS] = sample.wis ?? 14;
    game.u.acurr.a[A_INT] = sample.int ?? 15;
    game.u.abon = { a: new Array(6).fill(0) };
    game.u.atemp.a.fill(0);
    game.u.uen = sample.energy ?? 10; game.u.uenmax = 100;
    game.u.ulevel = 1;
    game.moves = sample.moves ?? 18;
    game.multi = sample.multi ?? 0;
    game.context.run = 0; game.context.travel = 0;
    game.flags.verbose = true;
    if (sample.nonwizard) {
        game.urole = { ...game.urole, mnum: PMNAMES.PM_HEALER,
            name: { ...game.urole.name, m: 'Healer' } };
    }
    if (sample.intrinsic) game.u.intrinsic.HMagical_breathing = sample.intrinsic;
    if (sample.form) {
        game.u.umonnum = PMNAMES.PM_VAMPIRE;
        game.youmonst.data = game.mons[PMNAMES.PM_VAMPIRE];
    }
    if (sample.amulet) {
        const amulet = mksobj(ONAMES.AMULET_OF_MAGICAL_BREATHING, false, false);
        addinv(amulet);
        if (sample.amulet !== 'carried') await Amulet_on(amulet);
        if (sample.amulet === 'removed') await Amulet_off();
        assert.equal(game.u.uprops.MAGICAL_BREATHING || 0,
            sample.amulet === 'worn' ? W_AMUL : 0);
        assert.equal(game.u.uamul === amulet, sample.amulet === 'worn');
    }
    if (sample.mask) game.u.uprops.MAGICAL_BREATHING = sample.mask;
    if (sample.regeneration) game.u.uprops.ENERGY_REGENERATION = W_ART;
    game.disp.botl = false;
    game._toplines = ''; game._msg_history = [];
}

function seed() { initRng(3); enableRngLog(); }
const cases = [
    { name: 'no breathing source', upper: 2, breathless: false },
    { name: 'carrying an unworn amulet', amulet: 'carried', upper: 2, breathless: false },
    { name: 'wearing the amulet', amulet: 'worn', upper: 4, breathless: true },
    { name: 'removing the amulet', amulet: 'removed', upper: 2, breathless: false },
    { name: 'intrinsic timeout alone', intrinsic: 100, upper: 2, breathless: true },
    { name: 'permanent intrinsic alone', intrinsic: FROMOUTSIDE, upper: 2, breathless: true },
    { name: 'vampire form alone', form: true, upper: 2, breathless: true },
    { name: 'intrinsic plus worn amulet adds two once', intrinsic: 100,
        amulet: 'worn', upper: 4, breathless: true },
    { name: 'breathless form plus worn amulet', form: true,
        amulet: 'worn', upper: 4, breathless: true },
    { name: 'any nonzero extrinsic mask qualifies', mask: W_ART, upper: 4, breathless: true },
    { name: 'attribute sum 29 stays below boundary', wis: 14, int: 15,
        amulet: 'worn', upper: 4, breathless: true },
    { name: 'attribute sum 30 crosses boundary', wis: 15, int: 15,
        amulet: 'worn', upper: 5, breathless: true },
    { name: 'low attributes retain one base point', wis: 3, int: 3,
        amulet: 'worn', upper: 3, breathless: true },
    { name: 'low attributes without amulet', wis: 3, int: 3, upper: 1, breathless: false },
    { name: 'already at maximum skips RNG', energy: 100, amulet: 'worn',
        eligible: false, breathless: true },
    { name: 'off ordinary regeneration tick skips RNG', moves: 17, amulet: 'worn',
        eligible: false, breathless: true },
    { name: 'moderate encumbrance prevents ordinary tick', wtcap: MOD_ENCUMBER,
        amulet: 'worn', eligible: false, breathless: true },
    { name: 'slight encumbrance permits ordinary tick', wtcap: MOD_ENCUMBER - 1,
        amulet: 'worn', upper: 4, breathless: true },
    { name: 'energy regeneration bypasses cadence and encumbrance', moves: 17,
        wtcap: MOD_ENCUMBER, regeneration: true, amulet: 'worn', upper: 4, breathless: true },
    { name: 'non-Wizard uses its ordinary 24-turn interval', nonwizard: true,
        moves: 24, amulet: 'worn', upper: 4, breathless: true },
    { name: 'non-Wizard skips Wizard interval', nonwizard: true,
        moves: 18, amulet: 'worn', eligible: false, breathless: true },
    { name: 'near maximum draws full range before clamping and interrupting',
        energy: 99, amulet: 'worn', multi: 5, upper: 4, breathless: true },
];

for (const sample of cases) test(sample.name, async () => {
    await setup(sample);
    assert.equal(Breathless(), sample.breathless);
    assert.equal(ACURR(A_WIS), sample.wis ?? 14);
    assert.equal(ACURR(A_INT), sample.int ?? 15);
    const oldEnergy = game.u.uen;
    const eligible = sample.eligible !== false;
    seed();
    const gain = eligible ? rn1(sample.upper, 1) : 0;
    const expectedCalls = [...getRngLog()];
    const next = rn2(19);
    seed();
    await regen_pw(sample.wtcap ?? 0);
    assert.deepEqual(getRngLog(), expectedCalls, 'same draw range and count before the clamp');
    assert.equal(game.u.uen, Math.min(100, oldEnergy + gain));
    if (!sample.multi)
        assert.equal(game.disp.botl, eligible);
    if (sample.multi) {
        assert.ok(gain > 1, 'the real roll overflows the one-point deficit');
        assert.equal(game.u.uen, 100);
        assert.equal(game.multi, 0);
        assert.match([...game._msg_history, game._toplines].join('\n'), /full of energy/);
        // The message flush consumes botl after painting the clamped value.
        assert.match(game.nhDisplay.grid[23].map(c => c.ch).join(''), /Pw:100\(100\)/);
    }
    assert.equal(rn2(19), next, 'regeneration consumes exactly its normal RNG word even when clamped');
});
