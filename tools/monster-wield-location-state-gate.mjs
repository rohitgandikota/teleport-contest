// C weapon.c:801 mon_wield_item. Actual makers, inventory, selection and input.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, clearMessages, messages, seed, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mksobj} from '../js/mkobj.js';
import {mpickobj} from '../js/steal.js';
import {mon_wield_item, select_hwep, select_rwep, autoreturn_weapon} from '../js/weapon.js';
import {m_dowear} from '../js/worn.js';
import {mattackm} from '../js/mhitm.js';
import {make_blinded} from '../js/potion.js';
import {canseemon, pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare({accessible = true, invisible = false} = {}) {
    const run = await setup();
    const mon = await makemon(game.mons[P.PM_OGRE], x + 2, y,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG | (invisible ? C.MM_MINVIS : 0));
    assert.ok(mon); assert.equal(mon.data, game.mons[P.PM_OGRE]);
    mon.mpeaceful = 0; mon.msleeping = 0;
    mon.mux = game.u.ux; mon.muy = game.u.uy;
    mon.weapon_check = C.NEED_HTH_WEAPON;
    game.flags.accessiblemsg = accessible; game.iflags.getpos_coords = 'm';
    assert.equal(!!canseemon(mon), !invisible);
    clearMessages(); seed(19);
    return {run, mon};
}
async function give(mon, type, cursed = false) {
    const obj = mksobj(type, false, false);
    obj.cursed = cursed; obj.bknown = 0;
    await mpickobj(mon, obj);
    assert.ok(mon.minvent.includes(obj)); assert.equal(obj.owornmask || 0, 0);
    return obj;
}
function finished(mon, obj) {
    assert.equal(mon.mw, obj); assert.equal(mon.weapon_check, C.NEED_WEAPON);
    assert.equal(obj.owornmask, C.W_WEP); assert.deepEqual(getRngLog(), []);
    assert.deepEqual(game.a11y.msg_loc, {x: 0, y: 0});
}
async function pendingMore(run, invoke, inspect) {
    let enter, timer, done = false;
    const reached = new Promise(resolve => { enter = resolve; });
    const releases = [];
    run._display.onEmptyQueue = () => { enter(); return new Promise(resolve => releases.push(resolve)); };
    const owner = invoke().then(value => { done = true; return value; });
    try {
        await Promise.race([reached, owner.then(() => { throw Error('owner completed without the required More'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('More not reached')), 2000); })]);
        await setImmediate();
        inspect({done, reads: releases.length});
    } finally {
        clearTimeout(timer); run._display.onEmptyQueue = () => 32;
        for (const release of releases) release(32);
        await owner; await setImmediate();
    }
    return owner;
}

for (const accessible of [false, true]) test(`visible ordinary club, accessible=${accessible}`, async () => {
    const {mon} = await prepare({accessible}); const obj = await give(mon, O.CLUB);
    assert.equal(select_hwep(mon), obj); seed(19);
    assert.equal(await mon_wield_item(mon), 1); finished(mon, obj);
    assert.equal(messages().trim(), `${accessible ? '<33,10>: ' : ''}The ogre wields a club!`);
});
test('aklys selection locates both wield and tether messages in order', async () => {
    const {mon} = await prepare(); const obj = await give(mon, O.AKLYS);
    assert.equal(select_hwep(mon), obj); assert.equal(autoreturn_weapon(obj).tethered, true); seed(19);
    assert.equal(await mon_wield_item(mon), 1); finished(mon, obj);
    const text = messages();
    assert.ok(text.includes('<33,10>: The ogre wields a thonged club!'), text);
    assert.ok(text.includes('<33,10>: The ogre secures the tether on the thonged club.'), text);
    assert.ok(text.indexOf('wields') < text.indexOf('secures'));
});
for (const [check, type, name] of [[C.NEED_PICK_AXE, O.PICK_AXE, 'pick-axe'], [C.NEED_AXE, O.AXE, 'axe']]) {
    test(`digging selection keeps the period: ${name}`, async () => {
        const {mon} = await prepare(); const obj = await give(mon, type); mon.weapon_check = check; seed(19);
        assert.equal(await mon_wield_item(mon), 1); finished(mon, obj);
        assert.equal(messages().trim(), `<33,10>: The ogre wields ${name === 'axe' ? 'an' : 'a'} ${name}.`);
    });
}
test('actual worn shield preserves pick-or-axe selection', async () => {
    const {mon} = await prepare();
    const mattock = await give(mon, O.DWARVISH_MATTOCK), pick = await give(mon, O.PICK_AXE);
    const shield = await give(mon, O.SMALL_SHIELD); await m_dowear(mon, true);
    assert.ok(shield.owornmask & C.W_ARMS); assert.equal(mattock.owornmask || 0, 0);
    mon.weapon_check = C.NEED_PICK_OR_AXE; clearMessages(); seed(19);
    assert.equal(await mon_wield_item(mon), 1); finished(mon, pick);
    assert.equal(messages().trim(), '<33,10>: The ogre wields a pick-axe.');
});
test('ranged selection uses the real launcher rather than its ammunition', async () => {
    const {mon} = await prepare(); const bow = await give(mon, O.BOW), arrow = await give(mon, O.ARROW);
    assert.equal(select_rwep(mon), arrow); assert.equal(game.propellor, bow);
    mon.weapon_check = C.NEED_RANGED_WEAPON; seed(19);
    assert.equal(await mon_wield_item(mon), 1); finished(mon, bow);
    assert.equal(arrow.owornmask || 0, 0); assert.equal(messages().trim(), '<33,10>: The ogre wields a bow!');
});
for (const kind of ['no-wanted', 'empty', 'missing-launcher', 'already-wielded']) test(`silent early return: ${kind}`, async () => {
    const {mon} = await prepare(); let obj;
    if (kind === 'no-wanted') { obj = await give(mon, O.CLUB); mon.weapon_check = C.NO_WEAPON_WANTED; }
    if (kind === 'missing-launcher') { await give(mon, O.ARROW); mon.weapon_check = C.NEED_RANGED_WEAPON; }
    if (kind === 'already-wielded') {
        obj = await give(mon, O.CLUB); assert.equal(await mon_wield_item(mon), 1); mon.weapon_check = C.NEED_HTH_WEAPON;
    }
    clearMessages(); seed(19);
    assert.equal(await mon_wield_item(mon), 0); assert.equal(messages().trim(), ''); assert.deepEqual(getRngLog(), []);
    assert.equal(mon.weapon_check, kind === 'no-wanted' ? C.NO_WEAPON_WANTED : C.NEED_WEAPON);
    if (kind === 'already-wielded') assert.equal(mon.mw, obj);
    else assert.ok(!mon.mw);
});
for (const kind of ['invisible', 'blind', 'sleeping', 'frozen']) test(`actual visibility contract: ${kind}`, async () => {
    const {mon} = await prepare({invisible: kind === 'invisible'}); const obj = await give(mon, O.CLUB);
    if (kind === 'blind') await make_blinded(100, false);
    if (kind === 'sleeping') mon.msleeping = 1;
    if (kind === 'frozen') mon.mfrozen = 1;
    const visible = kind === 'sleeping' || kind === 'frozen'; assert.equal(!!canseemon(mon), visible);
    clearMessages(); seed(19); assert.equal(await mon_wield_item(mon), 1); finished(mon, obj);
    assert.equal(messages().trim(), visible ? '<33,10>: The ogre wields a club!' : '');
});
test('newly welded feedback remains plain and follows located wielding', async () => {
    const {mon} = await prepare(); const obj = await give(mon, O.CLUB, true); seed(19);
    assert.equal(await mon_wield_item(mon), 1); finished(mon, obj); assert.equal(obj.bknown, 1);
    assert.match(messages(), /<33,10>: The ogre wields a club!/);
    assert.match(messages(), /The club welds itself to the ogre's hand!/);
    assert.doesNotMatch(messages(), /<33,10>: The club welds/);
});
for (const pick of [false, true]) test(`existing welded weapon retains C refusal feedback: pick=${pick}`, async () => {
    const {mon} = await prepare(); const old = await give(mon, O.DAGGER, true);
    assert.equal(await mon_wield_item(mon), 1); old.bknown = 0;
    const replacement = await give(mon, pick ? O.PICK_AXE : O.CLUB);
    mon.weapon_check = pick ? C.NEED_PICK_AXE : C.NEED_HTH_WEAPON; clearMessages(); seed(19);
    assert.equal(await mon_wield_item(mon), 1); assert.equal(mon.mw, old);
    assert.equal(old.owornmask, C.W_WEP); assert.equal(replacement.owornmask || 0, 0);
    assert.equal(mon.weapon_check, C.NO_WEAPON_WANTED); assert.equal(old.bknown, 1); assert.deepEqual(getRngLog(), []);
    if (pick) { assert.match(messages(), /cannot wield that pick-axe/); assert.doesNotMatch(messages(), /<33,10>:/); }
    else { assert.match(messages(), /<33,10>: The ogre tries to wield a club\./); assert.doesNotMatch(messages(), /<33,10>: Your dagger/); }
});

for (const kind of ['club', 'aklys', 'caller']) test(`pending More precedes final worn state: ${kind}`, async () => {
    const {run, mon} = await prepare(); const obj = await give(mon, kind === 'aklys' ? O.AKLYS : O.CLUB);
    let target;
    if (kind === 'caller') {
        target = await makemon(game.mons[P.PM_NEWT], x + 3, y, C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
        target.mhp = target.mhpmax = 100; target.msleeping = 0; target.mpeaceful = 0;
    }
    if (kind !== 'aklys') await pline('An earlier message takes up enough room here.');
    seed(19);
    const result = await pendingMore(run, () => kind === 'caller' ? mattackm(mon, target) : mon_wield_item(mon), state => {
        console.log('PENDING ' + JSON.stringify({kind, ...state, top: game._toplines,
            weapon: mon.mw?.otyp, check: mon.weapon_check, mask: obj.owornmask || 0, known: obj.bknown, rng: getRngLog()}));
        assert.equal(state.done, false); assert.equal(state.reads, 1);
        assert.equal(mon.mw, obj); assert.equal(mon.weapon_check, C.NEED_WEAPON);
        assert.equal(obj.owornmask || 0, 0, 'W_WEP is committed after all feedback');
        assert.equal(obj.bknown, 0); assert.deepEqual(getRngLog(), []);
        if (kind === 'aklys') assert.equal(game._toplines, '<33,10>: The ogre wields a thonged club!');
        if (target) assert.equal(target.mhp, 100, 'the caller cannot attack after spending its turn wielding');
    });
    assert.equal(result, kind === 'caller' ? C.M_ATTK_MISS : 1); finished(mon, obj);
    if (target) assert.equal(target.mhp, 100);
});
