// Ordinary keyboard reach and observer transparency. Native parity is separate.
// Usage: node tools/xray-preswap-redraw-input-gate.mjs [input.json] [report.json]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Hallucination, Blind} from '../js/youprop.js';
import {Is_rogue_level, W_TOOL, OBJ_FLOOR} from '../js/const.js';
import {ONAMES} from '../js/objects_data.js';
import {ART_EYES_OF_THE_OVERWORLD} from '../js/artilist_data.js';
import {cansee, couldsee} from '../js/vision.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/xray-preswap-redraw.json', import.meta.url)));
const input = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2])) : recipe;
assert.equal(input.segments.length, 4);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});
const hashes = output => Object.fromEntries(Object.entries(output).map(([k, v]) => [k, hash(v)]));
const reports = [], observed = {segments: []};

for (const [index, part] of input.segments.entries()) {
    for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
        assert.equal(Object.hasOwn(part, key), Object.hasOwn(recipe.segments[index], key));
        assert.deepEqual(part[key], recipe.segments[index][key], `${part.name}: ${key}`);
    }
    if (part.steps?.length) {
        assert.equal(input.source, 'c');
        assert.equal(input.version, 5);
        assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
        assert.deepEqual(recordingIntegrityErrors({segments: [part]}), []);
    }
    const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            const rock = g.level.objects.find(o => o.otyp === ONAMES.ROCK);
            states.push({step, hero: [g.u.ux, g.u.uy], rogue: !!Is_rogue_level(g.u.uz),
                xray: g.u.xray_range, hallucination: Hallucination(), blind: Blind(),
                timeout: g.u.intrinsic?.HHallucination || 0,
                eyes: g.u.ublindf?.oartifact || 0, worn: g.u.ublindf?.owornmask || 0,
                rock: rock ? {id: rock.o_id, where: rock.where, x: rock.ox, y: rock.oy,
                    inFloorIndex: g.level.objectAt(rock.ox, rock.oy) === rock,
                    visible: !!cansee(rock.ox, rock.oy), couldSee: !!couldsee(rock.ox, rock.oy),
                    seenv: g.level.at(rock.ox, rock.oy).seenv} : null});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
    const output = outputs(run), actualHashes = hashes(output);
    const unobserved = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
    observed.segments.push({steps: output.screens.map(screen => ({screen}))});
    const last = states.at(-1);
    await test(`${part.name}: complete input and transparent observer`, () => {
        for (const key of ['screens', 'cursors', 'slices', 'frames'])
            assert.equal(output[key].length, part.moves.length + 1, key);
        assert.deepEqual(actualHashes, hashes(unobserved));
        assert.equal(output.rng.length, [2393, 2371, 2239, 2685][index]);
        assert.deepEqual(output.slices.flat(), output.rng);
        assert.ok(output.rng.every(call => /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(call)),
            'no diagnostic entries leak into the ordinary call stream');
        assert.equal(output.frames.flat().length, 0);
    });
    await test(`${part.name}: real facewear, potion and floor producers`, () => {
        assert.equal(last.rogue, index === 3);
        assert.equal(last.eyes, index === 2 ? 0 : ART_EYES_OF_THE_OVERWORLD);
        assert.equal(last.xray, index === 2 ? -1 : 3);
        assert.ok(last.worn & W_TOOL);
        assert.equal(last.blind, false);
        assert.equal(last.hallucination, index !== 1);
        assert.equal(last.timeout > 0, index !== 1);
        assert.ok(last.rock?.visible);
        assert.equal(last.rock.where, OBJ_FLOOR);
        assert.equal(last.rock.inFloorIndex, true);
        assert.ok(states.some(s => s.rock && !s.hallucination),
            'the rock is dropped before the potion effect');
        if (index === 0) {
            assert.deepEqual(last.hero, [11, 13]);
            assert.deepEqual([last.rock.x, last.rock.y], [10, 13]);
            assert.equal(last.rock.seenv, 255);
            const moves = states.filter(s => s.hallucination && s.eyes && s.rock);
            assert.ok(moves.some(s => s.hero[0] === s.rock.x && s.hero[1] === s.rock.y),
                'real movement enters the rock square before leaving it');
            assert.ok(moves.some(s => s.hero[0] !== s.rock.x || s.hero[1] !== s.rock.y));
        }
    });
    reports.push({name: part.name, boundaries: output.screens.length,
        calls: output.rng.length, frames: output.frames.flat().length,
        hashes: actualHashes, screenHashes: output.screens.map(hash), states});
}
await test('paired recipe uses known categories and real observable setup', () => {
    const coverage = JSON.parse(fs.readFileSync(new URL(
        'gen-sessions/coverage-requirements.json', import.meta.url)));
    const known = new Set(coverage.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(id => known.has(id)));
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, observed), []);
});
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({
    evidence: 'Ordinary JS reach only; no native parity claim', reports,
}, null, 2) + '\n');
