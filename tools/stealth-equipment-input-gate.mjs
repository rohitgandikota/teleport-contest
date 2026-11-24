// Read-only input reach and unchanged C provenance. Full parity is checked separately.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Stealth, Flying, Levitation, Blind} from '../js/youprop.js';
import {FROMOUTSIDE, W_ARMF, W_ARMC, W_RINGL} from '../js/const.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/stealth-equipment-feedback.json', import.meta.url)));
const raw = readFileSync(new URL('gen-sessions/generated/stealth-equipment-feedback.session.json', import.meta.url));
const native = JSON.parse(raw);

test('unchanged C v2 recording, input tuples and four native branches', () => {
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '590b886515b60ab3a7d83053a85bd84e8ea45386d8375c8e374da96356a1fc35');
    assert.equal(native.segments.length, 4);
    assert.equal(recipe.segments.length, 4);
    assert.equal(recipe.name, 'stealth-equipment-feedback');
    for (const [index, part] of recipe.segments.entries())
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[field], native.segments[index][field]);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
});
const cases = [
    {mounted: true, flying: true, armor: [ONAMES.ELVEN_BOOTS]},
    {mounted: true, flying: true, blind: true, armor: [ONAMES.ELVEN_CLOAK]},
    {mounted: true, blocked: true, armor: [ONAMES.ELVEN_BOOTS, ONAMES.ELVEN_CLOAK]},
    {levitating: true, blind: true, armor: [ONAMES.ELVEN_BOOTS, ONAMES.ELVEN_CLOAK]},
];

for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const expected = cases[index];
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            states.push({step, stealth: Stealth(),
                intrinsic: g.u.intrinsic?.HStealth || 0,
                extrinsic: g.u.uprops?.STEALTH || 0,
                blocked: g.u.blocked?.STEALTH || 0,
                flying: Flying(), levitating: Levitation(), blind: Blind(),
                intrinsicFlight: g.u.intrinsic?.HFlying || 0,
                extrinsicFlight: g.u.uprops?.FLYING || 0,
                intrinsicLevitation: g.u.intrinsic?.HLevitation || 0,
                extrinsicLevitation: g.u.uprops?.LEVITATION || 0,
                mounted: !!g.u.usteed, steed: g.u.usteed?.mnum,
                hp: g.u.uhp, mortality: g.u.umortality || 0,
                inventory: (g.invent || []).map(o => ({type: o.otyp,
                    worn: o.owornmask || 0, known: !!g.objects[o.otyp].oc_name_known})),
                screen: g.nhDisplay.grid.map(row => row.map(c => c.ch).join('')
                    .trimEnd()).join('\n')});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    assert.equal(recipe.name, 'stealth-equipment-feedback');
    assert.equal(run.getScreens().length, part.moves.length + 1);
    assert.ok(part.nethackrc.includes('role:Knight'));
    assert.ok(!part.moves.includes('wizintrinsic'));
    assert.ok(states.every(s => s.intrinsic === 0), 'Knight never gains intrinsic stealth');
    assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));

    const mounted = states.filter(s => s.mounted);
    if (expected.mounted) {
        assert.ok(mounted.length, 'ordinary mount succeeds');
        const prompt = states.find(s => s.screen.includes('Force the mount to succeed?'));
        assert.ok(prompt);
        assert.equal(part.moves[prompt.step], 'n', 'force success is declined');
        assert.ok(mounted[0].step > prompt.step);
        assert.ok(mounted.every(s => s.steed === (expected.flying
            ? PMNAMES.PM_KI_RIN : PMNAMES.PM_PONY)));
    } else {
        assert.equal(mounted.length, 0);
    }

    const phases = [];
    for (const type of expected.armor) {
        const mask = type === ONAMES.ELVEN_BOOTS ? W_ARMF : W_ARMC;
        const worn = states.filter(s => s.inventory.some(o => o.type === type && o.worn === mask));
        assert.ok(worn.length, 'actual wear command equips armor');
        const before = states.find(s => s.step < worn[0].step
            && s.inventory.some(o => o.type === type && !o.worn));
        assert.ok(before, 'armor is carried before it is worn');
        assert.equal(before.inventory.find(o => o.type === type).known, false);
        for (const s of worn) {
            assert.equal(s.extrinsic, mask);
            assert.equal(s.blocked, expected.blocked ? FROMOUTSIDE : 0);
            assert.equal(s.stealth, !expected.blocked);
            assert.equal(s.mounted, !!expected.mounted);
            assert.equal(s.flying, !!expected.flying);
            assert.equal(s.levitating, !!expected.levitating);
            assert.equal(s.blind, !!expected.blind);
            assert.equal(s.intrinsicFlight, 0);
            assert.equal(s.extrinsicFlight, 0, 'flying mount supplies flight');
            assert.equal(s.intrinsicLevitation, 0);
            assert.equal(s.extrinsicLevitation, expected.levitating ? W_RINGL : 0);
        }
        const after = states.find(s => s.step > worn.at(-1).step
            && s.inventory.some(o => o.type === type && !o.worn));
        assert.ok(after, 'actual removal clears the slot and retains the object');
        assert.equal(after.extrinsic, 0);
        assert.equal(after.stealth, false);
        assert.equal(after.inventory.find(o => o.type === type).known, !expected.blocked);
        assert.equal(worn.at(-1).inventory.find(o => o.type === type).known, !expected.blocked);
        phases.push({type, on: worn[0].step, off: after.step,
            blocked: after.blocked, known: after.inventory.find(o => o.type === type).known});
    }

    const animations = run.getAnimationFramesByStep().reduce((n, frames) => n + frames.length, 0);
    const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const calls = entries => entries.map(call => call.replace(/\s*@\s.*$/, ''));
    console.log('INPUT_RECEIPT ' + JSON.stringify({name: part.name,
        boundaries: run.getScreens().length, calls: run.getRngLog().length, animations,
        rngSha256: hash(calls(run.getRngLog())),
        rngSlicesSha256: hash(run.getRngSlices().map(calls)),
        cursorSha256: hash(run.getCursors()),
        animationSha256: hash(run.getAnimationFramesByStep()),
        mountStep: mounted[0]?.step ?? null, phases}));
    const assertion = recipe.branchAssertions[index];
    const observed = {segments: Array.from({length: recipe.segments.length}, (_, i) => ({
        steps: i === index ? states.map(s => ({screen: s.screen})) : [],
    }))};
    assert.deepEqual(branchAssertionErrors({...recipe, branches: [assertion.branch],
        branchAssertions: [assertion]}, observed), []);
});
