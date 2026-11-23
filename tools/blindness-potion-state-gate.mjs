#!/usr/bin/env node
// Source-derived potion.c:261-364,1073-1080 and timeout.c:743-751 controls.
// These execute real JS functions. They are not a native C oracle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { make_blinded, toggle_blindness, peffects, dopotion } from '../js/potion.js';
import { nh_timeout } from '../js/timeout.js';
import { Blindf_off } from '../js/do_wear.js';
import { setworn } from '../js/worn.js';
import { mksobj } from '../js/mkobj.js';
import { addinv, obj_extract_self } from '../js/invent.js';
import { makemon } from '../js/makemon.js';
import { Blind } from '../js/youprop.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ART_EYES_OF_THE_OVERWORLD } from '../js/artilist_data.js';
import { W_TOOL, FROMOUTSIDE, FROMFORM, ROOM, IN_SIGHT, COULD_SEE, TIMEOUT,
    MM_NOGRP, MM_NOMSG, NO_MINVENT, OBJ_DELETED } from '../js/const.js';
import { initRng, enableRngLog, getRngLog, rn1, rn2 } from '../js/rng.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url))).segments[0];
let prompts;
async function setup(sample = {}) {
    const run = await runSegment({ ...segment, moves: ' ', storage: new InMemoryStorage() });
    prompts = [];
    run._display.onEmptyQueue = () => {
        prompts.push(game.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd());
        if (prompts.length > 30) throw Error('unexpected repeated prompt');
        return prompts.at(-1).includes('--More--') ? 32 : 0x1b;
    };
    game._preNhgetchHook = null;
    game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
    game.u.ublindf = null; game.u.uball = null; game.u.uchain = null;
    game.u.uswallow = false; game.u.ustuck = null; game.u.uswldtim = 0;
    game.u.uinvulnerable = false; game.u.uinwater = false; game.u.ucreamed = 0;
    game.u.usleep = 0; game.multi = 0; game.u.uroleplay.blind = false;
    game.u.ux = 31; game.u.uy = 10; game.u.uhp = game.u.uhpmax = 200;
    game.u.mtimedone = 0; game.u.usptime = 0;
    game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) obj_extract_self(obj);
    game.level.traps = []; game.regions = [];
    game.timer_base = []; game.invent = []; game.moves = 1;
    for (let x = 26; x <= 36; x++) for (let y = 5; y <= 15; y++) {
        Object.assign(game.level.at(x, y), { typ: ROOM, lit: 1,
            waslit: 1, seenv: 255, roomno: 0 });
        game.viz_array[y][x] = IN_SIGHT | COULD_SEE;
    }
    if (sample.form) {
        game.u.umonnum = PMNAMES.PM_YELLOW_LIGHT;
        game.youmonst.data = game.mons[PMNAMES.PM_YELLOW_LIGHT];
    }
    game.u.intrinsic.HBlinded = (sample.source || 0) | (sample.old || 0);
    if (sample.gear) {
        const obj = mksobj(sample.gear === 'towel' ? ONAMES.TOWEL : ONAMES.LENSES, false, false);
        if (sample.gear === 'eyes') { obj.oartifact = ART_EYES_OF_THE_OVERWORLD; obj.oname = 'The Eyes of the Overworld'; }
        addinv(obj); setworn(obj, W_TOOL);
    }
    if (sample.hallucination) {
        game.u.intrinsic.HHallucination = 100; game.u.uprops.HALLUC = 100;
    }
    if (sample.unaware) { game.multi = -3; game.u.usleep = 1; }
    game.u.ublind = Blind() ? 1 : 0;
    clearMessages();
}
function clearMessages() {
    game._toplines = ''; game._msg_history = []; game._toplin = 0;
    game._pending_message = ''; game._win_stop = false;
}
function messages() { return [...game._msg_history, game._toplines].join('\n'); }
function seed() { initRng(3); enableRngLog(); }

const transitions = [
    { name: 'gain timed blindness', next: 7, blind: true, text: /A cloud of darkness falls upon you/ },
    { name: 'clear timed blindness', old: 7, next: 0, blind: false, text: /You can see again/ },
    { name: 'extend existing blindness', old: 7, next: 12, blind: true, text: null },
    { name: 'zero remains sighted', next: 0, blind: false, text: null },
    { name: 'towel gains timer', gear: 'towel', next: 7, blind: true, text: /eyes momentarily twitch/ },
    { name: 'towel clears timer', gear: 'towel', old: 7, next: 0, blind: true, text: /eyes momentarily itch/ },
    { name: 'lenses gain timer', gear: 'lenses', next: 7, blind: true, text: /A cloud of darkness/ },
    { name: 'lenses clear timer', gear: 'lenses', old: 7, next: 0, blind: false, text: /You can see again/ },
    { name: 'Eyes gain timer', gear: 'eyes', next: 7, blind: false, text: /vision seems to dim.*normal/ },
    { name: 'Eyes clear timer', gear: 'eyes', old: 7, next: 0, blind: false, text: /vision seems to brighten.*normal/ },
    { name: 'permanent source gains timer', source: FROMOUTSIDE, next: 7, blind: true, text: /strange feeling/ },
    { name: 'permanent source clears timer', source: FROMOUTSIDE, old: 7, next: 0, blind: true, text: /strange feeling/ },
    { name: 'eyeless form clears timer', source: FROMFORM, form: true, old: 7, next: 0, blind: true, text: /strange feeling/ },
    { name: 'Eyes suppress permanent source', source: FROMOUTSIDE, gear: 'eyes', next: 7, blind: false, text: /strange feeling/ },
    { name: 'unaware suppresses feedback', unaware: true, next: 7, blind: true, text: null },
    { name: 'quiet recovery still synchronizes cache', talk: false, old: 7, next: 0, blind: false, text: null },
    { name: 'hallucinated loss of sight', hallucination: true, next: 7, blind: true, text: /Oh, bummer!.*Everything is dark/ },
    { name: 'hallucinated recovery', hallucination: true, old: 7, next: 0, blind: false, text: /Far out!.*Everything is all cosmic again/ },
];
for (const sample of transitions) test(`make_blinded: ${sample.name}`, async () => {
    await setup(sample); seed();
    await make_blinded(sample.next, sample.talk !== false);
    assert.equal(game.u.intrinsic.HBlinded, (sample.source || 0) | sample.next);
    assert.equal(Blind(), sample.blind); assert.equal(game.u.ublind, sample.blind ? 1 : 0);
    if (sample.text) assert.match(messages(), sample.text); else assert.equal(messages().trim(), '');
    assert.deepEqual(getRngLog(), []);
});

for (const sample of [
    { name: 'ordinary', old: 1, blind: false },
    { name: 'towel', old: 1, gear: 'towel', blind: true },
    { name: 'Eyes', old: 1, gear: 'eyes', blind: false },
    { name: 'Eyes and permanent source', old: 1, gear: 'eyes', source: FROMOUTSIDE, blind: false },
]) test(`expiry: ${sample.name}`, async () => {
    await setup(sample);
    const occupation = () => 1;
    game.occupation = occupation;
    seed(); await nh_timeout();
    assert.equal(game.u.intrinsic.HBlinded, sample.source || 0);
    assert.equal(Blind(), sample.blind); assert.equal(game.u.ublind, sample.blind ? 1 : 0);
    assert.equal(game.occupation, occupation, 'C snapshots Blind after decrement, before restoring one tick');
    if (sample.gear === 'eyes') {
        assert.equal(game.u.blocked.BLINDED, W_TOOL);
        await Blindf_off(game.u.ublindf);
        assert.equal(Blind(), !!sample.source);
        assert.equal(game.u.ublind, sample.source ? 1 : 0);
    }
    assert.deepEqual(getRngLog(), []);
});

test('expiry inside dust vortex waits for the next attack before reblinding', async () => {
    await setup({ old: 1 });
    const mon = await makemon(game.mons[PMNAMES.PM_DUST_VORTEX], 32, 10,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(mon);
    game.u.uswallow = true; game.u.ustuck = mon; game.u.uswldtim = 7;
    seed(); await nh_timeout();
    assert.equal(game.u.intrinsic.HBlinded, 0);
    assert.equal(Blind(), false); assert.equal(game.u.ublind, 0);
    assert.equal(game.u.uswldtim, 7); assert.equal(game.u.uhp, 200);
    assert.match(messages(), /You can see again/);
    assert.doesNotMatch(messages(), /can't see in here/);
    assert.deepEqual(getRngLog(), []);
});

test('toggle discovers unseen inventory only on recovery', async () => {
    await setup({ old: 7 });
    const obj = mksobj(ONAMES.POT_HEALING, false, false); addinv(obj); obj.dknown = 0;
    seed(); await toggle_blindness();
    assert.equal(obj.dknown, 0);
    await make_blinded(0, false);
    assert.equal(obj.dknown, 1); assert.equal(game.u.ublind, 0);
    assert.deepEqual(getRngLog(), []);
});

const effects = [
    { name: 'sighted', nothing: 0, blind: true },
    { name: 'timed', old: 7, nothing: 1, blind: true },
    { name: 'towel', gear: 'towel', nothing: 1, blind: true },
    { name: 'lenses', gear: 'lenses', nothing: 0, blind: true },
    { name: 'Eyes without existing blindness', gear: 'eyes', nothing: 0, blind: false },
    { name: 'Eyes with timed blindness', gear: 'eyes', old: 7, nothing: 1, blind: false },
    { name: 'Eyes with permanent blindness', gear: 'eyes', source: FROMOUTSIDE, nothing: 1, blind: false },
    { name: 'Eyes at timeout clamp', gear: 'eyes', old: TIMEOUT - 2, nothing: 1, blind: false },
];
for (const sample of effects) test(`blindness potion: ${sample.name}`, async () => {
    await setup(sample);
    const obj = mksobj(ONAMES.POT_BLINDNESS, false, false);
    obj.blessed = false; obj.cursed = false;
    game.potion_nothing = game.potion_unkn = 0;
    seed(); const duration = rn1(200, 250); const calls = [...getRngLog()]; const next = rn2(19);
    seed(); assert.equal(await peffects(obj), -1);
    assert.equal(game.potion_nothing, sample.nothing);
    assert.equal(game.u.intrinsic.HBlinded,
        (sample.source || 0) | Math.min(TIMEOUT, (sample.old || 0) + duration));
    assert.equal(Blind(), sample.blind); assert.equal(game.u.ublind, sample.blind ? 1 : 0);
    assert.deepEqual(getRngLog(), calls);
    assert.equal(rn2(19), next, 'the predicate adds no duration draws');
});

for (const sample of [
    { name: 'Eyes and timed blindness', gear: 'eyes', old: 7, known: false },
    { name: 'Eyes and permanent blindness', gear: 'eyes', source: FROMOUTSIDE, known: false },
    { name: 'Eyes without blindness', gear: 'eyes', known: true },
    { name: 'ordinary sighted control', known: true },
]) test(`quaff discovery: ${sample.name}`, async () => {
    await setup(sample);
    const obj = mksobj(ONAMES.POT_BLINDNESS, false, false); addinv(obj);
    obj.blessed = false; obj.cursed = false; obj.dknown = 1;
    game.objects[obj.otyp].oc_name_known = false; game.objects[obj.otyp].oc_uname = null;
    game.u.urexp = 0;
    seed(); await dopotion(obj);
    assert.equal(!!game.objects[obj.otyp].oc_name_known, sample.known);
    assert.equal(game.u.urexp, sample.known ? 10 : 0);
    assert.equal(obj.where, OBJ_DELETED);
    assert.equal(prompts.some(p => /Call .*potion/.test(p)), !sample.known);
    assert.equal(/peculiar feeling/.test([...prompts, messages()].join('\n')), !sample.known);
    // C o_init.c:483 exercises wisdom only on learning a new type.
    assert.deepEqual(getRngLog().map(c => c.split('=')[0]), sample.known
        ? ['rn2(200)', 'rn2(19)'] : ['rn2(200)']);
});
