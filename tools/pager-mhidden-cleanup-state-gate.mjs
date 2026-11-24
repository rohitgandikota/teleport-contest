// C pager.c:186-280, especially the fake-object cleanup at 226-230.
// Constructed states use real object, mimic, glyph, hiding and deletion owners.
// These checks establish source contracts, not ordinary native input reach.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, clearMessages, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {mhidden_description, object_from_map, do_screen_description} from '../js/pager.js';
import {makemon, hideunder} from '../js/makemon.js';
import {mksobj, place_object, add_to_container, set_corpsenm,
    dealloc_obj, dobjsfree} from '../js/mkobj.js';
import {make_blinded, peffects} from '../js/potion.js';
import {newsym, glyph_at} from '../js/display.js';
import {set_levltyp} from '../js/mkmaze.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {M_AP_TYPE, M_AP_OBJECT, M_AP_FURNITURE, MHID_PREFIX, MHID_ARTICLE,
    MHID_ALTMON, NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG,
    OBJ_FREE, OBJ_FLOOR, OBJ_CONTAINED, OBJ_DELETED, DOOR, D_ISOPEN} from '../js/const.js';

const flags = NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG;
const descriptionFlags = MHID_PREFIX | MHID_ARTICLE;
const deleted = () => game.objs_deleted || [];
const timersFor = obj => (game.timer_base || []).filter(timer => timer.arg === obj);

async function monster(id) {
    const mon = await makemon(game.mons[id], x + 1, y, flags);
    assert.ok(mon);
    newsym(mon.mx, mon.my);
    return mon;
}
async function mimic(type = ONAMES.ROCK) {
    await setup();
    const floor = mksobj(type, false, false);
    await place_object(floor, x + 1, y);
    const mon = await monster(PMNAMES.PM_SMALL_MIMIC);
    assert.equal(M_AP_TYPE(mon), M_AP_OBJECT);
    assert.equal(mon.mappearance, type, 'set_mimic_sym uses the actual floor object');
    dobjsfree(); clearMessages(); seed();
    return {mon, floor};
}
function remembered(mon) {
    const glyph = game.level.at(mon.mx, mon.my).remembered_glyph?.glyph;
    assert.equal(glyph?.kind, 'obj', 'newsym produced object memory');
    return glyph;
}
function floorRetained(floor, mon) {
    assert.equal(floor.where, OBJ_FLOOR);
    assert.equal(game.level.objectAt(mon.mx, mon.my), floor);
    assert.ok(game.level.objects.includes(floor));
    assert.ok(!deleted().includes(floor));
}
function oneAllocationDraw() {
    assert.equal(getRngLog().length, 1);
    assert.match(getRngLog()[0], /^rnd\(2\)=[12]$/, 'next_ident is the only draw');
}

test('actual mimic producer returns an unlinked fake even over a matching floor object', async () => {
    const {mon, floor} = await mimic();
    const {otmp, fake} = object_from_map(remembered(mon), mon.mx, mon.my);
    assert.equal(fake, true); assert.notEqual(otmp, floor);
    assert.equal(otmp.where, OBJ_FLOOR);
    assert.ok(!game.level.objects.includes(otmp));
    assert.ok(!game.level.objectsAt(mon.mx, mon.my).includes(otmp));
    assert.equal(otmp.cobj?.length || 0, 0);
    assert.equal(otmp.timed || 0, 0); assert.deepEqual(timersFor(otmp), []);
    assert.equal(otmp.lua_ref_cnt || 0, 0); assert.equal(otmp.lamplit || 0, 0);
    oneAllocationDraw(); floorRetained(floor, mon);
    // The producer transfers ownership to its caller. This producer-only
    // control supplies the documented cleanup and passes on both versions.
    otmp.where = OBJ_FREE;
    assert.equal(dealloc_obj(otmp), undefined);
    assert.equal(otmp.where, OBJ_DELETED);
    dobjsfree(); assert.deepEqual(Object.keys(otmp), []);
});

for (const [mhidFlags, expected] of [
    [0, 'rock'], [MHID_ARTICLE, 'a rock'],
    [MHID_PREFIX, ', mimicking rock'], [descriptionFlags, ', mimicking a rock'],
]) test(`naming flags ${mhidFlags}: cleanup follows the copied name without more RNG`, async () => {
    const {mon, floor} = await mimic();
    const nextId = game.context.ident;
    const result = mhidden_description(mon, mhidFlags);
    assert.equal(typeof result, 'string'); assert.equal(result, expected);
    oneAllocationDraw();
    assert.equal(deleted().length, 1, 'owner stages exactly one fake object');
    const fake = deleted()[0];
    assert.equal(fake.o_id, nextId); assert.equal(fake.otyp, ONAMES.ROCK);
    assert.equal(fake.where, OBJ_DELETED);
    floorRetained(floor, mon);
    const calls = [...getRngLog()];
    dobjsfree();
    assert.equal(deleted().length, 0); assert.deepEqual(Object.keys(fake), []);
    assert.equal(result, expected, 'the returned name survives actual deallocation');
    assert.deepEqual(getRngLog(), calls); floorRetained(floor, mon);
});

test('repeat descriptions preserve existing deletions and prepend distinct temporaries', async () => {
    const {mon, floor} = await mimic();
    const older = mksobj(ONAMES.APPLE, false, false);
    dealloc_obj(older); seed();
    assert.equal(mhidden_description(mon, descriptionFlags), ', mimicking a rock');
    const first = deleted()[0];
    assert.notEqual(first, older);
    assert.equal(mhidden_description(mon, descriptionFlags), ', mimicking a rock');
    const second = deleted()[0];
    assert.notEqual(second, first); assert.notEqual(first.o_id, second.o_id);
    assert.deepEqual(deleted(), [second, first, older]);
    assert.equal(getRngLog().length, 2);
    for (const call of getRngLog()) assert.match(call, /^rnd\(2\)=[12]$/);
    dobjsfree();
    for (const obj of [older, first, second]) assert.deepEqual(Object.keys(obj), []);
    floorRetained(floor, mon);
});

test('coin temporary keeps forced plural naming before cleanup', async () => {
    const {mon, floor} = await mimic(ONAMES.GOLD_PIECE);
    assert.equal(mhidden_description(mon, descriptionFlags), ', mimicking gold pieces');
    assert.equal(deleted().length, 1);
    assert.equal(deleted()[0].quan, 2);
    assert.equal(floor.quan, 1);
    oneAllocationDraw(); floorRetained(floor, mon);
});

test('empty temporary container does not free the real container contents', async () => {
    const {mon, floor} = await mimic(ONAMES.CHEST);
    const content = mksobj(ONAMES.APPLE, false, false);
    assert.equal(await add_to_container(floor, content), content);
    seed();
    assert.equal(mhidden_description(mon, descriptionFlags), ', mimicking a chest');
    assert.equal(deleted().length, 1);
    const fake = deleted()[0];
    assert.equal(fake.cobj?.length || 0, 0);
    oneAllocationDraw(); dobjsfree(); floorRetained(floor, mon);
    assert.deepEqual(floor.cobj, [content]);
    assert.equal(content.where, OBJ_CONTAINED); assert.equal(content.ocontainer, floor);
    assert.equal(content.otyp, ONAMES.APPLE);
});

test('corpse temporary has no timer while the actual corpse keeps its timer', async () => {
    const {mon, floor} = await mimic(ONAMES.CORPSE);
    set_corpsenm(floor, PMNAMES.PM_HILL_ORC);
    const floorTimers = [...timersFor(floor)];
    assert.ok(floorTimers.length > 0);
    const glyph = remembered(mon);
    seed();
    const {otmp, fake} = object_from_map(glyph, mon.mx, mon.my);
    assert.equal(fake, true);
    const expectedCalls = [...getRngLog()];
    assert.equal(otmp.timed || 0, 0); assert.deepEqual(timersFor(otmp), []);
    otmp.where = OBJ_FREE; dealloc_obj(otmp); dobjsfree();
    seed();
    assert.equal(mhidden_description(mon, descriptionFlags), ', mimicking a corpse');
    assert.deepEqual(getRngLog(), expectedCalls, 'cleanup adds no draw after the real constructor');
    assert.equal(deleted().length, 1);
    const pending = deleted()[0];
    assert.equal(pending.corpsenm, mon.mcorpsenm);
    assert.equal(pending.timed || 0, 0); assert.deepEqual(timersFor(pending), []);
    dobjsfree(); assert.deepEqual(timersFor(floor), floorTimers);
    floorRetained(floor, mon);
});

test('real hidden spider borrows its floor object without deleting or reallocating it', async () => {
    await setup();
    const floor = mksobj(ONAMES.ROCK, false, false);
    await place_object(floor, x + 1, y);
    const mon = await monster(PMNAMES.PM_CAVE_SPIDER);
    assert.equal(await hideunder(mon), true); newsym(mon.mx, mon.my);
    assert.equal(mon.mundetected, 1); remembered(mon);
    dobjsfree(); seed(); const nextId = game.context.ident;
    assert.equal(mhidden_description(mon, descriptionFlags), ', hiding under a rock');
    assert.equal(deleted().length, 0); assert.equal(game.context.ident, nextId);
    assert.deepEqual(getRngLog(), []); floorRetained(floor, mon);
});

test('furniture mimic does not allocate a temporary object', async () => {
    await setup(); set_levltyp(x + 1, y, DOOR);
    game.level.at(x + 1, y).doormask = D_ISOPEN;
    const mon = await monster(PMNAMES.PM_SMALL_MIMIC);
    assert.equal(M_AP_TYPE(mon), M_AP_FURNITURE);
    dobjsfree(); seed(); const nextId = game.context.ident;
    assert.match(mhidden_description(mon, descriptionFlags), /^, mimicking a (closed )?door$/);
    assert.equal(deleted().length, 0); assert.equal(game.context.ident, nextId);
    assert.deepEqual(getRngLog(), []);
});

test('blind-created mimic without object memory takes the something branch', async () => {
    await setup(); newsym(x + 1, y); await make_blinded(100, false);
    const mon = await monster(PMNAMES.PM_SMALL_MIMIC);
    assert.equal(M_AP_TYPE(mon), M_AP_OBJECT);
    assert.notEqual(game.level.at(mon.mx, mon.my).remembered_glyph?.glyph?.kind, 'obj');
    dobjsfree(); seed(); const nextId = game.context.ident;
    assert.equal(mhidden_description(mon, descriptionFlags), ', mimicking something');
    assert.equal(deleted().length, 0); assert.equal(game.context.ident, nextId);
    assert.deepEqual(getRngLog(), []);
});

test('ordinary visible monster with ALTMON has no fake-object path', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_HILL_ORC);
    dobjsfree(); seed(); const nextId = game.context.ident;
    assert.equal(mhidden_description(mon, descriptionFlags | MHID_ALTMON), '');
    assert.equal(deleted().length, 0); assert.equal(game.context.ident, nextId);
    assert.deepEqual(getRngLog(), []);
});

test('public inspection of a sensed object mimic completes cleanup synchronously', async () => {
    const {mon, floor} = await mimic();
    const potion = mksobj(ONAMES.POT_MONSTER_DETECTION, false, false);
    potion.blessed = true;
    await peffects(potion); newsym(mon.mx, mon.my);
    assert.ok(game.u.intrinsic.HDetect_monsters > 0);
    assert.equal(glyph_at(mon.mx, mon.my).kind, 'mon'); remembered(mon);
    dobjsfree(); seed();
    const result = do_screen_description({x:mon.mx, y:mon.my}, true, 0);
    assert.equal(typeof result?.then, 'undefined');
    assert.match(result.firstmatch, /, mimicking a rock$/);
    assert.match(result.out_str, /\[seen: normal vision, monster detection\]$/);
    assert.equal(deleted().length, 1); assert.equal(deleted()[0].where, OBJ_DELETED);
    oneAllocationDraw(); floorRetained(floor, mon);
});
