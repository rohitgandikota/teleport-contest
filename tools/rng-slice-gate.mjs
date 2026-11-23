#!/usr/bin/env node
// Verify complete RNG streams and each input's slice, including extra JS calls.
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {normalizeSession} from '../frozen/session_loader.mjs';

const paths = process.argv.slice(2);
if (!paths.length) {
    console.error('Usage: node tools/rng-slice-gate.mjs <session.json> [...]');
    process.exit(2);
}
const calls = entries => (entries || [])
    .map(entry => String(entry).replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim())
    .filter(entry => /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry));

for (const path of paths) {
    const input = normalizeSession(JSON.parse(readFileSync(path)));
    const storage = new InMemoryStorage();
    const result = {path, segments: 0, steps: 0, matchingSteps: 0,
        expectedCalls: 0, actualCalls: 0, blankExitFrames: 0, errors: []};
    for (const [segment, part] of input.segments.entries()) {
        const run = await runSegment({seed: part.seed, datetime: part.datetime,
            nethackrc: part.nethackrc, moves: part.moves, storage});
        const actual = calls(run.getRngLog());
        const expected = part.steps.flatMap(step => calls(step.rng));
        result.segments++;
        result.expectedCalls += expected.length;
        result.actualCalls += actual.length;
        if (actual.length !== expected.length)
            result.errors.push({segment, kind: 'stream-length',
                expected: expected.length, actual: actual.length});
        const first = expected.findIndex((call, i) => call !== actual[i]);
        if (first >= 0)
            result.errors.push({segment, kind: 'stream-call', index: first,
                expected: expected[first], actual: actual[first] ?? null});

        const slices = [...run.getRngSlices()];
        // C emits a blank terminal frame after character-selection cancellation.
        // The judge omits it. Accept only a completed game with that blank
        // terminal and no recorded calls or animation at the omitted boundary.
        const last = part.steps.at(-1);
        if (slices.length + 1 === part.steps.length
            && last?.screen === '' && calls(last.rng).length === 0
            && !(last.animation_frames || []).length
            && game.program_state?.gameover
            && run._display?.terminal.serialize() === '') {
            slices.push([]);
            result.blankExitFrames++;
        }
        if (slices.length !== part.steps.length)
            result.errors.push({segment, kind: 'step-count',
                expected: part.steps.length, actual: slices.length});
        for (const [step, recorded] of part.steps.entries()) {
            const c = calls(recorded.rng), js = calls(slices[step]);
            result.steps++;
            if (c.length === js.length && c.every((call, i) => call === js[i])) {
                result.matchingSteps++;
            } else if (result.errors.length < 20) {
                const index = c.findIndex((call, i) => call !== js[i]);
                const at = index < 0 ? c.length : index;
                result.errors.push({segment, step, kind: 'input-slice',
                    expectedLength: c.length, actualLength: js.length, index: at,
                    expected: c[at] ?? null, actual: js[at] ?? null});
            }
        }
    }
    console.log(JSON.stringify(result));
    if (result.errors.length || result.matchingSteps !== result.steps)
        process.exitCode = 1;
}
