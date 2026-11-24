// C pager.c:657-803 through public descriptions and actual glyph producers.
// Constructed state controls establish source contracts, not native input reach.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, form, clearMessages, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {do_screen_description, self_lookat} from '../js/pager.js';
import {makemon} from '../js/makemon.js';
import {gulpmu, expels} from '../js/mhitu.js';
import {mksobj_at} from '../js/mkobj.js';
import {m_at} from '../js/mon.js';
import {newsym, glyph_at} from '../js/display.js';
import {make_blinded, make_hallucinated, set_itimeout} from '../js/potion.js';
import {Blind, Hallucination, Halluc_resistance} from '../js/youprop.js';
import {christen_monst, mon_nam, rndmonnam, distant_monnam} from '../js/do_name.js';
import {mon_set_minvis} from '../js/worn.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES, ATTKS} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG, ARTICLE_NONE} from '../js/const.js';

const monsterFlags = NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG;
const describe = (xx = x + 1, yy = y, looked = true, sym = 0) =>
    do_screen_description({x:xx, y:yy}, looked, sym);

async function monster(id = PMNAMES.PM_GRID_BUG) {
    const mon = await makemon(game.mons[id], x + 1, y, monsterFlags);
    assert.ok(mon);
    newsym(mon.mx, mon.my);
    return mon;
}

async function engulfed() {
    await setup();
    game.u.uhp = game.u.uhpmax = 120;
    const mon = await monster(PMNAMES.PM_FOG_CLOUD);
    const attack = mon.data.mattk.find(a => a[0] === ATTKS.AT_ENGL);
    assert.ok(attack);
    await gulpmu(mon, attack);
    assert.equal(game.u.uswallow, 1);
    assert.equal(game.u.ustuck, mon);
    assert.ok(game.u.uswldtim > 0 && game.u.uhp > 0);
    assert.equal(m_at(x, y), mon);
    clearMessages();
    return mon;
}

async function statue(hallucinating = false) {
    await setup();
    const obj = mksobj_at(ONAMES.STATUE, x + 1, y, false, false);
    obj.corpsenm = PMNAMES.PM_GRID_BUG;
    if (hallucinating) await make_hallucinated(100, false);
    newsym(x + 1, y);
    assert.equal(m_at(x + 1, y), null);
    assert.ok(game.level.objectsAt(x + 1, y).includes(obj));
    assert.equal(Hallucination(), hallucinating);
    assert.equal(glyph_at(x + 1, y).kind, hallucinating ? 'mon' : 'obj');
    return obj;
}

// Rewind only the test RNG context, then compare the actual naming helper's
// display draws to the public caller. No helper or renderer is replaced.
function sampled(fn, value = 2) {
    seed(value);
    game.dispCtx = null;
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__rng_log_disp');
    try {
        globalThis.__rng_log_disp = true;
        const result = fn();
        assert.equal(typeof result?.then, 'undefined', 'description remains synchronous');
        const calls = getRngLog().map(entry => entry.replace(/\s+@\s*.*$/, ''));
        return {result, calls};
    } finally {
        if (previous) Object.defineProperty(globalThis, '__rng_log_disp', previous);
        else delete globalThis.__rng_log_disp;
    }
}

for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]])
test(`real engulf producer, interior at offset ${dx},${dy}`, async () => {
    const mon = await engulfed();
    assert.equal(glyph_at(x + dx, y + dy).kind, 'swallow');
    const {result, calls} = sampled(() => describe(x + dx, y + dy));
    assert.equal(result.firstmatch, 'interior of the fog cloud');
    assert.ok(result.out_str.includes('(interior of the fog cloud)'));
    assert.equal(result.pm, mon.data);
    assert.deepEqual(calls, []);
});

test('blind swallowed hero still feels the specific engulfer', async () => {
    const mon = await engulfed();
    await make_blinded(100, false);
    assert.equal(Blind(), true);
    const {result, calls} = sampled(() => describe());
    assert.equal(result.firstmatch, 'interior of the fog cloud');
    assert.equal(result.pm, mon.data);
    assert.deepEqual(calls, []);
});

test('invisible engulfer uses mon_nam suppression, not an invisible adjective', async () => {
    const mon = await engulfed();
    mon_set_minvis(mon, false);
    assert.equal(mon.minvis, 1);
    const result = describe();
    assert.equal(result.firstmatch, 'interior of the fog cloud');
    assert.equal(result.pm, mon.data);
});

test('real christening preserves engulfer proper-name article rules', async () => {
    const mon = await engulfed();
    christen_monst(mon, 'Mist');
    assert.equal(mon_nam(mon), 'Mist');
    const result = describe();
    assert.equal(result.firstmatch, 'interior of Mist');
    assert.equal(result.pm, mon.data);
});

test('hallucinated engulfer samples mon_nam and suppresses the real species', async () => {
    const mon = await engulfed();
    await make_hallucinated(100, false);
    assert.equal(Hallucination(), true);
    const expected = sampled(() => mon_nam(mon));
    const actual = sampled(() => describe());
    assert.ok(expected.calls.length >= 2);
    assert.equal(actual.result.firstmatch, `interior of ${expected.result}`);
    assert.deepEqual(actual.calls, expected.calls);
    assert.equal(actual.result.pm, null);
});

test('blind hallucinated engulf lookup keeps the same name and draw contract', async () => {
    const mon = await engulfed();
    await make_hallucinated(100, false);
    await make_blinded(100, false);
    const expected = sampled(() => mon_nam(mon), 19);
    const actual = sampled(() => describe(), 19);
    assert.equal(actual.result.firstmatch, `interior of ${expected.result}`);
    assert.deepEqual(actual.calls, expected.calls);
    assert.equal(actual.result.pm, null);
});

test('distant swallowed lookup bypasses naming, including hallucination draws', async () => {
    await engulfed();
    await make_hallucinated(100, false);
    for (const [dx, dy] of [[-2,0],[2,0],[0,-2],[0,2],[2,2]]) {
        const {result, calls} = sampled(() => describe(x + dx, y + dy));
        assert.equal(result.firstmatch, 'unreconnoitered');
        assert.equal(result.pm, null);
        assert.deepEqual(calls, []);
    }
});

test('swallowed center retains self description before the interior branch', async () => {
    await engulfed();
    const {result, calls} = sampled(() => describe(x, y));
    assert.equal(result.firstmatch, self_lookat());
    assert.equal(result.pm, null);
    assert.deepEqual(calls, []);
});

test('typed symbol does not inspect the current engulfer', async () => {
    await engulfed();
    const {result, calls} = sampled(() => describe(x + 1, y, false, '/'));
    assert.ok(!result.firstmatch.includes('fog cloud'));
    assert.ok(!result.out_str.includes('interior of the fog cloud'));
    assert.equal(result.pm, null);
    assert.deepEqual(calls, []);
});

test('real expulsion removes the interior description route', async () => {
    const mon = await engulfed();
    await expels(mon, mon.data, false);
    assert.ok(!game.u.uswallow);
    assert.equal(game.u.ustuck, null);
    assert.ok(!describe().firstmatch.startsWith('interior of '));
});

test('sober statue retains object naming and no species pointer or name draw', async () => {
    await statue();
    const {result, calls} = sampled(() => describe());
    assert.equal(result.firstmatch, 'a statue of a grid bug');
    assert.equal(result.pm, null);
    assert.deepEqual(calls, []);
});

for (const value of [2, 7, 19])
test(`hallucinated statue uses rndmonnam from display RNG seed ${value}`, async () => {
    await statue(true);
    assert.equal(glyph_at(x + 1, y).hallucinated_statue, true);
    const expected = sampled(() => rndmonnam(null), value);
    const actual = sampled(() => describe(), value);
    assert.ok(expected.calls.length >= 2);
    assert.equal(actual.result.firstmatch, expected.result);
    assert.ok(actual.result.out_str.includes(`(${expected.result})`));
    assert.equal(actual.result.pm, null);
    assert.deepEqual(actual.calls, expected.calls);
});

test('repeated statue queries each sample a name without changing its glyph', async () => {
    const obj = await statue(true);
    const glyph = structuredClone(glyph_at(x + 1, y));
    const expected = sampled(() => [rndmonnam(null), rndmonnam(null)]);
    const actual = sampled(() => [describe().firstmatch, describe().firstmatch]);
    assert.deepEqual(actual, expected);
    assert.deepEqual(glyph_at(x + 1, y), glyph);
    assert.equal(obj.corpsenm, PMNAMES.PM_GRID_BUG);
});

test('hallucination expiry restores the statue object branch', async () => {
    await statue(true);
    await make_hallucinated(0, false);
    newsym(x + 1, y);
    assert.equal(glyph_at(x + 1, y).kind, 'obj');
    assert.equal(describe().firstmatch, 'a statue of a grid bug');
});

test('a real monster is named through its existing helper, with species suppressed under hallucination', async () => {
    await setup();
    const mon = await monster();
    await make_hallucinated(100, false);
    newsym(mon.mx, mon.my);
    assert.equal(m_at(mon.mx, mon.my), mon);
    const expected = sampled(() => distant_monnam(mon, ARTICLE_NONE));
    const actual = sampled(() => describe(mon.mx, mon.my));
    assert.equal(actual.result.firstmatch, expected.result);
    assert.deepEqual(actual.calls, expected.calls);
    assert.equal(actual.result.pm, null);
});

test('sober real monster retains its actual species pointer', async () => {
    await setup();
    const mon = await monster();
    assert.equal(describe().pm, mon.data);
});

test('real resistant form and monster detection retain species despite the stored timer', async () => {
    await setup();
    const mon = await monster();
    await make_hallucinated(100, false);
    form(PMNAMES.PM_BLACK_LIGHT);
    set_itimeout('HDetect_monsters', 100);
    assert.ok(game.u.intrinsic.HHallucination > 0);
    assert.equal(Halluc_resistance(), true);
    assert.equal(Hallucination(), false);
    newsym(mon.mx, mon.my);
    const {result, calls} = sampled(() => describe());
    assert.equal(result.pm, mon.data);
    assert.deepEqual(calls, []);
});

test('ordinary hallucinated object does not enter the monster-without-m_at branch', async () => {
    await setup();
    mksobj_at(ONAMES.ROCK, x + 1, y, false, false);
    await make_hallucinated(100, false);
    newsym(x + 1, y);
    assert.equal(glyph_at(x + 1, y).kind, 'obj');
    const {result, calls} = sampled(() => describe());
    assert.equal(result.pm, null);
    // C pager.c:311 mksobj(FALSE), then mkobj.c:521 next_ident(): one core
    // rnd(2) for the temporary mapped object. There is no display name draw.
    assert.deepEqual(calls, ['rnd(2)=2']);
});
