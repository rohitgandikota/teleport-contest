// Source controls use live species and real equipment, form, timeout and caller producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, clearMessages, messages, seed, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {can_blow, can_chant, can_be_strangled} from '../js/mondata.js';
import {polymon, rehumanize} from '../js/polyself.js';
import {Amulet_on, Amulet_off} from '../js/do_wear.js';
import {set_itimeout, make_stunned} from '../js/potion.js';
import {nh_timeout} from '../js/timeout.js';
import {makemon} from '../js/makemon.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {set_levltyp} from '../js/mkmaze.js';
import {searches_for_item} from '../js/monmove.js';
import {doapply} from '../js/apply.js';
import {do_play_instrument} from '../js/music.js';
import {force_learn_spell, getspell} from '../js/spell.js';
import {cmdq_add_key} from '../js/cmd.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {W_AMUL, POOL, CQ_CANNED, ECMD_OK, ECMD_TIME,
    NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG, MM_ASLEEP} from '../js/const.js';

const flags = NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG;
async function amulet() {
    const obj = await addinv(mksobj(O.AMULET_OF_STRANGULATION, false, false));
    await Amulet_on(obj);
    return obj;
}
function capabilities(mon, blow, chant) {
    const rng = [...getRngLog()];
    assert.equal(can_blow(mon), blow, 'C can_blow');
    assert.equal(can_chant(mon), chant, 'C can_chant');
    assert.deepEqual(getRngLog(), rng, 'both predicates are synchronous and draw no RNG');
}
function reset(run) {
    clearMessages(); seed();
    run._display.clearInputQueue();
    game.command_queue = [];
}
async function pause(run, action) {
    let arrived, release;
    const input = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = action();
    const stopped = await Promise.race([input.then(() => true), pending.then(() => false)]);
    return {stopped, pending, resume(key = 32) {
        run._display.onEmptyQueue = () => 32;
        release?.(key);
    }};
}

// Expected values come from C mondata.c and the real monsters.h entries.
for (const [species, blow, chant] of [
    ['PM_ETTIN', true, true], ['PM_SKELETON', true, true],
    ['PM_KILLER_BEE', false, false], ['PM_GIANT_SPIDER', true, false],
    ['PM_SHRIEKER', true, false], ['PM_JABBERWOCK', true, false],
    ['PM_IRON_GOLEM', false, false], ['PM_GIANT_EEL', false, false],
]) test(`live ${species} anatomy and nonhero identity`, async () => {
    await setup();
    if (species === 'PM_GIANT_EEL') set_levltyp(x + 1, y, POOL);
    const mon = await makemon(game.mons[P[species]], x + 1, y, flags);
    assert.ok(mon);
    assert.equal(mon.data, game.mons[P[species]]);
    assert.notEqual(mon, game.youmonst);
    capabilities(mon, blow, chant);
    set_itimeout('HStrangled', 3);
    capabilities(game.youmonst, false, false);
    capabilities(mon, blow, chant);
});

test('human equipment starts a countdown, removal clears both owners', async () => {
    await setup();
    capabilities(game.youmonst, true, true);
    const obj = await amulet();
    assert.equal(game.u.intrinsic.HStrangled, 6);
    assert.equal(game.u.uprops.STRANGLED, W_AMUL);
    capabilities(game.youmonst, false, false);
    await nh_timeout();
    assert.equal(game.u.intrinsic.HStrangled, 5);
    capabilities(game.youmonst, false, false);
    await Amulet_off();
    assert.equal(game.u.intrinsic.HStrangled, 0);
    assert.equal(obj.owornmask, 0);
    assert.equal(game.u.uprops.STRANGLED || 0, 0);
    capabilities(game.youmonst, true, true);
});

test('wizard timeout producer blocks speech and blowing without equipment', async () => {
    await setup();
    set_itimeout('HStrangled', 3);
    assert.equal(game.u.uamul || null, null);
    assert.equal(game.u.uprops.STRANGLED || 0, 0);
    capabilities(game.youmonst, false, false);
    set_itimeout('HStrangled', 0);
    capabilities(game.youmonst, true, true);
});

test('wearing the amulet as a real skeleton retains the mask but does not block either ability', async () => {
    await setup();
    assert.equal(await polymon(P.PM_SKELETON), 1);
    const obj = await amulet();
    assert.equal(game.youmonst.data, game.mons[P.PM_SKELETON]);
    assert.equal(can_be_strangled(game.youmonst), false);
    assert.equal(game.u.intrinsic.HStrangled || 0, 0);
    assert.equal(game.u.uprops.STRANGLED, W_AMUL);
    assert.equal(game.u.uamul, obj);
    capabilities(game.youmonst, true, true);
});

test('real polymorph cancels an active countdown, rehumanization restores it', async () => {
    await setup();
    const obj = await amulet();
    capabilities(game.youmonst, false, false);
    await polymon(P.PM_SKELETON);
    assert.equal(game.u.intrinsic.HStrangled, 0);
    assert.equal(game.u.uprops.STRANGLED, W_AMUL);
    assert.equal(game.u.uamul, obj);
    capabilities(game.youmonst, true, true);
    await rehumanize();
    assert.equal(game.u.intrinsic.HStrangled, 6);
    capabilities(game.youmonst, false, false);
});

test('immune silent golem remains unable for anatomical reasons', async () => {
    await setup();
    await polymon(P.PM_IRON_GOLEM);
    await amulet();
    assert.equal(game.u.intrinsic.HStrangled || 0, 0);
    capabilities(game.youmonst, false, false);
});

test('a real NPC horn search ignores the hero timer and still checks charges', async () => {
    await setup();
    const mon = await makemon(game.mons[P.PM_HILL_GIANT], x + 1, y, flags);
    const charged = mksobj(O.FIRE_HORN, true, false);
    assert.ok(charged.spe > 0);
    set_itimeout('HStrangled', 3);
    assert.equal(searches_for_item(mon, charged), true);
    // mksobj with initialization disabled supplies the real zero-charge object.
    const empty = mksobj(O.FIRE_HORN, false, false);
    assert.equal(empty.spe, 0);
    assert.equal(searches_for_item(mon, empty), false);
    const animal = await makemon(game.mons[P.PM_ETTIN], x + 2, y, flags);
    capabilities(animal, true, true);
    assert.equal(searches_for_item(animal, charged), false, 'C rejects animals before the horn branch');
});

for (const active of [false, true]) test(`whistle feedback completes before waking a real sleeping monster, active=${active}`, async () => {
    const run = await setup();
    if (!active) await polymon(P.PM_SKELETON);
    await amulet();
    const whistle = await addinv(mksobj(O.TIN_WHISTLE, false, false));
    const mon = await makemon(game.mons[P.PM_GOBLIN], x + 1, y, flags | MM_ASLEEP);
    assert.equal(mon.msleeping, 1);
    reset(run);
    cmdq_add_key(CQ_CANNED, whistle.invlet);
    await pline('This preceding message fills enough of the line to need acknowledgement.');
    const held = await pause(run, () => doapply());
    const during = mon.msleeping;
    held.resume();
    const result = await held.pending;
    assert.equal(held.stopped, true);
    assert.equal(during, 1);
    assert.equal(result, ECMD_TIME);
    assert.equal(mon.msleeping, active ? 1 : 0);
    assert.match(messages(), active ? /incapable of using the whistle/ : /produce a high whistling sound/);
    assert.deepEqual(getRngLog(), []);
});

for (const [instrument, active, prompt] of [
    ['WOODEN_FLUTE', false, true], ['WOODEN_FLUTE', true, false],
    ['WOODEN_HARP', true, true],
]) test(`instrument wind guard, ${instrument}, active=${active}`, async () => {
    const run = await setup();
    if (!active) await polymon(P.PM_SKELETON);
    await amulet();
    const obj = mksobj(O[instrument], false, false);
    reset(run);
    const held = await pause(run, () => do_play_instrument(obj));
    const during = run._display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    held.resume('q'.charCodeAt(0));
    assert.equal(await held.pending, ECMD_OK);
    assert.equal(held.stopped, prompt);
    if (prompt) {
        assert.match(during, /Improvise/);
        assert.match(messages(), /Never mind/);
    } else assert.match(messages(), /incapable of playing/);
    assert.deepEqual(getRngLog(), []);
});

for (const active of [false, true]) test(`spell selection consumes a real canned key only after chanting eligibility, active=${active}`, async () => {
    const run = await setup();
    if (!active) await polymon(P.PM_SKELETON);
    await amulet();
    const letter = force_learn_spell(O.SPE_LIGHT);
    assert.ok(letter);
    reset(run);
    cmdq_add_key(CQ_CANNED, letter);
    const chosen = {v: -1};
    assert.equal(await getspell(chosen), !active);
    assert.equal(game.command_queue[CQ_CANNED].length, active ? 1 : 0);
    if (active) {
        assert.equal(chosen.v, -1);
        assert.match(messages(), /unable to chant/);
    } else assert.equal(game.spl_book[chosen.v].sp_id, O.SPE_LIGHT);
    assert.deepEqual(getRngLog(), []);
});

test('stun rejection precedes chanting and leaves the real spell selection queued', async () => {
    const run = await setup();
    await polymon(P.PM_SKELETON);
    await amulet();
    const letter = force_learn_spell(O.SPE_LIGHT);
    await make_stunned(3, false);
    reset(run);
    cmdq_add_key(CQ_CANNED, letter);
    assert.equal(await getspell({v: -1}), false);
    assert.match(messages(), /too impaired/);
    assert.doesNotMatch(messages(), /unable to chant/);
    assert.equal(game.command_queue[CQ_CANNED].length, 1);
    assert.deepEqual(getRngLog(), []);
});
