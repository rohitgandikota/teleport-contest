// Constructed states exercise real item, inventory, weapon and trap producers.
// These are source-contract checks, not ordinary-input/native coverage.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, clearMessages, messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mksobj, dobjsfree} from '../js/mkobj.js';
import {mpickobj} from '../js/steal.js';
import {mon_wield_item, select_hwep} from '../js/weapon.js';
import {m_dowear} from '../js/worn.js';
import {mwelded} from '../js/wield.js';
import {mcould_eat_tin, find_defensive, use_defensive} from '../js/muse.js';
import {searches_for_item} from '../js/monmove.js';
import {mon_learns_traps} from '../js/trap.js';
import {maketrap, stairway_add} from '../js/mklev.js';
import {set_levltyp} from '../js/mkmaze.js';
import {getRngLog} from '../js/rng.js';
import {pline} from '../js/display.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare(species = P.PM_HUMAN) {
    const run = await setup();
    game.stairs = null;
    const mon = await makemon(game.mons[species], 33, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    Object.assign(mon, {mux:game.u.ux, muy:game.u.uy, mpeaceful:0});
    clearMessages();
    return {run, mon};
}
async function give(mon, type, fields = {}) {
    const obj = Object.assign(mksobj(type, false, false), fields);
    assert.equal(await mpickobj(mon, obj), 0);
    assert.equal(obj.ocarry, mon);
    assert.equal(obj.where, C.OBJ_MINVENT);
    return obj;
}
async function wield(mon, obj) {
    assert.equal(select_hwep(mon), obj);
    mon.weapon_check = C.NEED_HTH_WEAPON;
    assert.equal(await mon_wield_item(mon), 1);
    assert.equal(mon.mw, obj);
    assert.ok(obj.owornmask & C.W_WEP);
}
function selection(mon, action, obj = null, tryescape = false, rng = []) {
    seed(2); // The first rn2(3) is 1. The zero arm uses seed 0 explicitly.
    const result = find_defensive(mon, tryescape);
    assert.equal(typeof result, 'boolean', 'selection remains synchronous');
    assert.equal(result, !!action);
    assert.equal(game.m.has_defense, action);
    assert.equal(game.m.defensive, obj);
    assert.deepEqual(getRngLog(), rng);
}
async function corpseWielder(openerType, cursed = true) {
    const {run, mon} = await prepare();
    const gloves = await give(mon, O.LEATHER_GLOVES);
    await m_dowear(mon, false);
    assert.ok(gloves.owornmask & C.W_ARMG);
    const corpse = await give(mon, O.CORPSE, {corpsenm:P.PM_COCKATRICE, cursed});
    await wield(mon, corpse);
    assert.equal(mwelded(corpse), false, 'C will_weld excludes food-class corpses');
    const opener = openerType ? await give(mon, openerType) : null;
    const tin = await give(mon, O.TIN, {corpsenm:P.PM_LIZARD});
    mon.mconf = mon.mstun = 1;
    clearMessages();
    return {run, mon, corpse, opener, tin};
}

for (const opener of [O.TIN_OPENER, O.DAGGER, O.KNIFE]) {
    test(`cursed corpse permits separate tin-opening tool ${opener}`, async () => {
        const {mon, corpse, tin} = await corpseWielder(opener);
        seed(2);
        assert.equal(mcould_eat_tin(mon), true);
        assert.deepEqual(getRngLog(), [], 'capability query never draws');
        assert.equal(searches_for_item(mon, tin), true, 'existing pickup predicate already permits it');
        selection(mon, 19, tin, false, ['rn2(3)=1']);
        const movement = mon.movement;
        assert.equal(await use_defensive(mon), 2);
        assert.equal(mon.mconf, 0);
        assert.equal(mon.mstun, 0);
        assert.equal(mon.movement, movement - C.NORMAL_SPEED);
        assert.equal(mon.mlstmv, game.moves);
        assert.equal(mon.minvent.includes(tin), false);
        assert.equal(tin.where, C.OBJ_DELETED, 'C stages deletion until dobjsfree');
        assert.ok(game.objs_deleted.includes(tin));
        dobjsfree();
        assert.equal(tin.otyp, undefined, 'the normal deletion drain clears the tin');
        assert.equal(mon.mw, corpse);
        assert.ok(mon.minvent.includes(corpse));
        assert.match(messages(), /opens and eats the contents of a tin/);
        assert.match(messages(), /seems steadier now/);
    });
}
test('uncursed corpse retains working opener path', async () => {
    const {mon, tin} = await corpseWielder(O.TIN_OPENER, false);
    selection(mon, 19, tin, false, ['rn2(3)=1']);
});
test('eligible cursed-corpse tin still spends the failing confusion draw', async () => {
    const {mon} = await corpseWielder(O.TIN_OPENER);
    seed(0);
    assert.equal(find_defensive(mon, false), false);
    assert.deepEqual(getRngLog(), ['rn2(3)=0']);
    assert.equal(mon.mconf, 1);
});
test('no opener does not draw or select the tin', async () => {
    const {mon} = await corpseWielder(null);
    selection(mon, 0);
});
test('welded sword blocks the separate opener without a draw', async () => {
    const {mon} = await prepare();
    const sword = await give(mon, O.LONG_SWORD, {cursed:1});
    await wield(mon, sword);
    await give(mon, O.TIN_OPENER);
    await give(mon, O.TIN, {corpsenm:P.PM_LIZARD});
    mon.mconf = 1;
    assert.equal(mwelded(sword), true);
    selection(mon, 0);
});
test('welded dagger itself can open the tin', async () => {
    const {mon} = await prepare();
    const dagger = await give(mon, O.DAGGER, {cursed:1});
    await wield(mon, dagger);
    const tin = await give(mon, O.TIN, {corpsenm:P.PM_LIZARD});
    mon.mconf = 1;
    selection(mon, 19, tin, false, ['rn2(3)=1']);
});
test('unwielded cursed sword does not block an opener', async () => {
    const {mon} = await prepare();
    await give(mon, O.LONG_SWORD, {cursed:1});
    await give(mon, O.TIN_OPENER);
    const tin = await give(mon, O.TIN, {corpsenm:P.PM_LIZARD});
    mon.mconf = 1;
    selection(mon, 19, tin, false, ['rn2(3)=1']);
});
for (const species of [P.PM_MONKEY, P.PM_STONE_GOLEM]) {
    test(`animal or mindless selection rejects all items (${species})`, async () => {
        const {mon} = await prepare(species);
        await give(mon, O.TIN_OPENER);
        await give(mon, O.UNICORN_HORN);
        mon.mconf = 1;
        game.m = {has_defense:17, defensive:mon.minvent[0]};
        selection(mon, 0);
    });
}
test('lizard corpse precedes tins and does not draw', async () => {
    const {mon} = await prepare();
    const corpse = await give(mon, O.CORPSE, {corpsenm:P.PM_LIZARD});
    await give(mon, O.TIN, {corpsenm:P.PM_LIZARD});
    mon.mconf = 1;
    selection(mon, 19, corpse);
});
test('the last lizard tin in inventory order is selected', async () => {
    const {mon} = await prepare();
    const last = await give(mon, O.TIN, {corpsenm:P.PM_LIZARD});
    await give(mon, O.TIN, {corpsenm:P.PM_LIZARD, cursed:1});
    await give(mon, O.TIN_OPENER);
    mon.mstun = 1;
    selection(mon, 19, last, false, ['rn2(3)=1']);
});
for (const cursed of [false, true]) {
    test(`horn priority and cursed-horn exclusion (${cursed})`, async () => {
        const {mon} = await prepare();
        const corpse = await give(mon, O.CORPSE, {corpsenm:P.PM_LIZARD});
        const horn = await give(mon, O.UNICORN_HORN, {cursed});
        mon.mconf = 1;
        selection(mon, cursed ? 19 : 17, cursed ? corpse : horn);
        assert.equal(await use_defensive(mon), 2);
        assert.equal(mon.mconf, 0);
        assert.ok(mon.minvent.includes(horn));
    });
}
for (const species of [P.PM_WHITE_UNICORN, P.PM_KI_RIN]) {
    test(`innate horn needs no inventory object (${species})`, async () => {
        const {mon} = await prepare(species);
        mon.mconf = 1;
        selection(mon, 17);
        assert.equal(await use_defensive(mon), 2);
        assert.equal(mon.mconf, 0);
        assert.match(messages(), /horn glows/);
    });
}
test('blind full-health monster selects full healing before lesser healing', async () => {
    const {mon} = await prepare();
    const full = await give(mon, O.POT_FULL_HEALING);
    await give(mon, O.POT_EXTRA_HEALING);
    await give(mon, O.POT_HEALING);
    mon.mcansee = 0;
    selection(mon, 18, full);
});
test('wounded peaceful monster uses only healing and keeps priority', async () => {
    const {mon} = await prepare();
    mon.mpeaceful = 1; mon.mhp = 1;
    const full = await give(mon, O.POT_FULL_HEALING);
    await give(mon, O.WAN_TELEPORTATION, {spe:3});
    await give(mon, O.POT_HEALING);
    selection(mon, 18, full);
});
for (const level of [9, 10, 14]) {
    test(`healing HP threshold at hero level ${level}`, async () => {
        const {mon} = await prepare();
        const heal = await give(mon, O.POT_HEALING);
        game.u.ulevel = level;
        const fraction = level === 9 ? 5 : level === 10 ? 4 : 3;
        mon.mhp = 10; mon.mhpmax = 10 * fraction;
        selection(mon, 0);
        mon.mhpmax++;
        selection(mon, 3, heal);
    });
}
test('distance guard precedes horn cure but tryescape bypasses distance', async () => {
    const {mon} = await prepare();
    mon.mconf = 1; mon.mux = mon.mx + 6;
    const horn = await give(mon, O.UNICORN_HORN);
    selection(mon, 0);
    selection(mon, 17, horn, true);
});
test('engulfing the hero excludes even a needed horn', async () => {
    const {mon} = await prepare(P.PM_PURPLE_WORM);
    mon.mconf = 1; game.u.ustuck = mon; game.u.uswallow = true;
    selection(mon, 0);
});
test('charged teleport wand, learned no-teleport, and empty-charge guards', async () => {
    const {mon} = await prepare();
    const wand = await give(mon, O.WAN_TELEPORTATION, {spe:2});
    mon.mhp = 1;
    selection(mon, 2, wand);
    game.level.flags.noteleport = true;
    selection(mon, 2, wand);
    mon_learns_traps(mon, C.TELEP_TRAP);
    selection(mon, 0);
    game.level.flags.noteleport = false;
    wand.spe = 0;
    selection(mon, 0);
});
test('digging selection spends the next inventory draw before stopping', async () => {
    const {mon} = await prepare();
    await give(mon, O.POT_HEALING);
    const dig = await give(mon, O.WAN_DIGGING, {spe:2});
    mon.mhp = 1;
    selection(mon, 5, dig, false, ['rn2(3)=1']);
});
test('hole outranks earlier teleport trap and keeps its exact location', async () => {
    const {mon} = await prepare(); mon.mhp = 1;
    await maketrap(mon.mx, mon.my, C.TELEP_TRAP);
    await maketrap(mon.mx+1, mon.my, C.HOLE);
    selection(mon, 6);
    assert.deepEqual([game.trapx,game.trapy], [mon.mx+1,mon.my]);
});
test('physical stairs precede carried magic', async () => {
    const {mon} = await prepare(); mon.mhp = 1;
    await give(mon, O.POT_HEALING);
    set_levltyp(mon.mx,mon.my,C.STAIRS);
    stairway_add(mon.mx,mon.my,false,false,{dnum:game.u.uz.dnum,dlevel:2});
    selection(mon, 9);
});

async function pendingMessage(run, start, inspect) {
    await pline('An earlier message leaves too little room for the next item message.');
    let entered, release, timer, settled = false;
    const waiting = new Promise(resolve => { entered = resolve; });
    run._display.onEmptyQueue = () => {
        entered();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = start().then(value => { settled = true; return value; });
    try {
        await Promise.race([waiting,
            pending.then(() => { throw Error('expected pending More'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('missing More')), 2000); })]);
        await setImmediate();
        assert.equal(settled, false);
        inspect();
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        await pending;
    }
    return pending;
}
test('tin consumption and cure wait for real More completion', async () => {
    const {run, mon, tin, corpse} = await corpseWielder(O.DAGGER);
    selection(mon, 19, tin, false, ['rn2(3)=1']);
    const movement = mon.movement;
    assert.equal(await pendingMessage(run, () => use_defensive(mon), () => {
        assert.equal(mon.mconf, 1);
        assert.equal(mon.mstun, 1);
        assert.equal(mon.movement, movement);
        assert.equal(tin.where, C.OBJ_MINVENT);
        assert.ok(mon.minvent.includes(tin));
        assert.equal(mon.mw, corpse);
    }), 2);
    assert.equal(mon.mconf, 0);
    assert.equal(mon.mstun, 0);
    assert.equal(tin.where, C.OBJ_DELETED);
    assert.ok(game.objs_deleted.includes(tin));
});
test('innate horn awaits More and cures blindness before confusion', async () => {
    const {run, mon} = await prepare(P.PM_WHITE_UNICORN);
    mon.mconf = 1; mon.mcansee = 0; mon.mblinded = 7;
    selection(mon, 17);
    assert.equal(await pendingMessage(run, () => use_defensive(mon), () => {
        assert.equal(mon.mcansee, 0);
        assert.equal(mon.mconf, 1);
    }), 2);
    assert.equal(mon.mcansee, 1);
    assert.equal(mon.mblinded, 0);
    assert.equal(mon.mconf, 1, 'C horn chooses one status arm per use');
});
