// Source controls for teleport.c:86-185, using real form and equipment producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {goodpos} from '../js/makemon.js';
import {set_levltyp} from '../js/mkmaze.js';
import {create_drawbridge} from '../js/dbridge.js';
import {zap_over_floor, BZ_U_WAND} from '../js/zap.js';
import {polymon} from '../js/polyself.js';
import {readobjnam} from '../js/objnam.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {accessory_or_armor_on, Boots_on, Ring_on} from '../js/do_wear.js';
import {Swimming, Amphibious, Flying, Fire_resistance, Wwalking} from '../js/youprop.js';
import {getRngLog, rn2} from '../js/rng.js';
import {PMNAMES as P, ATTKS} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

const tx = x + 2, ty = y;
async function wear(name, mask) {
    const obj = await addinv(await readobjnam(`uncursed ${name}`, null, false));
    if (mask) {
        setworn(obj, mask);
        if (mask === C.W_ARMF) await Boots_on();
        else await Ring_on(obj);
    } else await accessory_or_armor_on(obj);
    return obj;
}
async function swimmer(kind) {
    if (kind === 'breathing') {
        await wear('amulet of magical breathing');
        assert.ok(Amphibious());
        assert.ok(!game.u.uprops.SWIMMING && !game.u.uprops.AMPHIBIOUS);
    } else if (kind === 'flying') {
        await wear('amulet of flying');
        assert.ok(Flying());
    } else if (kind === 'swimming') {
        assert.equal(await polymon(P.PM_GIANT_EEL), 1);
        assert.ok(Swimming() && Amphibious());
        assert.ok(game.u.intrinsic.HSwimming & C.FROMFORM);
        assert.ok(!game.u.uprops.SWIMMING);
    }
}
function check(expected, mon = game.youmonst, flags = 0) {
    seed();
    assert.equal(goodpos(tx, ty, mon, flags), expected);
    assert.deepEqual(getRngLog(), []);
}

for (const terrain of [C.POOL, C.MOAT, C.WATER])
for (const kind of ['human', 'breathing', 'flying', 'swimming'])
test(`${kind}: water terrain ${terrain}`, async () => {
    await setup(); await swimmer(kind);
    set_levltyp(tx, ty, terrain);
    check(kind === 'breathing' || kind === 'swimming'
          || (kind === 'flying' && terrain !== C.WATER));
});

for (const kind of ['human', 'breathing', 'flying', 'swimming'])
test(`${kind}: the Water plane has no surface to fly above`, async () => {
    await setup(); await swimmer(kind);
    // Constructed level identity, read through the same Is_waterlevel predicate.
    game.water_level = {...game.u.uz};
    set_levltyp(tx, ty, C.POOL);
    check(kind === 'breathing' || kind === 'swimming');
});

for (const [proof, fire, walking] of [
    [false, false, false], [true, false, true], [false, true, true],
    [true, true, true], [true, true, false], [false, true, false],
]) test(`lava boots: proof=${proof}, fire=${fire}, walking=${walking}`, async () => {
    await setup();
    const boots = await wear(`${proof ? 'fireproof ' : ''}${walking ? 'water walking boots' : 'low boots'}`, C.W_ARMF);
    if (fire) await wear('ring of fire resistance', C.W_RINGL);
    assert.equal(game.u.uarmf, boots);
    assert.equal(!!boots.oerodeproof, proof);
    assert.equal(Fire_resistance(), fire);
    assert.equal(Wwalking(), walking);
    set_levltyp(tx, ty, C.LAVAPOOL);
    check(proof && fire && walking);
});

for (const [name, id, expected] of [
    ['salamander', P.PM_SALAMANDER, true],
    ['fire elemental', P.PM_FIRE_ELEMENTAL, true],
    ['floating eye', P.PM_FLOATING_EYE, false],
    ['bat', P.PM_BAT, true],
    ['stone golem', P.PM_STONE_GOLEM, false],
]) test(`${name}: lava placement after actual polymorph`, async () => {
    await setup(); assert.equal(await polymon(id), 1);
    assert.ok(C.Upolyd(game.u));
    set_levltyp(tx, ty, C.LAVAPOOL);
    check(expected);
});

for (const ice of [false, true]) for (const object of [false, true])
test(`raised bridge: ice=${ice}, object=${object}`, async () => {
    await setup(); set_levltyp(tx, ty, C.MOAT); set_levltyp(tx + 1, ty, C.HWALL);
    assert.equal(create_drawbridge(tx, ty, C.DB_EAST, false), true);
    if (ice) await zap_over_floor(tx, ty, BZ_U_WAND(ATTKS.AD_COLD - 1), {v:false}, true, O.STRANGE_OBJECT);
    const loc = game.level.at(tx, ty);
    assert.equal(loc.typ, C.DRAWBRIDGE_UP);
    assert.equal(loc.drawbridgemask & C.DB_UNDER, ice ? C.DB_ICE : C.DB_MOAT);
    check(ice, object ? null : game.youmonst);
});

for (const ignore of [false, true])
test(`eel on dry terrain preserves the draw before ignore-water=${ignore}`, async () => {
    await setup();
    // C explicitly permits this fake-monster contract during creation.
    const mon = {data:game.mons[P.PM_GIANT_EEL], wormno:0};
    seed(); const roll = rn2(13), calls = [...getRngLog()]; seed();
    assert.equal(goodpos(tx, ty, mon, ignore ? C.MM_IGNOREWATER : 0), ignore || roll === 0);
    assert.deepEqual(getRngLog(), calls);
});

test('invalid coordinates and disallowed hero occupancy return before eel RNG', async () => {
    await setup(); const mon = {data:game.mons[P.PM_GIANT_EEL], wormno:0}; seed();
    assert.equal(goodpos(0, ty, mon), false);
    assert.equal(goodpos(tx, -1, mon), false);
    assert.equal(goodpos(x, y, mon), false);
    assert.equal(goodpos(x, y, null), false);
    assert.equal(goodpos(x, y, null, C.GP_ALLOW_U), true);
    assert.deepEqual(getRngLog(), []);
});

test('a closed door stays inaccessible to the human and an object', async () => {
    await setup(); set_levltyp(tx, ty, C.DOOR);
    game.level.at(tx, ty).doormask = C.D_CLOSED;
    check(false); check(false, null);
});
