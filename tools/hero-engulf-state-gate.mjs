#!/usr/bin/env node

// Persistent-state checks for uhitm.c:4891..5196, eat.c:3920..3971,
// mhitm.c:1461, timeout.c:138..526 and end.c:704..764.
// Constructed source controls earn no native coverage or reachability credit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { gulpum, explum } from '../js/uhitm.js';
import { xdrainenergym } from '../js/mhitm.js';
import { mcalcdistress } from '../js/mon.js';
import { makemon } from '../js/makemon.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { mpickobj } from '../js/steal.js';
import { polymon } from '../js/polyself.js';
import { Finish_digestion, Popeye, start_tin } from '../js/eat.js';
import { savelife } from '../js/end.js';
import { nh_timeout } from '../js/timeout.js';
import { make_stoned, make_slimed, make_sick } from '../js/potion.js';
import { ACURR } from '../js/attrib.js';
import { Slow_digestion, Unchanging } from '../js/youprop.js';
import { enableRngLog, getRngLog } from '../js/rng.js';
import { PMNAMES, ATTKS, MFLAGS } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { MM_NOGRP, MM_NOMSG, NO_MINVENT, ROOM, FROMOUTSIDE, W_AMUL,
    OBJ_DELETED, OBJ_FLOOR, NON_PM, M_ATTK_MISS, M_ATTK_DEF_DIED,
    A_CON, CHOKING, DIED, TT_LAVA, SICK_ALL, KILLED_BY_AN,
    HUNGER, STONED, SLIMED, SICK, VOMITING, TIMEOUT } from '../js/const.js';

const read = name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url)));
let replays = 0;
for (const file of ['hero-engulf-digestion', 'hero-engulf-elements']) {
    for (const segment of read(file).segments) {
        let digesting = false, blind = false, slime = false, mortality = 0;
        let slow = false;
        globalThis.__step_snapshot = {step:'*', cb: state => {
            if (state.corpsenm_digested >= 0) {
                digesting = true;
                assert.equal(state.afternmv, Finish_digestion);
                assert.ok(state.multi < 0);
            }
            slime ||= state.u.umonnum === PMNAMES.PM_GREEN_SLIME;
            mortality = Math.max(mortality, state.u.umortality || 0);
            slow ||= Slow_digestion();
            for (const mon of state.level.monsters) {
                assert.ok(Number.isInteger(mon.mblinded));
                assert.ok(mon.mblinded >= 0 && mon.mblinded <= 127);
                assert.ok(Number.isFinite(mon.mspec_used));
                blind ||= mon.mblinded > 0;
            }
        }};
        try {
            await runSegment({...segment, storage:new InMemoryStorage()});
        } finally {
            delete globalThis.__step_snapshot;
        }
        const label = file + ':' + segment.name;
        assert.equal(game.mswallower ?? null, null, label + ': damage owner cleared');
        if (segment.name === 'flesh-golem') {
            assert.ok(digesting, label + ': delayed digestion');
            assert.equal(game.corpsenm_digested, NON_PM, label + ': completion cleared species');
        }
        if (segment.name === 'slow-digestion') {
            assert.ok(slow);
            assert.equal(digesting, false);
        }
        if (segment.name === 'dust-blindness') assert.ok(blind, label);
        if (['cockatrice','rider','green-slime'].includes(segment.name))
            assert.ok(mortality > 0, label + ': fatal path reached');
        if (segment.name === 'green-slime') {
            assert.ok(slime, label + ': actually transformed');
            assert.equal(game.u.uprops.SLIMED & TIMEOUT,0);
        }
        replays++;
    }
}

const source = read('monster-pickup-light').segments[0];
async function setup(form = null) {
    resetInputState();
    await runSegment({...source, moves:' ', storage:new InMemoryStorage()});
    game._preNhgetchHook = null;
    game.iflags.debug_mongen = false;
    pushKeys(' '.repeat(1000));
    game.u.uhp = game.u.uhpmax = 200;
    for (let x=game.u.ux-2;x<=game.u.ux+2;x++)
        for (let y=game.u.uy-2;y<=game.u.uy+2;y++)
            if (game.level.at(x,y)) game.level.at(x,y).typ=ROOM;
    if (form !== null) await polymon(form);
}
async function monster(mnum) {
    assert.ok(Number.isInteger(mnum),'valid monster species');
    const mon = await makemon(game.mons[mnum],game.u.ux+1,game.u.uy,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(mon);
    mon.mhp = mon.mhpmax = 100;
    return mon;
}
const attack = type => game.youmonst.data.mattk.find(a =>
    a[0] === ATTKS.AT_ENGL && (type === undefined || a[1] === type));

// Refusals still roll the initial attack dice, but leave the target intact.
for (const mode of ['huge','trapped','satiated','swallowed']) {
    await setup(PMNAMES.PM_PURPLE_WORM);
    const mon = await monster(mode === 'huge' ? PMNAMES.PM_RED_DRAGON : PMNAMES.PM_GOBLIN);
    if (mode === 'trapped') game.youmonst.mtrapped=1;
    if (mode === 'satiated') game.u.uhunger=1500;
    if (mode === 'swallowed') game.u.uswallow=1;
    enableRngLog();
    assert.equal(await gulpum(mon,attack()),M_ATTK_MISS,mode);
    assert.equal(mon.mhp,100,mode);
    assert.equal(getRngLog().filter(s=>s.startsWith('d(')).length,1,mode);
}

// Digestion consumes a worn lifesaver before killing. Corpse eligibility
// separately controls both nutrition and the multi-turn digestion callback.
for (const noCorpse of [false,true]) {
    await setup(PMNAMES.PM_PURPLE_WORM);
    game.u.uhunger=500;
    const mon=await monster(PMNAMES.PM_OGRE);
    const amulet=mksobj(ONAMES.AMULET_OF_LIFE_SAVING,false,false);
    await mpickobj(mon,amulet);
    amulet.owornmask=W_AMUL; mon.misc_worn_check=W_AMUL;
    if (noCorpse) game.mvitals[mon.mnum].mvflags |= MFLAGS.G_NOCORPSE;
    assert.equal(await gulpum(mon,attack()),M_ATTK_DEF_DIED);
    assert.ok(mon.mhp<=0);
    assert.equal(amulet.where,OBJ_DELETED);
    assert.equal(game.u.uhunger,500+(noCorpse?0:Math.trunc((mon.data.cnutrit+1)/2)));
    assert.equal(game.mswallower,null);
    if (noCorpse) {
        assert.notEqual(game.afternmv,Finish_digestion);
    } else {
        assert.equal(game.multi,-(1+(mon.data.cwt>>8)));
        assert.equal(game.afternmv,Finish_digestion);
        assert.equal(game.corpsenm_digested,mon.mnum);
        await Finish_digestion();
        assert.equal(game.corpsenm_digested,NON_PM);
    }
}

// Blindness saturates at the C bitfield limit and later restores sight.
await setup(PMNAMES.PM_DUST_VORTEX);
let mon=await monster(PMNAMES.PM_GOBLIN);
mon.mblinded=126; mon.mcansee=0;
await gulpum(mon,attack());
assert.equal(mon.mblinded,127,'engulf blindness cap');
assert.equal(mon.mhp,100,'blindness does not deal HP damage');
for(let i=0;i<127;i++) await mcalcdistress();
assert.equal(mon.mblinded,0); assert.equal(mon.mcansee,1);
await setup(PMNAMES.PM_YELLOW_LIGHT);
mon=await monster(PMNAMES.PM_GOBLIN);
mon.mblinded=126;
await explum(mon,game.youmonst.data.mattk.find(a=>a[0]===ATTKS.AT_EXPL));
assert.equal(mon.mblinded,126,'light cannot reblind an already blind target');
mon.mblinded=0;mon.mcansee=1;enableRngLog();
await explum(mon,game.youmonst.data.mattk.find(a=>a[0]===ATTKS.AT_EXPL));
const flash=Number(getRngLog().find(s=>s.startsWith('d(')).split('=')[1]);
assert.equal(mon.mblinded,Math.min(flash,127));assert.equal(mon.mcansee,0);

for (const species of ['GNOMISH_WIZARD','RED_DRAGON','GOBLIN']) {
    await setup(); mon=await monster(PMNAMES['PM_'+species]);
    mon.mspec_used=19; enableRngLog();
    await xdrainenergym(mon,false);
    const roll=getRngLog().find(s=>s.startsWith('d(2,2)='));
    if(species==='GOBLIN') {
        assert.equal(roll,undefined);assert.equal(mon.mspec_used,19);
    } else {
        assert.ok(roll);assert.equal(mon.mspec_used,19+Number(roll.split('=')[1]));
        enableRngLog();await xdrainenergym(mon,false);
        assert.equal(getRngLog().length,0,'cooldown limit prevents a further draw');
    }
}

for (const how of [DIED,CHOKING]) {
    await setup(PMNAMES.PM_PURPLE_WORM);
    game.u.uhp=game.u.mh=0;game.u.mhmax=300;
    game.u.uhunger=1500; game.u.utrap=5;game.u.utraptype=TT_LAVA;
    game.u.intrinsic.HUnchanging=FROMOUTSIDE;
    game.u.uprops.UNCHANGING=W_AMUL;
    await make_sick(1,'illness',false,SICK_ALL);
    const givehp=50+10*Math.trunc(ACURR(A_CON)/2);
    await savelife(how);
    assert.equal(game.u.uhp,Math.min(game.u.uhpmax,givehp));
    assert.equal(game.u.mh,givehp);
    assert.equal(game.u.uhunger,how===CHOKING?900:1500);
    assert.equal(game.u.uprops.SICK,0);
    assert.equal(game.u.utrap,0);
    assert.equal(game.u.intrinsic.HUnchanging,0);
    assert.ok(Unchanging(),'extrinsic Unchanging survives');
    assert.equal(game.multi,-1);assert.equal(game.context.move,0);
    assert.equal(game.u.ugrave_arise,NON_PM);
}

// The real tin-opening occupation supplies Popeye's function identity.
await setup();
const tin=mksobj(ONAMES.TIN,false,false);tin.blessed=tin.cursed=0;
await addinv(tin);await start_tin(tin);
const opening=game.occupation;assert.ok(opening);
tin.known=0;
assert.ok(Popeye(SICK),'an unknown tin may help');
tin.known=1;tin.corpsenm=PMNAMES.PM_LIZARD;
assert.ok(Popeye(STONED));assert.ok(Popeye(HUNGER));
assert.equal(Popeye(SLIMED),false);
tin.corpsenm=PMNAMES.PM_ACID_BLOB;assert.ok(Popeye(STONED));
tin.corpsenm=PMNAMES.PM_CHAMELEON;assert.ok(Popeye(SLIMED));
assert.equal(Popeye(SICK),false);assert.equal(Popeye(VOMITING),false);
tin.corpsenm=NON_PM;tin.spe=0;assert.equal(Popeye(HUNGER),false);
tin.spe=1;assert.ok(Popeye(HUNGER));
tin.where=OBJ_FLOOR;tin.ox=game.u.ux+2;tin.oy=game.u.uy;
assert.equal(Popeye(HUNGER),false,'inaccessible tin');
game.occupation=null;assert.equal(Popeye(HUNGER),false,'other occupation');

await setup();
game.u.intrinsic.HFast=FROMOUTSIDE;
await make_stoned(5,null,KILLED_BY_AN,null);
await nh_timeout();assert.equal(game.u.intrinsic.HFast,0);
await make_stoned(2,null,KILLED_BY_AN,null);
await make_slimed(3,null);game.u.uprops.VOMITING=10;
game.u.intrinsic.HDeaf=2;
await nh_timeout();
assert.equal(game.u.uprops.SLIMED,0,'stone dialogue cancels slime before slime dialogue');
assert.equal(game.u.uprops.VOMITING,0);
assert.equal(game.u.intrinsic.HDeaf,4,'deafness postponed then decremented');
await make_stoned(10,null,KILLED_BY_AN,null);
await make_slimed(3,null);
await nh_timeout();assert.equal(game.u.uprops.STONED,0,'late slime cancels petrification');
console.log(`hero engulf state gate: ${replays} replays and source controls passed`);
