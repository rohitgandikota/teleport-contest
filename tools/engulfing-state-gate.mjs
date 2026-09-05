#!/usr/bin/env node

// C mhitu.c:1289-1590, mon.c:3438 and steed.c:576. Replays inspect
// persistent state. Constructed source controls exercise the C contracts
// separately and earn no native coverage or reachability credit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { gulpmu, diseasemu, expels } from '../js/mhitu.js';
import { engulf_target } from '../js/mhitm.js';
import { set_ustuck, m_at, m_poisongas_ok } from '../js/mon.js';
import { makemon, remove_monster, place_monster } from '../js/makemon.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { maketrap } from '../js/mklev.js';
import { addinv, obj_extract_self } from '../js/invent.js';
import { mpickobj } from '../js/steal.js';
import { punish } from '../js/read.js';
import { polymon, set_uasmon } from '../js/polyself.js';
import { make_sick, make_slimed } from '../js/potion.js';
import { set_utrap } from '../js/trap.js';
import { dismount_steed } from '../js/steed.js';
import { vision_recalc } from '../js/vision.js';
import { create_gas_cloud } from '../js/region.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { enableRngLog, getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES, ATTKS } from '../js/monst_data.js';
import { Blind, Invis } from '../js/youprop.js';
import { OBJ_FREE, OBJ_INVENT, OBJ_FLOOR, OBJ_DELETED, W_AMUL, W_ARM,
    MM_NOGRP, MM_NOMSG, NO_MINVENT, M_ATTK_MISS, M_ATTK_HIT, M_ATTK_AGR_DIED,
    ROOM, STONE, IRONBARS, PIT, TT_WEB, SICK_NONVOMITABLE, FROMOUTSIDE,
    DISMOUNT_FELL, M_POISONGAS_OK, M_POISONGAS_MINOR, M_POISONGAS_BAD }
    from '../js/const.js';

const read = name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url)));
const source = read('monster-pickup-light').segments[0];
let replays = 0;
for (const file of ['engulf-resistance', 'engulf-form-transitions', 'engulf-attachments']) {
    for (const segment of read(file).segments) {
        let inside = false, ball, steed, freeChain = false, carriedBall = false;
        let yellow = false, humanAfterYellow = false, hugeReleased = false;
        globalThis.__step_snapshot = { step: '*', cb: state => {
            inside ||= !!state.u.uswallow;
            ball ||= state.u.uball;
            steed ||= state.u.usteed;
            freeChain ||= !!state.u.uswallow && state.u.uchain?.where === OBJ_FREE;
            carriedBall ||= !!state.u.uswallow && state.u.uball?.where === OBJ_INVENT;
            yellow ||= state.u.umonnum === PMNAMES.PM_YELLOW_LIGHT;
            humanAfterYellow ||= yellow && state.u.umonnum === state.u.umonster;
            hugeReleased ||= state.u.umonnum === PMNAMES.PM_STONE_GIANT && !state.u.uswallow;
        } };
        try {
            await runSegment({ ...segment, storage: new InMemoryStorage() });
        } finally {
            delete globalThis.__step_snapshot;
        }
        const label = file + ':' + segment.name;
        assert.ok(inside, label + ': entered an engulfer');
        assert.equal(game.mswallower ?? null, null, label + ': damage owner cleared');
        if (segment.name.startsWith('punished-')) {
            assert.ok(ball && freeChain, label + ': chain was in limbo');
            assert.equal(carriedBall, segment.name.endsWith('-carried'), label);
            assert.equal(ball.where, segment.name.endsWith('-carried') ? OBJ_INVENT : OBJ_FLOOR);
            assert.equal(game.u.uchain.where, OBJ_FLOOR);
            assert.ok(game.level.objects.includes(game.u.uchain));
        } else if (segment.name.startsWith('mounted-')) {
            assert.ok(steed, label + ': was mounted');
            assert.equal(game.u.usteed, null);
            if (steed.mhp > 0) {
                assert.equal(m_at(steed.mx, steed.my), steed);
                assert.ok(steed.mx !== game.u.ux || steed.my !== game.u.uy);
            }
        } else if (segment.name === 'web-release') {
            assert.equal(game.u.utrap, 0);
        } else if (segment.name === 'leash-release') {
            assert.equal(game.invent.find(o => o.otyp === ONAMES.LEASH).leashmon, 0);
            assert.ok(game.level.monsters.every(m => !m.mleashed));
        } else if (segment.name === 'light-form-dies') {
            assert.ok(yellow && humanAfterYellow);
        } else if (segment.name === 'huge-inside') {
            assert.ok(hugeReleased);
        } else if (segment.name === 'black-light-trapper') {
            assert.ok(Invis() && Blind());
        }
        replays++;
    }
}

async function setup(mnum = PMNAMES.PM_PURPLE_WORM) {
    resetInputState();
    await runSegment({ ...source, moves: ' ', storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game.iflags.debug_mongen = false;
    pushKeys(' '.repeat(500));
    game.u.uhp = game.u.uhpmax = 120;
    game.level.at(game.u.ux, game.u.uy).typ = ROOM;
    const mon = await makemon(game.mons[mnum], game.u.ux, game.u.uy,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(mon);
    return mon;
}
const attack = (mon, type) => mon.data.mattk.find(a =>
    a[0] === ATTKS.AT_ENGL && (type === undefined || a[1] === type));
function inside(mon) {
    remove_monster(mon.mx, mon.my);
    place_monster(mon, game.u.ux, game.u.uy);
    set_ustuck(mon);
    game.u.uswallow = 1;
    game.u.uswldtim = 20;
    vision_recalc(2);
}
async function strike(mon, type) {
    enableRngLog();
    const result = await gulpmu(mon, attack(mon, type));
    const log = getRngLog();
    const roll = Number(log.find(s => s.startsWith('d('))?.split('=')[1]);
    return { result, roll, log };
}

// Shared gates distinguish a trapped monster from the hero's trap timer.
let mon = await setup();
assert.ok(engulf_target(mon, game.youmonst));
mon.mtrapped = 1;
assert.equal(engulf_target(mon, game.youmonst), false);
mon.mtrapped = 0;
set_utrap(5, TT_WEB);
assert.ok(engulf_target(mon, game.youmonst));
game.youmonst.mtrapped = 1;
assert.equal(engulf_target(mon, game.youmonst), false);
game.youmonst.mtrapped = 0;
const heroTile = game.level.at(game.u.ux, game.u.uy);
heroTile.typ = STONE;
assert.equal(engulf_target(mon, game.youmonst), false);
game.u.intrinsic.HPasses_walls = FROMOUTSIDE;
assert.ok(engulf_target(mon, game.youmonst));
game.u.intrinsic.HPasses_walls = 0;
heroTile.typ = IRONBARS;
assert.equal(engulf_target(mon, game.youmonst), false);
heroTile.typ = ROOM;
const monsterTile = game.level.at(mon.mx, mon.my);
monsterTile.typ = STONE;
assert.equal(engulf_target(mon, game.youmonst), false);
monsterTile.typ = ROOM;
game.u.umonnum = PMNAMES.PM_STONE_GIANT;
set_uasmon();
assert.equal(engulf_target(mon, game.youmonst), false);

mon = await setup();
maketrap(game.u.ux, game.u.uy, PIT);
place_object(mksobj(ONAMES.BOULDER, false, false), game.u.ux, game.u.uy);
assert.equal((await strike(mon)).result, M_ATTK_MISS);
assert.ok(!game.u.ustuck && !game.u.uswallow);

mon = await setup();
await polymon(PMNAMES.PM_WRAITH);
const old = [mon.mx, mon.my];
assert.equal((await strike(mon)).result, M_ATTK_MISS);
assert.deepEqual([mon.mx, mon.my], old);
assert.ok(!game.u.ustuck);

// The initial stone check restores the attacker's old square, even when
// an amulet saves it. It also restores punishment before clearing the grip.
for (const lifesaved of [false, true]) {
    mon = await setup();
    const start = [mon.mx, mon.my];
    await punish(null);
    await polymon(PMNAMES.PM_COCKATRICE);
    let amulet;
    if (lifesaved) {
        amulet = mksobj(ONAMES.AMULET_OF_LIFE_SAVING, false, false);
        await mpickobj(mon, amulet);
        amulet.owornmask = W_AMUL;
        mon.misc_worn_check = W_AMUL;
    }
    assert.equal((await strike(mon)).result, lifesaved ? M_ATTK_MISS : M_ATTK_AGR_DIED);
    assert.ok(!game.u.uswallow && !game.u.ustuck);
    assert.equal(game.u.uchain.where, OBJ_FLOOR);
    assert.equal(game.u.uball.where, OBJ_FLOOR);
    if (lifesaved) {
        assert.equal(amulet.where, OBJ_DELETED);
        assert.deepEqual([mon.mx, mon.my], start);
        assert.ok(mon.mhp > 0);
    } else {
        const statue = game.level.objects.find(o => o.otyp === ONAMES.STATUE);
        assert.deepEqual([statue.ox, statue.oy], start);
    }
}

for (const carried of [false, true]) {
    mon = await setup();
    await punish(null);
    const ball = game.u.uball, chain = game.u.uchain;
    if (carried) {
        obj_extract_self(ball);
        addinv(ball);
    }
    set_utrap(5, TT_WEB);
    assert.equal((await strike(mon)).result, M_ATTK_HIT);
    assert.equal(game.u.utrap, 0);
    assert.equal(chain.where, OBJ_FREE);
    assert.equal(ball.where, carried ? OBJ_INVENT : OBJ_FREE);
    assert.deepEqual([chain.ox, chain.oy], [mon.mx, mon.my]);
    await expels(mon, mon.data, false);
    assert.equal(chain.where, OBJ_FLOOR);
    assert.equal(ball.where, carried ? OBJ_INVENT : OBJ_FLOOR);
    assert.ok(!game.u.uswallow && !game.u.ustuck);
    assert.ok(mon.mspec_used >= 1 && mon.mspec_used <= 2);
}

mon = await setup();
for (let i = 0; i < 2; i++) {
    const pet = await makemon(game.mons[PMNAMES.PM_WUMPUS], game.u.ux, game.u.uy,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    pet.mtame = 10;
    pet.mleashed = 1;
    const leash = mksobj(ONAMES.LEASH, false, false);
    leash.leashmon = pet.m_id;
    addinv(leash);
}
game.context_takeoff = {what: W_ARM, mask: W_ARM, disrobing: 'taking off armor'};
game.xlock = {usedtime: 2, chance: 50, picktyp: ONAMES.LOCK_PICK,
    door: game.level.at(game.u.ux, game.u.uy), box: null, magic_key: false};
game.trapinfo = {tobj: mksobj(ONAMES.BEARTRAP, false, false), force_bungle: 1};
await strike(mon);
assert.equal(game.context_takeoff.mask, 0);
assert.equal(game.context_takeoff.what, 0);
assert.equal(game.context_takeoff.disrobing, '');
assert.equal(game.xlock.usedtime, 0);
assert.equal(game.xlock.door, null);
assert.equal(game.trapinfo.tobj, 0);
assert.equal(game.trapinfo.force_bungle, 0);
assert.ok(game.invent.filter(o => o.otyp === ONAMES.LEASH).every(o => o.leashmon === 0));
assert.ok(game.level.monsters.every(m => !m.mleashed));

const outsider = await makemon(game.mons[PMNAMES.PM_OCHRE_JELLY], game.u.ux, game.u.uy,
    MM_NOGRP | MM_NOMSG | NO_MINVENT);
const timer = game.u.uswldtim, currentHP = game.u.uhp;
assert.equal((await strike(outsider)).result, M_ATTK_MISS);
assert.equal(game.u.ustuck, mon);
assert.equal(game.u.uswldtim, timer);
assert.equal(game.u.uhp, currentHP);

// Elemental resistance consumes the damage roll, preserves HP and does
// not disclose resistance to monsters outside the swallowed display.
for (const [name, property] of [
    ['FIRE_VORTEX', 'HFire_resistance'], ['ICE_VORTEX', 'HCold_resistance'],
    ['ENERGY_VORTEX', 'HShock_resistance'], ['OCHRE_JELLY', 'HAcid_resistance']]) {
    mon = await setup(PMNAMES['PM_' + name]);
    inside(mon);
    game.u.intrinsic[property] = FROMOUTSIDE;
    for (let i = 0; i < 12; i++) {
        game.u.uswldtim = 20;
        await strike(mon);
        assert.equal(game.u.uhp, 120, name);
        assert.equal(mon.seen_resistance, 0, name);
    }
}
for (const [engulfer, form, adtyp] of [
    ['FIRE_VORTEX', 'IRON_GOLEM', ATTKS.AD_FIRE],
    ['ENERGY_VORTEX', 'FLESH_GOLEM', ATTKS.AD_ELEC]]) {
    mon = await setup(PMNAMES['PM_' + engulfer]);
    await polymon(PMNAMES['PM_' + form]);
    inside(mon);
    let activated = false;
    for (let i = 0; i < 20 && !activated; i++) {
        game.u.mh = 10;
        game.u.mhmax = 100;
        game.u.uswldtim = 20;
        const {roll, log} = await strike(mon, adtyp);
        activated = log.includes('rn2(2)=1');
        assert.equal(game.u.mh, 10 + (activated
            ? adtyp === ATTKS.AD_FIRE ? roll : Math.trunc((roll + 5) / 6) : 0));
    }
    assert.ok(activated, form);
}

mon = await setup(PMNAMES.PM_FIRE_VORTEX);
inside(mon);
await make_slimed(10, null);
mon.mcan = 1;
await strike(mon);
assert.equal(game.u.uprops.SLIMED, 10);
mon.mcan = 0;
for (let i = 0; i < 20 && game.u.uprops.SLIMED; i++) {
    game.u.uswldtim = 20;
    await strike(mon);
}
assert.equal(game.u.uprops.SLIMED, 0);

for (const form of [PMNAMES.PM_FLESH_GOLEM, PMNAMES.PM_NEWT, PMNAMES.PM_FLAMING_SPHERE]) {
    mon = await setup(PMNAMES.PM_FOG_CLOUD);
    await polymon(form);
    inside(mon);
    game.u.mh = game.u.mhmax = 100;
    game.u.uac = 10;
    const {roll} = await strike(mon);
    assert.equal(game.u.mh, form === PMNAMES.PM_FLAMING_SPHERE ? 100 - roll : 100);
}

// C first doubles fatal digestion damage, then halves it. Using a form
// with sufficient monster HP exposes the intermediate rule without death.
mon = await setup(PMNAMES.PM_TRAPPER);
inside(mon);
game.u.uac = 10;
game.u.intrinsic.HHalf_physical_damage = FROMOUTSIDE;
const physical = await strike(mon, ATTKS.AD_PHYS);
assert.equal(game.u.uhp, 120 - Math.trunc((physical.roll + 1) / 2));

mon = await setup();
await polymon(PMNAMES.PM_GHOUL);
inside(mon);
game.u.intrinsic.HHalf_physical_damage = FROMOUTSIDE;
game.u.uac = 10;
game.u.uhp = 10;
game.u.mh = game.u.mhmax = 50;
game.u.uswldtim = 1;
await strike(mon);
assert.equal(game.u.mh, 40);
assert.equal(game.u.uswallow, 0);

// With slow digestion and negative AC, C changes negative damage to one.
mon = await setup();
inside(mon);
game.u.uac = -4;
game.u.intrinsic.HSlow_digestion = FROMOUTSIDE;
await strike(mon);
assert.equal(game.u.uhp, 119);
assert.equal(game.u.uswallow, 0);

mon = await setup(PMNAMES.PM_JUIBLEX);
await make_sick(30, 'Juiblex', false, SICK_NONVOMITABLE);
enableRngLog();
assert.equal(await diseasemu(mon.data), true);
assert.equal(game.u.uprops.SICK, 11);
assert.ok(getRngLog().every(s => s.startsWith('rn2(2)=')),
    'renewal only exercises constitution; it does not roll a new illness duration');
game.u.intrinsic.HSick_resistance = FROMOUTSIDE;
assert.equal(await diseasemu(mon.data), false);
assert.equal(game.u.uprops.SICK, 11);
inside(mon);
await strike(mon);
assert.equal(game.u.uhp, 120);

mon = await setup(PMNAMES.PM_DUST_VORTEX);
inside(mon);
await strike(mon);
assert.ok(Blind());
const blinded = game.u.intrinsic.HBlinded;
await strike(mon);
assert.equal(game.u.intrinsic.HBlinded, blinded + 1);

// The cloud factory stays synchronous when it emits no message. Gas safety
// distinguishes immune bodies, poison resistance and ordinary breathing.
await setup();
assert.equal(m_poisongas_ok(game.youmonst), M_POISONGAS_BAD);
game.u.intrinsic.HPoison_resistance = FROMOUTSIDE;
assert.equal(m_poisongas_ok(game.youmonst), M_POISONGAS_MINOR);
await polymon(PMNAMES.PM_IRON_GOLEM);
assert.equal(m_poisongas_ok(game.youmonst), M_POISONGAS_OK);
const cloud = create_gas_cloud(game.u.ux, game.u.uy, 1, 4);
assert.ok(!cloud.then && game.regions.includes(cloud));

// A flying hero does not acquire riding-injury damage after losing a mount.
const mounted = read('mounted-jousting').segments[0];
resetInputState();
await runSegment({ ...mounted, moves: mounted.moves.slice(0, mounted.moves.indexOf('\x07sleeping')),
    storage: new InMemoryStorage() });
game._preNhgetchHook = null;
pushKeys(' '.repeat(100));
assert.ok(game.u.usteed);
game.u.intrinsic.HFlying = FROMOUTSIDE;
const hp = game.u.uhp;
await dismount_steed(DISMOUNT_FELL);
assert.equal(game.u.uhp, hp);
assert.equal(game.u.usteed, null);

console.log(`engulfing state: PASS (${replays} C replays plus source controls)`);
