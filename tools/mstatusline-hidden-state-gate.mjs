// Constructed source contracts for C insight.c:3314-3323. These are not
// ordinary-input or native claims. Runtime helpers are never replaced.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, clearMessages, messages, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {mstatusline} from '../js/insight.js';
import {probe_monster, bhitm} from '../js/zap.js';
import {makemon, hideunder} from '../js/makemon.js';
import {mksobj, place_object, dobjsfree} from '../js/mkobj.js';
import {newsym} from '../js/display.js';
import {make_blinded} from '../js/potion.js';
import {create_gas_cloud, visible_region_at} from '../js/region.js';
import {clonewiz} from '../js/wizard.js';
import {set_levltyp} from '../js/mkmaze.js';
import {seemimic} from '../js/mon.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG, M_AP_TYPE,
    M_AP_NOTHING, M_AP_OBJECT, M_AP_FURNITURE, M_AP_MONSTER,
    OBJ_FLOOR, OBJ_DELETED, DOOR, D_ISOPEN, POOL} from '../js/const.js';

// Join tty-wrapped message fragments for text assertions only. Replay gates
// retain the original screens and all styles without normalization.
const text = () => messages().replace(/\s+/g, ' ');
const flags = NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG;
async function monster(id, dx = 1) {
    const mon = await makemon(game.mons[id], x + dx, y, flags);
    assert.ok(mon);
    newsym(mon.mx, mon.my);
    // Caller boundary state: bhit / zap_steed / use_stethoscope set this.
    game.bhitpos = {x:mon.mx, y:mon.my}; game.notonhead = false;
    return mon;
}
function reset() { dobjsfree(); clearMessages(); seed(); }
async function mimic(type = ONAMES.ROCK) {
    await setup();
    const floor = mksobj(type, false, false);
    await place_object(floor, x + 1, y);
    const mon = await monster(PMNAMES.PM_SMALL_MIMIC);
    assert.equal(M_AP_TYPE(mon), M_AP_OBJECT);
    assert.equal(mon.mappearance, type);
    assert.equal(game.level.at(mon.mx, mon.my).remembered_glyph.glyph.kind, 'obj');
    reset(); return {mon, floor};
}
function noAllocation(nextId) {
    assert.equal(game.context.ident, nextId);
    assert.deepEqual(game.objs_deleted || [], []);
    assert.deepEqual(getRngLog(), []);
}
function floorRetained(floor, mon) {
    assert.equal(floor.where, OBJ_FLOOR);
    assert.equal(game.level.objectAt(mon.mx, mon.my), floor);
    assert.ok(game.level.objects.includes(floor));
}

test('ordinary visible monster leaves the new suffix and RNG absent', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_HILL_ORC); reset();
    const nextId = game.context.ident;
    assert.equal(await mstatusline(mon), undefined);
    assert.match(text(), /Status of the hill orc/);
    assert.doesNotMatch(text(), /mimicking|hiding|masquerading|in a cloud/);
    noAllocation(nextId);
});

for (const [type, expected] of [[ONAMES.ROCK, 'a rock'], [ONAMES.GOLD_PIECE, 'gold pieces']])
test(`real object mimic: prefix, article/plural and temporary cleanup for ${type}`, async () => {
    const {mon, floor} = await mimic(type);
    const id = game.context.ident;
    await mstatusline(mon);
    assert.ok(text().includes(`, mimicking ${expected}`));
    assert.equal(game.objs_deleted.length, 1);
    const fake = game.objs_deleted[0];
    assert.equal(fake.o_id, id); assert.equal(fake.otyp, type);
    assert.equal(fake.where, OBJ_DELETED);
    assert.notEqual(fake, floor); floorRetained(floor, mon);
    assert.equal(getRngLog().length, 1);
    assert.match(getRngLog()[0], /^rnd\(2\)=[12]$/);
    dobjsfree(); assert.deepEqual(Object.keys(fake), []);
    floorRetained(floor, mon);
});

test('real furniture mimic has the canonical article and no object allocation', async () => {
    await setup(); set_levltyp(x + 1, y, DOOR);
    game.level.at(x + 1, y).doormask = D_ISOPEN;
    const mon = await monster(PMNAMES.PM_SMALL_MIMIC);
    assert.equal(M_AP_TYPE(mon), M_AP_FURNITURE);
    reset(); const id = game.context.ident;
    await mstatusline(mon);
    assert.match(text(), /, mimicking a (closed )?door/);
    noAllocation(id);
});

test('blind-created mimic reports something without inventing object memory', async () => {
    await setup(); newsym(x + 1, y); await make_blinded(100, false);
    const mon = await monster(PMNAMES.PM_SMALL_MIMIC);
    assert.equal(M_AP_TYPE(mon), M_AP_OBJECT);
    assert.notEqual(game.level.at(mon.mx, mon.my).remembered_glyph?.glyph?.kind, 'obj');
    reset(); const id = game.context.ident;
    await mstatusline(mon);
    assert.match(text(), /, mimicking something/); noAllocation(id);
});

test('real hideunder spider names and retains its borrowed floor object', async () => {
    await setup(); const floor = mksobj(ONAMES.ROCK, false, false);
    await place_object(floor, x + 1, y);
    const mon = await monster(PMNAMES.PM_CAVE_SPIDER);
    assert.equal(await hideunder(mon), true); newsym(mon.mx, mon.my);
    assert.equal(mon.mundetected, 1);
    reset(); const id = game.context.ident;
    await mstatusline(mon);
    assert.match(text(), /, hiding under a rock/);
    floorRetained(floor, mon); noAllocation(id);
});

test('real eel hiding producer adds the pool phrase', async () => {
    await setup(); set_levltyp(x + 1, y, POOL);
    const mon = await monster(PMNAMES.PM_GIANT_EEL);
    assert.equal(await hideunder(mon), true); newsym(mon.mx, mon.my);
    assert.equal(mon.mundetected, 1);
    reset(); const id = game.context.ident;
    await mstatusline(mon);
    assert.match(text(), /, hiding in murky water/); noAllocation(id);
});

test('real clone producer supplies alternate-monster wording', async () => {
    await setup(); await clonewiz();
    const mon = game.level.monsters.find(mon => mon.mnum === PMNAMES.PM_WIZARD_OF_YENDOR);
    assert.ok(mon); assert.equal(M_AP_TYPE(mon), M_AP_MONSTER);
    game.bhitpos = {x:mon.mx, y:mon.my}; reset(); const id = game.context.ident;
    await mstatusline(mon);
    assert.match(text(), /, masquerading as an? /); noAllocation(id);
});

for (const [damage, expected] of [[0, 'vapor'], [2, 'poison gas']])
test(`real cloud producer reports remote ${expected} using MHID_REGION`, async () => {
    await setup(); const mon = await monster(PMNAMES.PM_HILL_ORC, 4);
    await create_gas_cloud(mon.mx, mon.my, 1, damage);
    assert.ok(visible_region_at(mon.mx, mon.my));
    assert.ok((mon.mx - x) ** 2 > 2);
    reset(); const id = game.context.ident;
    await mstatusline(mon);
    assert.ok(text().includes(`, in a cloud of ${expected}`)); noAllocation(id);
});

test('visible-region guard uses the hit square, not the monster head', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_HILL_ORC, 4);
    await create_gas_cloud(mon.mx, mon.my, 1, 2);
    game.bhitpos = {x, y}; reset(); const id = game.context.ident;
    await mstatusline(mon);
    assert.doesNotMatch(text(), /in a cloud/); noAllocation(id);
});

test('passing a hit-square cloud guard still describes the actual monster square', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_HILL_ORC);
    await create_gas_cloud(x + 4, y, 1, 2);
    game.bhitpos = {x:x + 4, y}; reset(); const id = game.context.ident;
    await mstatusline(mon);
    assert.doesNotMatch(text(), /in a cloud/); noAllocation(id);
});

test('combined flags append hidden wording after eating and before impairment suffixes', async () => {
    const {mon} = await mimic();
    // Explicit source boundary for valid concurrent monster statuses.
    Object.assign(mon, {meating:3, mcan:1, mconf:1, msleeping:1});
    await mstatusline(mon);
    assert.match(text(), /, eating, mimicking a rock, cancelled, confused, asleep\./);
});

test('seemimic removes the suffix before stethoscope-style status feedback', async () => {
    const {mon, floor} = await mimic();
    seemimic(mon); assert.equal(M_AP_TYPE(mon), M_AP_NOTHING);
    reset(); const id = game.context.ident;
    await mstatusline(mon);
    assert.doesNotMatch(text(), /mimicking/); floorRetained(floor, mon); noAllocation(id);
});

test('actual WAN_PROBING hit keeps the disguise through status and completes its continuation', async () => {
    const {mon, floor} = await mimic();
    const wand = mksobj(ONAMES.WAN_PROBING, false, false); reset();
    const id = game.context.ident;
    assert.equal(await bhitm(mon, wand), 0);
    assert.match(text(), /, mimicking a rock/);
    assert.match(text(), /not carrying anything/);
    assert.equal(M_AP_TYPE(mon), M_AP_OBJECT); floorRetained(floor, mon);
    assert.equal(game.objs_deleted.length, 1);
    assert.equal(game.objs_deleted[0].o_id, id);
    assert.equal(game.objects[ONAMES.WAN_PROBING].oc_name_known, 1);
});

test('probe_monster waits at real status More before its inventory continuation', async () => {
    const {mon} = await mimic();
    const display = game.nhDisplay;
    let resume, signal;
    const paused = new Promise(resolve => { signal = resolve; });
    const previous = display.onEmptyQueue;
    let settled = false, reads = 0;
    display.onEmptyQueue = () => {
        if (++reads === 1) return new Promise(resolve => { resume = resolve; signal(); });
        return 32;
    };
    // The status line exceeds one tty line; its More prompt is the real
    // output owner's input wait, without a substituted pline or helper.
    const pending = probe_monster(mon).finally(() => { settled = true; });
    try {
        await Promise.race([paused, pending.then(() => { throw Error('expected More'); })]);
        assert.equal(settled, false);
        assert.match(text(), /, mimicking a rock/);
        assert.doesNotMatch(text(), /not carrying anything/);
        const calls = [...getRngLog()]; const queued = [...game.objs_deleted];
        await setImmediate(); await setImmediate();
        assert.equal(settled, false); assert.deepEqual(getRngLog(), calls);
        assert.deepEqual(game.objs_deleted, queued);
        resume(32); await pending;
        assert.equal(settled, true); assert.match(text(), /not carrying anything/);
    } finally {
        if (resume) resume(32);
        await pending; display.onEmptyQueue = previous;
    }
});
