// Constructed source boundaries, separate from ordinary-input reach evidence.
// Runtime helpers are real imports. Only fixture state and terminal input are set.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, form, clearMessages, messages}
    from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {throwit, toss_up} from '../js/dothrow.js';
import {mksobj} from '../js/mkobj.js';
import {addinv, freeinv, weight} from '../js/invent.js';
import {accessory_or_armor_on} from '../js/do_wear.js';
import {calc_capacity, near_capacity, weight_cap, exercise} from '../js/attrib.js';
import {rn2, getRngLog} from '../js/rng.js';
import {Blind} from '../js/youprop.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {A_STR, A_CON, A_INT, A_WIS, OBJ_FLOOR, OBJ_FREE, SLT_ENCUMBER}
    from '../js/const.js';

async function missile(otyp, quantity = 1) {
    const obj = mksobj(otyp, false, false);
    obj.quan = quantity;
    obj.owt = weight(obj);
    return await addinv(obj);
}

async function staminaFixture(options = {}) {
    const run = await setup();
    // Deliberate source boundaries, not an ordinary character-generation claim.
    game.u.acurr.a[A_STR] = game.u.acurr.a[A_CON] = 10;
    if (options.poly) form(PMNAMES.PM_HUMAN);
    if (options.air) game.u.uz = {...game.air_level};
    game.u.uhp = options.hp ?? 9; game.u.uhpmax = options.max ?? 12;
    game.u.mh = options.mh ?? 4; game.u.mhmax = options.mhmax ?? 12;
    const obj = await missile(options.light ? ONAMES.ROCK : ONAMES.CHEST);
    const cap = weight_cap();
    const total = options.capacityOne ? Math.ceil(cap * 1.5) - 1 : Math.ceil(cap * 1.5);
    // Gold has an actual, exact weight of one unit per hundred coins.
    const ballast = total - obj.owt;
    if (ballast > 0) await missile(ONAMES.GOLD_PIECE, ballast * 100);
    assert.equal(near_capacity(), options.capacityOne ? SLT_ENCUMBER : SLT_ENCUMBER + 1);
    const priorCapacity = near_capacity();
    await freeinv(obj);
    assert.equal(obj.where, OBJ_FREE);
    assert.equal(calc_capacity(obj.owt), options.capacityOne ? SLT_ENCUMBER : SLT_ENCUMBER + 1);
    game.u.dx = options.horizontal ? 1 : 0; game.u.dy = 0;
    game.u.dz = options.horizontal ? 0 : options.down ? 1 : -1;
    game.oldcap = options.retainedOldcap ? priorCapacity : near_capacity();
    clearMessages(); seed(2);
    return {run, obj};
}

for (const [name, options, drops] of [
    ['human HP 9', {}, true],
    ['human HP 10 boundary', {hp:10}, false],
    ['human full low HP', {hp:9,max:9}, false],
    ['one capacity unit', {capacityOne:true}, false],
    ['object weighs exactly twice HP', {hp:5,light:true}, false],
    ['object weighs more than twice HP', {hp:4,light:true}, true],
    ['already downward', {down:true}, false],
    ['horizontal redirects downward', {horizontal:true}, true],
    ['Plane of Air exception', {air:true}, false],
    ['temporary body HP 4', {poly:true,hp:12}, true],
    ['temporary body HP 5 boundary', {poly:true,mh:5,hp:1}, false],
    ['temporary body full low HP', {poly:true,mhmax:4,hp:1}, false],
]) {
    test(`stamina: ${name}`, async () => {
        const {obj} = await staminaFixture(options);
        const hp = options.poly ? game.u.mh : game.u.uhp;
        const exercise = game.u.aexe.a[A_CON];
        await throwit(obj, 0);
        assert.equal(messages().includes('drops from your grasp.'), drops);
        if (drops) {
            assert.deepEqual([game.u.dx,game.u.dy,game.u.dz], [0,0,1]);
            assert.equal(options.poly ? game.u.mh : game.u.uhp, hp);
            assert.equal(obj.ox, game.u.ux); assert.equal(obj.oy, game.u.uy);
            assert.ok(!messages().includes('ceiling'));
            if (options.poly) {
                assert.equal(game.u.aexe.a[A_CON], exercise);
                assert.ok(!getRngLog().some(s => s.startsWith('rn2(2)=')));
            } else {
                seed(2); const abuse = rn2(2);
                assert.equal(game.u.aexe.a[A_CON], exercise - abuse);
            }
        } else if (!options.down) {
            assert.match(messages(), /falls back on top of your/);
        }
        assert.equal(obj.where, OBJ_FLOOR);
        assert.equal(game.thrownobj, null);
        assert.equal(game.iflags.returning_missile, null);
    });
}

test('stamina message completes before direction, marker, exercise and floor changes', async () => {
    const {run, obj} = await staminaFixture();
    // Occupy the message line, forcing the new stamina message through More.
    game._toplines = 'A previous message fills the line.';
    game._toplin = 1;
    let release;
    let paused;
    const atPause = new Promise(resolve => { paused = resolve; });
    run._display.onEmptyQueue = () => {
        paused();
        return new Promise(resolve => { release = resolve; });
    };
    const exercise = game.u.aexe.a[A_CON];
    const thrown = game.thrownobj;
    const pending = throwit(obj, 0);
    try {
        await atPause;
        assert.equal(game.u.dz, -1);
        assert.equal(game.thrownobj, thrown);
        assert.equal(obj.where, OBJ_FREE);
        assert.equal(game.u.aexe.a[A_CON], exercise);
        assert.deepEqual(getRngLog(), []);
    } finally {
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        await pending;
    }
    assert.equal(game.u.dz, 1); assert.equal(obj.where, OBJ_FLOOR);
});

test('stamina waits for exercise encumbrance More before direction and ownership changes', async () => {
    const {run, obj} = await staminaFixture({retainedOldcap:true});
    const thrown = game.thrownobj;
    let release, signal;
    const paused = new Promise(resolve => { signal = resolve; });
    run._display.onEmptyQueue = () => {
        signal(); return new Promise(resolve => { release = resolve; });
    };
    const pending = throwit(obj, 0);
    try {
        await paused;
        assert.match(game._toplines, /drops from your grasp/);
        assert.equal(game.u.dz, -1);
        assert.equal(game.thrownobj, thrown);
        assert.equal(obj.where, OBJ_FREE);
        assert.equal(game.oldcap, SLT_ENCUMBER + 1);
    } finally {
        run._display.onEmptyQueue = () => 32;
        release?.(32); await pending;
    }
    assert.equal(game.u.dz, 1); assert.equal(obj.where, OBJ_FLOOR);
    assert.equal(game.oldcap, near_capacity());
});

test('exercise intelligence remains a synchronous no-op', async () => {
    await setup(); seed(2);
    assert.equal(exercise(A_INT, false), undefined);
    assert.deepEqual(getRngLog(), []);
});
test('temporary body constitution exercise remains a synchronous no-op', async () => {
    await setup(); form(PMNAMES.PM_HUMAN); seed(2);
    assert.equal(exercise(A_CON, false), undefined);
    assert.deepEqual(getRngLog(), []);
});
test('wisdom exercise remains synchronous with the original abuse draw', async () => {
    await setup(); seed(2); const draw = rn2(2), expected = [...getRngLog()]; seed(2);
    const old = game.u.aexe.a[A_WIS];
    assert.equal(exercise(A_WIS, false), undefined);
    assert.equal(game.u.aexe.a[A_WIS], old - draw);
    assert.deepEqual(getRngLog(), expected);
});
test('constitution at move zero remains synchronous without encumbrance feedback', async () => {
    await setup(); game.moves = 0; seed(2);
    const draw = rn2(2), expected = [...getRngLog()]; seed(2);
    const old = game.u.aexe.a[A_CON];
    assert.equal(exercise(A_CON, false), undefined);
    assert.equal(game.u.aexe.a[A_CON], old - draw);
    assert.deepEqual(getRngLog(), expected);
});

for (const erosion of [0,3]) {
    test(`crystal armor hits roof at erosion ${erosion}: return and ownership`, async () => {
        await setup();
        const obj = await missile(ONAMES.CRYSTAL_PLATE_MAIL);
        await freeinv(obj); obj.oeroded = erosion;
        game.thrownobj = obj;
        const hp = game.u.uhp;
        // A seed qualifies the real obj_resists draw; no draw is replaced.
        let selected;
        for (let n = 1; n <= 100; n++) {
            seed(n); if (rn2(100) >= 90) { selected = n; break; }
        }
        assert.ok(selected); seed(selected); clearMessages();
        const survived = await toss_up(obj, true);
        assert.equal(survived, erosion === 0);
        assert.equal(game.u.uhp, hp);
        assert.ok(!messages().includes('falls back on top'));
        if (survived) {
            assert.ok(obj.oeroded >= 1); assert.equal(obj.where, OBJ_FLOOR);
            assert.equal(game.thrownobj, null);
        } else assert.ok(!game.level.objects.includes(obj));
        assert.ok(getRngLog()[0].startsWith('rn2(100)='));
    });
}

for (const blindfold of [false,true]) {
    test(`cream on face with blindfold ${blindfold}: real blindness predicate`, async () => {
        await setup();
        if (blindfold) await accessory_or_armor_on(await missile(ONAMES.BLINDFOLD));
        assert.equal(Blind(), blindfold);
        const obj = await missile(ONAMES.CREAM_PIE); await freeinv(obj);
        seed(2); clearMessages();
        assert.equal(await toss_up(obj, false), false);
        assert.equal(!!game.u.ucreamed, !blindfold);
        assert.equal(getRngLog().filter(s => s.startsWith('rnd(25)=')).length, blindfold ? 0 : 1);
        assert.ok(!game.level.objects.includes(obj));
        assert.match(messages(), /all over your face/);
    });
}
