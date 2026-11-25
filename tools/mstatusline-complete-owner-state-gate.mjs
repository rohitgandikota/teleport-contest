// Constructed C insight.c:3275-3398 and worm.c:946-968 contracts.
// Actual runtime producers are used. These checks do not claim native reach.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, clearMessages, messages, mount, form, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {mstatusline} from '../js/insight.js';
import {makemon, place_monster, remove_monster} from '../js/makemon.js';
import {tamedog} from '../js/dog.js';
import {gain_guardian_angel} from '../js/minion.js';
import {mk_roamer, mon_aligntyp} from '../js/priest.js';
import {newcham, set_ustuck} from '../js/mon.js';
import {gulpmu} from '../js/mhitu.js';
import {probe_monster} from '../js/zap.js';
import {set_wounded_legs, heal_legs} from '../js/do.js';
import {digests, enfolds, is_animal, attacktype, sticks} from '../js/mondata.js';
import {getRngLog} from '../js/rng.js';
import * as worm from '../js/worm.js';
import {PMNAMES, ATTKS} from '../js/monst_data.js';
import {NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG, MM_NOTAIL, NON_PM,
    EDOG, LEFT_SIDE, RIGHT_SIDE, BOTH_SIDES, A_LAWFUL, A_NEUTRAL,
    A_CHAOTIC, A_NONE, STRAT_WAITMASK, MFAST} from '../js/const.js';

const flags = NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG;
const text = () => messages().replace(/\s+/g, ' ');
async function monster(id = PMNAMES.PM_NEWT, extra = 0, dx = 1) {
    const mon = await makemon(game.mons[id], x + dx, y, flags | extra);
    assert.ok(mon); game.bhitpos = {x:mon.mx,y:mon.my};
    game.notonhead = false;
    return mon;
}
async function status(mon) {
    clearMessages(); seed();
    // use_stethoscope starts at the hero coordinate for mount/engulfer calls.
    game.bhitpos ||= {x:game.u.ux,y:game.u.uy};
    const result = await mstatusline(mon);
    assert.equal(result, undefined);
    assert.deepEqual(getRngLog(), [], 'status adds no RNG for these nonhallucinating monsters');
    return text();
}
async function pet() {
    const mon = await monster(PMNAMES.PM_LITTLE_DOG);
    assert.ok(await tamedog(mon, null, false));
    assert.ok(EDOG(mon)); return mon;
}
async function segmentedWorm() {
    const mon = await monster(PMNAMES.PM_LONG_WORM, MM_NOTAIL);
    // The same canonical constructors used by creation with a nonzero tail.
    worm.initworm(mon, 3);
    worm.place_worm_tail_randomly(mon, mon.mx, mon.my);
    assert.equal(worm.count_wsegs(mon), 3);
    return mon;
}
function segments(mon) {
    const out = [];
    for (let seg=game.worms.wtails[mon.wormno];seg;seg=seg.nseg) out.push(seg);
    return out;
}

test('ordinary nonwizard monster retains plain status and no suffix draws', async () => {
    await setup(); game.wizard = false; const mon = await monster();
    assert.doesNotMatch(await status(mon), /hungry|apport|segment|shapechanger|holding|carrying|injured/);
});
test('tamedog produces the wizard tameness, hunger and apport values', async () => {
    await setup(); const mon = await pet(), dog = EDOG(mon);
    assert.match(await status(mon), new RegExp(`, tame \\(${mon.mtame}; hungry ${dog.hungrytime}; apport ${dog.apport}\\)`));
});
test('nonwizard pet omits wizard fields without hiding tameness', async () => {
    await setup(); const mon = await pet(); game.wizard = false;
    const line = await status(mon);
    assert.match(line, /, tame\./); assert.doesNotMatch(line, /hungry|apport|tame \(/);
});
test('real guardian minion reports tameness without an EDOG lookup', async () => {
    await setup(); await pet(); game.u.ualign.record = 20;
    await gain_guardian_angel();
    const mon = game.level.monsters.find(m => m.isminion && m.mtame);
    assert.ok(mon); assert.equal(EDOG(mon), undefined);
    assert.match(await status(mon), /, tame \(10\)/);
    assert.doesNotMatch(text(), /hungry|apport/);
});
test('peaceful untamed monster never gets wizard pet details', async () => {
    await setup(); const mon = await monster(); mon.mpeaceful = 1;
    assert.equal(mon.mtame, 0);
    assert.match(await status(mon), /, peaceful\./); assert.doesNotMatch(text(), /tame|hungry/);
});
test('MM_NOTAIL long worm reports its single head segment', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_LONG_WORM, MM_NOTAIL);
    assert.equal(worm.count_wsegs(mon), 0);
    assert.match(await status(mon), /, single segment/);
});
test('real long-worm size 7 maps to C gigantic, rather than the unused index 5', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_LONG_WORM, MM_NOTAIL);
    assert.equal(mon.data.msize,7);
    assert.match(await status(mon), /\(neutral, gigantic\)/);
    assert.doesNotMatch(text(), /unknown size/);
});
for (const [position, expected] of [[3,'1st'],[2,'2nd'],[1,'3rd'],[0,'4th']])
test(`real placed worm reports ${expected} at the selected coordinate`, async () => {
    await setup(); const mon = await segmentedWorm(), seg = segments(mon)[position];
    game.bhitpos = {x:seg.wx,y:seg.wy};
    assert.match(await status(mon), new RegExp(`, ${expected} of 4 segments`));
});
test('wseg_at rejects a missing worm and an ordinary monster synchronously', async () => {
    await setup(); const mon = await monster(); seed();
    assert.equal(worm.wseg_at(null,x,y),0);
    assert.equal(worm.wseg_at(mon,mon.mx,mon.my),0);
    assert.deepEqual(getRngLog(),[]);
});
test('wseg_at rejects a square owned by a different real monster', async () => {
    await setup(); const mon = await segmentedWorm(), other = await monster(PMNAMES.PM_NEWT,0,-3);
    seed(); assert.equal(worm.wseg_at(mon,other.mx,other.my),0); assert.deepEqual(getRngLog(),[]);
});
test('wseg_at returns zero when the map identity exists without a matching segment', async () => {
    await setup(); const mon = await segmentedWorm();
    // Explicit helper boundary, not an ordinary-state claim.
    game.level.monAt.set(`${x-3},${y}`,mon);
    seed(); assert.equal(worm.wseg_at(mon,x-3,y),0); assert.deepEqual(getRngLog(),[]);
});
test('save and restore preserve head/tail aliases and selected ordinals', async () => {
    await setup(); const mon = await segmentedWorm();
    const expected = segments(mon).map((s,i) => [s.wx,s.wy,4-i]);
    const saved = worm.save_worm();
    worm.remove_worm(mon); worm.rest_worm(saved);
    place_monster(mon,mon.mx,mon.my); worm.place_wsegs(mon,null); seed();
    for (const [xx,yy,n] of expected) assert.equal(worm.wseg_at(mon,xx,yy),n);
    assert.equal(segments(mon).at(-1),game.worms.wheads[mon.wormno]);
    assert.deepEqual(getRngLog(),[]);
});
test('moving a worm makes its former head the second segment', async () => {
    await setup(); const mon = await segmentedWorm(), old = {x:mon.mx,y:mon.my};
    remove_monster(mon.mx,mon.my); place_monster(mon,x+2,y);
    worm.worm_move(mon); seed();
    assert.equal(worm.wseg_at(mon,mon.mx,mon.my),1);
    assert.equal(worm.wseg_at(mon,old.x,old.y),2);
    assert.deepEqual(getRngLog(),[]);
});
test('shrinking removes only the old tail from ordinal lookup', async () => {
    await setup(); const mon = await segmentedWorm(), tail = segments(mon)[0];
    const at = {x:tail.wx,y:tail.wy}; worm.shrink_worm(mon.wormno); seed();
    assert.equal(worm.count_wsegs(mon),2);
    assert.equal(worm.wseg_at(mon,at.x,at.y),0);
    assert.equal(worm.wseg_at(mon,mon.mx,mon.my),1);
    assert.deepEqual(getRngLog(),[]);
});
test('wormgone leaves a valid tail-less monster status', async () => {
    await setup(); const mon = await segmentedWorm(); worm.wormgone(mon);
    place_monster(mon,mon.mx,mon.my); assert.equal(mon.wormno,0);
    assert.match(await status(mon), /, single segment/);
});
test('created chameleon exposes the changed form without naming its innate form', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_CHAMELEON);
    assert.equal(mon.cham,PMNAMES.PM_CHAMELEON);
    assert.notEqual(mon.data,game.mons[mon.cham]);
    assert.match(await status(mon), /, shapechanger/);
    assert.doesNotMatch(text(), /chameleon/);
});
test('newcham returning to the innate form removes shapechanger feedback', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_CHAMELEON);
    await newcham(mon,game.mons[mon.cham],0);
    assert.equal(mon.data,game.mons[mon.cham]);
    assert.doesNotMatch(await status(mon), /shapechanger/);
});
test('ordinary polymorph retains NON_PM and does not claim innate shapechanging', async () => {
    await setup(); const mon = await monster();
    await newcham(mon,game.mons[PMNAMES.PM_RED_MOLD],0);
    assert.equal(mon.cham,NON_PM); assert.equal(mon.data,game.mons[PMNAMES.PM_RED_MOLD]);
    assert.doesNotMatch(await status(mon), /shapechanger/);
});
test('set_ustuck with a nonsticky hero reports holding you', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_OWLBEAR); set_ustuck(mon);
    assert.equal(sticks(game.youmonst.data),false);
    assert.match(await status(mon), /, holding you\./);
});
test('sticky hero takes precedence when both forms are holders', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_OWLBEAR);
    form(PMNAMES.PM_LARGE_MIMIC); assert.equal(sticks(mon.data),true);
    assert.equal(sticks(game.youmonst.data),true); set_ustuck(mon);
    assert.match(await status(mon), /, held by you\./);
});
test('the held relationship applies only to the selected monster identity', async () => {
    await setup(); const mon = await monster(), holder = await monster(PMNAMES.PM_OWLBEAR,0,-2);
    set_ustuck(holder); assert.doesNotMatch(await status(mon), /holding|held by|engulfing|digesting/);
});
for (const [id, suffix] of [[PMNAMES.PM_PURPLE_WORM,'digesting you'],[PMNAMES.PM_TRAPPER,'engulfing you'],[PMNAMES.PM_FOG_CLOUD,'engulfing you']])
test(`real gulpmu producer yields ${suffix} for species ${id}`, async () => {
    await setup(); const mon = await monster(id); game.u.uhp = game.u.uhpmax = 200;
    const attack = mon.data.mattk.find(a => a[0] === ATTKS.AT_ENGL); assert.ok(attack);
    await gulpmu(mon,attack);
    assert.equal(game.u.ustuck,mon); assert.equal(game.u.uswallow,1);
    assert.ok((await status(mon)).includes(`, ${suffix}`));
});
test('swallowing takes precedence over a sticky hero source boundary', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_PURPLE_WORM);
    form(PMNAMES.PM_LARGE_MIMIC); set_ustuck(mon);
    // Explicit owner boundary, not a claim that this form can be engulfed.
    game.u.uswallow = 1;
    assert.match(await status(mon), /, digesting you\./);
    assert.doesNotMatch(text(), /held by you/);
});
test('all current animal engulfers digest or enfold, bounding the swallowing arm', async () => {
    await setup();
    const animals = game.mons.filter(m => is_animal(m) && attacktype(m,ATTKS.AT_ENGL));
    assert.ok(animals.length > 0);
    assert.deepEqual(animals.filter(m => !digests(m) && !enfolds(m)),[]);
});
for (const [side, noun] of [[LEFT_SIDE,'rear leg'],[RIGHT_SIDE,'rear leg'],[BOTH_SIDES,'rear legs'],[0,'rear leg']])
test(`mounted wounded legs use canonical form and side mask ${side}`, async () => {
    await setup(); await mount(); const mon = game.u.usteed;
    await set_wounded_legs(side,12);
    assert.ok(game.u.intrinsic.HWounded_legs);
    assert.ok((await status(mon)).includes(`, carrying you, injured ${noun}`));
});
test('extrinsic side alone still reports the steed injury', async () => {
    await setup(); await mount(); await set_wounded_legs(BOTH_SIDES,12);
    game.u.intrinsic.HWounded_legs = 0; // Explicit valid property boundary.
    assert.match(await status(game.u.usteed), /, carrying you, injured rear legs/);
});
test('heal_legs removes the injury while retaining the mount relation', async () => {
    await setup(); await mount(); await set_wounded_legs(BOTH_SIDES,12); await heal_legs(0);
    assert.match(await status(game.u.usteed), /, carrying you/); assert.doesNotMatch(text(), /injured/);
});
test('unmounted hero injuries are absent from monster status', async () => {
    await setup(); const mon = await monster(); await set_wounded_legs(BOTH_SIDES,12);
    assert.doesNotMatch(await status(mon), /carrying you|injured/);
});
for (const [alignment, word] of [[A_LAWFUL,'lawful'],[A_NEUTRAL,'neutral'],[A_CHAOTIC,'chaotic'],[A_NONE,'unaligned']])
test(`real roamer alignment ${word} overrides species alignment`, async () => {
    await setup(); const mon = await mk_roamer(game.mons[PMNAMES.PM_ALIGNED_CLERIC],alignment,x+1,y,true);
    assert.ok(mon); assert.equal(mon.isminion,1); assert.equal(mon_aligntyp(mon),alignment);
    assert.ok((await status(mon)).includes(`(${word}, `));
});
test('all existing impairment suffixes retain their C order after pet details', async () => {
    await setup(); const mon = await pet();
    // Valid concurrent owner state, deliberately independent of native reach.
    Object.assign(mon,{meating:2,mcan:1,mconf:1,mblinded:1,mstun:1,msleeping:1,
        mfrozen:3,mstrategy:STRAT_WAITMASK,mflee:1,mtrapped:1,mspeed:MFAST,minvis:1,mleashed:1});
    const line = await status(mon);
    assert.match(line, /tame \([^)]*\), eating, cancelled, confused, blind, stunned, asleep, scared, trapped, fast, invisible, leashed\./);
    assert.doesNotMatch(line, /can't move|meditating/);
});
test('real pet status More suspends probing before inventory continuation', async () => {
    await setup(); const mon = await pet(); clearMessages(); seed();
    const display = game.nhDisplay, previous = display.onEmptyQueue;
    let resume, signal, settled = false, reads = 0;
    const paused = new Promise(resolve => { signal = resolve; });
    display.onEmptyQueue = () => ++reads === 1
        ? new Promise(resolve => { resume = resolve; signal(); }) : 32;
    const pending = probe_monster(mon).finally(() => { settled = true; });
    try {
        await Promise.race([paused,pending.then(() => {throw Error('expected status More');})]);
        assert.equal(settled,false); assert.match(text(), /hungry/);
        assert.doesNotMatch(text(), /not carrying anything/);
        const draws = [...getRngLog()];
        await setImmediate(); await setImmediate();
        assert.equal(settled,false); assert.deepEqual(getRngLog(),draws);
        resume(32); await pending;
        assert.match(text(), /not carrying anything/);
    } finally {
        if (resume) resume(32);
        await pending; display.onEmptyQueue = previous;
    }
});
