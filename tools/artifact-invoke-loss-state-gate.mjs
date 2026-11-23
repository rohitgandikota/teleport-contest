// Constructed C contracts, separate from ordinary-input/native evidence.
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mkobj.js';
import { invoke_property, set_artifact_intrinsic } from '../js/artifact.js';
import { addinv, freeinv_core, freeinv, obj_extract_self, useup, useupall } from '../js/invent.js';
import { delobj, delobj_core } from '../js/mon.js';
import { dropx, drop } from '../js/do.js';
import { in_container } from '../js/pickup.js';
import { drop_upon_death } from '../js/bones.js';
import { poly_obj } from '../js/zap.js';
import { nhl_gamestate_save } from '../js/nhlua.js';
import { ART_ORB_OF_DETECTION, ART_HEART_OF_AHRIMAN, ART_SCEPTRE_OF_MIGHT } from '../js/artilist_data.js';
import { ONAMES } from '../js/objects_data.js';
import { Levitation, Flying } from '../js/youprop.js';
import { initRng, enableRngLog, getRngLog, rnz, d } from '../js/rng.js';
import { W_ART, W_ARTI, W_WEP, W_RINGL, W_AMUL, FROMOUTSIDE, I_SPECIAL,
    OBJ_FREE, OBJ_FLOOR, OBJ_INVENT, OBJ_CONTAINED, OBJ_DELETED,
    ROOM, IN_SIGHT, COULD_SEE, TT_PIT, TT_INFLOOR, ECMD_TIME } from '../js/const.js';

const cases = [
    ['INVIS', 'HInvis', ART_ORB_OF_DETECTION, ONAMES.CRYSTAL_BALL],
    ['LEVITATION', 'HLevitation', ART_HEART_OF_AHRIMAN, ONAMES.LUCKSTONE],
    ['CONFLICT', 'HConflict', ART_SCEPTRE_OF_MIGHT, ONAMES.MACE],
];
const initial = { seed: 6202, datetime: '20000110090000', moves: ' ',
    nethackrc: 'OPTIONS=name:Control,role:Barbarian,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' };
let prompts, refreshed;
const priorHooks = ['__invokedLossPause', '__invokedLossNewsym'].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
afterEach(() => {
    for (const [key, descriptor] of priorHooks) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
    }
});
async function setup() {
    const run = await runSegment({ ...initial, storage: new InMemoryStorage() });
    prompts = []; refreshed = [];
    run._display.onEmptyQueue = () => {
        const text = game.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd();
        prompts.push(text);
        if (prompts.length > 50) throw Error('unexpected repeated prompt');
        return text.includes('--More--') ? 32 : 27;
    };
    game._preNhgetchHook = null;
    game.invent = []; game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) obj_extract_self(obj);
    game.level.traps = []; game.regions = []; game.timer_base = [];
    game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
    for (const key of ['uwep','uswapwep','uquiver','uarm','uarmc','uarmh','uarmg',
        'uarms','uarmf','uarmu','ublindf','uamul','uleft','uright','uball','uchain','usteed','ustuck']) game.u[key] = null;
    game.u.ublind = 0; game.u.uswallow = false; game.u.uinwater = false;
    game.u.utrap = 0; game.u.ux = 31; game.u.uy = 10;
    game.u.uhp = game.u.uhpmax = 200; game.moves = 100;
    game.u.ushops = ''; game.u.urooms = ''; game.u.twoweap = false;
    game.gmst = null; game.gmst_stored = false;
    for (let x = 26; x <= 36; x++) for (let y = 5; y <= 15; y++) {
        Object.assign(game.level.at(x,y), { typ: ROOM, lit: 1, waslit: 1, seenv: 255, roomno: 0 });
        game.viz_array[y][x] = IN_SIGHT | COULD_SEE;
    }
    game.disp.botl = false; game._toplines = ''; game._msg_history = []; game._toplin = 0;
    game._pending_message = ''; game._win_stop = false;
    globalThis.__invokedLossNewsym = (x,y) => {
        if (x === game.u.ux && y === game.u.uy) refreshed.push([x,y]);
    };
}
function seed() { initRng(71); enableRngLog(); }
function expectedCooldown() { seed(); const value = rnz(100), calls = [...getRngLog()]; seed(); return { value, calls }; }
function messages() { return [...prompts, ...game._msg_history, game._toplines].join('\n'); }
async function object(c = cases[0]) {
    const obj = mksobj(c[3], false, false); obj.oartifact = c[2]; obj.age = 0;
    await addinv(obj); refreshed = []; return obj;
}

for (const c of cases) for (const on of [true, false]) {
    const [prop, intrinsic] = c;
    test(`${prop} ${on ? 'on' : 'off'} follows the ordinary C branch`, async () => {
        await setup(); const obj = await object(c);
        game.u.uprops[prop] = on ? 0 : W_ARTI;
        const expected = expectedCooldown();
        assert.equal(await invoke_property(obj, prop), ECMD_TIME);
        assert.equal(game.u.uprops[prop] || 0, on ? W_ARTI : 0);
        assert.equal(game.u.intrinsic[intrinsic] || 0, 0);
        assert.equal(obj.age, on ? 0 : game.moves + expected.value);
        assert.deepEqual(getRngLog(), on ? [] : expected.calls);
        if (prop === 'INVIS') {
            assert.deepEqual(refreshed, [[game.u.ux, game.u.uy]]);
            assert.match(messages(), on ? /strange transparency/ : /seems to unfade/);
        } else if (prop === 'CONFLICT') assert.match(messages(), on ? /rabble-rouser/ : /tension decrease/);
        else assert.match(messages(), on ? /start to float/ : /float gently/);
    });
    for (const other of ['intrinsic', 'extrinsic']) test(`${prop} ${on ? 'on' : 'off'} preserves another ${other} source`, async () => {
        await setup(); const obj = await object(c);
        game.u.uprops[prop] = (on ? 0 : W_ARTI) | (other === 'extrinsic' ? W_RINGL : 0);
        game.u.intrinsic[intrinsic] = other === 'intrinsic' ? FROMOUTSIDE : 0;
        const expected = expectedCooldown();
        await invoke_property(obj, prop);
        assert.equal(game.u.uprops[prop] || 0, (on ? W_ARTI : 0) | (other === 'extrinsic' ? W_RINGL : 0));
        assert.equal(game.u.intrinsic[intrinsic], other === 'intrinsic' ? FROMOUTSIDE : 0);
        assert.equal(obj.age, on ? 0 : game.moves + expected.value);
        assert.deepEqual(getRngLog(), on ? [] : expected.calls);
        assert.match(messages(), /surge of power/); assert.doesNotMatch(messages(), /transparency|unfade|rabble|tension|float/);
        assert.deepEqual(refreshed, []);
    });
}
for (const c of cases) test(`${c[0]} rejected activation restores mask and extends cooldown after feedback`, async () => {
    await setup(); const obj = await object(c); obj.age = game.moves + 10;
    game.u.uprops[c[0]] = W_RINGL;
    seed(); const delta = d(3,10), expected = [...getRngLog()]; seed();
    await invoke_property(obj, c[0]);
    assert.equal(obj.age, game.moves + 10 + delta); assert.equal(game.u.uprops[c[0]], W_RINGL);
    assert.match(messages(), /ignoring you/); assert.deepEqual(getRngLog(), expected);
    assert.deepEqual(refreshed, []);
});
for (const mode of ['blind', 'blocked', 'hallucinating']) for (const on of [true,false]) {
    test(`invisibility ${on ? 'on' : 'off'} while ${mode}`, async () => {
        await setup(); const obj = await object(); game.u.uprops.INVIS = on ? 0 : W_ARTI;
        if (mode === 'blind') game.u.intrinsic.HBlinded = 10;
        if (mode === 'blocked') game.u.blocked.INVIS = W_WEP;
        if (mode === 'hallucinating') game.u.intrinsic.HHallucination = game.u.uprops.HALLUC = 10;
        const expected = expectedCooldown(); await invoke_property(obj, 'INVIS');
        assert.equal(game.u.uprops.INVIS || 0, on ? W_ARTI : 0);
        assert.deepEqual(getRngLog(), on ? [] : expected.calls);
        if (mode === 'hallucinating') {
            assert.match(messages(), on ? /normal transparency/ : /unfade/);
            assert.deepEqual(refreshed, [[game.u.ux,game.u.uy]]);
        } else {
            assert.match(messages(), /surge of power/); assert.doesNotMatch(messages(), /transparency|unfade/);
            assert.deepEqual(refreshed, []);
        }
    });
}
for (const mode of ['pit', 'floor trap', 'flight and hallucination']) test(`levitation calls full float_up: ${mode}`, async () => {
    await setup(); const obj = await object(cases[1]);
    if (mode === 'pit') { game.u.utrap = 7; game.u.utraptype = TT_PIT; }
    if (mode === 'floor trap') { game.u.utrap = 7; game.u.utraptype = TT_INFLOOR; }
    if (mode === 'flight and hallucination') {
        game.u.uprops.FLYING = W_AMUL;
        game.u.intrinsic.HHallucination = game.u.uprops.HALLUC = 10;
        assert.equal(Flying(), true);
    }
    seed(); await invoke_property(obj, 'LEVITATION');
    assert.equal(game.disp.botl, true); assert.deepEqual(getRngLog(), []);
    if (mode === 'pit') { assert.equal(game.u.utrap, 0); assert.match(messages(), /float up, out of/); }
    if (mode === 'floor trap') {
        assert.equal(game.u.utrap, 7); assert.ok(game.u.blocked.LEVITATION & I_SPECIAL);
        assert.equal(Levitation(), false); assert.match(messages(), /legs are still stuck/);
    }
    if (mode === 'flight and hallucination') {
        assert.match(messages(), /walking on air/); assert.match(messages(), /no longer able to control your flight/);
        assert.equal(Flying(), false); assert.ok(game.u.blocked.FLYING & I_SPECIAL);
    }
});

for (const c of cases) test(`${c[0]} setter removes only active carried invocation`, async () => {
    await setup(); const obj = await object(c);
    game.invent = []; obj.where = OBJ_FREE; game.u.uprops[c[0]] = W_ARTI;
    const expected = expectedCooldown(), pending = set_artifact_intrinsic(obj, false, W_ART);
    assert.equal(typeof pending?.then, 'function'); await pending;
    assert.equal(game.u.uprops[c[0]] || 0, 0); assert.equal(obj.age, game.moves + expected.value);
    assert.deepEqual(getRngLog(), expected.calls);
});
for (const [name,on,mask,active] of [
    ['adding carried effects',true,W_ART,true], ['removing worn effects',false,W_WEP,true],
    ['combined noncarry mask',false,W_ART|W_WEP,true], ['inactive invocation',false,W_ART,false],
]) test(`setter stays synchronous for ${name}`, async () => {
    await setup(); const obj = await object(); game.u.uprops.INVIS = active ? W_ARTI : 0;
    seed(); const result = set_artifact_intrinsic(obj,on,mask);
    assert.equal(result,undefined); assert.equal(game.u.uprops.INVIS || 0,active ? W_ARTI : 0);
    assert.equal(obj.age,0); assert.deepEqual(getRngLog(),[]);
});
test('ordinary inventory loss does not affect another artifact invocation', async () => {
    await setup(); await object(); game.u.uprops.INVIS = W_ARTI;
    const ordinary = mksobj(ONAMES.DAGGER,false,false); await addinv(ordinary);
    seed(); assert.equal(freeinv(ordinary),undefined);
    assert.equal(game.u.uprops.INVIS,W_ARTI); assert.deepEqual(getRngLog(),[]);
});
for (const action of ['freeinv_core','freeinv','obj_extract_self','useupall','useup','delobj','delobj_core']) {
    for (const artifact of [false,true]) test(`${action} keeps ${artifact ? 'inactive artifact' : 'ordinary object'} synchronous`, async () => {
        await setup(); const obj = await object(); if (!artifact) obj.oartifact = 0;
        let value;
        if (action === 'freeinv_core') { game.invent = []; obj.where = OBJ_FREE; value = freeinv_core(obj); }
        if (action === 'freeinv') value = freeinv(obj);
        if (action === 'obj_extract_self') value = obj_extract_self(obj);
        if (action === 'useupall') value = useupall(obj);
        if (action === 'useup') value = useup(obj);
        if (action === 'delobj') value = delobj(obj);
        if (action === 'delobj_core') value = delobj_core(obj,false);
        assert.equal(value, undefined); assert.equal(typeof value?.then, 'undefined');
        assert.equal(obj.where, ['useupall','useup','delobj','delobj_core'].includes(action) ? OBJ_DELETED : OBJ_FREE);
    });
}

const tick = () => new Promise(resolve => setImmediate(resolve));
test('Heart freeinv_core tail waits before updating carried luck', async () => {
    await setup(); const obj = await object(cases[1]); game.u.uprops.LEVITATION = W_ARTI;
    game.u.moreluck = 3;
    let release;
    globalThis.__invokedLossPause = () => new Promise(resolve => { release=resolve; });
    const pending = freeinv(obj); await tick();
    assert.equal(typeof release,'function'); assert.equal(game.u.moreluck,3);
    assert.equal(obj.where,OBJ_FREE); assert.ok(!game.invent.includes(obj));
    release(ECMD_TIME); await pending; assert.equal(game.u.moreluck,0);
});
test('Orb carried effects clear before invoked invisibility completion', async () => {
    await setup(); const obj = await object(); game.u.uprops.INVIS = W_ARTI;
    assert.ok(game.u.uprops.TELEPAT & W_ART); assert.ok(game.u.uprops.HALF_SPDAM & W_ART);
    let release;
    globalThis.__invokedLossPause = () => new Promise(resolve => { release=resolve; });
    const pending = freeinv(obj); await tick();
    assert.equal(typeof release,'function'); assert.equal(game.u.uprops.TELEPAT || 0,0);
    assert.equal(game.u.uprops.HALF_SPDAM || 0,0);
    release(ECMD_TIME); await pending;
});
test('polymorph replaces the inventory node before awaiting old carried effects', async () => {
    await setup(); const obj = await object(); game.u.uprops.INVIS = W_ARTI;
    let release, finished=false;
    globalThis.__invokedLossPause = target => {
        assert.equal(target,obj); return new Promise(resolve => { release=resolve; });
    };
    const pending=poly_obj(obj,ONAMES.SACK); pending.then(()=>{finished=true;}); await tick();
    assert.equal(typeof release,'function'); assert.equal(finished,false);
    assert.equal(obj.where,OBJ_FREE); assert.ok(!game.invent.includes(obj));
    assert.ok(game.invent.some(o=>o.otyp===ONAMES.SACK));
    release(ECMD_TIME); const replacement=await pending;
    assert.equal(replacement.otyp,ONAMES.SACK); assert.equal(replacement.where,OBJ_INVENT);
});
for (const action of ['freeinv','obj_extract_self','useupall','useup','delobj_core','dropx','drop','in_container','death']) {
    test(`${action} completes invoked loss before the next ownership step`, async () => {
        await setup(); const obj = await object(); game.u.uprops.INVIS = W_ARTI;
        const bag = mksobj(ONAMES.SACK,false,false); await addinv(bag);
        game.current_container = bag;
        let release, entered = false;
        globalThis.__invokedLossPause = target => {
            if (target !== obj) return;
            entered = true; return new Promise(resolve => { release = resolve; });
        };
        const calls = { freeinv, obj_extract_self, useupall, useup,
            delobj_core: o => delobj_core(o,false), dropx, drop, in_container,
            death: () => drop_upon_death(null,null,game.u.ux,game.u.uy) };
        let finished = false; const pending = calls[action](obj);
        Promise.resolve(pending).then(() => { finished = true; });
        await tick(); assert.equal(entered,true); assert.equal(finished,false);
        assert.equal(obj.where,OBJ_FREE); assert.ok(!game.invent.includes(obj));
        assert.ok(!game.level.objects.includes(obj)); assert.ok(!(bag.cobj || []).includes(obj));
        release(ECMD_TIME); await pending;
        if (['useupall','useup','delobj_core'].includes(action)) assert.equal(obj.where,OBJ_DELETED);
        else if (['dropx','drop','death'].includes(action)) assert.equal(obj.where,OBJ_FLOOR);
        else if (action === 'in_container') { assert.equal(obj.where,OBJ_CONTAINED); assert.ok(bag.cobj.includes(obj)); }
        else assert.equal(obj.where,OBJ_FREE);
    });
}
test('tutorial storage waits for each active invocation before storing the next object', async () => {
    await setup(); const first = await object(), second = await object(cases[2]);
    game.u.uprops.INVIS = game.u.uprops.CONFLICT = W_ARTI;
    const entered = [], releases = [];
    globalThis.__invokedLossPause = obj => {
        entered.push(obj); return new Promise(resolve => { releases.push(resolve); });
    };
    const pending = nhl_gamestate_save(); await tick();
    assert.deepEqual(entered,[first]); assert.deepEqual(game.invent,[second]); assert.equal(game.gmst_stored,false);
    releases[0](ECMD_TIME); await tick();
    assert.deepEqual(entered,[first,second]); assert.equal(game.gmst_stored,false);
    releases[1](ECMD_TIME); await pending;
    assert.deepEqual(game.gmst.invent,[first,second]); assert.equal(game.gmst_stored,true);
});
