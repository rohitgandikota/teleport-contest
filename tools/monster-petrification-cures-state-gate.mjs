#!/usr/bin/env node

// State checks for src/muse.c munstone(), cures_stoning(), and
// mcould_eat_tin(). The paired C recording pins the visible lizard and acidic
// corpse cures, including the acid-damage draw, at every input boundary.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { cures_stoning, mcould_eat_tin, munstone } from '../js/muse.js';
import { mksobj } from '../js/mkobj.js';
import { mpickobj } from '../js/steal.js';
import { weight } from '../js/invent.js';
import { DEADMONSTER } from '../js/monst.js';
import { ONAMES } from '../js/objects_data.js';
import { MFLAGS, PMNAMES } from '../js/monst_data.js';
import { MFAST, NON_PM, NORMAL_SPEED, STRAT_WAITFORU,
         W_ARMF, W_WEP } from '../js/const.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/monster-petrification-cures.json',
    import.meta.url), 'utf8'));
const cTrace = JSON.parse(await readFile(new URL(
    'gen-sessions/generated/monster-petrification-cures.session.json',
    import.meta.url), 'utf8'));

function liveSoldier() {
    return (game.level?.monsters || []).find(mon =>
        mon.mnum === PMNAMES.PM_SOLDIER && !DEADMONSTER(mon));
}

function curingCorpse(mon) {
    return (mon.minvent || []).find(obj => obj.otyp === ONAMES.CORPSE
        && (obj.corpsenm === PMNAMES.PM_LIZARD
            || obj.corpsenm === PMNAMES.PM_ACID_BLOB));
}

function cLines(index) {
    return cTrace.segments[index].steps.map(step =>
        (step.screen || '').split('\n')[0]);
}

function cRng(index) {
    return cTrace.segments[index].steps.flatMap(step => step.rng || []);
}

function relevantUnported() {
    return [...(game.unported || [])].filter(path =>
        /do_stone_mon:munstone|mhitm_ad_ston:uhitm/.test(path));
}

async function replay(index, moves = recipe.segments[index].moves) {
    const nhGame = await runSegment({
        ...recipe.segments[index],
        moves,
        onFrame: () => {},
    });
    nhGame._display.onEmptyQueue = () => 0x20;
    return nhGame;
}

async function setupCure(index) {
    const segment = recipe.segments[index];
    const cut = segment.moves.indexOf('#wizintrinsic');
    assert.ok(cut > 0, `segment ${index} contains its post-loot boundary`);
    await replay(index, segment.moves.slice(0, cut));
    const soldier = liveSoldier();
    assert.ok(soldier, `segment ${index} leaves a living soldier`);
    assert.ok(curingCorpse(soldier),
              `segment ${index} transfers its curing corpse to the soldier`);
    game.unported = new Set();
    return soldier;
}

function retag(obj, otyp, corpsenm = NON_PM) {
    obj.otyp = otyp;
    obj.oclass = game.objects[otyp].oc_class;
    obj.corpsenm = corpsenm;
    obj.quan = 1;
    obj.owt = weight(obj);
    return obj;
}

function addObject(mon, otyp) {
    const obj = mksobj(otyp, false, false);
    assert.ok(obj, `creates object type ${otyp}`);
    mpickobj(mon, obj);
    return obj;
}

function nutritionMultiplier(msize) {
    switch (msize) {
    case MFLAGS.MZ_TINY: return 8;
    case MFLAGS.MZ_SMALL: return 6;
    case MFLAGS.MZ_LARGE: return 4;
    case MFLAGS.MZ_HUGE: return 3;
    case MFLAGS.MZ_GIGANTIC: return 2;
    default: return 5;
    }
}

for (const index of [0, 1, 2]) {
    const result = await replay(index);
    assert.equal(result.getRngLog().length, cRng(index).length,
                 `segment ${index} matches the C RNG total`);
    assert.deepEqual(relevantUnported(), [],
                     `segment ${index} leaves no former cure marker`);
}

assert.ok(cLines(0).some(line =>
    line.includes('The soldier is slowing down.')),
'C reports the petrification slowdown before the lizard cure');
assert.ok(cLines(0).some(line =>
    line.includes('The soldier eats a lizard corpse.')),
'C consumes the lizard corpse from monster inventory');
assert.ok(cLines(0).some(line =>
    line.includes('The soldier seems limber!')),
'C reports successful recovery from petrification');
assert.equal(cRng(0).some(call => call.includes('rnd(15)')), false,
             'the lizard cure spends no acid-damage roll');

assert.ok(cLines(1).some(line =>
    line.includes('The soldier eats an acid blob corpse.')),
'C consumes an acidic corpse as a petrification cure');
assert.ok(cLines(1).some(line =>
    line.includes('The soldier has a very bad case of stomach acid.')),
'C reports unresisted acid damage after the acidic cure');
assert.ok(cRng(1).some(call =>
    call === 'rnd(15)=12 @ mon_consume_unstone(muse.c:2942)'),
'C pins the acidic cure damage to its independent rnd(15) call');

assert.ok(cLines(2).some(line =>
    line.includes('You bite the soldier.  You touch the soldier.')),
'C reaches the polymorphed hero cockatrice touch');
assert.ok(cLines(2).some(line =>
    line.includes('The soldier is slowing down.  The soldier eats a lizard corpse.')),
'the hero touch lets the defender consume its carried cure');
assert.ok(cLines(2).some(line =>
    line.includes('The soldier seems limber!')),
'the hero-attributed cure leaves the target alive');

let mon = await setupCure(0);
let cure = curingCorpse(mon);
const baseMintrinsics = mon.mintrinsics | 0;
const baseMovement = 2 * NORMAL_SPEED;
const unrelatedStrategy = 0x40000000;
mon.mintrinsics = baseMintrinsics | MFLAGS.MR_STONE;
assert.equal(await munstone(mon, false), false,
             'stone resistance rejects a cure before consuming it');
assert.equal(cure.quan, 1, 'the resisted case preserves the cure');
mon.mintrinsics = baseMintrinsics;

mon.meating = 1;
assert.equal(await munstone(mon, false), false,
             'a monster already eating cannot start a cure');
mon.meating = 0;
mon.msleeping = 1;
assert.equal(await munstone(mon, false), false,
             'a helpless monster cannot consume a cure');
mon.msleeping = 0;

mon.mconf = 1;
mon.mstun = 1;
mon.permspeed = MFAST;
mon.mspeed = MFAST;
mon.movement = baseMovement;
mon.mstrategy = STRAT_WAITFORU | unrelatedStrategy;
mon.mtame = 10;
mon.isminion = 0;
mon.edog = { hungrytime: game.moves - 10 };
cure.quan = 2;
cure.owt = weight(cure);
const boots = addObject(mon, ONAMES.SPEED_BOOTS);
boots.owornmask = W_ARMF;
mon.misc_worn_check = (mon.misc_worn_check | 0) | W_ARMF;
const expectedNutrition = game.mons[PMNAMES.PM_LIZARD].cnutrit
    * nutritionMultiplier(mon.data.msize);
const cureMove = game.moves;
assert.equal(await munstone(mon, false), true,
             'a ready susceptible monster consumes its lizard cure');
assert.equal(cure.quan, 1, 'a stacked cure consumes one corpse');
assert.ok((mon.minvent || []).includes(cure),
          'the remainder of a stacked cure stays in monster inventory');
assert.equal(mon.permspeed | 0, 0,
             'petrification removes intrinsic fast speed');
assert.equal(mon.mspeed, MFAST,
             'worn speed boots continue to supply fast speed');
assert.equal(mon.mconf | 0, 0, 'a lizard cure clears confusion');
assert.equal(mon.mstun | 0, 0, 'a lizard cure clears stunning');
assert.equal(mon.movement, baseMovement - NORMAL_SPEED,
             'the cure consumes the monster\'s next move');
assert.equal(mon.mlstmv, cureMove,
             'the cure records the current move as the last monster move');
assert.equal(mon.mstrategy & STRAT_WAITFORU, 0,
             'starting the cure clears wait-for-hero strategy');
assert.equal(mon.mstrategy & unrelatedStrategy, unrelatedStrategy,
             'starting the cure preserves unrelated strategy bits');
assert.equal(mon.edog.hungrytime, cureMove + expectedNutrition,
             'a tame monster receives the C pet nutrition from the corpse');

mon = await setupCure(1);
cure = curingCorpse(mon);
const acidHp = mon.mhp;
mon.mintrinsics = (mon.mintrinsics | 0) | MFLAGS.MR_ACID;
assert.equal(await munstone(mon, false), true,
             'acid resistance still permits consuming an acidic cure');
assert.equal(mon.mhp, acidHp,
             'acid resistance prevents the cure\'s secondary damage');
assert.equal((mon.minvent || []).includes(cure), false,
             'the resistant case still consumes the corpse');

mon = await setupCure(1);
const survivorHp = 100;
mon.mhp = survivorHp;
mon.mhpmax = survivorHp;
assert.equal(await munstone(mon, false), true,
             'an unresistant monster consumes an acidic cure');
assert.ok(mon.mhp >= survivorHp - 15 && mon.mhp < survivorHp,
          'an acidic cure deals one through fifteen damage');
assert.equal(DEADMONSTER(mon), false,
             'the high-HP acidic control survives');

mon = await setupCure(1);
mon.mhp = 1;
assert.equal(await munstone(mon, false), true,
             'a lethal acidic cure still counts as consumed');
assert.equal(DEADMONSTER(mon), true,
             'secondary acid damage can kill the curing monster');
assert.equal(liveSoldier(), undefined,
             'monster-caused acid death removes the soldier from the level');

mon = await setupCure(1);
mon.mhp = 1;
const conductBefore = game.u.uconduct?.killer | 0;
assert.equal(await munstone(mon, true), true,
             'hero-attributed acidic cure reaches the same lethal path');
assert.equal(DEADMONSTER(mon), true,
             'hero-attributed cure damage kills the low-HP monster');
assert.equal(game.u.uconduct?.killer | 0, conductBefore,
             'hero attribution does not break pacifist conduct');

mon = await setupCure(0);
cure = curingCorpse(mon);
assert.equal(cures_stoning(mon, cure, false), true,
             'a lizard corpse is a cure without any tool');
cure.corpsenm = PMNAMES.PM_NEWT;
assert.equal(cures_stoning(mon, cure, false), false,
             'an ordinary corpse does not cure petrification');
cure.corpsenm = PMNAMES.PM_ACID_BLOB;
assert.equal(cures_stoning(mon, cure, false), true,
             'an acidic corpse is a cure');

retag(cure, ONAMES.POT_ACID);
assert.equal(cures_stoning(mon, cure, false), true,
             'a potion of acid is always an eligible cure');
retag(cure, ONAMES.GLOB_OF_GREEN_SLIME, PMNAMES.PM_GREEN_SLIME);
assert.equal(cures_stoning(mon, cure, false), false,
             'a slimeable soldier rejects a green-slime glob');
mon.mnum = PMNAMES.PM_SALAMANDER;
mon.data = game.mons[PMNAMES.PM_SALAMANDER];
assert.equal(cures_stoning(mon, cure, false), true,
             'a slimeproof salamander can use a green-slime glob');
mon.mnum = PMNAMES.PM_SOLDIER;
mon.data = game.mons[PMNAMES.PM_SOLDIER];

retag(cure, ONAMES.TIN, NON_PM);
assert.equal(cures_stoning(mon, cure, true), false,
             'an empty or special tin cannot cure petrification');
cure.corpsenm = PMNAMES.PM_LIZARD;
assert.equal(cures_stoning(mon, cure, false), false,
             'a lizard tin is unusable without a way to open it');
assert.equal(cures_stoning(mon, cure, true), true,
             'an openable lizard tin is a cure');

addObject(mon, ONAMES.TIN_OPENER);
assert.equal(mcould_eat_tin(mon), true,
             'a non-animal monster can use a carried tin opener');
const originalMnum = mon.mnum;
const originalData = mon.data;
mon.mnum = PMNAMES.PM_MONKEY;
mon.data = game.mons[PMNAMES.PM_MONKEY];
assert.equal(mcould_eat_tin(mon), false,
             'an animal cannot open a tin even while carrying an opener');
mon.mnum = originalMnum;
mon.data = originalData;

if (mon.mw)
    mon.mw.owornmask &= ~W_WEP;
const sword = addObject(mon, ONAMES.LONG_SWORD);
sword.cursed = 1;
sword.owornmask = W_WEP;
mon.mw = sword;
mon.misc_worn_check = (mon.misc_worn_check | 0) | W_WEP;
assert.equal(mcould_eat_tin(mon), false,
             'a welded non-opening weapon blocks access to the opener');
sword.cursed = 0;
assert.equal(mcould_eat_tin(mon), true,
             'an unwelded weapon permits access to the opener');

cure.corpsenm = PMNAMES.PM_ACID_BLOB;
mon.mhp = 1;
assert.equal(await munstone(mon, false), true,
             'an openable acidic tin cures petrification');
assert.equal(mon.mhp, 1,
             'tinning suppresses the acidic corpse damage');

mon = await setupCure(0);
cure = retag(curingCorpse(mon), ONAMES.POT_ACID);
mon.mhp = mon.mhpmax = 100;
assert.equal(await munstone(mon, false), true,
             'a potion of acid is consumed as a live cure');
assert.ok(mon.mhp >= 85 && mon.mhp < 100,
          'an unresisted acid potion applies its rnd(15) damage');
assert.equal((mon.minvent || []).includes(cure), false,
             'the acid potion leaves monster inventory');

mon = await setupCure(0);
cure = retag(curingCorpse(mon), ONAMES.GLOB_OF_GREEN_SLIME,
              PMNAMES.PM_GREEN_SLIME);
assert.equal(await munstone(mon, false), false,
             'a slimeable monster does not consume a green-slime glob');
mon.mnum = PMNAMES.PM_SALAMANDER;
mon.data = game.mons[PMNAMES.PM_SALAMANDER];
assert.equal(await munstone(mon, false), true,
             'a non-stone-resistant slimeproof monster consumes the glob');
assert.equal((mon.minvent || []).includes(cure), false,
             'the green-slime glob is consumed');

assert.deepEqual(relevantUnported(), [],
                 'all direct cure controls leave no former gap marker');
console.log('monster petrification cures state: PASS');
