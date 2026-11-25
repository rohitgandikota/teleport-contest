import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { accessory_or_armor_on, Boots_on, Blindf_on } from '../js/do_wear.js';
import { addinv, is_worn } from '../js/invent.js';
import { mksobj, place_object, curse } from '../js/mkobj.js';
import { oname } from '../js/do_name.js';
import { setworn } from '../js/worn.js';
import { setuwep, setuswapwep, setuqwep } from '../js/wield.js';
import { polymon, float_vs_flight } from '../js/polyself.js';
import { uchangealign, ACURR, encumber_msg } from '../js/attrib.js';
import { set_uinwater, spoteffects, unmul } from '../js/hack.js';
import { set_levltyp } from '../js/mkmaze.js';
import { make_glib } from '../js/potion.js';
import { pline } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES, OCLASSES, MATERIALS } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ECMD_OK, ECMD_TIME, W_WEP, W_SWAPWEP, W_QUIVER, W_RINGL, W_RINGR,
    W_ARMF, W_ARMH,
    A_CON, A_LAWFUL, A_CG_CONVERT, SINK, POOL, OBJ_INVENT } from '../js/const.js';

async function item(type, artifact = null) {
    let obj = mksobj(ONAMES[type], false, false);
    if (artifact)
        obj = await oname(obj, artifact, 0);
    await addinv(obj);
    return obj;
}
async function fresh() {
    const run = await setup();
    // Constructed high HP keeps real damage paths away from the death prompt.
    game.u.uhp = game.u.uhpmax = 200;
    run._display.onEmptyQueue = () => 32;
    return run;
}
function reset(run, answer = null) {
    clearMessages();
    run._display.clearInputQueue();
    game.command_queue = [];
    if (answer)
        run._display.pushKey(answer.charCodeAt(0));
    seed();
}
async function pauseAtInput(run, operation) {
    let arrive, release;
    const arrived = new Promise(resolve => { arrive = resolve; });
    run._display.onEmptyQueue = () => {
        arrive();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = operation();
    const stopped = await Promise.race([arrived.then(() => true), pending.then(() => false)]);
    return { stopped, pending, resume(key = 32) {
        run._display.onEmptyQueue = () => 32;
        release?.(key);
    } };
}

for (const converted of [false, true]) {
    test(`quest helm rejects before wearing, converted=${converted}`, async () => {
        const run = await fresh();
        if (converted)
            await uchangealign(A_LAWFUL, A_CG_CONVERT);
        // Branch fixture uses the real dungeon registry, not a fabricated quest ID.
        game.u.uz = { ...game.qstart_level };
        game.u.ublessed = 7;
        const obj = await item('HELM_OF_OPPOSITE_ALIGNMENT');
        reset(run);
        assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
        assert.equal(game.u.ublessed, 0);
        assert.equal(game.u.uarmh ?? null, null);
        assert.equal(obj.owornmask | 0, 0);
        assert.equal(!!game.objects[obj.otyp].oc_name_known, true);
        assert.equal(game.afternmv ?? null, null);
        assert.match(messages(), converted ? /shame and change your mind/ : /losing all chance at your goal/);
        // Real makeknown -> discover_object exercises wisdom.
        assert.deepEqual(getRngLog(), ['rn2(19)=4']);
    });
}
test('quest refusal waits for More before protection and discovery change', async () => {
    const run = await fresh();
    game.u.uz = { ...game.qstart_level };
    game.u.ublessed = 7;
    const obj = await item('HELM_OF_OPPOSITE_ALIGNMENT');
    reset(run);
    await pline('An existing message occupies enough of the line to require acknowledgement.');
    const held = await pauseAtInput(run, () => accessory_or_armor_on(obj));
    const during = { protection: game.u.ublessed, worn: obj.owornmask | 0, known: !!game.objects[obj.otyp].oc_name_known };
    held.resume();
    await held.pending;
    assert.equal(held.stopped, true);
    assert.equal(during.protection, 7);
    assert.equal(during.worn, 0);
    assert.equal(during.known, false);
    assert.equal(game.u.ublessed, 0);
});
for (const [slot, producer, mask] of [['uwep', setuwep, W_WEP], ['uswapwep', setuswapwep, W_SWAPWEP], ['uquiver', setuqwep, W_QUIVER]]) {
    for (const type of ['HELMET', 'RIN_SEARCHING']) {
        test(`${type} releases actual ${slot} before its wear completion`, async () => {
            const run = await fresh();
            const obj = await item(type);
            await producer(obj);
            assert.equal(obj.owornmask, mask);
            reset(run, type.startsWith('RIN') ? 'l' : null);
            assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
            assert.equal(game.u[slot], null);
            assert.equal(obj.owornmask, type.startsWith('RIN') ? W_RINGL : W_ARMH);
            assert.equal(obj.where, OBJ_INVENT);
        });
    }
}
for (const type of ['HELMET', 'SMALL_SHIELD', 'LEATHER_ARMOR', 'CLOAK_OF_PROTECTION', 'LEATHER_GLOVES', 'LOW_BOOTS', 'HAWAIIAN_SHIRT']) {
    test(`${type} keeps C delay, completes through the real callback, clears takeoff`, async () => {
        const run = await fresh();
        const obj = await item(type);
        game.context_takeoff = { mask: 123, what: 456, delay: 17 };
        reset(run);
        assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
        assert.equal(game.context_takeoff.mask, 0);
        assert.equal(game.context_takeoff.what, 0);
        assert.equal(game.context_takeoff.delay, 17);
        assert.ok(is_worn(obj));
        const delay = game.objects[obj.otyp].oc_delay;
        assert.equal(game.multi, delay ? -delay : 0);
        if (delay) {
            assert.equal(obj.known, 0);
            assert.equal(typeof game.afternmv, 'function');
            await unmul();
        }
        assert.equal(obj.known, 1);
        assert.equal(game.afternmv ?? null, null);
        assert.deepEqual(getRngLog(), type === 'CLOAK_OF_PROTECTION' ? ['rn2(19)=4'] : []);
    });
}
for (const [old, next, expected] of [
    ['TOWEL', 'LENSES', /face is already covered by a towel/],
    ['BLINDFOLD', 'LENSES', /can't wear lenses because you're wearing a blindfold there already/],
    ['LENSES', 'BLINDFOLD', /can't wear a blindfold because you're wearing some lenses there already/],
    ['BLINDFOLD', 'TOWEL', /already wearing a blindfold/],
    ['LENSES', 'TOWEL', /already wearing some lenses/],
]) {
    test(`${old} blocks ${next} with C conflict wording`, async () => {
        const run = await fresh();
        const first = await item(old);
        await Blindf_on(first);
        const obj = await item(next);
        reset(run);
        assert.equal(await accessory_or_armor_on(obj), ECMD_OK);
        assert.equal(game.u.ublindf, first);
        assert.equal(obj.owornmask | 0, 0);
        assert.match(messages(), expected);
        assert.deepEqual(getRngLog(), []);
    });
}
for (const type of ['BLINDFOLD', 'TOWEL', 'LENSES']) {
    test(`real headless cube cannot wear ${type}`, async () => {
        const run = await fresh();
        await polymon(PMNAMES.PM_GELATINOUS_CUBE);
        const obj = await item(type);
        reset(run);
        assert.equal(await accessory_or_armor_on(obj), ECMD_OK);
        assert.equal(game.u.ublindf ?? null, null);
        assert.equal(obj.owornmask | 0, 0);
        assert.match(messages(), /have no head to wear/);
        assert.deepEqual(getRngLog(), []);
    });
}
for (const vampire of [false, true]) {
    test(`real shuffled silver ring retouch, vampire=${vampire}`, async () => {
        const run = await fresh();
        if (vampire) {
            await polymon(PMNAMES.PM_VAMPIRE);
            game.u.mh = game.u.mhmax = 200;
        }
        const type = game.objects.findIndex(o => o.oc_class === OCLASSES.RING_CLASS && o.oc_material === MATERIALS.SILVER);
        assert.ok(type > 0);
        const obj = mksobj(type, false, false);
        await addinv(obj);
        const hp = vampire ? game.u.mh : game.u.uhp;
        reset(run, 'l');
        assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
        if (vampire) {
            assert.equal(obj.owornmask | 0, 0);
            assert.ok(game.u.mh < hp);
            assert.match(messages(), /can't handle/);
        } else {
            assert.ok(is_worn(obj));
            assert.equal(game.u.uhp, hp);
            assert.doesNotMatch(messages(), /can't handle/);
        }
        assert.equal(obj.where, OBJ_INVENT);
    });
}
test('real vampire can wear a nonsilver searching ring', async () => {
    const run = await fresh();
    await polymon(PMNAMES.PM_VAMPIRE);
    const type = game.objects.findIndex(o => o.oc_class === OCLASSES.RING_CLASS && o.oc_material !== MATERIALS.SILVER && o.oc_oprop === game.objects[ONAMES.RIN_SEARCHING].oc_oprop);
    assert.ok(type > 0);
    const obj = mksobj(type, false, false);
    await addinv(obj);
    reset(run, 'l');
    assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
    assert.equal(obj.owornmask, W_RINGL);
    assert.deepEqual(getRngLog(), []);
});
for (const [name, type, accepts] of [['The Mitre of Holiness', 'HELM_OF_BRILLIANCE', false], ['The Eyes of the Overworld', 'LENSES', true]]) {
    test(`real named ${name} ${accepts ? 'blasts then wears' : 'refuses before dressing'}`, async () => {
        const run = await fresh();
        const obj = await item(type, name);
        assert.ok(obj.oartifact);
        reset(run);
        assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
        assert.ok(game.u.uhp < 200);
        assert.match(messages(), /blasted by/);
        assert.equal(!!is_worn(obj), accepts);
        assert.equal(obj.where, OBJ_INVENT);
        if (!accepts) {
            assert.equal(game.afternmv ?? null, null);
            assert.match(messages(), /beyond your control/);
        }
    });
}
test('artifact blast waits before damage, ownership and dressing continuation', async () => {
    const run = await fresh();
    const obj = await item('LENSES', 'The Eyes of the Overworld');
    reset(run);
    await pline('An existing message occupies enough of the line to require acknowledgement.');
    const held = await pauseAtInput(run, () => accessory_or_armor_on(obj));
    const during = { hp: game.u.uhp, worn: obj.owornmask | 0, rng: [...getRngLog()] };
    held.resume();
    await held.pending;
    assert.equal(held.stopped, true);
    assert.deepEqual(during, { hp: 200, worn: 0, rng: [] });
    assert.ok(game.u.uhp < 200);
    assert.equal(game.u.ublindf, obj);
});
test('water-walking latch captures water before an intervening real spoteffects', async () => {
    const run = await fresh();
    set_levltyp(x, y, POOL);
    await set_uinwater(1);
    const obj = await item('WATER_WALKING_BOOTS');
    reset(run);
    assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
    assert.equal(game.wasinwater, 1);
    await spoteffects(false);
    assert.equal(game.u.uinwater, 0);
    assert.equal(!!game.objects[obj.otyp].oc_name_known, false);
    await unmul();
    assert.equal(!!game.objects[obj.otyp].oc_name_known, true);
    assert.equal(game.wasinwater, 0);
});
for (const flying of [false, true]) {
    test(`levitation ring over a sink is removed before on_msg, flying=${flying}`, async () => {
        const run = await fresh();
        if (flying) {
            await polymon(PMNAMES.PM_VAMPIRE);
            game.u.mh = game.u.mhmax = 200;
        }
        set_levltyp(x, y, SINK);
        const obj = await item('RIN_LEVITATION');
        reset(run, 'l');
        assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
        assert.equal(game.u.uleft, null);
        assert.equal(obj.owornmask | 0, 0);
        assert.equal(game.u.intrinsic.HLevitation, 0);
        assert.equal(game.u.uprops.LEVITATION | 0, 0);
        assert.match(messages(), flying ? /gain control of your flight/ : /crash to the floor/);
        assert.match(messages(), /were wearing/);
        assert.doesNotMatch(messages(), /on left hand/);
        if (flying)
            assert.equal(game.u.mh, 200);
        else
            assert.ok(game.u.uhp < 200);
    });
}
test('sink weapon injuries traverse the actual local pile, preserving nonweapons', async () => {
    const run = await fresh();
    set_levltyp(x, y, SINK);
    for (const type of ['DAGGER', 'APPLE', 'PICK_AXE'])
        await place_object(mksobj(ONAMES[type], false, false), x, y);
    const obj = await item('RIN_LEVITATION');
    reset(run, 'l');
    await accessory_or_armor_on(obj);
    const text = messages();
    assert.ok(text.indexOf('fell on a pick-axe') < text.indexOf('fell on a dagger'));
    assert.doesNotMatch(text, /fell on an apple/);
    assert.equal(game.level.objects.length, 3);
    assert.equal(getRngLog().filter(v => v.startsWith('rnd(3)')).length, 2);
});
test('sink removes both worn levitation rings and boots, suppressing intermediate landing', async () => {
    const run = await fresh();
    const left = await item('RIN_LEVITATION');
    const right = await item('RIN_LEVITATION');
    const boots = await item('LEVITATION_BOOTS');
    await setworn(left, W_RINGL);
    await setworn(right, W_RINGR);
    await setworn(boots, W_ARMF);
    float_vs_flight();
    set_levltyp(x, y, SINK);
    reset(run);
    await spoteffects(false);
    assert.equal(game.u.uleft, null);
    assert.equal(game.u.uright, null);
    assert.equal(game.u.uarmf, null);
    assert.equal(game.u.uprops.LEVITATION | 0, 0);
    assert.equal(game.u.intrinsic.HLevitation, 0);
    assert.equal((messages().match(/were wearing/g) || []).length, 3);
    assert.doesNotMatch(messages(), /float gently to/);
});
test('sink interrupts real unfinished levitation-boot dressing without a second Boots_on', async () => {
    const run = await fresh();
    const boots = await item('LEVITATION_BOOTS');
    reset(run);
    await accessory_or_armor_on(boots);
    assert.equal(game.afternmv, Boots_on);
    set_levltyp(x, y, SINK);
    await spoteffects(false);
    assert.equal(game.afternmv ?? null, null);
    assert.equal(game.u.uarmf, null);
    assert.equal(boots.owornmask, 0);
    assert.match(messages(), /stop putting on/);
});
for (const [type, slot] of [['AMULET_OF_REFLECTION', 'uamul'], ['LENSES', 'ublindf']]) {
    test(`ordinary ${type} still releases a wielded accessory`, async () => {
        const run = await fresh();
        const obj = await item(type);
        await setuwep(obj);
        reset(run);
        assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
        assert.equal(game.u.uwep, null);
        assert.equal(game.u[slot], obj);
    });
}
test('already-worn and nonwearable early exits retain no RNG and no turn', async () => {
    const run = await fresh();
    const helmet = await item('HELMET');
    await accessory_or_armor_on(helmet);
    await unmul();
    reset(run);
    assert.equal(await accessory_or_armor_on(helmet), ECMD_OK);
    assert.match(messages(), /already wearing that/);
    const food = await item('APPLE');
    seed();
    assert.equal(await accessory_or_armor_on(food), ECMD_OK);
    assert.match(messages(), /can't wear that/);
    assert.deepEqual(getRngLog(), []);
});

for (const known of [false, true]) {
    test(`cursed gloves return time only on first discovery, known=${known}`, async () => {
        const run = await fresh();
        const gloves = await item('LEATHER_GLOVES');
        await accessory_or_armor_on(gloves);
        await unmul();
        await curse(gloves);
        gloves.bknown = +known;
        const ring = await item('RIN_SEARCHING');
        reset(run, 'l');
        assert.equal(await accessory_or_armor_on(ring), known ? ECMD_OK : ECMD_TIME);
        assert.equal(gloves.bknown, 1);
        assert.equal(ring.owornmask | 0, 0);
        assert.match(messages(), /cannot remove your gloves/);
        assert.deepEqual(getRngLog(), []);
    });
}
test('glib gloves always use time before ring retouch', async () => {
    const run = await fresh();
    const gloves = await item('LEATHER_GLOVES');
    await accessory_or_armor_on(gloves);
    await unmul();
    make_glib(10);
    const ring = await item('RIN_SEARCHING');
    reset(run, 'l');
    assert.equal(await accessory_or_armor_on(ring), ECMD_TIME);
    assert.match(messages(), /too slippery to remove/);
    assert.equal(ring.owornmask | 0, 0);
});
for (const [weapon, hand, allowed] of [['DAGGER', 'r', false], ['DAGGER', 'l', true], ['TWO_HANDED_SWORD', 'l', false]]) {
    test(`welded ${weapon} guard, selected=${hand}`, async () => {
        const run = await fresh();
        const obj = await item(weapon);
        await curse(obj);
        obj.bknown = 0;
        await setuwep(obj);
        const ring = await item('RIN_SEARCHING');
        reset(run, hand);
        assert.equal(await accessory_or_armor_on(ring), ECMD_TIME);
        assert.equal(!!is_worn(ring), allowed);
        if (!allowed)
            assert.match(messages(), /cannot free your weapon hand/);
        assert.equal(game.u.uwep, obj);
    });
}
test('ring cancellation is before silver contact or any RNG', async () => {
    const run = await fresh();
    await polymon(PMNAMES.PM_VAMPIRE);
    const type = game.objects.findIndex(o => o.oc_class === OCLASSES.RING_CLASS && o.oc_material === MATERIALS.SILVER);
    const ring = mksobj(type, false, false);
    await addinv(ring);
    reset(run);
    const hp = game.u.mh;
    const held = await pauseAtInput(run, () => accessory_or_armor_on(ring));
    const during = { hp: game.u.mh, worn: ring.owornmask | 0, rng: [...getRngLog()] };
    held.resume(27);
    assert.equal(await held.pending, ECMD_OK);
    assert.equal(held.stopped, true);
    assert.deepEqual(during, { hp, worn: 0, rng: [] });
    assert.equal(game.u.mh, hp);
    assert.equal(ring.owornmask | 0, 0);
});
test('real limbless form is rejected before the ring-side prompt', async () => {
    const run = await fresh();
    await polymon(PMNAMES.PM_GELATINOUS_CUBE);
    const ring = await item('RIN_SEARCHING');
    reset(run);
    run._display.onEmptyQueue = () => { throw Error('unexpected selection'); };
    assert.equal(await accessory_or_armor_on(ring), ECMD_OK);
    assert.match(messages(), /cannot make the ring stick/);
    assert.equal(ring.owornmask | 0, 0);
});
test('occupied amulet is rejected before touching the second item', async () => {
    const run = await fresh();
    const first = await item('AMULET_OF_REFLECTION');
    await accessory_or_armor_on(first);
    const next = await item('AMULET_OF_ESP');
    reset(run);
    assert.equal(await accessory_or_armor_on(next), ECMD_OK);
    assert.equal(game.u.uamul, first);
    assert.equal(next.owornmask | 0, 0);
    assert.match(messages(), /already wearing an amulet/);
    assert.deepEqual(getRngLog(), []);
});
test('innate floating-eye levitation wobbles at a sink without damage or RNG', async () => {
    const run = await fresh();
    await polymon(PMNAMES.PM_FLOATING_EYE);
    const lev = game.u.intrinsic.HLevitation;
    assert.ok(lev);
    const hp = game.u.mh;
    set_levltyp(x, y, SINK);
    reset(run);
    await spoteffects(false);
    assert.match(messages(), /wobble unsteadily/);
    assert.equal(game.u.mh, hp);
    assert.equal(game.u.intrinsic.HLevitation, lev);
    assert.deepEqual(getRngLog(), []);
});
test('sink crash message completes before real damage and ring removal', async () => {
    const run = await fresh();
    const ring = await item('RIN_LEVITATION');
    await setworn(ring, W_RINGL);
    set_levltyp(x, y, SINK);
    reset(run);
    await pline('An existing message occupies enough of the line to require acknowledgement.');
    const held = await pauseAtInput(run, () => spoteffects(false));
    const during = { hp: game.u.uhp, ring: game.u.uleft, extrinsic: game.u.uprops.LEVITATION,
        rng: [...getRngLog()] };
    held.resume();
    await held.pending;
    assert.equal(held.stopped, true);
    assert.equal(during.hp, 200);
    assert.equal(during.ring, ring);
    assert.equal(during.extrinsic, 0);
    assert.deepEqual(during.rng, []);
    assert.equal(game.u.uleft, null);
    assert.ok(game.u.uhp < 200);
});
test('half physical damage applies separately to the fall and each floor weapon', async () => {
    const outcomes = [];
    for (const half of [false, true]) {
        const run = await fresh();
        if (half)
            await item('SKELETON_KEY', 'The Master Key of Thievery');
        assert.equal(!!game.u.uprops.HALF_PHDAM, half);
        const ring = await item('RIN_LEVITATION');
        await setworn(ring, W_RINGL);
        await place_object(mksobj(ONAMES.DAGGER, false, false), x, y);
        set_levltyp(x, y, SINK);
        reset(run);
        await spoteffects(false);
        outcomes.push({ loss: 200 - game.u.uhp, con: ACURR(A_CON), rng: [...getRngLog()] });
    }
    assert.deepEqual(outcomes[0].rng, outcomes[1].rng);
    const amounts = outcomes[0].rng.filter(v => /^(rn2\(8\)|rnd\(3\))/.test(v))
        .map(v => Number(v.split('=')[1]) + (v.startsWith('rn2') ? 25 - outcomes[0].con : 0));
    assert.equal(amounts.length, 2);
    assert.equal(outcomes[0].loss, amounts.reduce((a, b) => a + b, 0));
    assert.equal(outcomes[1].loss, amounts.reduce((a, b) => a + Math.trunc((b + 1) / 2), 0));
});

test('sink awaits real exercise encumbrance feedback before restoring levitation and removing the ring', async () => {
    const run = await fresh();
    await item('PLATE_MAIL');
    await item('PLATE_MAIL');
    const ring = await item('RIN_LEVITATION');
    await setworn(ring, W_RINGL);
    await encumber_msg();
    await place_object(mksobj(ONAMES.DAGGER, false, false), x, y);
    set_levltyp(x, y, SINK);
    reset(run);
    const held = await pauseAtInput(run, () => spoteffects(false));
    const during = { ring: game.u.uleft, extrinsic: game.u.uprops.LEVITATION,
        intrinsic: game.u.intrinsic.HLevitation, text: game._pending_message };
    held.resume();
    await held.pending;
    assert.equal(held.stopped, true);
    assert.match(messages(), /movements|load|difficulty/);
    assert.equal(during.ring, ring);
    assert.equal(during.extrinsic, 0);
    assert.equal(during.intrinsic, 0);
    assert.equal(game.u.uleft, null);
});
