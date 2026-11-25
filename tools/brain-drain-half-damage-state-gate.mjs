// C mhitu.c:1144-1267. Real public attack entry; no private exports or helper replacements.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, clearMessages, messages} from './brain-drain-half-damage-setup.mjs';
import {game} from '../js/gstate.js';
import {mattacku, mdamageu} from '../js/mhitu.js';
import {makemon} from '../js/makemon.js';
import {mksobj, bless, curse} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {artifact_exists} from '../js/artifact.js';
import {setworn} from '../js/worn.js';
import {Amulet_on, set_wear} from '../js/do_wear.js';
import {incr_itimeout} from '../js/potion.js';
import {nh_timeout} from '../js/timeout.js';
import {getRngLog} from '../js/rng.js';
import {Role_if} from '../js/attrib.js';
import {Half_physical_damage, Antimagic} from '../js/youprop.js';
import {mon_hates_blessings} from '../js/mondata.js';
import {is_quest_artifact} from '../js/questpgr.js';
import {msgtype_parse_add, boolean_option} from '../js/options.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare(options = {}) {
    const run = await setup(options.role || (options.mitre ? 'Priest' : 'Wizard'),
        options.showdamage ? 'OPTIONS=showdamage\n' : '');
    game.u.uhp = game.u.uhpmax = options.hp || 100; // Constructed healthy/injured HP boundary.
    if (options.intrinsic) incr_itimeout('HHalf_physical_damage', options.timeout || 30);
    if (options.orb) {
        const orb = mksobj(O.CRYSTAL_BALL, false, false);
        artifact_exists(orb, 'The Orb of Fate', true, C.ONAME_WISH);
        await addinv(orb); assert.ok(orb.oartifact);
    }
    let helmet;
    if (options.mitre || options.helmet || options.plain) {
        helmet = mksobj(options.helmet ? O.HELMET : O.HELM_OF_BRILLIANCE, false, false);
        if (options.mitre) artifact_exists(helmet, 'The Mitre of Holiness', true, C.ONAME_WISH);
        if (options.buc === 'blessed') bless(helmet);
        if (options.buc === 'cursed') await curse(helmet);
        await addinv(helmet);
        if (!options.carried) { setworn(helmet, C.W_ARMH); await set_wear(helmet); }
    }
    if (options.magicResistance) {
        const cloak = await addinv(mksobj(O.CLOAK_OF_MAGIC_RESISTANCE, false, false));
        setworn(cloak, C.W_ARMC); await set_wear(cloak); assert.ok(Antimagic());
    }
    const mon = await makemon(game.mons[options.monster ?? P.PM_KOBOLD_ZOMBIE], 32, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon); mon.mux = game.u.ux; mon.muy = game.u.uy;
    game.u.uac = options.ac ?? 10; // Explicit armor-class boundary, not an ordinary-input claim.
    clearMessages(); seed(options.seed ?? 0);
    return {run, mon, helmet};
}
const ordinaryCalls = ['rnd(20)=6','d(1,4)=4','rn2(3)=2','rn2(6)=0'];

for (const [name, options, loss] of [
    ['no protection', {}, 4],
    ['intrinsic', {intrinsic:true}, 2],
    ['carried Orb of Fate', {orb:true}, 2],
    ['intrinsic plus Orb', {intrinsic:true,orb:true}, 2],
    ['uncursed Mitre', {mitre:true}, 2],
    ['blessed Mitre', {mitre:true,buc:'blessed'}, 2],
    ['cursed Mitre', {mitre:true,buc:'cursed'}, 2],
    ['Mitre plus intrinsic', {mitre:true,intrinsic:true}, 2],
    ['Mitre plus Orb', {mitre:true,orb:true}, 2],
    ['Mitre worn by Wizard', {mitre:true,role:'Wizard'}, 4],
    ['Mitre merely carried', {mitre:true,carried:true}, 4],
    ['ordinary brilliance helm', {plain:true,role:'Priest'}, 4],
]) test(`public zombie hit: ${name}`, async () => {
    const {mon,helmet} = await prepare(options);
    assert.equal(Half_physical_damage(), !!(options.intrinsic || options.orb));
    assert.ok(mon_hates_blessings(mon));
    if (options.mitre && options.role !== 'Wizard') {
        assert.ok(Role_if(P.PM_CLERIC)); assert.ok(is_quest_artifact(helmet));
        assert.equal(game.u.uarmh === helmet, !options.carried);
    }
    assert.equal(await mattacku(mon), 0);
    assert.equal(game.u.uhp, 100 - loss);
    assert.deepEqual(getRngLog(), ordinaryCalls);
    assert.match(messages(), /kobold zombie hits/);
    assert.equal(game.u.umortality || 0, 0);
});

test('the same worn Mitre does not protect against a living attacker', async () => {
    const {mon} = await prepare({mitre:true,monster:P.PM_KITTEN});
    assert.equal(mon_hates_blessings(mon), false); await mattacku(mon);
    assert.equal(game.u.uhp, 94);
    assert.deepEqual(getRngLog(), ['rnd(20)=6','d(1,6)=6','rn2(3)=2','rn2(6)=0']);
});
for (const [value, hp, calls] of [
    [0,98,['rnd(1)=1','rnd(20)=4','d(1,4)=4','rn2(3)=0','rn2(6)=5','rnd(1)=1']],
    [2,99,['rnd(1)=1','rnd(20)=3','d(1,4)=1','rn2(3)=0','rn2(6)=3','rnd(1)=1']],
]) test(`negative AC reduction and minimum precede halving, seed ${value}`, async () => {
    const {mon} = await prepare({intrinsic:true,ac:-1,seed:value}); await mattacku(mon);
    assert.equal(game.u.uhp, hp); assert.deepEqual(getRngLog(), calls);
});
test('a genuine miss never reaches damage or knockback samples', async () => {
    const {mon} = await prepare({intrinsic:true,ac:-1,seed:1}); await mattacku(mon);
    assert.equal(game.u.uhp, 100); assert.match(messages(), /misses/);
    assert.deepEqual(getRngLog(), ['rnd(1)=1','rnd(20)=15']);
});
test('a real intrinsic expiry restores full common-caller damage', async () => {
    const {mon} = await prepare({intrinsic:true,timeout:1});
    await nh_timeout(); assert.equal(Half_physical_damage(), false);
    clearMessages(); seed(0); await mattacku(mon);
    assert.equal(game.u.uhp, 96); assert.deepEqual(getRngLog(), ordinaryCalls);
});
for (const helmet of [false,true]) test(`mind-flayer round consumes each damage once, helmet=${helmet}`, async () => {
    const {mon} = await prepare({monster:P.PM_MIND_FLAYER,intrinsic:true,helmet});
    await mattacku(mon);
    // One claw rolls four; each reached tentacle rolls two. The ordinary
    // helmet guards and consumed brain branch both retain one physical dose.
    const draws = getRngLog().filter(call => /^d\((1,4|2,1)\)=/.test(call));
    assert.equal(draws[0], 'd(1,4)=4');
    assert.equal(game.u.uhp, 100 - 2 - (draws.length - 1));
    assert.match(messages(), /Your brain is eaten/);
    assert.equal(messages().includes('blocks the attack'), helmet);
    assert.equal(game.u.umortality || 0, 0);
});
test('mdamageu itself never applies the common caller multiplier', async () => {
    const {mon} = await prepare({intrinsic:true}); await mdamageu(mon, 5);
    assert.equal(game.u.uhp, 95); assert.deepEqual(getRngLog(), []);
});
test('halving occurs before real life-saving threshold handling', async () => {
    const {mon} = await prepare({intrinsic:true,hp:3});
    const amulet = await addinv(mksobj(O.AMULET_OF_LIFE_SAVING,false,false));
    await Amulet_on(amulet); clearMessages(); seed(0); await mattacku(mon);
    assert.equal(game.u.uhp, 1); assert.equal(game.u.uamul, amulet);
    assert.ok(game.invent.includes(amulet)); assert.equal(game.u.umortality || 0, 0);
    assert.doesNotMatch(messages(), /medallion|Die\?/); assert.deepEqual(getRngLog(),ordinaryCalls);
});

async function pending(run, pattern, action, inspect) {
    assert.ok(msgtype_parse_add(`stop "${pattern.source}"`));
    let entered, release, timer, done=false;
    const atMore = new Promise(resolve => {entered=resolve;});
    run._display.onEmptyQueue = () => {
        if (!pattern.test(game._toplines)) return 32;
        entered(); return new Promise(resolve => {release=resolve;});
    };
    const operation=action().then(() => {done=true;});
    try {
        await Promise.race([atMore,operation.then(() => {throw Error('no More');}),
            new Promise((_,reject) => {timer=setTimeout(() => reject(Error('More timeout')),2000);})]);
        await setImmediate(); assert.equal(done,false); inspect();
    } finally {clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await operation;}
    assert.equal(done,true);
}
test('hit feedback completes before knockback and half-damage application', async () => {
    const {run,mon}=await prepare({intrinsic:true});
    await pending(run,/kobold zombie hits/,()=>mattacku(mon),()=>{
        assert.equal(game.u.uhp,100);assert.deepEqual(getRngLog(),ordinaryCalls.slice(0,2));
    });
    assert.equal(game.u.uhp,98);assert.deepEqual(getRngLog(),ordinaryCalls);
});
test('damage feedback suspends after one reduced dose and before attack completion', async () => {
    const {run,mon}=await prepare({intrinsic:true,showdamage:true});
    assert.ok(boolean_option('showdamage'));
    await pending(run,/HP -2, 98 left/,()=>mattacku(mon),()=>{
        assert.equal(game.u.uhp,98);assert.deepEqual(getRngLog(),ordinaryCalls);
    });
    assert.equal(game.u.uhp,98);
});
for (const half of [false,true]) test(`Death permanent-damage path uses the already reduced amount, half=${half}`, async () => {
    const {mon}=await prepare({monster:P.PM_DEATH,intrinsic:half,magicResistance:true,hp:200});
    await mattacku(mon);
    assert.match(messages(), /life force draining away/);
    assert.ok(game.u.uhpmax<200); assert.equal(game.u.uhp,game.u.uhpmax);
    assert.equal(game.u.umortality || 0,0);
    const calls=getRngLog();
    // At level one with max HP above 25, C permanently removes each full
    // applied dose. Its extra permanent-damage sample is still drawn first.
    let expected=0, expectedBounds=[];
    for (let i=0;i<calls.length;i++) if (calls[i].startsWith('d(8,8)=')) {
        const raw=Number(calls[i].split('=')[1]);
        const effect=calls.slice(i+1).find(c=>c.startsWith('rn2(20)='));
        if (Number(effect?.split('=')[1])<5) continue;
        const applied=half ? Math.floor((raw+1)/2):raw;
        expected+=applied;expectedBounds.push(`rn2(${Math.floor(applied/2)+1})=`);
    }
    assert.equal(game.u.uhp,200-expected);
    for(const prefix of expectedBounds) assert.ok(calls.some(c=>c.startsWith(prefix)),prefix);
});
