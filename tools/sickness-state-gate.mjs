// Constructed owner/consumer contracts, through normal exports and actual RNG.
// Direct flags, limits and countdown setup are not claims of ordinary reach.
import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { getRngLog, initRng, enableRngLog } from '../js/rng.js';
import { pline, display_nhwindow_message } from '../js/display.js';
import { make_sick, make_stoned, make_slimed, make_hallucinated, healup } from '../js/potion.js';
import { find_delayed_killer, delayed_killer, formatkiller, done_in_by } from '../js/end.js';
import { nh_timeout } from '../js/timeout.js';
import { diseasemu } from '../js/mhitu.js';
import { vomit, doeat } from '../js/eat.js';
import { mksobj } from '../js/mkobj.js';
import { makemon } from '../js/makemon.js';
import { addinv } from '../js/invent.js';
import { setworn } from '../js/worn.js';
import { Sick_resistance } from '../js/youprop.js';
import { gamestate_encode, gamestate_decode } from '../js/save.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { ACURR } from '../js/attrib.js';
import { SICK, SICK_ALL, SICK_VOMITABLE, SICK_NONVOMITABLE, STONED, SLIMED,
    POLYMORPH, KILLED_BY, KILLED_BY_AN, TIMEOUT, I_SPECIAL, FROMOUTSIDE,
    A_CON, POISONING, W_ARM, DIED, NO_MM_FLAGS } from '../js/const.js';

import fs from 'node:fs';
assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'Usage: node tools/sickness-state-gate.mjs [compact-report.json]');
const deadline = setTimeout(() => { console.error('sickness state gate exceeded 55 seconds'); process.exit(1); }, 55000);
deadline.unref();
const results = [];
async function test(name, body) {
    await nodeTest(name, async () => {
        try { await body(); results.push({name, pass:true}); }
        catch (error) { results.push({name, pass:false, error:error.message.slice(0,1000)}); throw error; }
    });
}

const rc = 'OPTIONS=name:Sicktest,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait\n'
    + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=symset:plain\n';
let seen = [];
function feed(run, keys) {
    let reads = 0; seen = [];
    run._display.onEmptyQueue = async () => {
        await setImmediate();
        assert.ok(reads < 64, 'bounded physical input exhausted');
        seen.push({ top: game._toplines, pending: game._pending_message,
            sick: game.u.uprops.SICK || 0, type: game.u.usick_type || 0,
            killer: { format: game.killer.format, name: game.killer.name },
            formatted: formatkiller(POISONING, false) });
        const ch = keys?.[reads] ?? (game._toplines.includes('Die?') ? 'n' : ' ');
        reads++; return ch.charCodeAt(0);
    };
}
async function settle(run) {
    feed(run); await display_nhwindow_message(); feed(run);
}
async function boot(seed = 12001) {
    const run = await runSegment({ seed, moves: ' ', datetime: '20000112093000',
        nethackrc: rc, storage: new InMemoryStorage() });
    resetInputState(); await settle(run); return run;
}
const node = () => find_delayed_killer(SICK);
const state = () => ({ sick: game.u.uprops.SICK || 0, type: game.u.usick_type || 0,
    exercise: game.u.aexe.a[A_CON], killer: JSON.stringify(game.killer),
    botl: game.disp.botl, top: game._toplines });
const draws = start => getRngLog().slice(start);

await test('new sickness installs the shared cause and clears the immediate name', async () => {
    await boot(); game.killer.name = 'prior immediate cause';
    const start = getRngLog().length, ex = game.u.aexe.a[A_CON];
    await make_sick(19, 'rotted newt corpse', false, SICK_VOMITABLE);
    assert.equal(game.u.uprops.SICK, 19); assert.equal(game.u.usick_type, SICK_VOMITABLE);
    assert.equal(node()?.name, 'rotted newt corpse'); assert.equal(node().format, KILLED_BY_AN);
    assert.equal(game.killer.name, ''); assert.equal(game.disp.botl, true);
    assert.ok(game._toplines.includes('You feel deathly sick.'));
    assert.match(draws(start).join('\n'), /^rn2\(2\)=[01]$/);
    assert.equal(game.u.aexe.a[A_CON], ex - Number(draws(start)[0].split('=')[1]));
    assert.equal(Object.hasOwn(game, 'delayed_killer'), false);
});

await test('repeated disease updates the same node and unions the sickness types', async () => {
    const run = await boot(); await make_sick(30, 'rotted newt corpse', false, SICK_VOMITABLE);
    const old = node(); await settle(run);
    assert.equal(await diseasemu(game.mons[PMNAMES.PM_PESTILENCE]), true);
    assert.equal(game.u.uprops.SICK, 11); assert.equal(game.u.usick_type, SICK_ALL);
    assert.equal(node(), old); assert.equal(node()?.name, 'Pestilence');
    assert.ok(game._toplines.includes('You feel much worse.'));
});

await test('ordinary range timeout and even-worse wording remain unchanged', async () => {
    const run = await boot(); await make_sick(9, 'first', false, SICK_NONVOMITABLE);
    await settle(run); await make_sick(5, 'second', true, SICK_NONVOMITABLE);
    assert.equal(game.u.uprops.SICK, 5); assert.equal(game.u.usick_type, SICK_NONVOMITABLE);
    assert.ok(game._toplines.includes('You feel even worse.'));
});

await test('constructed timeout flags survive a saturated positive update', async () => {
    await boot(); game.u.uprops.SICK = I_SPECIAL | 9;
    await make_sick(TIMEOUT + 17, 'horn', false, SICK_NONVOMITABLE);
    assert.equal(game.u.uprops.SICK, I_SPECIAL | TIMEOUT);
});

await test('vomiting partially cures mixed sickness without replacing its cause', async () => {
    const run = await boot(); await make_sick(12, 'rotted newt corpse', false, SICK_VOMITABLE);
    await diseasemu(game.mons[PMNAMES.PM_PESTILENCE]); await settle(run);
    const before = game.u.uprops.SICK, cause = node(); assert.ok(cause);
    game.killer.name = 'unrelated immediate cause'; await vomit();
    assert.equal(game.u.uprops.SICK, before * 2); assert.equal(game.u.usick_type, SICK_NONVOMITABLE);
    assert.equal(node(), cause); assert.equal(node().name, 'Pestilence');
    assert.equal(game.killer.name, 'unrelated immediate cause');
    assert.equal(game.multi, -2); assert.ok(game._toplines.includes('somewhat better.'));
});

await test('constructed partial doubling clamps timeout and retains high flags', async () => {
    await boot(); game.u.uprops.SICK = I_SPECIAL | (TIMEOUT - 3); game.u.usick_type = SICK_ALL;
    delayed_killer(SICK, KILLED_BY, 'retained cause'); const cause = node();
    await make_sick(0, null, false, SICK_VOMITABLE);
    assert.equal(game.u.uprops.SICK, I_SPECIAL | TIMEOUT); assert.equal(node(), cause);
    assert.equal(node().name, 'retained cause');
});

await test('mismatched cure retains cause and still exercises constitution', async () => {
    await boot(); game.u.uprops.SICK = 9; game.u.usick_type = SICK_NONVOMITABLE;
    delayed_killer(SICK, KILLED_BY_AN, 'retained'); const cause = node();
    game.killer.name = 'unchanged'; game.disp.botl = false;
    const start = getRngLog().length; await make_sick(0, null, true, SICK_VOMITABLE);
    assert.equal(game.u.uprops.SICK, 9); assert.equal(node(), cause);
    assert.equal(game.killer.name, 'unchanged'); assert.equal(game.disp.botl, false);
    assert.equal(Object.hasOwn(game, 'delayed_killer'), false);
    assert.match(draws(start).join('\n'), /^rn2\(2\)=[01]$/);
});

await test('missing shared cause is created even by a partial cure with null cause', async () => {
    await boot(); game.u.uprops.SICK = 8; game.u.usick_type = SICK_ALL;
    await make_sick(0, null, false, SICK_VOMITABLE);
    assert.equal(game.u.uprops.SICK, 16); assert.equal(node()?.name, '');
    assert.equal(node().format, KILLED_BY_AN);
});

await test('full cure clears every sickness flag and only its delayed cause', async () => {
    await boot(); game.u.uprops.SICK = I_SPECIAL | 8; game.u.usick_type = SICK_ALL;
    delayed_killer(SLIMED, KILLED_BY_AN, 'green slime');
    delayed_killer(SICK, KILLED_BY_AN, 'illness');
    delayed_killer(STONED, KILLED_BY_AN, 'cockatrice');
    delayed_killer(POLYMORPH, KILLED_BY, 'self-genocide');
    const others = [SLIMED, STONED, POLYMORPH].map(find_delayed_killer);
    const start = getRngLog().length; await make_sick(0, null, true, SICK_ALL);
    assert.equal(game.u.uprops.SICK, 0); assert.equal(game.u.usick_type, 0); assert.equal(node(), null);
    assert.deepEqual([SLIMED, STONED, POLYMORPH].map(find_delayed_killer), others);
    assert.deepEqual(draws(start), []); assert.ok(game._toplines.includes('cured.  What a relief!'));
});

await test('zero-time cleanup removes an orphan sickness node without exercise', async () => {
    await boot(); delayed_killer(SICK, KILLED_BY_AN, 'orphan');
    const start = getRngLog().length; await make_sick(0, null, false, SICK_ALL);
    assert.equal(node(), null); assert.deepEqual(draws(start), []);
});

for (const [field, value] of [['intrinsic', FROMOUTSIDE], ['extrinsic', W_ARM]]) {
    await test(`${field} sickness resistance leaves existing sickness and causes intact`, async () => {
        await boot(); game.u.uprops.SICK = 9; game.u.usick_type = SICK_VOMITABLE;
        delayed_killer(SICK, KILLED_BY_AN, 'existing');
        if (field === 'intrinsic') game.u.intrinsic.HSick_resistance = value;
        else game.u.uprops.SICK_RES = value;
        assert.equal(Sick_resistance(), true); const before = state(), start = getRngLog().length;
        await make_sick(3, 'ignored', true, SICK_NONVOMITABLE);
        assert.deepEqual(state(), before); assert.deepEqual(draws(start), []);
    });
}

await test('real green dragon armor blocks make_sick without direct resistance fields', async () => {
    await boot(); const armor = mksobj(ONAMES.GREEN_DRAGON_SCALE_MAIL, true, false);
    addinv(armor); await setworn(armor, W_ARM);
    assert.ok(!game.u.intrinsic.HSick_resistance && !game.u.uprops.SICK_RES);
    assert.equal(Sick_resistance(), true); const before = state(), start = getRngLog().length;
    await make_sick(20, 'unicorn horn', true, SICK_NONVOMITABLE);
    assert.deepEqual(state(), before); assert.deepEqual(draws(start), []);
});

await test('resistance does not block a full cure of existing sickness', async () => {
    await boot(); game.u.uprops.SICK = 8; game.u.usick_type = SICK_ALL;
    game.u.intrinsic.HSick_resistance = FROMOUTSIDE;
    await make_sick(0, null, false, SICK_ALL);
    assert.equal(game.u.uprops.SICK, 0); assert.equal(game.u.usick_type, 0);
});

await test('wizard intrinsic cause uses KILLED_BY and null cause uses an empty name', async () => {
    const run = await boot(); await make_sick(12, '#wizintrinsic', true, SICK_NONVOMITABLE);
    assert.equal(node()?.format, KILLED_BY); assert.equal(node().name, '#wizintrinsic');
    await settle(run); await make_sick(7, null, false, SICK_NONVOMITABLE);
    assert.equal(node().format, KILLED_BY_AN); assert.equal(node().name, '');
});

await test('real tainted food producer sets a corpse cause then vomiting fully cures it', async () => {
    const run = await boot(); game.moves = 200;
    const corpse = mksobj(ONAMES.CORPSE, true, false);
    corpse.corpsenm = PMNAMES.PM_NEWT; corpse.age = 1; corpse.cursed = 1;
    addinv(corpse); feed(run, corpse.invlet + ' '.repeat(32));
    await doeat(); assert.equal(game.u.usick_type, SICK_VOMITABLE);
    assert.ok(game.u.uprops.SICK >= 10 && game.u.uprops.SICK <= 19);
    assert.equal(node()?.name, 'rotted newt corpse');
    await settle(run); await vomit();
    assert.equal(game.u.uprops.SICK, 0); assert.equal(game.u.usick_type, 0); assert.equal(node(), null);
});

await test('unrelated real stoning and slime cures preserve the sickness node', async () => {
    const run = await boot(); await make_sick(20, 'Pestilence', false, SICK_NONVOMITABLE);
    const cause = node(); assert.ok(cause); await settle(run);
    await make_stoned(5, null, KILLED_BY_AN, 'cockatrice');
    await make_slimed(5, null); delayed_killer(SLIMED, KILLED_BY_AN, 'green slime');
    await make_stoned(0, null, KILLED_BY_AN, null); await make_slimed(0, null);
    assert.equal(node(), cause); assert.equal(game.u.uprops.SICK, 20);
    assert.equal(find_delayed_killer(STONED), null); assert.equal(find_delayed_killer(SLIMED), null);
});

await test('healing without curesick leaves sickness state and other causes intact', async () => {
    await boot(); game.u.uprops.SICK = 20; game.u.usick_type = SICK_NONVOMITABLE;
    delayed_killer(SICK, KILLED_BY_AN, 'untouched'); const cause = node();
    await healup(1, 0, false, false);
    assert.equal(game.u.uprops.SICK, 20); assert.equal(node(), cause);
});

await test('food poisoning warning uses sickness and the urgent message path', async () => {
    await boot(); game.u.uprops.SICK = 7; game.u.usick_type = SICK_VOMITABLE;
    game._win_stop = true; await nh_timeout();
    assert.equal(game.u.uprops.SICK, 6); assert.equal(game._win_stop, false);
    assert.ok(game._toplines.includes('Your sickness feels worse.'));
});

await test('fatal illness warning and no-warning even turn retain their behavior', async () => {
    const run = await boot(); game.u.uprops.SICK = 5; game.u.usick_type = SICK_ALL;
    await nh_timeout(); assert.ok(game._toplines.includes('Your illness is severe.'));
    await settle(run); const top = game._toplines, start = getRngLog().length;
    await nh_timeout(); assert.equal(game.u.uprops.SICK, 3); assert.equal(game._toplines, top);
    assert.match(draws(start).join('\n'), /^rn2\(2\)=[01]$/);
});

await test('constructed high flags do not hide a low-time sickness warning', async () => {
    await boot(); game.u.uprops.SICK = I_SPECIAL | 5; game.u.usick_type = SICK_NONVOMITABLE;
    await nh_timeout(); assert.equal(game.u.uprops.SICK, I_SPECIAL | 4);
    assert.ok(game._toplines.includes('Your illness is severe.'));
});

await test('hallucinated Death warning draws its pronoun before constitution exercise', async () => {
    const run = await boot(); await make_hallucinated(30, false, 0); await settle(run);
    game.u.uprops.SICK = 3; game.u.usick_type = SICK_NONVOMITABLE;
    const start = getRngLog().length; await nh_timeout();
    assert.match(game._toplines, /Death's door\.  (He is|She is|It is|They are) inviting you in\./);
    assert.match(draws(start).join('\n'), /^rn2\(4\)=[0-3]\nrn2\(2\)=[01]$/);
});

await test('invulnerability stops sickness dialogue countdown and exercise', async () => {
    await boot(); game.u.uprops.SICK = 3; game.u.usick_type = SICK_NONVOMITABLE;
    game.u.uinvulnerable = 1; const before = state(), start = getRngLog().length;
    await nh_timeout(); assert.deepEqual(state(), before); assert.deepEqual(draws(start), []);
});

await test('sickness expiry consumes the produced cause and formats a named monster', async () => {
    const run = await boot(); await make_sick(1, 'Pestilence', false, SICK_NONVOMITABLE);
    delayed_killer(STONED, KILLED_BY_AN, 'separate cockatrice');
    const other = find_delayed_killer(STONED); await settle(run);
    const start = getRngLog().length; await nh_timeout();
    assert.ok(seen.some(s => s.formatted === 'poisoned by Pestilence'));
    assert.ok(!draws(start).some(s => s.startsWith('rn2(100)=')));
    assert.equal(game.u.umortality, 1); assert.equal(game.u.uprops.SICK, 0);
    assert.equal(game.u.usick_type, 0); assert.equal(node(), null);
    assert.equal(find_delayed_killer(STONED), other);
});

await test('existing consumer honors an empty cause fallback and only removes SICK', async () => {
    const run = await boot(); game.u.uprops.SICK = 1; game.u.usick_type = SICK_NONVOMITABLE;
    delayed_killer(SICK, KILLED_BY_AN, ''); delayed_killer(POLYMORPH, KILLED_BY, 'self-genocide');
    const other = find_delayed_killer(POLYMORPH); await settle(run); await nh_timeout();
    assert.ok(seen.some(s => s.formatted === 'poisoned by a poisoned'));
    assert.equal(node(), null); assert.equal(find_delayed_killer(POLYMORPH), other);
});

await test('food expiry recovery uses real RNG and retains the C subtype quirk', async () => {
    const run = await boot(); game.u.uprops.SICK = 1; game.u.usick_type = SICK_VOMITABLE;
    delayed_killer(SICK, KILLED_BY_AN, 'rotted newt corpse');
    await settle(run); initRng(0); enableRngLog(); const before = ACURR(A_CON);
    await nh_timeout();
    const roll = getRngLog().find(s => s.startsWith('rn2(100)='));
    assert.ok(roll); assert.ok(Number(roll.split('=')[1]) < before, 'fixed actual RNG recovery seed');
    assert.equal(game.u.uprops.SICK, 0); assert.equal(game.u.usick_type, SICK_VOMITABLE);
    assert.equal(node(), null); assert.equal(game.u.umortality || 0, 0);
    assert.equal(ACURR(A_CON), before - 1);
});

await test('shared delayed causes survive the real save codec without a legacy field', async () => {
    await boot(); await make_sick(12, 'rotted newt corpse', false, SICK_VOMITABLE);
    delayed_killer(POLYMORPH, KILLED_BY, 'self-genocide');
    const restored = gamestate_decode(JSON.parse(JSON.stringify(gamestate_encode(game.killer))));
    assert.equal(restored.next.id, POLYMORPH); assert.equal(restored.next.next.id, SICK);
    assert.equal(restored.next.next.name, 'rotted newt corpse');
    assert.equal(Object.hasOwn(game, 'delayed_killer'), false);
});

for (const sickness of [false, true]) {
    await test(`monster death survival preserves the killer head with sickness ${sickness}`, async () => {
        const run = await boot();
        if (sickness) {
            game.u.uprops.SICK = 20; game.u.usick_type = SICK_NONVOMITABLE;
            delayed_killer(SICK, KILLED_BY_AN, 'unicorn horn');
        }
        const mon = await makemon(game.mons[PMNAMES.PM_GOBLIN],game.u.ux,game.u.uy,NO_MM_FLAGS);
        assert.ok(mon); const cause = node(); await settle(run);
        await done_in_by(mon, DIED);
        assert.equal(game.u.umortality, 1); assert.equal(node(), cause);
        assert.equal(game.u.uprops.SICK || 0, sickness ? 20 : 0);
        assert.equal(game.killer.name, '');
    });
}

for (const sickness of [false, true]) {
    await test(`strangulation survival preserves unrelated delayed causes with sickness ${sickness}`, async () => {
        const run = await boot();
        if (sickness) {
            game.u.uprops.SICK = 20; game.u.usick_type = SICK_NONVOMITABLE;
            delayed_killer(SICK, KILLED_BY_AN, 'unicorn horn');
        }
        game.u.intrinsic.HStrangled = 1; const cause = node(); await settle(run);
        await nh_timeout();
        assert.equal(game.u.umortality, 1); assert.equal(node(), cause);
        assert.equal(game.u.uprops.SICK || 0, sickness ? 19 : 0);
        assert.equal(game.u.intrinsic.HStrangled, 0);
    });
}

for (const kind of ['new', 'partial', 'warning']) {
    await test(`pending ${kind} sickness message holds later state and RNG`, async () => {
        const run = await boot();
        if (kind !== 'new') {
            game.u.uprops.SICK = kind === 'warning' ? 7 : 10;
            game.u.usick_type = SICK_ALL;
            delayed_killer(SICK, KILLED_BY_AN, 'retained');
        }
        await pline('A preceding message which is long enough to require a real More prompt here.');
        let release, entered;
        const pending = new Promise(resolve => { entered = resolve; });
        const input = new Promise(resolve => { release = resolve; });
        run._display.onEmptyQueue = async () => { entered(); return await input; };
        let complete = false;
        const work = (kind === 'warning' ? nh_timeout()
            : make_sick(kind === 'new' ? 20 : 0, kind === 'new' ? 'new cause' : null,
                        true, kind === 'new' ? SICK_NONVOMITABLE : SICK_VOMITABLE))
            .then(() => { complete = true; });
        await pending;
        const before = state(), rng = [...getRngLog()]; await setImmediate();
        assert.equal(complete, false); assert.deepEqual(state(), before); assert.deepEqual(getRngLog(), rng);
        assert.equal(game.u.uprops.SICK || 0, kind === 'new' ? 0 : kind === 'warning' ? 7 : 10);
        if (kind === 'partial') assert.equal(game.u.usick_type, SICK_NONVOMITABLE);
        feed(run); release(' '.charCodeAt(0)); await work;
        assert.equal(game.u.uprops.SICK, kind === 'warning' ? 6 : 20);
        assert.equal(node()?.name, kind === 'new' ? 'new cause' : 'retained');
    });
}

clearTimeout(deadline);
assert.equal(results.length, 34);
const report = {kind:'constructed source controls through real helpers',
    total:results.length, passed:results.filter(r=>r.pass).length, results};
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report,null,2)+'\n');
if (report.passed !== report.total) process.exitCode = 1;
