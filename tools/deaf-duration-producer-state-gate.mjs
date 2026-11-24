// Complete C contracts: potion.c:443, eat.c:1813, timeout.c:1847.
// Constructed source controls with real producers, not native coverage.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {make_deaf} from '../js/potion.js';
import {doeat} from '../js/eat.js';
import {do_storms, fall_asleep, nh_timeout} from '../js/timeout.js';
import {dopray} from '../js/pray.js';
import {mksobj, curse} from '../js/mkobj.js';
import {addinv, obj_extract_self} from '../js/invent.js';
import {resetInputState, pushKeys} from '../js/input.js';
import {set_occupation} from '../js/allmain.js';
import {pline} from '../js/display.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {Deaf, Unaware} from '../js/youprop.js';
import {ONAMES} from '../js/objects_data.js';
import {ROOM, CLOUD, TIMEOUT, COLNO, ROWNO, ECMD_TIME, PARANOID_PRAY} from '../js/const.js';

function seed(value = 1) { initRng(value); enableRngLog(); }
function clearMessages() {
    game._toplines = ''; game._msg_history = []; game._toplin = 0;
    game._pending_message = ''; game._win_stop = false; game.iflags.last_msg = 0;
}
const messages = () => [...game._msg_history, game._toplines].join('\n');
const hdeaf = () => game.u.intrinsic.HDeaf || 0;
async function setup(old = 0, conduct = false) {
    const run = await runSegment({seed:99812, datetime:'20000110090000', moves:' ',
        nethackrc:'OPTIONS=name:Desired,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
            + (conduct ? 'OPTIONS=deaf\n' : ''), storage:new InMemoryStorage()});
    let reads = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++reads < 30, 'bounded message acknowledgments');
        return 32;
    };
    game._preNhgetchHook = null; resetInputState();
    game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) await obj_extract_self(obj);
    game.level.traps = []; game.regions = []; game.timer_base = [];
    game.u.ux = 31; game.u.uy = 10;
    for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++)
        Object.assign(game.level.at(x, y), {typ:ROOM, lit:1, waslit:1, seenv:255, roomno:0});
    await make_deaf(old, false);
    clearMessages(); game.disp.botl = false; seed();
    return run;
}
async function apple(cursed = true) {
    const obj = mksobj(ONAMES.APPLE, false, false);
    if (cursed) await curse(obj);
    addinv(obj); pushKeys(obj.invlet);
    return obj;
}
function storm() {
    game.level.flags.stormy = true;
    game.level.at(game.u.ux, game.u.uy).typ = CLOUD;
    seed(14);
}

for (const value of [0, 1, TIMEOUT, TIMEOUT + 1, 2147483648, -1]) {
    test(`make_deaf clamps long ${value} but uses the raw argument for its transition`, async () => {
        await setup();
        assert.equal(await make_deaf(value, false), undefined);
        assert.equal(hdeaf(), Math.min(TIMEOUT, Math.max(0, value)));
        assert.equal(!!game.disp.botl, value !== 0);
        // Feedback flushes status and consumes botl. Check that flag before
        // feedback, then independently check the raw-argument message rule.
        await make_deaf(0, false); clearMessages();
        assert.equal(await make_deaf(value, true), undefined);
        assert.equal(messages(), value !== 0 ? 'You are unable to hear anything.' : '');
        assert.deepEqual(getRngLog(), []);
    });
}
for (const conduct of [false, true]) {
    test(`timed expiry clears its duration and preserves deaf conduct=${conduct}`, async () => {
        await setup(1, conduct);
        await nh_timeout();
        assert.equal(hdeaf(), 0);
        assert.equal(Deaf(), conduct);
        assert.equal(messages(), conduct ? 'You are unable to hear anything.' : 'You can hear again.');
        assert.deepEqual(getRngLog(), []);
    });
}
test('ordinary extension and repeated clearing produce no transition feedback', async () => {
    await setup(10); await make_deaf(20, true);
    assert.equal(hdeaf(), 20); assert.equal(messages(), '');
    assert.equal(game.disp.botl, false);
    await make_deaf(0, false); clearMessages(); game.disp.botl = false;
    await make_deaf(0, true);
    assert.equal(hdeaf(), 0); assert.equal(messages(), '');
    assert.equal(game.disp.botl, false); assert.deepEqual(getRngLog(), []);
});
test('real sleep suppresses make_deaf feedback without suppressing the timer change', async () => {
    await setup(10); await fall_asleep(-3, true);
    assert.equal(Unaware(), true);
    clearMessages(); seed(); await make_deaf(0, true);
    assert.equal(hdeaf(), 0); assert.equal(messages(), '');
    assert.equal(game.disp.botl, true); assert.deepEqual(getRngLog(), []);
});

const foodRng = [];
for (const old of [0, 30, TIMEOUT - 5, TIMEOUT]) {
    test(`actual cursed-apple fainting adds only capped timeout bits from ${old}`, async () => {
        await setup(old); const obj = await apple(); seed();
        assert.equal(await doeat(), ECMD_TIME);
        const draws = [...getRngLog()]; foodRng.push(draws);
        assert.deepEqual(draws, ['rn2(4)=1', 'rn2(4)=2', 'rn2(3)=0', 'rnd(10)=10']);
        assert.equal(hdeaf(), Math.min(TIMEOUT, old + 10));
        assert.equal(hdeaf() & ~TIMEOUT, 0);
        assert.equal(game.multi, -10);
        assert.equal(game.multi_reason, 'unconscious from rotten food');
        assert.equal(game.nomovemsg, 'You are conscious again.');
        assert.equal(typeof game.afternmv, 'function');
        assert.equal(obj.orotten, true);
        assert.match(messages(), /The world spins and goes dark\./);
        assert.deepEqual(draws, foodRng[0], 'saturation does not add or remove random calls');
    });
}
for (const [kind, value, message] of [
    ['harmless', 0, /Blecch!  Rotten food!/],
    ['confusion', 5, /rather light headed/],
    ['blindness', 7, /Everything suddenly goes dark/],
]) {
    test(`rotten-food ${kind} arm leaves the existing deaf timeout alone`, async () => {
        await setup(TIMEOUT); await apple(); seed(value);
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(hdeaf(), TIMEOUT);
        assert.match(messages(), message);
        assert.doesNotMatch(messages(), /world spins/);
        // C fprefx's cursed-apple arm then sleeps without adding HDeaf.
        assert.equal(game.multi_reason, 'sleeping');
        assert.ok(game.multi < 0);
    });
}
test('fresh uncursed apple never enters rottenfood or adds deafness', async () => {
    await setup(TIMEOUT); await apple(false); seed();
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(hdeaf(), TIMEOUT);
    assert.doesNotMatch(messages(), /Blecch|world spins/);
});

const stormRng = [];
for (const old of [0, 30, TIMEOUT - 5, TIMEOUT]) {
    test(`real thunder adds only capped timeout bits from ${old}`, async () => {
        await setup(old); storm();
        assert.equal(await do_storms(), undefined);
        const draws = [...getRngLog()]; stormRng.push(draws);
        assert.equal(draws[0], 'rn2(8)=0');
        const duration = 30 + Number(draws.at(-1).match(/^rn2\(20\)=(\d+)$/)?.[1]);
        assert.ok(duration >= 30 && duration <= 49);
        assert.equal(hdeaf(), Math.min(TIMEOUT, old + duration));
        assert.equal(hdeaf() & ~TIMEOUT, 0);
        assert.equal(game.multi, -3);
        assert.equal(game.multi_reason, 'hiding from thunderstorm');
        assert.equal(game.nomovemsg, 0);
        assert.match(messages(), /Kaboom!!!  Boom!!  Boom!!/);
        assert.deepEqual(draws, stormRng[0], 'saturation does not change strikes or duration RNG');
    });
}
test('non-stormy level returns without RNG, timeout or occupation changes', async () => {
    await setup(30);
    const occupation = async () => 1;
    set_occupation(occupation, 'waiting', 0);
    await do_storms();
    assert.equal(hdeaf(), 30); assert.deepEqual(getRngLog(), []);
    assert.equal(game.occupation, occupation); assert.equal(messages(), '');
});
test('failed storm frequency draw leaves the cloud and timer unchanged', async () => {
    await setup(30); storm(); seed(1); await do_storms();
    assert.equal(getRngLog().length, 1);
    assert.notEqual(getRngLog()[0], 'rn2(8)=0');
    assert.equal(hdeaf(), 30); assert.equal(game.multi, 0); assert.equal(messages(), '');
});
test('successful storm outside a cloud gives rumbling without deafness or paralysis', async () => {
    await setup(); game.level.flags.stormy = true; seed(14);
    await do_storms();
    assert.equal(getRngLog()[0], 'rn2(8)=0');
    assert.equal(hdeaf(), 0); assert.equal(game.multi, 0);
    assert.match(messages(), /You hear a rumbling noise/);
    assert.doesNotMatch(messages(), /Kaboom/);
});
test('real prayer invulnerability preserves the prayer while thunder still adds its timeout', async () => {
    await setup(TIMEOUT);
    game.flags.paranoia_bits = PARANOID_PRAY;
    pushKeys('y y');
    await dopray();
    assert.ok(game.u.uinvulnerable);
    const after = game.afternmv;
    assert.equal(game.multi, -3); assert.equal(game.multi_reason, 'praying');
    clearMessages(); storm();
    await do_storms();
    assert.equal(hdeaf(), TIMEOUT); assert.equal(game.multi, -3);
    assert.equal(game.afternmv, after); assert.equal(game.multi_reason, 'praying');
    assert.equal(game.nomovemsg, 'You finish your prayer.');
    assert.match(messages(), /Kaboom/);
});

for (const kind of ['make_deaf', 'storm']) {
    test(`${kind} keeps its C timer/message ordering across a delayed acknowledgement`, async () => {
        const old = kind === 'make_deaf' ? 0 : TIMEOUT;
        const run = await setup(old);
        if (kind === 'storm') storm();
        await pline('A pending message which must be acknowledged before the next feedback.');
        let release, notify, held = false;
        const entered = new Promise(resolve => { notify = resolve; });
        run._display.onEmptyQueue = () => {
            if (held) return 32;
            held = true;
            return new Promise(resolve => { release = resolve; notify(); });
        };
        seed(kind === 'storm' ? 14 : 1);
        const operation = kind === 'make_deaf' ? make_deaf(2147483648, true) : do_storms();
        try {
            assert.equal(await Promise.race([entered.then(() => 'prompt'), operation.then(() => 'complete')]), 'prompt');
            assert.equal(hdeaf(), kind === 'make_deaf' ? TIMEOUT : old,
                'make_deaf writes before feedback; storm writes after it');
            assert.equal(game.multi, 0);
        } finally {
            if (release) release(32);
            await operation;
        }
        assert.equal(hdeaf(), TIMEOUT);
        assert.equal(game.multi, kind === 'storm' ? -3 : 0);
    });
}
