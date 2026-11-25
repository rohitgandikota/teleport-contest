// Constructed source contracts. Native keyboard coverage is checked separately.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, clearMessages, messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {enlightenment, BASICENLIGHTENMENT, MAGICENLIGHTENMENT,
    ENL_GAMEOVERALIVE} from '../js/insight.js';
import {change_sex, polymon} from '../js/polyself.js';
import {accessory_or_armor_on} from '../js/do_wear.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {cmdq_add_key, cmdq_copy, cmdq_clear} from '../js/cmd.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {A_CURRENT, A_ORIGINAL, A_NEUTRAL, A_CHAOTIC, A_LAWFUL,
    FROMOUTSIDE, W_RINGL, W_RINGR, W_AMUL, W_WEP, CQ_CANNED,
    CQ_REPEAT, ECMD_OK, ECMD_TIME} from '../js/const.js';

const report = (mode = BASICENLIGHTENMENT, final = 0) => enlightenment(mode, final).join('\n');

test('unchanged background has no original-sex or alignment correction', async () => {
    await setup();
    assert.doesNotMatch(report(), /started out|actually neutral/);
});

for (const polymorphed of [false, true])
test(`real sex change reports the original male role, polymorphed ${polymorphed}`, async () => {
    await setup();
    if (polymorphed) await polymon(PMNAMES.PM_XORN);
    change_sex();
    assert.equal(polymorphed ? game.u.mfemale : game.flags.female, true);
    assert.match(report(), /You started out male\./);
});

for (const [name, current, permanent, sexChange, expected] of [
    ['temporary helm only', A_CHAOTIC, A_NEUTRAL, false, ['actually neutral']],
    ['permanent conversion', A_LAWFUL, A_LAWFUL, false, ['started out neutral']],
    ['helm over conversion', A_CHAOTIC, A_LAWFUL, false, ['actually lawful', 'started out neutral']],
    ['sex change and conversion', A_LAWFUL, A_LAWFUL, true, ['started out male and neutral']],
    ['sex change and temporary helm', A_CHAOTIC, A_NEUTRAL, true, ['actually neutral', 'started out male']],
]) test(`background separates ${name}`, async () => {
    await setup();
    // Explicit alignment-state contracts, not a claim of native conversion.
    game.u.ualign.type = current;
    game.u.ualignbase[A_CURRENT] = permanent;
    game.u.ualignbase[A_ORIGINAL] = A_NEUTRAL;
    if (sexChange) change_sex();
    const lines = report();
    for (const text of expected) assert.ok(lines.includes(text));
    assert.equal(lines.includes('started out'), expected.some(text=>text.startsWith('started out')));
    if (name === 'temporary helm only') assert.doesNotMatch(lines, /started out chaotic/);
});

test('original background retains C past tense in final disclosure', async () => {
    await setup(); change_sex();
    game.u.ualign.type = A_CHAOTIC;
    assert.match(report(BASICENLIGHTENMENT, ENL_GAMEOVERALIVE),
        /You were actually neutral\.[\s\S]*You started out male\./);
});

for (const [name, mode, wizard, final, expected] of [
    ['basic nonwizard hides an unknown intrinsic', BASICENLIGHTENMENT, false, 0, null],
    ['magic reveals the intrinsic', MAGICENLIGHTENMENT, false, 0, 'You fall asleep uncontrollably.'],
    ['wizard reveals source and countdown', MAGICENLIGHTENMENT, true, 0,
        'You fall asleep uncontrollably intrinsically (37).'],
    ['final disclosure keeps past tense', MAGICENLIGHTENMENT, true, ENL_GAMEOVERALIVE,
        'You fell asleep uncontrollably intrinsically (37).'],
]) test(`Sleepy ${name}`, async () => {
    await setup(); game.wizard = wizard;
    game.u.intrinsic.HSleepy = FROMOUTSIDE | 37;
    const lines = report(mode, final);
    if (expected) assert.ok(lines.includes(expected));
    else assert.doesNotMatch(lines, /asleep uncontrollably/);
});

for (const [name, mask, discovered, seen, expected] of [
    ['known worn cause', W_AMUL, true, true, true],
    ['undiscovered worn cause', W_AMUL, false, true, false],
    ['unseen worn cause', W_AMUL, true, false, false],
    ['carried known cause', 0, true, true, false],
    ['wielded known cause', W_WEP, true, true, false],
]) test(`basic Sleepy disclosure checks ${name}`, async () => {
    await setup();
    const obj = mksobj(ONAMES.AMULET_OF_RESTFUL_SLEEP, false, false);
    addinv(obj); setworn(obj, mask);
    obj.dknown = seen;
    game.objects[obj.otyp].oc_name_known = discovered;
    game.u.intrinsic.HSleepy = FROMOUTSIDE | 23;
    game.wizard = false;
    assert.equal(report().includes('You fall asleep uncontrollably.'), expected);
});

test('a known worn item with another property does not disclose Sleepy', async () => {
    await setup();
    const obj = mksobj(ONAMES.AMULET_OF_ESP, false, false);
    addinv(obj); setworn(obj, W_AMUL);
    obj.dknown = true; game.objects[obj.otyp].oc_name_known = true;
    game.u.intrinsic.HSleepy = FROMOUTSIDE | 23; game.wizard = false;
    assert.doesNotMatch(report(), /asleep uncontrollably/);
});

test('extrinsic-only Sleepy uses the actual property and equipment source', async () => {
    await setup();
    const obj = mksobj(ONAMES.AMULET_OF_RESTFUL_SLEEP, false, false);
    addinv(obj); setworn(obj, W_AMUL);
    obj.dknown = true; game.objects[obj.otyp].oc_name_known = true;
    assert.equal(game.u.intrinsic.HSleepy || 0, 0);
    assert.match(report(MAGICENLIGHTENMENT),
        /fall asleep uncontrollably because of your amulet of restful sleep \(0\)/);
});

for (const [form, noun] of [[null, 'ring-fingers'], [PMNAMES.PM_XORN, 'foreclaws']])
test(`full ring slots name ${noun}`, async () => {
    await setup();
    if (form !== null) await polymon(form);
    const rings = Array.from({length:3},()=>mksobj(ONAMES.RIN_ADORNMENT, false, false));
    for (const obj of rings) addinv(obj);
    setworn(rings[0], W_RINGL); setworn(rings[1], W_RINGR);
    clearMessages();
    assert.equal(await accessory_or_armor_on(rings[2]), ECMD_OK);
    assert.match(messages(), new RegExp(`There are no more ${noun} to fill\\.`));
    assert.equal(rings[2].owornmask || 0, 0);
});

for (const [form, noun] of [[null, 'ring-finger'], [PMNAMES.PM_XORN, 'foreclaw']])
test(`ring prompt names ${noun} and retains the answer for repeat`, async () => {
    const run = await setup();
    if (form !== null) await polymon(form);
    const obj = mksobj(ONAMES.RIN_ADORNMENT, false, false); addinv(obj);
    clearMessages(); run._display.clearInputQueue();
    cmdq_clear(CQ_CANNED); cmdq_clear(CQ_REPEAT);
    let reads = 0;
    run._display.onEmptyQueue = () => {
        assert.equal(++reads, 1);
        assert.equal(obj.owornmask || 0, 0);
        assert.equal(game._pending_message, `Which ${noun}, Right or Left? [rl] `);
        return 'r'.charCodeAt(0);
    };
    assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
    assert.equal(reads, 1); assert.equal(obj.owornmask, W_RINGR);
    assert.equal(cmdq_copy(CQ_REPEAT).at(-1).key, 'r');
});

test('ring hand selection consumes a saved answer without asking again', async () => {
    const run = await setup();
    const obj = mksobj(ONAMES.RIN_ADORNMENT, false, false); addinv(obj);
    clearMessages(); run._display.clearInputQueue(); cmdq_clear(CQ_CANNED);
    cmdq_add_key(CQ_CANNED, 'l');
    run._display.onEmptyQueue = () => { throw Error('saved ring answer was ignored'); };
    assert.equal(await accessory_or_armor_on(obj), ECMD_TIME);
    assert.equal(obj.owornmask, W_RINGL);
});
