#!/usr/bin/env node

// Native replays plus source controls for eat.c:475,758..878,
// do_wear.c:608..640 and timeout.c:137..526,813..843.
// Constructed controls earn no native branch or reachability credit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { cprefx, eatfood } from '../js/eat.js';
import { nh_timeout } from '../js/timeout.js';
import { make_stoned } from '../js/potion.js';
import { find_delayed_killer } from '../js/end.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { addinv, obj_extract_self } from '../js/invent.js';
import { stop_occupation } from '../js/allmain.js';
import { glyph_at, map_invisible } from '../js/display.js';
import { domove_fight_empty } from '../js/hack.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { TIMEOUT, FROMOUTSIDE, G_GENOD, STONED, KILLED_BY_AN,
    ROOM } from '../js/const.js';

const read = name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url)));
let replays = 0;
for (const file of ['energy-drain','fatal-countdowns','fatal-tin-interventions',
                    'slimicide','first-bite-effects']) {
    for (const segment of read(file).segments) {
        let stone = false, slimed = false, held = false, resistant = false;
        globalThis.__step_snapshot = {step:'*',cb: g => {
            stone ||= !!(g.u.uprops.STONED & TIMEOUT);
            slimed ||= !!(g.u.uprops.SLIMED & TIMEOUT);
            resistant ||= !!(g.u.intrinsic.HStone_resistance & TIMEOUT);
            held ||= g.u.uwep?.corpsenm === PMNAMES.PM_COCKATRICE;
        }};
        try {
            await runSegment({...segment,storage:new InMemoryStorage()});
        } finally {
            delete globalThis.__step_snapshot;
        }
        const name = segment.name, label = file + ':' + name;
        if (['lizard-rescue','acid-rescue','lizard-unknown-rescue',
             'lizard-first-bite','acid-first-bite'].includes(name)) {
            assert.ok(stone,label + ': countdown was active');
            assert.equal(game.u.uprops.STONED & TIMEOUT,0,label + ': cured');
            assert.equal(game.u.umortality || 0,0,label + ': no death reprieve');
        }
        if (file === 'slimicide') {
            assert.ok(slimed,label);
            assert.equal(game.u.umonnum,PMNAMES.PM_GREEN_SLIME,label);
            assert.ok(game.mvitals[PMNAMES.PM_GREEN_SLIME].mvflags & G_GENOD,label);
            assert.equal(game.u.umortality,2,label + ': both deaths occurred');
            assert.equal(game.u.uprops.SLIMED & TIMEOUT,0,label);
            if (name === 'amulet-reprieve') {
                assert.equal(game.u.uamul,null,label);
                assert.equal(game.invent.some(o=>o.otyp===ONAMES.AMULET_OF_LIFE_SAVING),false,label);
            }
        }
        if (file === 'first-bite-effects') {
            if (name === 'domestic-tin' || name === 'cannibal-tin')
                assert.ok(game.u.intrinsic.HAggravate_monster & FROMOUTSIDE,label);
            if (name === 'cannibal-tin') assert.equal(game.u.uluck,-2,label);
            if (name === 'petrifying-golem') {
                assert.equal(game.u.umonnum,PMNAMES.PM_STONE_GOLEM,label);
                assert.equal(game.u.umortality || 0,0,label);
            }
            if (name === 'sliming-glob') {
                assert.ok(slimed,label);
                assert.equal(game.u.umonnum,PMNAMES.PM_GREEN_SLIME,label);
            }
            if (name === 'held-corpse-timeout') {
                assert.ok(held && resistant,label + ': held under temporary protection');
                assert.notEqual(game.u.uwep?.corpsenm,PMNAMES.PM_COCKATRICE,label);
                assert.ok(game.invent.some(o=>o.corpsenm===PMNAMES.PM_COCKATRICE),label);
                assert.equal(game.u.intrinsic.HStone_resistance & TIMEOUT,0,label);
            }
        }
        replays++;
    }
}

const source = read('first-bite-effects').segments[0];
async function setup() {
    resetInputState();
    await runSegment({...source,moves:' ',storage:new InMemoryStorage()});
    game._preNhgetchHook = null;
    game.iflags.debug_mongen = false;
    game.u.uhp = game.u.uhpmax = 200;
    pushKeys(' '.repeat(1000));
}

// A cure removes the delayed killer as well as the displayed condition.
for (const species of [PMNAMES.PM_LIZARD,PMNAMES.PM_ACID_BLOB]) {
    await setup();
    await make_stoned(5,null,KILLED_BY_AN,'cockatrice');
    await cprefx(species);
    assert.equal(game.u.uprops.STONED,0);
    assert.equal(find_delayed_killer(STONED),null);
    assert.equal(game.u.umortality || 0,0);
}

// Protection extends during an accessible dangerous meal, then expires when
// the meal stops. Both carried food and floor food use the same occupation.
for (const [property,species] of [
    ['HStone_resistance',PMNAMES.PM_COCKATRICE],
    ['HAcid_resistance',PMNAMES.PM_ACID_BLOB],
]) {
    for (const location of ['carried','floor','inaccessible','ordinary']) {
        await setup();
        const food = mksobj(ONAMES.CORPSE,false,false);
        food.corpsenm = location === 'ordinary' ? PMNAMES.PM_NEWT : species;
        await addinv(food);
        if (location === 'floor' || location === 'inaccessible') {
            obj_extract_self(food);
            place_object(food,game.u.ux+(location==='inaccessible'?1:0),game.u.uy);
        }
        game.context.victual = {piece:food,usedtime:0,reqtime:10,eating:1};
        game.occupation = eatfood;game.occtxt = 'eating the corpse';
        game.u.intrinsic[property] = 1;
        await nh_timeout();
        const expected = location === 'carried' || location === 'floor' ? 1 : 0;
        assert.equal(game.u.intrinsic[property],expected,property+': '+location);
        await stop_occupation();
        await nh_timeout();
        assert.equal(game.u.intrinsic[property],0,property+': interrupted meal');
    }
}

// A stale invisible marker consumes a move even without forcefight, and its
// remembered object is gone afterwards. A normal move does not attack air.
await setup();
const x=game.u.ux+1,y=game.u.uy;
game.level.at(x,y).typ=ROOM;
game.level.monsters=game.level.monsters.filter(m=>m.mx!==x||m.my!==y);
game.context.forcefight=false;game.context.nopick=0;
map_invisible(x,y);
assert.equal(glyph_at(x,y).kind,'invis');
assert.equal(await domove_fight_empty(x,y),true);
assert.notEqual(game.level.at(x,y).remembered_glyph?.glyph?.kind,'invis');
assert.equal(await domove_fight_empty(x,y),false);
console.log(`fatal timers state gate: ${replays} replays and source controls passed`);
