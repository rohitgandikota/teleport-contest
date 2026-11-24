// C polyself.c:38/469/735/1972/2236. Real producers, no species normalization.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { polymon, polyself, set_uasmon, rehumanize, change_sex,
    body_part, mbodypart } from '../js/polyself.js';
import { match_warn_of_mon } from '../js/display.js';
import { completelyrusts, completelyrots, completelyburns } from '../js/mondata.js';
import { set_ulycn } from '../js/were.js';
import { dosave0, dorecover } from '../js/save.js';
import { makemon } from '../js/makemon.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { mons as initialMons, PMNAMES as P } from '../js/monst_data.js';
import { FROMFORM, FROMRACE, FROMOUTSIDE, NON_PM, G_GENOD, G_EXTINCT,
    HAND, EYE, NOSE, HAIR, POLY_MONSTER, MM_NOGRP, MM_NOMSG, NO_MINVENT } from '../js/const.js';

const input = { seed:7341, datetime:'20000110090000', moves:' ',
    nethackrc:'OPTIONS=name:Identity,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' };
async function setup() {
    const run = await runSegment({...input, storage:new InMemoryStorage()});
    let reads = 0;
    run._display.onEmptyQueue = () => { assert.ok(++reads < 100, 'bounded message completion'); return 32; };
    game._preNhgetchHook = null;
    resetInputState();
    return run;
}
function canonical(form = game.u.umonnum) {
    assert.equal(game.youmonst.data, game.mons[form]);
    assert.notEqual(game.youmonst.data, initialMons[form]);
    assert.equal(game.youmonst.mnum, form);
    assert.equal(game.youmonst.m_id, 1);
}
async function form(id) {
    assert.equal(await polymon(id), 1);
    assert.equal(game.u.umonnum, id);
}
function seed() { initRng(19); enableRngLog(); }

test('new-game initialization retains the current species table', async () => {
    await setup(); canonical();
    assert.notEqual(game.mons, initialMons);
});
test('two real starts use distinct game tables without retaining the previous hero entry', async () => {
    await setup();
    const priorGame=game, priorTable=game.mons, priorHero=game.youmonst.data;
    await setup();
    assert.notEqual(game, priorGame); assert.notEqual(game.mons, priorTable);
    assert.notEqual(game.youmonst.data, priorHero); canonical();
});

for (const [id, rust, rot, burn] of [
    [P.PM_IRON_GOLEM,true,false,false], [P.PM_WOOD_GOLEM,false,true,false],
    [P.PM_LEATHER_GOLEM,false,true,false], [P.PM_PAPER_GOLEM,false,false,true],
    [P.PM_STRAW_GOLEM,false,false,true], [P.PM_STONE_GOLEM,false,false,false],
    [P.PM_LITTLE_DOG,false,false,false]
]) test(`real polymon ${id} supplies canonical data to unchanged material predicates`, async () => {
    await setup(); await form(id);
    assert.equal(completelyrusts(game.youmonst.data),rust);
    assert.equal(completelyrots(game.youmonst.data),rot);
    assert.equal(completelyburns(game.youmonst.data),burn); canonical(id);
});

for (const [id,key] of [[P.PM_BABY_GRAY_DRAGON,'HAntimagic'],
    [P.PM_GHOUL,'HSick_resistance'], [P.PM_STALKER,'HStun'],
    [P.PM_SILVER_DRAGON,'HReflecting']]) {
    test(`canonical form ${id} preserves local identity-derived property ${key}`, async () => {
        await setup(); game.u.intrinsic[key]=FROMOUTSIDE;
        await form(id);
        assert.equal(game.u.intrinsic[key] & FROMFORM,FROMFORM);
        assert.equal(game.u.intrinsic[key] & FROMOUTSIDE,FROMOUTSIDE);
        await form(P.PM_LITTLE_DOG);
        assert.equal(game.u.intrinsic[key] & FROMFORM,0);
        assert.equal(game.u.intrinsic[key] & FROMOUTSIDE,FROMOUTSIDE);
    });
}

test('rehumanize restores canonical role data through polyman', async () => {
    await setup(); await form(P.PM_IRON_GOLEM);
    await rehumanize(); canonical(game.u.umonster);
    assert.equal(game.u.mtimedone,0);
});
test('set_ulycn refresh stays synchronous and consumes no RNG', async () => {
    await setup(); await form(P.PM_IRON_GOLEM); seed();
    assert.equal(set_ulycn(P.PM_WEREWOLF),undefined); canonical();
    assert.equal(set_ulycn(NON_PM),undefined); canonical();
    assert.deepEqual(getRngLog(),[]);
});
test('amorous-demon change_sex retains canonical form and synchronous return', async () => {
    await setup(); await form(P.PM_AMOROUS_DEMON); seed();
    assert.equal(change_sex(),undefined); canonical(); assert.deepEqual(getRngLog(),[]);
});
test('set_uasmon preserves C movement proration and has no asynchronous or RNG work', async () => {
    await setup(); await form(P.PM_BAT);
    assert.equal(game.youmonst.data.mmove,22);
    game.u.umovement=22; game.u.umonnum=P.PM_IRON_GOLEM; seed();
    assert.equal(set_uasmon(),undefined); assert.equal(game.u.umovement,6); canonical();
    game.u.umonnum=P.PM_BAT;
    assert.equal(set_uasmon(),undefined); assert.equal(game.u.umovement,6); canonical();
    assert.deepEqual(getRngLog(),[]);
});

for (const id of [P.PM_IRON_GOLEM,P.PM_WOOD_GOLEM,P.PM_PURPLE_WORM]) {
    test(`full save/restore rebuilds form ${id} against the fresh live table`, async () => {
        await setup(); await form(id);
        const previous=game.mons;
        assert.equal(await dosave0(),true);
        assert.equal(await dorecover(),true);
        assert.notEqual(game.mons,previous); canonical(id);
        if(id===P.PM_PURPLE_WORM)
            assert.equal(game.context.warntype.species,game.mons[P.PM_SHRIEKER]);
    });
}

test('genocided form returns zero and preserves the current data and form timer', async () => {
    await setup();
    const data=game.youmonst.data, timer=game.u.mtimedone;
    game.mvitals[P.PM_IRON_GOLEM].mvflags|=G_GENOD;
    assert.equal(await polymon(P.PM_IRON_GOLEM),0);
    assert.equal(game.youmonst.data,data); assert.equal(game.u.mtimedone,timer);
});
test('extinction still permits polymorph without resetting generation flags', async () => {
    await setup(); game.mvitals[P.PM_IRON_GOLEM].mvflags|=G_EXTINCT;
    await form(P.PM_IRON_GOLEM); canonical();
    assert.ok(game.mvitals[P.PM_IRON_GOLEM].mvflags&G_EXTINCT);
});

test('purple-worm warning is a canonical species pointer and clears on leaving the form', async () => {
    await setup(); await form(P.PM_PURPLE_WORM);
    assert.equal(game.context.warntype.species,game.mons[P.PM_SHRIEKER]);
    assert.equal(game.context.warntype.speciesidx,P.PM_SHRIEKER);
    assert.ok(game.u.intrinsic.HWarn_of_mon & FROMRACE);
    await form(P.PM_LITTLE_DOG);
    assert.equal(game.context.warntype.species,null);
    assert.equal(game.context.warntype.speciesidx,NON_PM);
    assert.equal(game.u.intrinsic.HWarn_of_mon & FROMRACE,0);
});
test('vampire-leader shape selection keeps the C rn2(10) draw before alternate selection', async () => {
    await setup(); await form(P.PM_VAMPIRE_LEADER); seed();
    await polyself(POLY_MONSTER);
    assert.match(getRngLog()[0],/^rn2\(10\)=/);
    assert.ok([P.PM_WOLF,P.PM_FOG_CLOUD,P.PM_VAMPIRE_BAT].includes(game.u.umonnum));
});

for (const [id,part,name] of [[P.PM_OWLBEAR,HAND,'paw'],
    [P.PM_FLOATING_EYE,EYE,'cornea'], [P.PM_MUMAK,NOSE,'trunk'],
    [P.PM_SHARK,HAIR,'skin']]) {
    test(`canonical hero ${id} keeps C body-part name ${name}`, async () => {
        await setup(); await form(id); assert.equal(body_part(part),name);
    });
}
test('real makemon owlbear uses the same body-part comparison as the hero', async () => {
    await setup();
    const mon=await makemon(game.mons[P.PM_OWLBEAR],0,0,MM_NOGRP|MM_NOMSG|NO_MINVENT);
    assert.ok(mon); assert.equal(mon.data,game.mons[P.PM_OWLBEAR]);
    assert.equal(mbodypart(mon,HAND),'paw');
});

for (const [species,expected] of [[P.PM_SHRIEKER,true],[P.PM_VIOLET_FUNGUS,false]]) {
    test(`real warning consumer species ${species} matches only the selected species`, async () => {
        await setup(); await form(P.PM_PURPLE_WORM);
        const mon=await makemon(game.mons[species],0,0,MM_NOGRP|MM_NOMSG|NO_MINVENT);
        assert.ok(mon); assert.equal(match_warn_of_mon(mon),expected);
    });
}

for (const [species,offerSit] of [[P.PM_GIANT_EEL,false],
    [P.PM_ELECTRIC_EEL,false],[P.PM_CROCODILE,true]]) {
    test(`female egg-layer ${species} preserves C's sit-hint exception`, async () => {
        await setup();
        game.flags.female=true; game.flags.verbose=true;
        game._msg_history=[]; game._toplines='';
        await form(species);
        const text=[...game._msg_history,game._toplines].join('\n');
        assert.equal(text.includes('Use the command #sit'),offerSit);
    });
}
