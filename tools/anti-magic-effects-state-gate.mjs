// C trap.c:2347-2450, through real form, timeout, equipment and trap producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, clearMessages, messages, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {polymon, rehumanize} from '../js/polyself.js';
import {incr_itimeout, make_blinded} from '../js/potion.js';
import {nh_timeout} from '../js/timeout.js';
import {Antimagic, Half_physical_damage, Half_spell_damage} from '../js/youprop.js';
import {maketrap} from '../js/mklev.js';
import {dotrap, mintrap, Trap_Effect_Finished, Trap_Killed_Mon} from '../js/trap.js';
import {makemon} from '../js/makemon.js';
import {mon_set_minvis, m_dowear} from '../js/worn.js';
import {mksobj} from '../js/mkobj.js';
import {mpickobj} from '../js/steal.js';
import {mlifesaver} from '../js/mon.js';
import {resists_magm} from '../js/mondata.js';
import {getRngLog} from '../js/rng.js';
import {set_msg_xy} from '../js/pline.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function hero({form = null, timed = false, half = '', expired = false, reverted = false}) {
    await setup();
    if (form !== null) assert.equal(await polymon(form), 1);
    if (timed) incr_itimeout('HAntimagic', expired ? 1 : 30);
    if (half === 'physical' || half === 'both') incr_itimeout('HHalf_physical_damage', 30);
    if (half === 'spell' || half === 'both') incr_itimeout('HHalf_spell_damage', 30);
    if (expired) await nh_timeout();
    if (reverted) await rehumanize();
    const resistant = !expired && !reverted
        && (timed || [P.PM_GRAY_DRAGON, P.PM_BABY_GRAY_DRAGON].includes(form));
    assert.equal(Antimagic(), resistant);
    assert.equal(Half_physical_damage(), ['physical','both'].includes(half));
    assert.equal(Half_spell_damage(), ['spell','both'].includes(half));
    assert.ok(!game.u.uprops.ANTIMAGIC && !game.u.uprops.HALF_PHDAM
        && !game.u.uprops.HALF_SPDAM, 'real canonical producers have no extrinsic equipment');
    game.u.uhp = game.u.uhpmax = game.u.mh = game.u.mhmax = 100;
    game.u.uen = game.u.uenmax = 100;
    const trap = await maketrap(game.u.ux, game.u.uy, C.ANTI_MAGIC);
    clearMessages(); seed();
    assert.equal(await dotrap(trap, C.FORCETRAP), Trap_Effect_Finished);
    const calls = getRngLog(), rolls = resistant ? 1 + Number(!!half) : 0;
    assert.equal(calls.length, rolls + 2, 'one additional damage roll for either or both half protections');
    let damage = 0;
    for (const call of calls.slice(0, rolls)) {
        assert.match(call, /^rnd\(4\)=\d$/); damage += Number(call.split('=')[1]);
    }
    assert.match(calls[rolls], /^d\(2,6\)=\d+$/);
    assert.match(calls[rolls+1], /^rnd\(\d+\)=\d+$/);
    const hp = form !== null && !reverted ? game.u.mh : game.u.uhp;
    assert.equal(hp, 100 - damage);
    assert.equal(100-game.u.uen + 100-game.u.uenmax, Number(calls[rolls].split('=')[1]));
    assert.ok(trap.tseen);
}
for (const options of [
    {form:P.PM_GRAY_DRAGON}, {form:P.PM_BABY_GRAY_DRAGON},
    {form:P.PM_GRAY_DRAGON,half:'physical'}, {form:P.PM_GRAY_DRAGON,half:'spell'},
    {form:P.PM_GRAY_DRAGON,half:'both'}, {timed:true}, {timed:true,half:'both'},
    {timed:true,expired:true}, {form:P.PM_GRAY_DRAGON,reverted:true},
    {form:P.PM_BLUE_DRAGON}, {half:'both'},
]) test(`hero canonical properties: ${JSON.stringify(options)}`, () => hero(options));

async function monster(species = P.PM_KOBOLD_SHAMAN) {
    await setup();
    const mon = await makemon(game.mons[species], x + 1, y,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    mon.mhp = mon.mhpmax = 100;
    mon.mspec_used = 0;
    const trap = await maketrap(mon.mx, mon.my, C.ANTI_MAGIC);
    trap.tseen = trap.madeby_u = 0;
    return {mon, trap};
}
for (const [accessible, blind, invisible] of [
    [true,false,false], [false,false,false], [true,true,false], [true,false,true],
]) test(`monster energy feedback: accessible=${accessible}, blind=${blind}, invisible=${invisible}`, async () => {
    const {mon, trap} = await monster();
    game.flags.accessiblemsg = accessible;
    if (blind) await make_blinded(10, false);
    if (invisible) mon_set_minvis(mon, false);
    clearMessages(); seed(); set_msg_xy(x-1,y);
    assert.equal(await mintrap(mon, C.FORCETRAP), Trap_Effect_Finished);
    assert.equal(getRngLog().length, 1);
    assert.match(getRngLog()[0], /^d\(2,6\)=/);
    assert.equal(mon.mspec_used, Number(getRngLog()[0].split('=')[1]));
    assert.equal(mon.mhp, 100);
    if (blind || invisible) {
        assert.equal(messages().trim(), '');
        assert.equal(trap.tseen, 0);
    } else {
        assert.ok(messages().includes('The kobold shaman seems lethargic.'));
        assert.equal(messages().includes('(east): The kobold shaman seems lethargic.'), accessible);
        assert.ok(!messages().includes('(west):'));
        assert.deepEqual(game.a11y.msg_loc, {x:0,y:0});
        assert.ok(trap.tseen);
    }
});

for (const [species, cancelled] of [[P.PM_KOBOLD_SHAMAN,true],[P.PM_LARGE_CAT,false]])
test(`monster energy guards: species=${species}, cancelled=${cancelled}`, async () => {
    const {mon, trap} = await monster(species);
    mon.mcan = cancelled; // Constructed source boundary, not an ordinary-input claim.
    clearMessages(); seed();
    assert.equal(await mintrap(mon, C.FORCETRAP), Trap_Effect_Finished);
    assert.deepEqual(getRngLog(), []);
    assert.equal(mon.mspec_used, 0);
    assert.equal(trap.tseen, 0);
    assert.equal(messages().trim(), '');
});

for (const [worn, genocided] of [[true,false],[false,false],[true,true]])
test(`resistant monster lethal damage: amulet worn=${worn}, genocided=${genocided}`, async () => {
    const {mon, trap} = await monster(P.PM_ORACLE);
    assert.equal(resists_magm(mon), true);
    const amulet = mksobj(O.AMULET_OF_LIFE_SAVING, false, false);
    await mpickobj(mon, amulet);
    if (worn) m_dowear(mon, true);
    assert.equal(mlifesaver(mon), worn ? amulet : null);
    // Explicitly constructed terminal-health and genocide boundaries.
    mon.mhp = 1;
    if (genocided) game.mvitals[P.PM_ORACLE].mvflags |= C.G_GENOD;
    const deaths = game.mvitals[P.PM_ORACLE].died || 0;
    clearMessages(); seed();
    const survives = worn && !genocided;
    assert.equal(await mintrap(mon, C.FORCETRAP), survives ? Trap_Effect_Finished : Trap_Killed_Mon);
    assert.equal(mon.mhp > 0, survives);
    assert.equal(game.level.monsters.includes(mon), survives);
    assert.equal(game.mvitals[P.PM_ORACLE].died || 0, deaths + Number(!survives));
    assert.match(getRngLog()[0], /^rnd\(4\)=/);
    if (survives) {
        assert.equal(mon.mhp, mon.mhpmax);
        assert.equal(mlifesaver(mon), null);
        assert.ok(!mon.minvent.includes(amulet));
        assert.ok(!game.level.objectsAt(mon.mx,mon.my).some(o=>o.otyp===O.CORPSE));
    }
});
