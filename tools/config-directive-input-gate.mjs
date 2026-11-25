import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3, 'optional argument: compact report path');
const root = new URL('../', import.meta.url), js = new URL('js/', root);
const recipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/config-directive-contract.json', root));
const recipe = JSON.parse(recipeBytes);
const sha = value => createHash('sha256').update(value).digest('hex');
const lockBytes = readFileSync(new URL('tools/gen-sessions/evidence/config-directive-contract/input-lock.json', root));
assert.equal(sha(lockBytes), '8de73aa733c1733a93af13b444e2059e79a611fd2540e73aab354bc4c603f2a8');
const lock = JSON.parse(lockBytes);
assert.equal(sha(recipeBytes), lock.recipeSHA256);
assert.equal(recipe.segments.length, 11);
assert.equal(recipe.branchAssertions.length, 11);
const tuples = recipe.segments.map(part => lock.fields.map(field => {
    assert.ok(Object.hasOwn(part, field), `${part.name}: missing ${field}`);
    return [field, part[field]];
}));
assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
recipe.segments.forEach((part, i) => {
    assert.equal(part.name, lock.segments[i].name);
    assert.equal(part.moves.length, lock.segments[i].keys);
    assert.equal(sha(JSON.stringify(tuples[i])), lock.segments[i].inputSHA256);
});
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/evidence/config-directive-contract/canonical-inputs.json', root));
assert.equal(sha(canonicalBytes), '8d07868e2e7b19c6f874b2dd76bd1c7fe9e5e934b5c7c3d4843872924c3887b8');
const canonical = JSON.parse(canonicalBytes);
assert.deepEqual(branchAssertionErrors(recipe), []);
// Mandatory unchanged native evidence, before any ordinary runtime import.
const rawBytes = readFileSync(new URL('tools/gen-sessions/generated/config-directive-contract.session.json', root));
assert.equal(sha(rawBytes), '11969c506804f7ee408c5c65ae65bff670d1185d4b358e51275d69a4d6852430');
const native = JSON.parse(rawBytes);
assert.equal(native.version, 5); assert.equal(native.source, 'c');
assert.ok(Array.isArray(native.segments)); assert.equal(native.segments.length, 11);
assert.deepEqual(lock.fields, ['seed', 'datetime', 'nethackrc', 'moves', 'name']);
let boundaries = 0, calls = 0, frames = 0, keys = 0;
for (const [i, segment] of native.segments.entries()) {
    for (const field of lock.fields) {
        assert.ok(Object.hasOwn(segment, field), `native ${i}: missing ${field}`);
        assert.deepEqual(segment[field], recipe.segments[i][field], `native ${i}: ${field}`);
    }
    assert.ok(Array.isArray(segment.steps));
    assert.equal(segment.steps.length, segment.moves.length + 1);
    keys += segment.moves.length;
    for (const [stepIndex, step] of segment.steps.entries()) {
        assert.ok(Object.hasOwn(step, 'key'));
        assert.equal(step.key, stepIndex ? segment.moves[stepIndex - 1] : null);
        assert.equal(typeof step.screen, 'string');
        assert.ok(Array.isArray(step.cursor) && step.cursor.length === 3);
        assert.ok(Array.isArray(step.rng) && step.rng.every(call => typeof call === 'string'));
        if (Object.hasOwn(step, 'animation_frames')) assert.ok(Array.isArray(step.animation_frames));
        boundaries++; calls += step.rng.length; frames += (step.animation_frames || []).length;
    }
}
assert.deepEqual({boundaries, calls, frames, keys}, {boundaries: 385, calls: 29478, frames: 0, keys: 374});
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.equal(recipe.requireBranchAssertions, true);
assert.deepEqual(recipe.branchAssertions.map(assertion => assertion.branch), recipe.branches);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
const negativeBytes = readFileSync(new URL('tools/gen-sessions/evidence/config-directive-contract/negative-hashes.json', root));
assert.equal(sha(negativeBytes), 'e37917837ad7266e038b4daef1a75efaa90aa6f429035b8247ab9679ea53fc76');
const negatives = JSON.parse(negativeBytes);
assert.equal(negatives.controls.length, 3);
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const {Blind} = await import(new URL('youprop.js', js));
const {TIMEOUT} = await import(new URL('const.js', js));
const {CLR_RED, ATR_BOLD: TERM_BOLD} = await import(new URL('terminal.js', js));
const symbols = await import(new URL('symbols.js', js));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
const text = screen => decodeScreen(screen).map(row => row.map(renderCell).join('').trimEnd()).join('\n');
const deadline = setTimeout(() => { console.error('55 second config directive input limit'); process.exit(2); }, 55000);
const results = [];
try {
    for (const [index, part] of recipe.segments.entries()) {
        const row = {name: part.name, checks: []}, states = [];
        const check = (name, fn) => {
            try { fn(); row.checks.push({name, pass: true}); }
            catch (error) { row.checks.push({name, pass: false, error: error.message.slice(0, 800)}); }
        };
        let output;
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        try {
            globalThis.__step_snapshot = {step: '*', cb(g, step) {
                states.push({step, turn: g.moves, blind: !!Blind(), timeout: (g.u?.intrinsic?.HBlinded || 0) & TIMEOUT,
                    accessiblemsg: !!g.flags?.accessiblemsg, notices: !!g.flags?.spot_monsters,
                    errors: [...(g.rc?.errors || [])], unhandled: [...(g.rc?.unhandled || [])],
                    graphics: symbols.gc_currentgraphics.set,
                    inventory: (g.invent || []).map(o => ({otyp: o.otyp, invlet: o.invlet})),
                    apes: (g.apelist || []).map(a => ({pattern: a.pattern, grab: a.grab}))});
            }};
            output = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
        const plain = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        const late = await deferred(part);
        const reference = outputs(await runSegment({...canonical[part.name], storage: new InMemoryStorage()}));
        check('all keys and all-five observer/deferred equality', () => {
            assert.deepEqual(output, plain); assert.deepEqual(output, late);
            assert.deepEqual(output.slices.flat(), output.calls);
            for (const key of ['screens', 'cursors', 'slices', 'frames'])
                assert.equal(output[key].length, part.moves.length + 1);
            assert.equal(states.length, part.moves.length + 1);
        });
        check('identical all-five output to canonical valid directive form', () => assert.deepEqual(hashes(output), hashes(reference)));
        check('valid RC has no collected errors or unsupported statements', () => {
            assert.ok(states.every(s => !s.errors.length && !s.unhandled.length));
        });
        const assertion = {...recipe.branchAssertions[index], segment: 0};
        check('original producer and consumer branch assertion', () => assert.deepEqual(branchAssertionErrors({
            branches: [assertion.branch], segments: [part], requireBranchAssertions: true, branchAssertions: [assertion],
        }, {segments: [{steps: output.screens.map((screen, i) => ({screen, rng: output.slices[i]}))}]}), []));
        if (/options-colon|opti-prefix|canonical-options/.test(part.name)) {
            check('actual blindness producer expires before input88', () => {
                assert.ok(states.some(s => s.blind && s.timeout > 0));
                assert.equal(states[88].blind, false); assert.equal(states[88].timeout, 0);
                if (part.name === 'opti-prefix-notice-off') assert.equal(states[88].notices, false);
                else assert.equal(states[88].accessiblemsg, false);
            });
        }
        if (/rogue-prefix/.test(part.name))
            check('actual Rogue-level producer selects rogue symbols', () => assert.ok(states.some(s => s.graphics === symbols.ROGUESET)));
        if (/menu/.test(part.name)) {
            check('real inventory renders red bold quarterstaff', () => {
                assert.ok(output.screens.some(screen => decodeScreen(screen).some(cells => {
                    const str = cells.map(renderCell).join(''), at = str.indexOf('quarterstaff');
                    return at >= 0 && cells.slice(at, at + 12).every(c => c.color === CLR_RED && (c.attr & TERM_BOLD));
                })));
            });
        }
        if (/autop-prefix/.test(part.name)) {
            check('real drop and pickup consumes matching exception', () => {
                const first = states.find(s => s.inventory.length)?.inventory.find(o => o.invlet === 'a' || o.invlet === 97);
                assert.ok(first);
                assert.ok(states.some(s => !s.inventory.some(o => o.otyp === first.otyp)));
                assert.ok(states.at(-1).inventory.some(o => o.otyp === first.otyp));
                assert.ok(states.every(s => s.apes.some(a => a.grab && a.pattern === 'quarterstaff')));
            });
        }
        if (/msgtype/.test(part.name))
            check('sit commands take time while their matched message is hidden', () => {
                assert.ok(states.at(-1).turn > states[0].turn);
                assert.ok(output.screens.every(screen => !text(screen).includes('You sit on the stairs.')));
            });
        row.hashes = hashes(output); row.canonicalHashes = hashes(reference);
        row.boundaries = output.screens.length; row.calls = output.calls.length;
        row.frames = output.frames.flat().length;
        row.unaffectedControl = recipe.derivations[index].unaffectedControl;
        row.pass = row.checks.every(c => c.pass); results.push(row);
    }
    for (const negative of negatives.controls) {
        const result = results.find(row => row.name === negative.name);
        assert.ok(result?.unaffectedControl);
        assert.deepEqual(Object.keys(negative.hashes).sort(), ['calls', 'cursors', 'frames', 'screens', 'slices']);
        assert.deepEqual(result.hashes, negative.hashes, negative.name);
    }
    const report = {recipeSHA256: sha(recipeBytes), total: results.length,
        passed: results.filter(r => r.pass).length, results};
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
