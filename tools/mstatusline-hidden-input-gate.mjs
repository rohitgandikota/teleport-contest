// Actual key reach, with read-only observations and an unobserved replay.
// This gate proves JS branches. Parent native recording is independent.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {M_AP_TYPE, M_AP_OBJECT, M_AP_NOTHING} from '../js/const.js';
import {canseemon} from '../js/display.js';
import {ONAMES} from '../js/objects_data.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/mstatusline-hidden.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const output = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    calls:run.getRngLog(), slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
const hashes = out => Object.fromEntries(Object.entries(out).map(([key, value]) => [key, hash(value)]));
const plain = screen => decodeScreen(screen).map(row => row.map(renderCell).join('')).join('\n');

test('recipe name, four input tuples and all coverage tags are registered', () => {
    assert.equal(recipe.name, 'mstatusline-hidden');
    assert.equal(recipe.segments.length, 4);
    assert.equal(recipe.branchAssertions.length, 4);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const registered = new Set(coverage.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(tag => registered.has(tag)));
    assert.ok(recipe.segments.every(s => typeof s.moves === 'string' && !Object.hasOwn(s, 'steps')));
});

for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const expected = recipe.jsReach[index], states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            const mon = g.level.monsters.find(m => m.m_id === expected.target.runtimeId);
            const memory = mon ? g.level.at(mon.mx, mon.my).remembered_glyph?.glyph : null;
            states.push({step, text:g._toplines || '', hp:g.u.uhp,
                mortality:g.u.umortality || 0, hero:[g.u.ux,g.u.uy],
                hit:g.bhitpos ? {...g.bhitpos} : null,
                inventory:(g.invent || []).map(o => ({type:o.otyp, letter:o.invlet, charges:o.spe})),
                mon:mon ? {id:mon.mnum, x:mon.mx, y:mon.my,
                    hidden:!!mon.mundetected, asleep:!!mon.msleeping,
                    visible:!!canseemon(mon),
                    peaceful:!!mon.mpeaceful, hp:mon.mhp,
                    appearance:M_AP_TYPE(mon), type:mon.mappearance,
                    memory:memory ? {kind:memory.kind, type:memory.otyp} : null} : null});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = output(run);
    assert.deepEqual(hashes(out), hashes(output(await runSegment({...part, storage:new InMemoryStorage()}))),
        'read-only observer preserves all five original output hashes');
    assert.equal(out.screens.length, part.moves.length + 1);
    assert.equal(out.screens.length, expected.boundaries);
    assert.equal(out.calls.length, expected.calls);
    assert.equal(out.frames.flat().length, expected.frames);
    assert.deepEqual(out.slices.flat(), out.calls);
    for (const call of out.calls)
        assert.match(call.replace(/\s+@\s*.*$/, ''), /^(?:~d)?(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(-?\d+(?:,\s*-?\d+)*\)=-?\d+$/);
    assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));
    const selected = states.find(s => s.step === expected.selectedStep);
    assert.ok(selected?.mon);
    assert.equal(selected.hp, expected.hp);
    assert.deepEqual(selected.hero, expected.hero);
    for (const field of ['id','x','y']) assert.equal(selected.mon[field], expected.target[field]);
    for (const field of ['hidden','asleep','peaceful']) assert.equal(selected.mon[field], expected[field]);
    assert.equal(selected.mon.hp, expected.targetHp);
    assert.equal(selected.mon.appearance, expected.appearanceType);
    if (index >= 2) assert.equal(selected.mon.visible, true);
    if (index === 1) assert.equal(selected.mon.visible, false);
    assert.deepEqual(selected.hit, {x:9,y:12});
    assert.equal(part.moves[expected.commandDirectionStep - 1], 'l');
    if (index < 3) {
        assert.ok(states.some(s => s.inventory.some(o => o.type === ONAMES.WAN_PROBING && o.charges === 8 && o.letter === 'a')));
        assert.ok(selected.inventory.some(o => o.type === ONAMES.WAN_PROBING && o.charges === 7 && o.letter === 'a'));
        assert.ok(states.some(s => /not carrying anything/.test(s.text)));
    } else {
        assert.ok(selected.inventory.some(o => o.type === ONAMES.STETHOSCOPE && o.letter === 'a'));
        assert.ok(states.some(s => s.mon?.appearance === M_AP_OBJECT));
        assert.equal(selected.mon.appearance, M_AP_NOTHING);
    }
    if (index === 0) {
        assert.equal(selected.mon.type, ONAMES.EGG);
        assert.deepEqual(selected.mon.memory, {kind:'obj',type:ONAMES.EGG});
        assert.ok(out.slices[expected.selectedStep].some(call => /^rnd\(2\)=/.test(call)),
            'real temporary constructor consumes next_ident during status feedback');
    }
    const screen = plain(out.screens[expected.selectedStep]);
    assert.ok(screen.includes('Status of'));
    assert.ok(screen.includes('--More--'), 'ordinary output really waits at More');
    const generated = {segments:recipe.segments.map((_s,i) => i === index ? {
        steps:out.screens.map((screen,step) => ({screen,rng:out.slices[step]}))} : {steps:[]})};
    const oneRecipe = {...recipe,branches:[recipe.branches[index]],branchAssertions:[recipe.branchAssertions[index]]};
    assert.deepEqual(branchAssertionErrors(oneRecipe, generated), []);
    console.log(JSON.stringify({name:part.name, selectedStep:expected.selectedStep,
        boundaries:out.screens.length,calls:out.calls.length,frames:out.frames.flat().length,
        allFiveObserverHashesExact:true, originalOutputHashes:hashes(out), selected,
        evidence:'JS actual-input reach; separate native gate verifies C tuples and output'}));
});
