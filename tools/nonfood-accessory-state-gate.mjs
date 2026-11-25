// Public doeat controls. Material randomization, wearing and effects are real.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, seed, clearMessages, messages } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { doeat, is_edible } from '../js/eat.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { init_objects } from '../js/o_init.js';
import { polymon } from '../js/polyself.js';
import { setworn } from '../js/worn.js';
import { Ring_on } from '../js/do_wear.js';
import { set_itimeout } from '../js/potion.js';
import { cmdq_add_key } from '../js/cmd.js';
import { getRngLog, rn2, rnd, d } from '../js/rng.js';
import { ABASE } from '../js/attrib.js';
import { Levitation, Sleep_resistance, Fixed_abil, Fire_resistance, Invis,
    See_invisible } from '../js/youprop.js';
import { ONAMES, OCLASSES, MATERIALS } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { CQ_CANNED, ECMD_TIME, OBJ_INVENT, W_RINGL, W_RINGR, FROMOUTSIDE,
    NOT_HUNGRY, A_CHA, A_STR, A_CON, Upolyd } from '../js/const.js';

function effectSeed(bound, success = true) {
    for (let value = 1; value < 100; value++) {
        seed(value);
        if ((rn2(bound) === 0) === success)
            return value;
    }
    throw Error('bounded effect seed search failed');
}

async function fixture(typ, { spe = 0, worn = false, success = true } = {}) {
    const run = await setup();
    // These are constructed states from the actual object initializer. No
    // material is assigned, and no ordinary seed claim is made by this gate.
    for (let value = 1; value <= 64; value++) {
        seed(value);
        init_objects();
        const material = game.objects[typ].oc_material;
        if (material >= MATERIALS.IRON && material <= MATERIALS.MITHRIL)
            break;
    }
    await polymon(PMNAMES.PM_XORN);
    game.u.uhunger = 500;
    game.u.uhs = NOT_HUNGRY;
    const obj = mksobj(typ, false, false);
    obj.spe = spe;
    await addinv(obj);
    assert.equal(is_edible(obj), true);
    if (worn) {
        await setworn(obj, W_RINGL);
        await Ring_on(obj);
    }
    clearMessages();
    run._display.clearInputQueue();
    game.command_queue = [];
    cmdq_add_key(CQ_CANNED, obj.invlet);
    const effect = effectSeed(obj.oclass === OCLASSES.RING_CLASS ? 3 : 5, success);
    seed(effect);
    return { run, obj, effect };
}

const defaults = [
    ['RIN_FIRE_RESISTANCE', 'HFire_resistance'],
    ['RIN_COLD_RESISTANCE', 'HCold_resistance'],
    ['RIN_SHOCK_RESISTANCE', 'HShock_resistance'],
    ['RIN_POISON_RESISTANCE', 'HPoison_resistance'],
    ['RIN_REGENERATION', 'HRegeneration'],
    ['RIN_HUNGER', 'HHunger'],
    ['RIN_CONFLICT', 'HConflict'],
    ['RIN_SEARCHING', 'HSearching'],
    ['RIN_TELEPORTATION', 'HTeleportation'],
    ['RIN_TELEPORT_CONTROL', 'HTeleport_control'],
    ['RIN_POLYMORPH', 'HPolymorph'],
    ['RIN_POLYMORPH_CONTROL', 'HPolymorph_control'],
    ['RIN_STEALTH', 'HStealth'],
    ['RIN_WARNING', 'HWarning'],
    ['RIN_AGGRAVATE_MONSTER', 'HAggravate_monster'],
    ['AMULET_OF_ESP', 'HTelepat'],
    ['AMULET_OF_MAGICAL_BREATHING', 'HMagical_breathing'],
];
for (const [name, key] of defaults) {
    test(`accepted ${name} writes canonical intrinsic bits`, async () => {
        const { obj } = await fixture(ONAMES[name]);
        set_itimeout(key, 37);
        const before = game.u.intrinsic[key];
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(game.u.intrinsic[key], before | FROMOUTSIDE);
        assert.equal(obj.known, 1);
        assert.equal(obj.dknown, 1);
        assert.equal(game.invent.includes(obj), false);
        assert.deepEqual(game.context.victual, {});
        assert.match(messages(), /Magic spreads through your body/);
        assert.deepEqual(getRngLog(), [obj.oclass === OCLASSES.RING_CLASS ? 'rn2(3)=0' : 'rn2(5)=0']);
    });
}

for (const typ of [ONAMES.RIN_FIRE_RESISTANCE, ONAMES.AMULET_OF_ESP]) {
    test(`failed accessory effect still observes, tastes and consumes type ${typ}`, async () => {
        const { obj } = await fixture(typ, { success: false });
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(obj.known, 1);
        assert.equal(obj.dknown, 1);
        assert.equal(game.invent.includes(obj), false);
        assert.equal((game.u.intrinsic.HFire_resistance || 0) & FROMOUTSIDE, 0);
        assert.equal((game.u.intrinsic.HTelepat || 0) & FROMOUTSIDE, 0);
        assert.doesNotMatch(messages(), /Magic spreads/);
        assert.equal(getRngLog().length, 1);
    });
}

test('repeat acquisition preserves timeout and suppresses repeated effect speech', async () => {
    const { obj, effect } = await fixture(ONAMES.RIN_FIRE_RESISTANCE);
    await doeat();
    assert.equal(Fire_resistance(), true);
    const again = mksobj(obj.otyp, false, false);
    await addinv(again);
    set_itimeout('HFire_resistance', 29);
    const before = game.u.intrinsic.HFire_resistance;
    clearMessages();
    cmdq_add_key(CQ_CANNED, again.invlet);
    seed(effect);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(game.u.intrinsic.HFire_resistance, before);
    assert.doesNotMatch(messages(), /Magic spreads/);
    assert.deepEqual(getRngLog(), ['rn2(3)=0']);
});

for (const [name, attr] of [['RIN_ADORNMENT', A_CHA], ['RIN_GAIN_STRENGTH', A_STR],
    ['RIN_GAIN_CONSTITUTION', A_CON]]) {
    test(`eaten ${name} uses actual attribute adjustment and identification`, async () => {
        const { obj } = await fixture(ONAMES[name], { spe: -1 });
        const before = ABASE(attr);
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(ABASE(attr), before - 1);
        assert.equal(game.objects[obj.otyp].oc_name_known, 1);
        assert.match(messages(), /Magic spreads/);
    });
}

test('a second worn sustain-ability ring blocks the eaten attribute effect', async () => {
    const { obj, effect } = await fixture(ONAMES.RIN_GAIN_STRENGTH, { spe: -1 });
    const fixed = mksobj(ONAMES.RIN_SUSTAIN_ABILITY, false, false);
    await addinv(fixed);
    await setworn(fixed, W_RINGR);
    await Ring_on(fixed);
    assert.equal(Fixed_abil(), true);
    const before = ABASE(A_STR);
    clearMessages();
    seed(effect);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(ABASE(A_STR), before);
    assert.equal(game.objects[obj.otyp].oc_name_known, 0);
    assert.equal(game.u.uright, fixed);
    assert.match(messages(), /Magic spreads/);
    assert.deepEqual(getRngLog(), ['rn2(3)=0']);
});

for (const [name, field] of [['RIN_INCREASE_ACCURACY', 'uhitinc'], ['RIN_INCREASE_DAMAGE', 'udaminc']]) {
    test(`${name} keeps the bounded lower limit`, async () => {
        const { effect } = await fixture(ONAMES[name], { spe: -1 });
        game.u[field] = -128;
        seed(effect);
        assert.equal(await doeat(), ECMD_TIME);
        // A same-sign sum above 40 suppresses another negative increase.
        assert.equal(game.u[field], -128);
        assert.deepEqual(getRngLog(), ['rn2(3)=0']);
    });
    test(`${name} removes eaten worn contribution before permanent increase`, async () => {
        const { obj } = await fixture(ONAMES[name], { spe: 3, worn: true });
        assert.equal(game.u[field], 3);
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(game.u[field], 3);
        assert.equal(game.u.uleft, null);
        assert.equal(obj.owornmask, 0);
        assert.deepEqual(getRngLog(), ['rn2(3)=0']);
    });
}

for (const [name, increment] of [['RIN_PROTECTION', 3], ['AMULET_OF_GUARDING', 2]]) {
    test(`${name} supplies permanent protection from a fresh zero field`, async () => {
        await fixture(ONAMES[name], { spe: 3 });
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(game.u.ublessed, increment);
        assert.equal(game.u.intrinsic.HProtection & FROMOUTSIDE, FROMOUTSIDE);
        assert.equal(game.disp.botl, true);
    });
}

test('free action gives sleep resistance and no free-action intrinsic', async () => {
    await fixture(ONAMES.RIN_FREE_ACTION);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(Sleep_resistance(), true);
    assert.equal(game.u.intrinsic.HSleep_resistance & FROMOUTSIDE, FROMOUTSIDE);
    assert.equal((game.u.intrinsic.HFree_action || 0) & FROMOUTSIDE, 0);
    assert.match(messages(), /wide awake/);
});

for (const name of ['RIN_SUSTAIN_ABILITY', 'AMULET_OF_LIFE_SAVING', 'AMULET_OF_FLYING',
    'AMULET_OF_REFLECTION']) {
    test(`${name} is consumed without granting its property`, async () => {
        const { obj } = await fixture(ONAMES[name]);
        const before = { ...game.u.intrinsic };
        assert.equal(await doeat(), ECMD_TIME);
        assert.deepEqual(game.u.intrinsic, before);
        assert.equal(game.invent.includes(obj), false);
        assert.doesNotMatch(messages(), /Magic spreads/);
        assert.equal(getRngLog().length, 1);
    });
}

test('levitation gives a duration and restores the old intrinsic word first', async () => {
    const { effect } = await fixture(ONAMES.RIN_LEVITATION);
    seed(effect);
    rn2(3);
    const duration = d(10, 20);
    rn2(19); // makeknown exercises wisdom.
    const rng = [...getRngLog()];
    seed(effect);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(game.u.intrinsic.HLevitation, duration);
    assert.equal(!!Levitation(), true);
    assert.deepEqual(getRngLog(), rng);
});

test('existing levitation is preserved without duration or identification draws', async () => {
    await fixture(ONAMES.RIN_LEVITATION);
    set_itimeout('HLevitation', 29);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(game.u.intrinsic.HLevitation, 29);
    assert.deepEqual(getRngLog(), ['rn2(3)=0']);
});

for (const oldnap of [0, 1, 100]) {
    test(`restful sleep preserves the shorter timeout, prior=${oldnap}`, async () => {
        const { effect } = await fixture(ONAMES.AMULET_OF_RESTFUL_SLEEP);
        set_itimeout('HSleepy', oldnap);
        seed(effect);
        rn2(5);
        const nap = rnd(100);
        const rng = [...getRngLog()];
        seed(effect);
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(game.u.intrinsic.HSleepy, FROMOUTSIDE | (oldnap ? Math.min(oldnap, nap) : nap));
        assert.deepEqual(getRngLog(), rng);
    });
}

test('unchanging amulet returns the accepted xorn to human', async () => {
    await fixture(ONAMES.AMULET_OF_UNCHANGING);
    assert.equal(Upolyd(game.u), true);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(Upolyd(game.u), false);
    assert.match(messages(), /Magic spreads/);
});

test('change amulet uses the shared sex-change owner', async () => {
    const { obj } = await fixture(ONAMES.AMULET_OF_CHANGE);
    const before = game.flags.female;
    assert.equal(await doeat(), ECMD_TIME);
    assert.notEqual(game.flags.female, before);
    assert.equal(game.objects[obj.otyp].oc_name_known, 1);
    assert.match(messages(), /suddenly very/);
});

test('invisibility effect reaches its actual visibility consumer', async () => {
    await fixture(ONAMES.RIN_INVISIBILITY);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(Invis(), true);
    assert.equal(game.u.intrinsic.HInvis & FROMOUTSIDE, FROMOUTSIDE);
    assert.match(messages(), /strange transparency/);
});

test('see-invisible effect reveals the intrinsically invisible hero', async () => {
    await fixture(ONAMES.RIN_SEE_INVISIBLE);
    set_itimeout('HInvis', 30);
    assert.equal(Invis(), true);
    assert.equal(See_invisible(), false);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(See_invisible(), true);
    assert.match(messages(), /Suddenly you can see yourself/);
});

test('effect feedback waits after nutrition but before granting or disposing', async () => {
    const { run, obj } = await fixture(ONAMES.RIN_FIRE_RESISTANCE);
    const before = game.u.intrinsic.HFire_resistance || 0;
    let arrived, release;
    const waiting = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = doeat();
    let timer;
    await Promise.race([waiting, operation, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('accessory feedback did not reach a boundary')), 2000);
    })]);
    clearTimeout(timer);
    await setImmediate();
    const during = { where: obj.where, intrinsic: game.u.intrinsic.HFire_resistance || 0,
        hunger: game.u.uhunger, victual: { ...game.context.victual },
        rng: [...getRngLog()] };
    run._display.onEmptyQueue = () => 32;
    release?.(32);
    await operation;
    assert.deepEqual(during, { where: OBJ_INVENT, intrinsic: before,
        hunger: 500 + game.objects[obj.otyp].oc_nutrition, victual: {}, rng: ['rn2(3)=0'] });
    assert.equal(Fire_resistance(), true);
    assert.equal(game.invent.includes(obj), false);
});

for (const [name, field] of [['RIN_INCREASE_ACCURACY', 'uhitinc'], ['RIN_INCREASE_DAMAGE', 'udaminc']]) {
    test(`${name} narrows after excluding a worn contribution from the bound`, async () => {
        const { obj, effect } = await fixture(ONAMES[name], { spe: 127 });
        const worn = mksobj(obj.otyp, false, false);
        worn.spe = 127;
        await addinv(worn);
        game.u[field] = -7;
        await setworn(worn, W_RINGR);
        await Ring_on(worn);
        assert.equal(game.u[field], 120);
        clearMessages();
        seed(effect);
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(game.u[field], -9); // (signed char) (120 + 127)
        assert.equal(game.u.uright, worn);
        assert.deepEqual(getRngLog(), ['rn2(3)=0']);
    });
}
