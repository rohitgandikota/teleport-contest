// Constructed C mhitu.c:29-143 contracts. Normal runtime APIs, no helper replacements.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, clearMessages, messages, form} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {mpickobj} from '../js/steal.js';
import {oname} from '../js/do_name.js';
import {setworn} from '../js/worn.js';
import {Blindf_on} from '../js/do_wear.js';
import {make_blinded, make_deaf, set_itimeout} from '../js/potion.js';
import {Blind, Deaf} from '../js/youprop.js';
import {hitmsg, missmu, mswings, mswings_verb, getmattk, could_seduce, mattacku} from '../js/mhitu.js';
import {mhitm_ad_phys} from '../js/uhitm.js';
import {mon_wield_item} from '../js/weapon.js';
import {mon_set_minvis} from '../js/worn.js';
import {glyph_is_invisible_at, canspotmon} from '../js/display.js';
import {set_occupation} from '../js/allmain.js';
import {dosearch} from '../js/detect.js';
import {cmdq_add_key, cmdq_peek} from '../js/cmd.js';
import {msgtype_parse_add} from '../js/options.js';
import {getRngLog, rn2} from '../js/rng.js';
import {PMNAMES as P, ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare(species = P.PM_ORC) {
    const run = await setup();
    const mon = await makemon(game.mons[species], 32, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    Object.assign(mon, {mux:31, muy:10, mpeaceful:0});
    game.flags.accessiblemsg = true;
    game.iflags.getpos_coords = 'm';
    game.hitmsg_mid = 0; game.hitmsg_prev = null;
    clearMessages(); seed();
    return {run, mon};
}
async function weapon(mon, type, quantity = 1) {
    const obj = mksobj(type, false, false);
    obj.quan = quantity;
    await mpickobj(mon, obj);
    mon.weapon_check = C.NEED_HTH_WEAPON;
    await mon_wield_item(mon);
    assert.equal(mon.mw, obj);
    clearMessages(); seed();
    return obj;
}
async function eyes() {
    const obj = await oname(mksobj(O.LENSES, false, false), 'The Eyes of the Overworld');
    assert.ok(obj.oartifact);
    await addinv(obj);
    return obj;
}
function attack(mon, kind) {
    const index = mon.data.mattk.findIndex(a => a[0] === kind);
    assert.ok(index >= 0);
    return {a:mon.data.mattk[index], index};
}

const verbs = [
    [P.PM_NEWT, A.AT_BITE, /bites!/],
    [P.PM_PONY, A.AT_KICK, /kicks!/],
    [P.PM_KILLER_BEE, A.AT_STNG, /stings!/],
    [P.PM_MINOTAUR, A.AT_BUTT, /butts!/],
    [P.PM_GHOST, A.AT_TUCH, /touches you!/],
    [P.PM_MIND_FLAYER, A.AT_TENT, /'s tentacles suck your brain!/],
    [P.PM_BLACK_LIGHT, A.AT_EXPL, /explodes!/],
    [P.PM_GAS_SPORE, A.AT_BOOM, /explodes!/],
    [P.PM_ORC, A.AT_WEAP, /hits!/],
];
for (const [species, kind, ending] of verbs) test(`located hit verb: ${species}/${kind}`, async () => {
    const {mon} = await prepare(species);
    const {a, index} = attack(mon, kind);
    await hitmsg(mon, a, index);
    assert.match(messages(), /^\n?<32,10>: /);
    assert.match(messages(), ending);
    assert.equal(game.hitmsg_mid, mon.m_id);
    assert.deepEqual(game.hitmsg_prev, {indx:index, aatyp:kind, alternate:false});
    assert.deepEqual(getRngLog(), []);
});
test('thick-skinned hero retains harmless kick punctuation', async () => {
    const {mon} = await prepare(P.PM_PONY);
    form(P.PM_STONE_GOLEM); clearMessages(); seed();
    await hitmsg(mon, mon.data.mattk[0], 0);
    assert.match(messages(), /<32,10>: The pony kicks\.$/);
    assert.deepEqual(getRngLog(), []);
});

const sight = [
    ['sighted', 'smiles at'], ['timed', 'talks to'], ['blindfold', 'talks to'],
    ['eyeless form', 'talks to'], ['Eyes over timer', 'smiles at'],
    ['blind and deaf', 'touches'], ['deaf only', 'smiles at'],
    ['timer producer boundary', 'talks to'], ['eyewear producer boundary', 'talks to'],
    ['Eyes producer boundary', 'smiles at'],
];
for (const [mode, verb] of sight) test(`seduction uses canonical blindness: ${mode}`, async () => {
    const {mon} = await prepare(P.PM_WATER_NYMPH);
    if (['timed', 'Eyes over timer', 'Eyes producer boundary', 'blind and deaf'].includes(mode))
        await make_blinded(10, false);
    if (['blindfold', 'eyewear producer boundary'].includes(mode)) {
        const obj = await addinv(mksobj(O.BLINDFOLD, false, false));
        if (mode === 'blindfold') await Blindf_on(obj);
        else await setworn(obj, C.W_TOOL);
    }
    if (mode === 'eyeless form') form(P.PM_GELATINOUS_CUBE);
    if (mode === 'Eyes over timer') await Blindf_on(await eyes());
    if (mode === 'Eyes producer boundary') await setworn(await eyes(), C.W_TOOL);
    if (mode === 'timer producer boundary') set_itimeout('HBlinded', 10);
    if (mode === 'blind and deaf' || mode === 'deaf only') await make_deaf(10, false);
    // Direct producer boundaries are source controls, not ordinary combat reach claims.
    if (mode.endsWith('producer boundary')) {
        assert.notEqual(!!game.u.ublind, !!Blind());
        game.flags.accessiblemsg = false; // Isolate predicate repair from location feedback.
    }
    assert.equal(!!Blind(), verb !== 'smiles at');
    const a = mon.data.mattk[0], compat = could_seduce(mon, game.youmonst, a);
    assert.ok(compat === 1 || compat === 2);
    clearMessages(); seed();
    await hitmsg(mon, a, 0);
    if (game.flags.accessiblemsg) assert.match(messages(), /<32,10>: /);
    assert.ok(messages().includes(`${verb} you ${compat === 2 ? 'engagingly' : 'seductively'}.`), messages());
    assert.deepEqual(getRngLog(), []);
});
for (const field of ['mcan', 'mspec_used']) test(`seduction fallback when ${field} is set`, async () => {
    const {mon} = await prepare(P.PM_WATER_NYMPH); mon[field] = 1;
    await hitmsg(mon, mon.data.mattk[0], 0);
    assert.match(messages(), /<32,10>: The water nymph hits!/);
    assert.deepEqual(getRngLog(), []);
});
test('same-sex nymph compatibility selects engagingly', async () => {
    const {mon} = await prepare(P.PM_WATER_NYMPH);
    game.flags.female = true;
    assert.equal(could_seduce(mon, game.youmonst, mon.data.mattk[0]), 2);
    await hitmsg(mon, mon.data.mattk[0], 0);
    assert.match(messages(), /smiles at you engagingly\./);
});

for (const verbose of [false, true]) for (const near of [false, true])
test(`located miss near=${near} verbose=${verbose}`, async () => {
    const {mon} = await prepare(P.PM_NEWT); game.flags.verbose = verbose;
    await missmu(mon, near, mon.data.mattk[0]);
    assert.ok(messages().includes(`<32,10>: The newt ${near && verbose ? 'just ' : ''}misses!`));
    assert.equal(game.hitmsg_mid, 0); assert.equal(game.hitmsg_prev, null);
    assert.deepEqual(getRngLog(), []);
});
test('friendly miss ignores seduction cooldown but honors cancellation', async () => {
    const {mon} = await prepare(P.PM_WATER_NYMPH); mon.mspec_used = 1;
    await missmu(mon, true, mon.data.mattk[0]);
    assert.match(messages(), /<32,10>: The water nymph pretends to be friendly\./);
    mon.mcan = 1; clearMessages(); seed();
    await missmu(mon, true, mon.data.mattk[0]);
    assert.match(messages(), /<32,10>: The water nymph just misses!/);
    assert.deepEqual(getRngLog(), []);
});
test('unseen miss maps the real invisible glyph before feedback', async () => {
    const {mon} = await prepare(); mon_set_minvis(mon);
    assert.equal(canspotmon(mon), false);
    await missmu(mon, false, mon.data.mattk[0]);
    assert.equal(glyph_is_invisible_at(32,10), true);
    assert.match(messages(), /<32,10>: It misses!/);
});

for (const type of [O.BULLWHIP, O.DAGGER, O.LONG_SWORD, O.MACE])
test(`real wielded weapon swing ${type}`, async () => {
    const {mon} = await prepare(); const obj = await weapon(mon, type, 2);
    await mswings(mon, obj, false);
    assert.match(messages(), /<32,10>: The orc (lashes|thrusts|swings) one of his /);
    assert.deepEqual(getRngLog(), []);
});
for (const blocked of ['quiet', 'blind', 'invisible', 'undetected'])
test(`swing feedback gate: ${blocked}`, async () => {
    const {mon} = await prepare(); const obj = await weapon(mon, O.BULLWHIP);
    if (blocked === 'quiet') game.flags.verbose = false;
    if (blocked === 'blind') await make_blinded(10, false);
    if (blocked === 'invisible') mon_set_minvis(mon);
    if (blocked === 'undetected') mon.mundetected = 1;
    clearMessages(); seed(); await mswings(mon, obj, false);
    assert.equal(messages().trim(), ''); assert.deepEqual(getRngLog(), []);
});
for (const bash of [false, true]) test(`mixed-direction weapon draws before bash override=${bash}`, async () => {
    await prepare();
    const type = game.objects.findIndex(o => (o.oc_dir & 1) && (o.oc_dir & ~1) /* objclass.h:79 PIERCE */);
    assert.ok(type >= 0);
    const obj = mksobj(type, false, false);
    seed(); const draw = rn2(2), expected = [...getRngLog()];
    seed(); assert.equal(mswings_verb(obj, bash), bash ? 'bashes with' : draw ? 'swings' : 'thrusts');
    assert.deepEqual(getRngLog(), expected);
});
test('wet towel lash is a shared-helper contract, not a monster-wield claim', async () => {
    await prepare(); const obj = mksobj(O.TOWEL, false, false);
    obj.spe = 1; seed(); assert.equal(mswings_verb(obj, false), 'lashes');
    obj.spe = 0; assert.equal(mswings_verb(obj, false), 'swings');
    assert.deepEqual(getRngLog(), []);
});

test('consecutive actual owlbear attacks retain again; a miss clears it', async () => {
    const {mon} = await prepare(P.PM_OWLBEAR);
    const a0 = getmattk(mon, game.youmonst, 0, []);
    const a1 = getmattk(mon, game.youmonst, 1, [C.M_ATTK_HIT]);
    await hitmsg(mon, a0, 0); await hitmsg(mon, a1, 1);
    assert.match(messages(), /hits again!/);
    await missmu(mon, false, a0); clearMessages();
    await hitmsg(mon, a1, 1); assert.doesNotMatch(messages(), /again/);
});
test('actual getmattk substitute suppresses again without changing its adjacency contract', async () => {
    const {mon} = await prepare(P.PM_FAMINE);
    const a0 = getmattk(mon, game.youmonst, 0, []);
    const a1 = getmattk(mon, game.youmonst, 1, [C.M_ATTK_HIT]);
    assert.equal(a1.getmattk_alternate, true); assert.equal(a1[1], A.AD_STUN);
    await hitmsg(mon, a0, 0); clearMessages(); await hitmsg(mon, a1, 1);
    assert.doesNotMatch(messages(), /again/);
    assert.equal(game.hitmsg_prev.alternate, true);
});
test('accessibility off preserves plain owner messages and consumes location', async () => {
    const {mon} = await prepare(); const obj = await weapon(mon, O.BULLWHIP);
    game.flags.accessiblemsg = false;
    await hitmsg(mon, mon.data.mattk[0], 0);
    await missmu(mon, false, mon.data.mattk[0]);
    await mswings(mon, obj, false);
    assert.doesNotMatch(messages(), /<32,10>/);
    assert.match(messages(), /The orc hits!/); assert.match(messages(), /The orc misses!/);
    assert.match(messages(), /The orc lashes his bullwhip\./);
    assert.deepEqual(game.a11y.msg_loc, {x:0, y:0});
});

async function atMore(run, action, inspect) {
    let entered, release, complete = false;
    const reached = new Promise(resolve => { entered = resolve; });
    run._display.onEmptyQueue = () => { entered(); return new Promise(resolve => { release = resolve; }); };
    const pending = action().then(value => { complete = true; return value; });
    let timer;
    try {
        await Promise.race([reached, pending.then(() => { throw Error('message never waited'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('More timeout')), 2000); })]);
        await setImmediate(); assert.equal(complete, false); inspect();
    } finally {
        clearTimeout(timer); run._display.onEmptyQueue = () => 32;
        release?.(32); await pending;
    }
    assert.equal(complete, true);
}
test('real physical-damage caller waits for hit feedback before hitflags and history advance', async () => {
    const {run, mon} = await prepare(P.PM_NEWT);
    assert.ok(msgtype_parse_add('stop "bites"'));
    const mhm = {damage:1, hitflags:C.M_ATTK_MISS, done:false, indx:0};
    await atMore(run, () => mhitm_ad_phys(mon, mon.data.mattk[0], game.youmonst, mhm), () => {
        assert.match(game._toplines, /<32,10>: The newt bites!/);
        assert.equal(game.hitmsg_mid, 0); assert.equal(game.hitmsg_prev, null);
        assert.equal(mhm.hitflags, C.M_ATTK_MISS);
    });
    assert.equal(mhm.hitflags, C.M_ATTK_HIT); assert.equal(game.hitmsg_mid, mon.m_id);
});
test('seductive feedback also waits before committing attack history', async () => {
    const {run, mon} = await prepare(P.PM_WATER_NYMPH);
    assert.ok(msgtype_parse_add('stop "seductively"'));
    await atMore(run, () => hitmsg(mon, mon.data.mattk[0], 0), () => {
        assert.match(game._toplines, /<32,10>: The water nymph smiles/);
        assert.equal(game.hitmsg_mid, 0); assert.equal(game.hitmsg_prev, null);
    });
    assert.equal(game.hitmsg_mid, mon.m_id);
});
test('miss feedback clears prior hit immediately but delays occupation and queue cleanup', async () => {
    const {run, mon} = await prepare(P.PM_NEWT);
    await hitmsg(mon, mon.data.mattk[0], 0); clearMessages();
    set_occupation(dosearch, 'searching', 0); cmdq_add_key(C.CQ_CANNED, 's');
    assert.ok(msgtype_parse_add('stop "misses"'));
    await atMore(run, () => missmu(mon, false, mon.data.mattk[0]), () => {
        assert.match(game._toplines, /<32,10>: The newt misses!/);
        assert.equal(game.hitmsg_mid, 0); assert.equal(game.hitmsg_prev, null);
        assert.equal(game.occupation, dosearch); assert.ok(cmdq_peek(C.CQ_CANNED));
    });
    assert.equal(game.occupation, null); assert.equal(cmdq_peek(C.CQ_CANNED), null);
    assert.match(messages(), /You stop searching\./);
});
test('swing feedback returns only after its real More acknowledgement', async () => {
    const {run, mon} = await prepare(); const obj = await weapon(mon, O.BULLWHIP);
    assert.ok(msgtype_parse_add('stop "lashes"'));
    await atMore(run, () => mswings(mon, obj, false), () => {
        assert.match(game._toplines, /<32,10>: The orc lashes his bullwhip\./);
        assert.deepEqual(getRngLog(), []); assert.equal(mon.mw, obj);
    });
});
test('actual mattacku pauses at swing before to-hit RNG and hero damage', async () => {
    const {run, mon} = await prepare(); const obj = await weapon(mon, O.BULLWHIP);
    const hp = game.u.uhp, oldRoll = game.mhitu_dieroll;
    assert.ok(msgtype_parse_add('stop "lashes"'));
    await atMore(run, () => mattacku(mon), () => {
        assert.match(game._toplines, /<32,10>: The orc lashes his bullwhip\./);
        assert.equal(game.u.uhp, hp); assert.equal(game.mhitu_dieroll, oldRoll);
        assert.ok(!getRngLog().some(call => call.startsWith('rnd(20)=')));
        assert.equal(mon.mw, obj);
    });
    assert.ok(getRngLog().some(call => call.startsWith('rnd(20)=')));
});

test('real see-invisible property restores swing feedback for an invisible monster', async () => {
    const {mon} = await prepare(); const obj = await weapon(mon, O.BULLWHIP);
    mon_set_minvis(mon);
    assert.equal(canspotmon(mon), false);
    set_itimeout('HSee_invisible', 10);
    assert.equal(canspotmon(mon), true);
    clearMessages(); seed(); await mswings(mon, obj, false);
    assert.match(messages(), /<32,10>: The invisible orc lashes his bullwhip\./);
    assert.deepEqual(getRngLog(), []);
});
