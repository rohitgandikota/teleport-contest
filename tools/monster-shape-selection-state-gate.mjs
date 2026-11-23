// C mon.c:4993-5011, 5197-5207, 5229-5252; existing exported callers only.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { validspecmon, newcham } from '../js/mon.js';
import { makemon } from '../js/makemon.js';
import { mksobj, add_to_minv } from '../js/mkobj.js';
import { which_armor } from '../js/worn.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES, MFLAGS } from '../js/monst_data.js';
import { ROOM, NO_MINVENT, MM_NOMSG, MM_ASLEEP, MM_NOCOUNTBIRTH,
    G_GENOD, G_EXTINCT, W_ARM } from '../js/const.js';
import { TOPLINE_EMPTY } from '../js/display.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

async function setup() {
    const run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game._toplin = TOPLINE_EMPTY; game._toplines = ''; game._pending_message = '';
    run._display.onEmptyQueue = () => { throw new Error('Unexpected input: ' + game._toplines); };
    game.level.monsters = []; game.level.monAt.clear();
    game.level.traps = []; game.level.objects = []; game.level.objAt.clear();
    Object.assign(game.level.at(30, 10), { typ: ROOM, roomno: 0 });
    const mon = await makemon(game.mons[PMNAMES.PM_ORC_CAPTAIN], 30, 10,
        NO_MINVENT | MM_NOMSG | MM_ASLEEP | MM_NOCOUNTBIRTH);
    assert.ok(mon); assert.equal(mon.cham, -1);
    assert.equal(!!game.flags.monpolycontrol, false);
    initRng(21); enableRngLog();
    return mon;
}

// validspecmon reaches the real private accept_newcham_form. NON_PM is its
// documented caller exception, not an assertion that accept accepts NON_PM.
for (const [name, type, accepted] of [
    ['ordinary newt', PMNAMES.PM_NEWT, true],
    ['orc placeholder', PMNAMES.PM_ORC, false],
    ['giant placeholder', PMNAMES.PM_GIANT, false],
    ['elf placeholder', PMNAMES.PM_ELF, false],
    ['human placeholder', PMNAMES.PM_HUMAN, false],
    ['player class', PMNAMES.PM_ARCHEOLOGIST, true],
    ['other shapechanger', PMNAMES.PM_CHAMELEON, false],
    ['random request', -1, true],
]) test(`acceptance caller: ${name}`, async () => {
    assert.equal(validspecmon(await setup(), type), accepted);
    assert.deepEqual(getRngLog(), []);
});
test('genocide precedes the player-class exception', async () => {
    const mon = await setup(); game.mvitals[PMNAMES.PM_ARCHEOLOGIST].mvflags |= G_GENOD;
    assert.equal(validspecmon(mon, PMNAMES.PM_ARCHEOLOGIST), false);
    assert.deepEqual(getRngLog(), []);
});
test('extinction is not genocide', async () => {
    const mon = await setup(); game.mvitals[PMNAMES.PM_NEWT].mvflags |= G_EXTINCT;
    assert.equal(validspecmon(mon, PMNAMES.PM_NEWT), true);
    assert.deepEqual(getRngLog(), []);
});
test('the natural shapechanger exception precedes polyok', async () => {
    const mon = await setup(); mon.cham = PMNAMES.PM_CHAMELEON;
    assert.ok(game.mons[mon.cham].mflags2 & MFLAGS.M2_NOPOLY);
    assert.equal(validspecmon(mon, mon.cham), true);
    assert.deepEqual(getRngLog(), []);
});
test('special monsters still reject a non-manipulating form', async () => {
    const mon = await setup(); mon.isshk = true;
    assert.equal(validspecmon(mon, PMNAMES.PM_FOG_CLOUD), false);
    assert.equal(validspecmon(mon, PMNAMES.PM_ORC_CAPTAIN), true);
    assert.deepEqual(getRngLog(), []);
});

for (const [name, type, expected] of [
    ['gray scales', ONAMES.GRAY_DRAGON_SCALES, PMNAMES.PM_GRAY_DRAGON],
    ['yellow scales', ONAMES.YELLOW_DRAGON_SCALES, PMNAMES.PM_YELLOW_DRAGON],
    ['gray mail', ONAMES.GRAY_DRAGON_SCALE_MAIL, PMNAMES.PM_GRAY_DRAGON],
    ['yellow mail', ONAMES.YELLOW_DRAGON_SCALE_MAIL, PMNAMES.PM_YELLOW_DRAGON],
]) test(`ordinary armor preference: ${name}`, async () => {
    const mon = await setup(), armor = mksobj(type, false, false);
    add_to_minv(mon, armor); armor.owornmask = mon.misc_worn_check = W_ARM;
    assert.equal(which_armor(mon, W_ARM), armor);
    initRng(21); enableRngLog();
    assert.equal(await newcham(mon, null, 0), 1);
    assert.equal(mon.mnum, expected);
    assert.equal(mon.cham, -1);
    assert.ok(!getRngLog().some(s => s.startsWith(`rn2(${PMNAMES.SPECIAL_PM})=`)),
        'the ordinary armor preference selects a form before fallback');
});
test('a genocided armor form exhausts acceptance without random fallback', async () => {
    const mon = await setup(), armor = mksobj(ONAMES.GRAY_DRAGON_SCALES, false, false);
    add_to_minv(mon, armor); armor.owornmask = mon.misc_worn_check = W_ARM;
    game.mvitals[PMNAMES.PM_GRAY_DRAGON].mvflags |= G_GENOD;
    initRng(21); enableRngLog();
    assert.equal(await newcham(mon, null, 0), 0);
    assert.equal(mon.mnum, PMNAMES.PM_ORC_CAPTAIN);
    assert.deepEqual(getRngLog(), []);
});

for (const [name, type, worn] of [
    ['no armor', null, false],
    ['unworn dragon scales', ONAMES.GRAY_DRAGON_SCALES, false],
    ['ordinary body armor', ONAMES.LEATHER_ARMOR, true],
]) test(`unchanged fallback: ${name}`, async () => {
    const mon = await setup();
    if (type !== null) {
        const armor = mksobj(type, false, false); add_to_minv(mon, armor);
        if (worn) armor.owornmask = mon.misc_worn_check = W_ARM;
    }
    initRng(21); enableRngLog(); await newcham(mon, null, 0);
    assert.equal(mon.mnum, PMNAMES.PM_YELLOW_MOLD);
    assert.equal(getRngLog()[0], 'rn2(330)=160');
});
test('shapechanger selection precedes the ordinary armor preference', async () => {
    const mon = await setup(), armor = mksobj(ONAMES.GRAY_DRAGON_SCALES, false, false);
    mon.cham = PMNAMES.PM_CHAMELEON;
    add_to_minv(mon, armor); armor.owornmask = mon.misc_worn_check = W_ARM;
    initRng(21); enableRngLog(); await newcham(mon, null, 0);
    assert.equal(mon.cham, PMNAMES.PM_CHAMELEON);
    assert.equal(getRngLog()[0], 'rn2(3)=1');
    assert.notEqual(mon.mnum, PMNAMES.PM_GRAY_DRAGON);
});
