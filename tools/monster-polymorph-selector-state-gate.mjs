// Pinned C mon.c:5028-5535 and makemon.c:1355-1453. Normal production imports.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import * as mon from '../js/mon.js';
import { makemon, newmonhp } from '../js/makemon.js';
import { set_mon_data } from '../js/mondata.js';
import { mksobj, add_to_minv } from '../js/mkobj.js';
import { christen_monst } from '../js/do_name.js';
import { TOPLINE_EMPTY } from '../js/display.js';
import { PMNAMES as P, MONSYMS as S } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { ROOM, NO_MINVENT, MM_NOMSG, MM_ASLEEP, MM_NOCOUNTBIRTH,
    G_GENOD, G_EXTINCT, M_AP_OBJECT, M_AP_NOTHING, W_ARM } from '../js/const.js';

const flags = NO_MINVENT | MM_NOMSG | MM_ASLEEP | MM_NOCOUNTBIRTH;
async function setup(type = P.PM_ORC_CAPTAIN) {
    const run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game._toplin = TOPLINE_EMPTY;
    game._toplines = game._pending_message = '';
    run._display.onEmptyQueue = () => { throw new Error('Unexpected input: ' + game._toplines); };
    game.in_mklev = true;
    game.flags.monpolycontrol = false;
    game.level.monsters = []; game.level.monAt.clear();
    game.level.traps = []; game.level.objects = []; game.level.objAt.clear();
    for (let x = 25; x <= 40; x++)
        for (let y = 5; y <= 15; y++)
            Object.assign(game.level.at(x, y), { typ: ROOM, roomno: 0 });
    const target = await makemon(game.mons[P.PM_ORC_CAPTAIN], 30, 10, flags);
    set_mon_data(target, game.mons[type]); newmonhp(target, type);
    Object.assign(target, { cham: -1, minvent: [], misc_worn_check: 0 });
    initRng(21); enableRngLog();
    return { target, display: run._display };
}

async function answer(display, action, keys, pendingCheck = () => {}) {
    let reached;
    const waiting = new Promise(resolve => { reached = resolve; });
    display.onEmptyQueue = () => { reached(); };
    const result = action();
    assert.ok(result instanceof Promise, 'actual input must return completion');
    await Promise.race([waiting, result.then(() => {
        throw new Error('Operation completed before requesting input');
    })]);
    assert.ok(display.isWaitingForInput);
    let pendingError;
    try { await pendingCheck(); }
    catch (error) { pendingError = error; }
    display.onEmptyQueue = () => { throw new Error('Unexpected extra input: ' + game._toplines); };
    for (const key of keys) display.pushKey(key.charCodeAt(0));
    const completed = await result;
    if (pendingError) throw pendingError;
    return completed;
}

const vampireCases = [
    ['basic wolf refused', P.PM_VAMPIRE, P.PM_WOLF, 0, false, P.PM_WOLF],
    ['leader wolf allowed', P.PM_VAMPIRE_LEADER, P.PM_WOLF, 0, true, P.PM_WOLF],
    ['fog allowed', P.PM_VAMPIRE, P.PM_FOG_CLOUD, 0, true, P.PM_FOG_CLOUD],
    ['vampire bat allowed', P.PM_VAMPIRE, P.PM_VAMPIRE_BAT, 0, true, P.PM_VAMPIRE_BAT],
    ['other shifter becomes self', P.PM_VAMPIRE, P.PM_CHAMELEON, 0, true, P.PM_VAMPIRE],
    ['vampire class becomes self', P.PM_VAMPIRE_LEADER, P.PM_NEWT, S.S_VAMPIRE, true, P.PM_VAMPIRE_LEADER],
    ['bat class canonicalizes', P.PM_VAMPIRE, P.PM_BAT, S.S_BAT, true, P.PM_VAMPIRE_BAT],
    ['vortex class canonicalizes', P.PM_VAMPIRE, P.PM_ENERGY_VORTEX, S.S_VORTEX, true, P.PM_FOG_CLOUD],
    ['leader dog class becomes wolf', P.PM_VAMPIRE_LEADER, P.PM_LITTLE_DOG, S.S_DOG, true, P.PM_WOLF],
    ['basic dog class refused', P.PM_VAMPIRE, P.PM_LITTLE_DOG, S.S_DOG, false, -1],
    ['unrelated class refused', P.PM_VAMPIRE, P.PM_NEWT, S.S_LIZARD, false, -1],
    ['random is not a vampire form', P.PM_VAMPIRE, -1, 0, false, -1],
];
for (const [name, base, form, klass, ok, expected] of vampireCases)
    test(`validvamp: ${name}`, async () => {
        const { target } = await setup(base); target.cham = base;
        const ref = { v: form };
        assert.equal(mon.validvamp(target, ref, klass), ok);
        assert.equal(ref.v, expected);
        assert.deepEqual(getRngLog(), []);
    });

test('Vlad carrying the Candelabrum overrides even an invalid selection', async () => {
    const { target } = await setup(P.PM_VLAD_THE_IMPALER); target.cham = P.PM_VLAD_THE_IMPALER;
    add_to_minv(target, mksobj(O.CANDELABRUM_OF_INVOCATION, false, false));
    initRng(21); enableRngLog();
    const ref = { v: -1 };
    assert.equal(mon.validvamp(target, ref, 0), true);
    assert.equal(ref.v, P.PM_VLAD_THE_IMPALER);
    assert.deepEqual(getRngLog(), []);
});
test('ordinary validvamp delegates genocide and special-monster restrictions', async () => {
    const { target } = await setup();
    assert.equal(mon.validvamp(target, { v: P.PM_NEWT }, 0), true);
    game.mvitals[P.PM_NEWT].mvflags |= G_GENOD;
    assert.equal(mon.validvamp(target, { v: P.PM_NEWT }, 0), false);
    target.isshk = true;
    assert.equal(mon.validvamp(target, { v: P.PM_FOG_CLOUD }, 0), false);
    assert.deepEqual(getRngLog(), []);
});

for (const type of [P.PM_DEATH, P.PM_FAMINE, P.PM_PESTILENCE, P.PM_NAZGUL, P.PM_ERINYS])
    test(`newcham immunity before names/input/RNG: ${type}`, async () => {
        const { target } = await setup(type); game.flags.monpolycontrol = true;
        assert.equal(mon.newcham(target, null, 0), 0);
        assert.equal(target.mnum, type); assert.deepEqual(getRngLog(), []);
    });
test('an apparent Rider with a natural shapechanger base can change', async () => {
    const { target } = await setup(P.PM_DEATH); target.cham = P.PM_DOPPELGANGER;
    assert.equal(mon.newcham(target, game.mons[P.PM_NEWT], 0), 1);
    assert.equal(target.mnum, P.PM_NEWT);
});
for (const protected_ of [false, true])
    test(`cancelled natural shapechanger, protection=${protected_}`, async () => {
        const { target } = await setup(P.PM_CHAMELEON); target.mcan = 1;
        game.u.intrinsic.HProtection_from_shape_changers = protected_ ? 1 : 0;
        assert.equal(mon.newcham(target, target.data, 0), 0);
        assert.equal(target.cham, protected_ ? -1 : P.PM_CHAMELEON);
        assert.equal(target.mcan, protected_ ? 1 : 0);
        assert.deepEqual(getRngLog(), []);
    });
test('explicit extinct form is allowed, genocided form is not', async () => {
    const { target } = await setup();
    game.mvitals[P.PM_NEWT].mvflags |= G_GENOD;
    assert.equal(mon.newcham(target, game.mons[P.PM_NEWT], 0), 0);
    assert.deepEqual(getRngLog(), []);
    game.mvitals[P.PM_NEWT].mvflags = G_EXTINCT;
    assert.equal(mon.newcham(target, game.mons[P.PM_NEWT], 0), 1);
    assert.equal(target.mnum, P.PM_NEWT);
});
test('same form returns scalar zero without gender or HP rolls', async () => {
    const { target } = await setup();
    assert.equal(mon.newcham(target, target.data, 0), 0);
    assert.deepEqual(getRngLog(), []);
});
test('mimic appearance clears before applying a non-mimic form', async () => {
    const { target } = await setup(P.PM_SMALL_MIMIC);
    target.m_ap_type = M_AP_OBJECT; target.mappearance = O.CHEST;
    assert.equal(mon.newcham(target, game.mons[P.PM_NEWT], 0), 1);
    assert.equal(target.m_ap_type, M_AP_NOTHING); assert.equal(target.mappearance, 0);
});
test('Endgame mplayer title is removed, ordinary assigned names are retained', async () => {
    const { target } = await setup(P.PM_WIZARD);
    christen_monst(target, 'Dana the Evoker');
    game.astral_level = { dnum: 6, dlevel: 1 }; game.u.uz = { ...game.astral_level };
    assert.equal(mon.newcham(target, game.mons[P.PM_NEWT], 0), 1);
    assert.equal(target.mgivenname, 'Dana');
});
test('non-Endgame mplayer keeps its complete given name', async () => {
    const { target } = await setup(P.PM_WIZARD); christen_monst(target, 'Dana the Evoker');
    assert.equal(mon.newcham(target, game.mons[P.PM_NEWT], 0), 1);
    assert.equal(target.mgivenname, 'Dana the Evoker');
});

test('noninteractive selection and creation retain scalar returns', async () => {
    const { target } = await setup();
    assert.equal(typeof mon.select_newcham_form(target), 'number');
    assert.equal(mon.newcham(target, game.mons[P.PM_NEWT], 0), 1);
    const created = makemon(game.mons[P.PM_CHAMELEON], 35, 10, flags);
    assert.ok(created && !(created instanceof Promise));
    assert.equal(created.cham, P.PM_CHAMELEON);
    assert.equal(game.level.monAt.get('35,10'), created);
});
test('control option without wizard mode does not request input', async () => {
    const { target } = await setup(); game.wizard = false; game.flags.monpolycontrol = true;
    assert.equal(typeof mon.select_newcham_form(target), 'number');
});
test('shape preference RNG occurs before input and not again on resume', async () => {
    const { target, display } = await setup(P.PM_VAMPIRE_BAT);
    target.cham = P.PM_VAMPIRE; game.flags.monpolycontrol = true;
    initRng(5); enableRngLog();
    const result = await answer(display, () => mon.select_newcham_form(target), 'vampire bat\r', () => {
        assert.deepEqual(getRngLog(), ['rn2(4)=0', 'rn2(4)=2']);
        assert.equal(target.mnum, P.PM_VAMPIRE_BAT);
    });
    assert.equal(result, P.PM_VAMPIRE_BAT);
    assert.deepEqual(getRngLog(), ['rn2(4)=0', 'rn2(4)=2']);
});
test('ordinary dragon armor preference can be overridden by the shared prompt', async () => {
    const { target, display } = await setup();
    const armor = mksobj(O.GRAY_DRAGON_SCALE_MAIL, false, false);
    add_to_minv(target, armor); armor.owornmask = target.misc_worn_check = W_ARM;
    game.flags.monpolycontrol = true; initRng(21); enableRngLog();
    assert.equal(await answer(display, () => mon.select_newcham_form(target), 'kitten\r', () => {
        assert.deepEqual(getRngLog(), []);
    }), P.PM_KITTEN);
    assert.deepEqual(getRngLog(), []);
});
test('screen-coordinate option reaches the shared prompt', async () => {
    const { target, display } = await setup(); game.flags.monpolycontrol = true;
    game.iflags.getpos_coords = 's';
    assert.equal(await answer(display, () => mon.select_newcham_form(target), 'newt\r', () => {
        assert.match(game._toplines, / @ \[12,30\] into what\? /);
    }), P.PM_NEWT);
});
test('Rogue newcham rejects five lowercase choices, then accepts the sixth', async () => {
    const { target, display } = await setup(); game.flags.monpolycontrol = true;
    game.rogue_level = { ...game.u.uz };
    let prompts = 0;
    game._preNhgetchHook = () => {
        if (game._toplines.endsWith('into what? ')) prompts++;
    };
    assert.equal(await answer(display, () => mon.newcham(target, null, 0), 'newt\r'.repeat(6)), 1);
    assert.equal(prompts, 6); assert.equal(target.mnum, P.PM_NEWT);
    game._preNhgetchHook = null;
});
test('initial creation prompts under in_mklev and MM_NOMSG, before inventory', async () => {
    const { display } = await setup(); game.flags.monpolycontrol = true;
    const created = await answer(display, () => makemon(game.mons[P.PM_CHAMELEON], 35, 10,
        MM_NOMSG | MM_ASLEEP | MM_NOCOUNTBIRTH), 'kitten\r', async () => {
        const pending = game.level.monsters.find(m => m.cham === P.PM_CHAMELEON);
        assert.ok(pending); assert.equal(pending.mnum, P.PM_CHAMELEON);
        assert.equal(pending.minvent, null);
        const calls = getRngLog();
        await Promise.resolve(); assert.deepEqual(getRngLog(), calls);
    });
    assert.equal(created.mnum, P.PM_KITTEN); assert.equal(created.cham, P.PM_CHAMELEON);
    assert.equal(created.minvent, null);
});
test('shape protection bypasses initial newcham by the C guard', async () => {
    await setup(); game.flags.monpolycontrol = true;
    game.u.intrinsic.HProtection_from_shape_changers = 1;
    const created = makemon(game.mons[P.PM_CHAMELEON], 35, 10, flags);
    assert.ok(created && !(created instanceof Promise));
    assert.equal(created.mnum, P.PM_CHAMELEON); assert.equal(created.cham, -1);
});

for (const key of ['\x1b', '*\r', 'RaNdOm\r'])
    test(`wizard random/cancel discards the preselected armor form: ${JSON.stringify(key)}`, async () => {
        const { target, display } = await setup();
        const armor = mksobj(O.GRAY_DRAGON_SCALES, false, false);
        add_to_minv(target, armor); armor.owornmask = target.misc_worn_check = W_ARM;
        game.flags.monpolycontrol = true; initRng(21); enableRngLog();
        assert.equal(await answer(display, () => mon.select_newcham_form(target), key), P.PM_YELLOW_MOLD);
        assert.deepEqual(getRngLog(), ['rn2(330)=160']);
    });
test('vampire cancel repeats pickvampshape instead of using arbitrary fallback', async () => {
    const { target, display } = await setup(P.PM_VAMPIRE_BAT);
    target.cham = P.PM_VAMPIRE; game.flags.monpolycontrol = true;
    initRng(5); enableRngLog();
    assert.equal(await answer(display, () => mon.select_newcham_form(target), '\x1b'), P.PM_VAMPIRE_BAT);
    assert.deepEqual(getRngLog(), ['rn2(4)=0', 'rn2(4)=2', 'rn2(4)=2', 'rn2(4)=2']);
});
for (const choice of ['D', 'dragon'])
    test(`class selection uses mkclass_poly: ${choice}`, async () => {
        const { target, display } = await setup(); game.flags.monpolycontrol = true;
        const type = await answer(display, () => mon.select_newcham_form(target), choice + '\r');
        assert.equal(game.mons[type].mlet, S.S_DRAGON);
        assert.equal(getRngLog().length, 2);
        assert.match(getRngLog()[0], /^rn2\(9\)=/);
    });
test('five invalid answers expand the retry prompt once and fall back once', async () => {
    const { target, display } = await setup(); game.flags.monpolycontrol = true;
    const prompts = [];
    game._preNhgetchHook = () => {
        if (game._toplines.endsWith('what? ') || game._toplines.endsWith('monster? '))
            prompts.push(game._toplines);
    };
    const type = await answer(display, () => mon.select_newcham_form(target), 'squid\r '.repeat(5));
    assert.equal(type, P.PM_YELLOW_MOLD);
    assert.equal(prompts.length, 5);
    assert.match(prompts[0], /into what\? /);
    assert.ok(prompts.slice(1).every(p => p.endsWith('into what kind of monster? ')));
    assert.match(game._toplines, /That's enough tries!/);
    assert.deepEqual(getRngLog(), ['rn2(330)=160']);
    game._preNhgetchHook = null;
});
test('long prompt truncates the name, preserves the coordinate suffix and skips retry expansion', async () => {
    const { target, display } = await setup(); game.flags.monpolycontrol = true;
    // Constructed bound control. Normal assigned names have a smaller limit.
    target.mgivenname = 'A'.repeat(240);
    const prompts = [];
    game._preNhgetchHook = () => {
        if (game._toplines.endsWith('into what? ')) prompts.push(game._toplines);
    };
    assert.equal(await answer(display, () => mon.select_newcham_form(target), 'squid\r newt\r'), P.PM_NEWT);
    assert.equal(prompts.length, 2);
    assert.ok(prompts.every(p => p.length === 128 && p.endsWith(' @ <30,10> into what? ')));
    assert.equal(prompts[0], prompts[1]);
    game._preNhgetchHook = null;
});
test('old long-worm tail is removed and its head stays at the original square', async () => {
    await setup();
    const worm = makemon(game.mons[P.PM_LONG_WORM], 35, 10, flags);
    assert.ok(worm && !(worm instanceof Promise));
    const number = worm.wormno; assert.ok(number);
    assert.ok(game.worms.wheads[number]);
    initRng(21); enableRngLog();
    assert.equal(mon.newcham(worm, game.mons[P.PM_NEWT], 0), 1);
    assert.equal(worm.wormno, 0); assert.ok(!game.worms.wheads[number]);
    assert.equal(game.level.monAt.get('35,10'), worm);
    assert.deepEqual([worm.mx, worm.my], [35, 10]);
});
