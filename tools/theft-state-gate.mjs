#!/usr/bin/env node

// C steal.c:120-615, do_wear.c:1603-1735/1920 and objnam.c:2359.
// C recordings supply action and inventory evidence. Source controls check
// callback outcomes and ownership bits which earn no additional C coverage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { steal, thiefdead, unresponsive, remove_worn_item } from '../js/steal.js';
import { armoroff, doffing, stop_donning, Armor_off, Shield_off, Helmet_off,
    Gloves_off, Boots_off, Cloak_off, Shirt_off } from '../js/do_wear.js';
import { makemon } from '../js/makemon.js';
import { mondead, mongone } from '../js/mon.js';
import { mksobj } from '../js/mkobj.js';
import { addinv, freeinv } from '../js/invent.js';
import { setworn } from '../js/worn.js';
import { unmul } from '../js/hack.js';
import { yname, bare_artifactname } from '../js/objnam.js';
import { artifact_exists } from '../js/artifact.js';
import { Blind, Levitation, Stone_resistance } from '../js/youprop.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ART_EXCALIBUR, ART_ORB_OF_DETECTION } from '../js/artilist_data.js';
import { OBJ_INVENT, OBJ_MINVENT, OBJ_CONTAINED, OBJ_DELETED,
    LOST_NONE, LOST_STOLEN, MM_NOGRP, MM_NOMSG, NO_MINVENT,
    W_ARM, W_ARMS, W_ARMH, W_ARMG, W_ARMF, W_ARMC, W_ARMU,
    W_ARMOR, A_STR, A_CHA, FAINTED, ONAME_LEVEL_DEF } from '../js/const.js';

const read = name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url)));
const delayed = new Set(['delayed-mail', 'cursed-mail', 'female-mail',
    'levitation-boots', 'interrupted-doffing']);
const refused = new Set(['cursed-ring', 'loadstone', 'welded-weapon',
    'petrifying-corpse', 'oracle-corpse', 'medusa-corpse',
    'heavy-mail', 'impatient-gloves', 'boulder-retry']);
let count = 0;
for (const file of ['theft-armor', 'theft-equipment', 'theft-animals', 'theft-special']) {
    for (const segment of read(file).segments) {
        const label = segment.name;
        let original, chain, thief, heldUnworn = false, transferredUnworn = false;
        let wasLevitating = false, wasBlind = false;
        const genesis = segment.moves.indexOf('\x07');
        globalThis.__step_snapshot = { step: '*', cb: (state, step) => {
            chain ||= state.u.uchain;
            if (label === 'carried-ball')
                original ||= state.u.uball;
            else if (!['empty-pack', 'gold-only', 'floor-chain'].includes(label))
                original ||= state.invent?.find(o => o.invlet === 'b');
            if (step > genesis)
                thief ||= state.level.monsters.find(m => m.mhp > 0
                    && [PMNAMES.PM_WOOD_NYMPH, PMNAMES.PM_MONKEY].includes(m.mnum));
            if (original?.ocarry)
                thief = original.ocarry;
            if (original && state.stealoid === original.o_id
                && original.where === OBJ_INVENT && !original.owornmask)
                heldUnworn = true;
            if (original?.where === OBJ_MINVENT && !original.owornmask)
                transferredUnworn = true;
            wasLevitating ||= Levitation();
            wasBlind ||= Blind();
        } };
        try {
            await runSegment({ ...segment, storage: new InMemoryStorage() });
        } finally {
            delete globalThis.__step_snapshot;
        }
        assert.ok(thief, label + ': reached a thief');
        assert.equal(game.stealoid | 0, 0);
        assert.equal(game.stealmid | 0, 0);
        assert.equal(game.afternmv ?? null, null);
        if (['floor-chain', 'carried-ball'].includes(label)) {
            assert.ok(chain);
            assert.equal(chain.where, OBJ_DELETED);
            assert.equal(chain.owornmask | 0, 0);
            assert.equal(game.u.uball ?? null, null);
            assert.equal(game.u.uchain ?? null, null);
            assert.equal(thief.mavenge | 0, 0, label + ': unpunishing is not avenged');
        }
        if (refused.has(label)) {
            assert.ok(game.invent.includes(original));
            assert.equal(original.where, OBJ_INVENT);
            assert.equal(thief.mavenge | 0, 0);
            assert.equal(original.how_lost | 0, LOST_NONE);
        } else if (label.startsWith('corpse-')) {
            assert.equal(original.where, OBJ_CONTAINED);
            assert.equal(original.ocontainer.otyp, ONAMES.STATUE);
            assert.equal(original.ocontainer.corpsenm, PMNAMES.PM_WOOD_NYMPH);
            assert.equal(thief.mhp, 0);
            assert.ok(!thief.minvent?.length);
            assert.equal(original.how_lost, LOST_STOLEN);
            assert.ok(Stone_resistance());
        } else if (original) {
            assert.ok(!game.invent.includes(original));
            assert.equal(original.where, OBJ_MINVENT);
            assert.equal(original.ocarry, thief);
            assert.ok(thief.minvent.includes(original));
            assert.ok(transferredUnworn, label + ': removed before monster acquisition');
            assert.equal(original.how_lost | 0, delayed.has(label) ? LOST_NONE : LOST_STOLEN);
            assert.equal(thief.mavenge | 0, delayed.has(label) || label === 'carried-ball' ? 0 : 1);
            if (delayed.has(label) && label !== 'levitation-boots')
                assert.ok(heldUnworn, label + ': armor remains carried before delayed transfer');
        }
        if (label === 'gold-only') {
            assert.equal(game.invent.length, 1);
            assert.equal(game.invent[0].otyp, ONAMES.GOLD_PIECE);
            assert.equal(game.invent[0].quan, 1000);
        }
        if (['empty-pack', 'floor-chain'].includes(label))
            assert.equal(game.invent.length, 0);
        if (label === 'cursed-mail' || label === 'cursed-quiver' || label === 'cursed-ring')
            assert.equal(original.cursed, 1);
        if (label === 'cursed-ring')
            assert.equal(game.u.uleft, original);
        if (label === 'welded-weapon') {
            assert.equal(game.u.uwep, original);
            assert.equal(original.bknown, 1);
        }
        if (label === 'cursed-quiver')
            assert.equal(game.u.uquiver ?? null, null);
        if (label === 'strength-ring' || label === 'adornment-priority') {
            assert.equal(game.u.uleft ?? null, null);
            assert.equal(game.u.abon.a[label === 'strength-ring' ? A_STR : A_CHA], 0);
            if (label === 'adornment-priority')
                assert.ok(game.invent.some(o => o.otyp === ONAMES.APPLE));
        }
        if (label === 'levitation-boots') {
            assert.ok(wasLevitating);
            assert.equal(Levitation(), false);
        }
        if (label === 'blindfold-reveals-thief') {
            assert.ok(wasBlind);
            assert.equal(Blind(), false);
        }
        count++;
    }
}

// A delayed theft is cancellable independently of the hero finishing the
// armor removal. Death, disappearance, polymorph and distance are separate
// C guards; these controls do not claim that a recording reached them.
const base = read('theft-armor').segments[0];
const setup = base.moves.slice(0, base.moves.indexOf('\x07'));
for (const outcome of ['transfer', 'death', 'disappearance', 'polymorph',
    'distance', 'missing-item', 'missing-thief-id', 'other-callback']) {
    await runSegment({ ...base, moves: setup, storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game.iflags.debug_mongen = false;
    pushKeys(' '.repeat(40));
    try {
        const armor = game.u.uarm;
        assert.ok(armor);
        const mon = await makemon(game.mons[PMNAMES.PM_WOOD_NYMPH], game.u.ux, game.u.uy,
            MM_NOGRP | MM_NOMSG | NO_MINVENT);
        assert.ok(mon);
        const name = { value: 'previous' };
        assert.equal(await steal(mon, name), 0);
        assert.equal(name.value, '');
        assert.equal(game.multi, -game.objects[armor.otyp].oc_delay);
        assert.equal(game.stealoid, armor.o_id);
        assert.equal(game.stealmid, mon.m_id);
        assert.equal(armor.owornmask, 0);
        assert.ok(game.invent.includes(armor));
        const callback = game.afternmv;
        assert.equal(callback.name, 'stealarm');
        assert.equal(await steal(mon), 0, 'an in-progress item cannot be selected twice');
        assert.equal(game.afternmv, callback);
        if (outcome === 'death')
            await mondead(mon);
        else if (outcome === 'disappearance')
            mongone(mon);
        else if (outcome === 'polymorph')
            mon.data = game.mons[PMNAMES.PM_GOBLIN];
        else if (outcome === 'distance')
            mon.mx = game.u.ux + 3;
        else if (outcome === 'missing-item')
            freeinv(armor);
        else if (outcome === 'missing-thief-id')
            game.stealmid = 0;
        else if (outcome === 'other-callback') {
            const other = () => 0;
            game.afternmv = other;
            game.nomovemsg = 'Other action';
            thiefdead();
            assert.equal(game.afternmv, other);
            assert.equal(game.nomovemsg, 'Other action');
            assert.equal(game.stealmid, 0);
            assert.equal(game.stealoid, armor.o_id);
            game.stealoid = 0;
        }
        if (outcome === 'death' || outcome === 'disappearance') {
            assert.equal(game.stealmid, 0);
            assert.equal(game.afternmv.name, 'unstolenarm');
            assert.equal(game.nomovemsg, null);
        }
        await unmul('');
        assert.equal(game.stealoid | 0, 0);
        assert.equal(game.stealmid | 0, 0);
        assert.equal(game.afternmv, null);
        assert.equal(game.invent.includes(armor), !['transfer', 'missing-item'].includes(outcome));
        assert.equal(mon.minvent?.includes(armor) || false, outcome === 'transfer');
        assert.equal(armor.owornmask, 0);
        assert.equal(mon.mavenge | 0, 0);
    } finally {
        resetInputState();
    }
}

// armoroff must retain the exact named callback checked by doffing. C
// cancel_don zeroes multi before stop_donning reads its remaining delay.
await runSegment({ ...base, moves: setup.slice(0, setup.indexOf('\x17uncursed plate')),
    storage: new InMemoryStorage() });
game._preNhgetchHook = null;
pushKeys(' '.repeat(40));
try {
    for (const [otyp, mask, callback] of [
        [ONAMES.PLATE_MAIL, W_ARM, Armor_off],
        [ONAMES.SMALL_SHIELD, W_ARMS, Shield_off],
        [ONAMES.HELMET, W_ARMH, Helmet_off],
        [ONAMES.LEATHER_GLOVES, W_ARMG, Gloves_off],
        [ONAMES.LOW_BOOTS, W_ARMF, Boots_off],
        [ONAMES.ROBE, W_ARMC, Cloak_off],
        [ONAMES.T_SHIRT, W_ARMU, Shirt_off],
    ]) {
        const obj = mksobj(otyp, false, false);
        await addinv(obj);
        setworn(obj, mask);
        game.context_takeoff = { mask: W_ARMOR, what: mask, delay: 1 };
        assert.equal(await armoroff(obj), 1);
        assert.equal(game.context_takeoff.mask, 0);
        assert.equal(game.context_takeoff.what, 0);
        if (game.objects[otyp].oc_delay) {
            assert.equal(game.afternmv, callback);
            assert.equal(doffing(obj), true);
            assert.equal(await stop_donning(obj), 0);
            assert.equal(obj.owornmask, mask);
            assert.equal(game.afternmv, null);
            await remove_worn_item(obj, false);
        }
        assert.equal(obj.owornmask | 0, 0);
        freeinv(obj);
    }
    for (const [multi, reason, asleep, fainted, expected] of [
        [0, 'frozen by a monster', 0, false, false],
        [-2, 'frozen by a monster', 0, false, true],
        [-2, 'paralyzed by a potion', 0, false, true],
        [-2, 'taking off clothes', 0, false, false],
        [-2, 'sleeping', 1, false, true],
        [-2, 'fainted', 0, true, true],
    ]) {
        game.multi = multi;
        game.multi_reason = reason;
        game.u.usleep = asleep;
        game.u.uhs = fainted ? FAINTED : 0;
        assert.equal(unresponsive(), expected);
    }
    game.multi = 0;
    game.u.usleep = 0;
    game.u.uhs = 0;

    // C's shared ownership prefix treats unique corpses and proper artifact
    // names differently. The recorded monkey case covers an ordinary corpse.
    const corpse = mksobj(ONAMES.CORPSE, false, false);
    corpse.corpsenm = PMNAMES.PM_MEDUSA;
    await addinv(corpse);
    assert.equal(yname(corpse), "Medusa's corpse");
    corpse.corpsenm = PMNAMES.PM_ORACLE;
    // Both cxname and shk_your supply "the". The C monkey replay confirms it.
    assert.equal(yname(corpse), "the the Oracle's corpse");
    freeinv(corpse);
    game.iflags.override_ID = true;
    for (const [otyp, artifact, oname, expected] of [
        [ONAMES.LONG_SWORD, ART_EXCALIBUR, 'Excalibur', 'Excalibur'],
        [ONAMES.CRYSTAL_BALL, ART_ORB_OF_DETECTION, 'The Orb of Detection', 'your Orb of Detection'],
    ]) {
        const obj = mksobj(otyp, false, false);
        obj.oname = oname;
        artifact_exists(obj, oname, true, ONAME_LEVEL_DEF);
        assert.equal(obj.oartifact, artifact);
        assert.equal(bare_artifactname(obj), oname.replace(/^The /, 'the '));
        await addinv(obj);
        assert.equal(yname(obj), expected);
        freeinv(obj);
    }
    game.iflags.override_ID = false;
} finally {
    resetInputState();
}
console.log(`theft state: PASS (${count} C replays plus source controls)`);
