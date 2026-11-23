#!/usr/bin/env node
// Source-derived contracts for potion.c:369-440 and its direct callers.
// Real JS functions; no native-oracle or input-reachability claim.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { make_hallucinated, peffects } from '../js/potion.js';
import { nh_timeout } from '../js/timeout.js';
import { mksobj } from '../js/mkobj.js';
import { obj_extract_self } from '../js/invent.js';
import { Hallucination } from '../js/youprop.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { W_ARM, W_WEP, FROMFORM, TIMEOUT, M_AP_OBJECT,
    ROOM, IN_SIGHT, COULD_SEE } from '../js/const.js';
import { initRng, enableRngLog, getRngLog, rn1, rn2 } from '../js/rng.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url))).segments[0];
let prompts;
async function setup(sample = {}) {
    const run = await runSegment({ ...segment, moves: ' ', storage: new InMemoryStorage() });
    prompts = [];
    run._display.onEmptyQueue = () => {
        const text = game.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd();
        prompts.push(text);
        if (prompts.length > 30) throw Error('unexpected repeated prompt');
        return text.includes('--More--') ? 32 : 0x1b;
    };
    game._preNhgetchHook = null;
    game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
    game.u.intrinsic.HHallucination = game.u.uprops.HALLUC = sample.old || 0;
    game.u.intrinsic.HHalluc_resistance = sample.intrinsic || 0;
    game.u.uprops.HALLUC_RES = sample.extrinsic || 0;
    game.u.intrinsic.HBlinded = sample.blind ? 9 : 0;
    game.u.ublind = sample.blind ? 1 : 0;
    game.u.ublindf = null; game.u.uball = null; game.u.uchain = null;
    game.u.uswallow = false; game.u.ustuck = null; game.u.uswldtim = 0;
    game.u.uinvulnerable = false; game.u.uinwater = false; game.u.ucreamed = 0;
    game.u.usleep = 0; game.multi = 0;
    game.u.ux = 31; game.u.uy = 10; game.u.uhp = game.u.uhpmax = 200;
    game.u.mtimedone = 0; game.u.usptime = 0;
    game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) obj_extract_self(obj);
    game.level.traps = []; game.regions = []; game.timer_base = []; game.invent = [];
    game.moves = 1; game.warn_obj_cnt = 0;
    game.eatmbuf = null; game.nomovemsg = null;
    game.youmonst.m_ap_type = 0; game.youmonst.mappearance = 0;
    for (let x = 26; x <= 36; x++) for (let y = 5; y <= 15; y++) {
        Object.assign(game.level.at(x, y), { typ: ROOM, lit: 1, waslit: 1, seenv: 255, roomno: 0 });
        game.viz_array[y][x] = IN_SIGHT | COULD_SEE;
    }
    if (sample.eyeless) {
        game.u.umonnum = PMNAMES.PM_YELLOW_LIGHT;
        game.youmonst.data = game.mons[PMNAMES.PM_YELLOW_LIGHT];
        game.u.intrinsic.HBlinded = FROMFORM; game.u.ublind = 1;
    }
    if (sample.unaware) { game.multi = -3; game.u.usleep = 1; }
    game.disp.botl = false;
    game._toplines = ''; game._msg_history = []; game._toplin = 0;
    game._pending_message = ''; game._win_stop = false;
}
function messages() { return [...prompts, ...game._msg_history, game._toplines].join('\n'); }
function seed(value = 3) { initRng(value); enableRngLog(); }
function noDraws() { assert.deepEqual(getRngLog(), []); }
function timer() { return game.u.intrinsic.HHallucination || 0; }
function alias() { return game.u.uprops.HALLUC || 0; }

const transitions = [
    { name: 'start without resistance', next: 7, changed: true, hallucinating: true, text: /Oh wow! Everything looks so cosmic!/ },
    { name: 'end without resistance', old: 7, next: 0, changed: true, hallucinating: false, text: /Everything looks SO boring now/ },
    { name: 'extend without resistance', old: 7, next: 12, changed: false, hallucinating: true },
    { name: 'zero remains zero', next: 0, changed: false, hallucinating: false },
    { name: 'intrinsic resistance does not gate C changed', intrinsic: FROMFORM, next: 7, changed: true, hallucinating: false, text: /Oh wow! Everything looks so cosmic!/ },
    { name: 'intrinsic resistance still announces the end', intrinsic: FROMFORM, old: 7, next: 0, changed: true, hallucinating: false, text: /Everything looks SO boring now/ },
    { name: 'extrinsic resistance hides start', extrinsic: W_WEP, next: 7, changed: false, hallucinating: false },
    { name: 'hidden expiry flattens vision', extrinsic: W_WEP, old: 7, next: 0, changed: false, hallucinating: false, text: /vision seems to flatten for a moment but is normal now/ },
    { name: 'hidden expiry while blind itches', extrinsic: W_WEP, blind: true, old: 7, next: 0, changed: false, hallucinating: false, text: /eyes momentarily itch/ },
    { name: 'hidden expiry without eyes feels strange', extrinsic: W_WEP, eyeless: true, old: 7, next: 0, changed: false, hallucinating: false, text: /strange feeling/ },
    { name: 'hidden expiry unaware is quiet', extrinsic: W_WEP, unaware: true, old: 7, next: 0, changed: false, hallucinating: false },
    { name: 'hidden expiry talk false is quiet', extrinsic: W_WEP, talk: false, old: 7, next: 0, changed: false, hallucinating: false },
    { name: 'hidden extension is quiet', extrinsic: W_WEP, old: 7, next: 12, changed: false, hallucinating: false },
    { name: 'blind visible transition uses feels', blind: true, next: 7, changed: true, hallucinating: true, text: /Oh wow! Everything feels so cosmic!/ },
];
for (const sample of transitions) test(sample.name, async () => {
    await setup(sample); seed();
    assert.equal(await make_hallucinated(sample.next, sample.talk !== false, 0), sample.changed);
    assert.equal(timer(), sample.next); assert.equal(alias(), sample.next);
    assert.equal(Hallucination(), sample.hallucinating);
    const text = messages().replace(/\s+/g, ' ').trim();
    if (sample.text) assert.match(text, sample.text); else assert.equal(text, '');
    noDraws();
});

for (const sample of [
    { name: 'add resistance with an active timer', old: 7, next: 0, before: 0, after: W_ARM, changed: true, active: false },
    { name: 'remove resistance with an active timer', old: 7, next: 1, before: W_ARM, after: 0, changed: true, active: true },
    { name: 'add resistance with no timer', old: 0, next: 0, before: 0, after: W_ARM, changed: false, active: false },
    { name: 'remove resistance with no timer', old: 0, next: 1, before: W_ARM, after: 0, changed: false, active: false },
    { name: 'remove only one of two sources', old: 7, next: 1, before: W_ARM | W_WEP, after: W_WEP, changed: true, active: false },
    { name: 'mask change preserves intrinsic resistance', old: 7, next: 1, before: W_ARM, after: 0, intrinsic: FROMFORM, changed: true, active: false },
]) test(`mask: ${sample.name}`, async () => {
    await setup({ old: sample.old, extrinsic: sample.before, intrinsic: sample.intrinsic }); seed();
    assert.equal(await make_hallucinated(sample.next, false, W_ARM), sample.changed);
    assert.equal(timer(), sample.old); assert.equal(alias(), sample.old);
    assert.equal(game.u.uprops.HALLUC_RES || 0, sample.after);
    assert.equal(game.u.intrinsic.HHalluc_resistance, sample.intrinsic || 0);
    assert.equal(Hallucination(), sample.active); noDraws();
});

for (const [value, expected] of [[TIMEOUT, TIMEOUT], [TIMEOUT + 1, TIMEOUT], [-1, 0]]) {
    test(`set_itimeout contract: ${value} becomes ${expected}`, async () => {
        await setup({ extrinsic: W_WEP }); seed();
        assert.equal(await make_hallucinated(value, false, 0), false);
        assert.equal(timer(), expected); assert.equal(alias(), expected);
        assert.equal(Hallucination(), false); noDraws();
    });
}

for (const mode of ['end', 'resist', 'unrelated-message']) {
    test(`mimic cleanup: ${mode}`, async () => {
        await setup({ old: 7 });
        game.eatmbuf = 'Your rind escaped intact.';
        game.nomovemsg = mode === 'unrelated-message' ? 'A different deferred message.' : game.eatmbuf;
        game.youmonst.m_ap_type = M_AP_OBJECT; game.youmonst.mappearance = ONAMES.ORANGE;
        game.multi = -8;
        seed(); await make_hallucinated(0, false, mode === 'resist' ? W_ARM : 0);
        assert.equal(Hallucination(), false);
        if (mode === 'unrelated-message') {
            assert.equal(game.youmonst.mappearance, ONAMES.ORANGE);
            assert.equal(game.eatmbuf, 'Your rind escaped intact.');
            assert.equal(game.nomovemsg, 'A different deferred message.');
        } else {
            assert.equal(game.youmonst.mappearance, ONAMES.GOLD_PIECE);
            assert.equal(game.eatmbuf, 'You now prefer mimicking yourself.');
            assert.equal(game.nomovemsg, game.eatmbuf);
        }
        assert.equal(game.multi, -8); noDraws();
    });
}

for (const [name, sample, feedback] of [
    ['extrinsic', { extrinsic: W_WEP }, /flatten/],
    ['intrinsic', { intrinsic: FROMFORM }, /SO boring/],
    ['unaware extrinsic', { extrinsic: W_WEP, unaware: true }, null],
]) test(`timeout caller: ${name}`, async () => {
    await setup({ ...sample, old: 1 });
    const occupation = () => 1; game.occupation = occupation; game.occtxt = 'searching';
    seed(); await nh_timeout();
    assert.equal(timer(), 0); assert.equal(alias(), 0);
    assert.equal(Hallucination(), false);
    assert.ok(!game.occupation, 'C stops occupation on expiry even when resistance already hid the timer');
    if (feedback) assert.match(messages(), feedback);
    else assert.equal(messages().trim(), 'You stop searching.');
    noDraws();
});

for (const resistance of ['intrinsic', 'extrinsic', 'both']) for (const buc of ['blessed', 'uncursed', 'cursed']) {
    test(`hallucination potion returns before RNG: ${resistance}, ${buc}`, async () => {
        await setup({ old: 7, intrinsic: resistance !== 'extrinsic' ? FROMFORM : 0,
            extrinsic: resistance !== 'intrinsic' ? W_WEP : 0 });
        const obj = mksobj(ONAMES.POT_HALLUCINATION, false, false);
        obj.blessed = buc === 'blessed'; obj.cursed = buc === 'cursed';
        game.potion_nothing = game.potion_unkn = 0;
        seed(); assert.equal(await peffects(obj), -1);
        assert.equal(game.potion_nothing, 1); assert.equal(game.potion_unkn, 0);
        assert.equal(timer(), 7); assert.equal(alias(), 7);
        assert.equal(messages().trim(), ''); noDraws();
    });
}
for (const old of [0, 7]) test(`unresisted cursed hallucination potion: old=${old}`, async () => {
    await setup({ old });
    const obj = mksobj(ONAMES.POT_HALLUCINATION, false, false); obj.cursed = true; obj.blessed = false;
    game.potion_nothing = game.potion_unkn = 0;
    seed(); const duration = rn1(200, 900); const calls = [...getRngLog()]; const next = rn2(19);
    seed(); assert.equal(await peffects(obj), -1);
    assert.equal(game.potion_nothing, old ? 1 : 0);
    assert.equal(timer(), old + duration); assert.equal(alias(), old + duration);
    assert.equal(Hallucination(), true);
    assert.deepEqual(getRngLog(), calls); assert.equal(rn2(19), next);
});
