import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3, 'optional argument: compact report path');
const root = new URL('../', import.meta.url), js = new URL('js/', root);
const sha = value => createHash('sha256').update(value).digest('hex');
const recipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/config-line-assembly-contract.json', root));
const recipe = JSON.parse(recipeBytes);
assert.equal(sha(recipeBytes), '1bd3a156b364cc68c96c370e0d4db311e3a883297bb442863c71e181fef6d244');
const lockBytes = readFileSync(new URL('tools/gen-sessions/evidence/config-line-assembly-contract/input-lock.json', root));
assert.equal(sha(lockBytes), '7652fface1c5f19f9d1ac43c59a0475b9037f5e53b37d24da201be614d3c64b8');
const lock = JSON.parse(lockBytes);
assert.equal(sha(recipeBytes), lock.recipeSHA256);
assert.deepEqual(lock.fields, ['seed', 'datetime', 'nethackrc', 'moves', 'name']);
assert.equal(recipe.segments.length, 12);
assert.equal(recipe.branchAssertions.length, 12);
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
assert.equal(recipe.requireBranchAssertions, true);
assert.deepEqual(recipe.branchAssertions.map(a => a.branch), recipe.branches);
assert.deepEqual(branchAssertionErrors(recipe), []);
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/evidence/config-line-assembly-contract/canonical-inputs.json', root));
assert.equal(sha(canonicalBytes), 'd4d1bdc245fa48037ffdd754779b5d65ddc275befa32beb14f5eec67b2fbe3da');
const canonical = JSON.parse(canonicalBytes);
const negativeBytes = readFileSync(new URL('tools/gen-sessions/evidence/config-line-assembly-contract/negative-hashes.json', root));
assert.equal(sha(negativeBytes), '4611b64ae486ad5b8e38fe20d81ff970619c7f282084d0d026f707ecf2f6f1b3');
const negatives = JSON.parse(negativeBytes);
assert.equal(negatives.controls.length, 3);
// Mandatory canonical C evidence, checked before ordinary runtime imports.
const rawBytes = readFileSync(new URL('tools/gen-sessions/generated/config-line-assembly-contract.session.json', root));
assert.equal(sha(rawBytes), '22f7576060003ecaa1157b63552a74394ee8ec83a2d76e831dbce7fa9c33303d');
const native = JSON.parse(rawBytes);
assert.equal(native.version, 5);
assert.equal(native.source, 'c');
assert.ok(Array.isArray(native.segments));
assert.equal(native.segments.length, 12);
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
        boundaries++;
        calls += step.rng.length;
        frames += (step.animation_frames || []).length;
    }
}
assert.deepEqual({boundaries, calls, frames, keys}, {boundaries: 200, calls: 32580, frames: 0, keys: 188});
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
const nativePreflight = {sha256: sha(rawBytes), version: 5, source: 'c',
    segments: 12, fields: lock.fields, boundaries, calls, frames, keys,
    primaryBranchAssertions: 12, integrityErrors: [], branchErrors: []};
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const {Blind} = await import(new URL('youprop.js', js));
const {TIMEOUT} = await import(new URL('const.js', js));
const {CLR_RED, ATR_BOLD: TERM_BOLD} = await import(new URL('terminal.js', js));
const symbols = await import(new URL('symbols.js', js));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
const text = screen => decodeScreen(screen).map(row => row.map(renderCell).join('').trimEnd()).join('\n');
const deadline = setTimeout(() => { console.error('55 second config line input limit'); process.exit(2); }, 55000);
const results = [];
try {
    for (const [index, part] of recipe.segments.entries()) {
        const row = {name: part.name, checks: []}, states = [];
        const check = (name, fn) => {
            try { fn(); row.checks.push({name, pass: true}); }
            catch (error) { row.checks.push({name, pass: false, error: error.message.slice(0, 900)}); }
        };
        let output;
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        try {
            globalThis.__step_snapshot = {step: '*', cb(g, step) {
                states.push({step, turn: g.moves, blind: !!Blind(), timeout: (g.u?.intrinsic?.HBlinded || 0) & TIMEOUT,
                    notices: !!g.flags?.spot_monsters,
                    noticeOption: g.rc?.opts?.spot_monsters,
                    noticeOptionPresent: g.rc?.optSetInConfig?.spot_monsters === true,
                    errors: [...(g.rc?.errors || [])], unhandled: [...(g.rc?.unhandled || [])],
                    symbolDirectives: [...(g.rc?.symbols || [])],
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
        check('all-five equality to explicit canonical valid RC', () => assert.deepEqual(hashes(output), hashes(reference)));
        check('no collected errors or unsupported statements', () => {
            assert.ok(states.every(s => !s.errors.length && !s.unhandled.length));
        });
        const assertion = {...recipe.branchAssertions[index], segment: 0};
        check('primary gameplay branch assertion', () => assert.deepEqual(branchAssertionErrors({
            branches: [assertion.branch], segments: [part], requireBranchAssertions: true, branchAssertions: [assertion],
        }, {segments: [{steps: output.screens.map((screen, i) => ({screen, rng: output.slices[i]}))}]}), []));
        if (part.name.includes('notice-off'))
            check('real blindness producer expires at88 with monster notices disabled', () => {
                assert.ok(states.some(s => s.blind && s.timeout > 0));
                assert.equal(states[88].blind, false); assert.equal(states[88].timeout, 0);
                assert.equal(states[88].notices, false);
                assert.ok(states.every(s => s.noticeOption === false && s.noticeOptionPresent));
            });
        if (part.name.includes('rogue-'))
            check('actual Rogue-level producer selects rogue symbols', () => assert.ok(states.some(s => s.graphics === symbols.ROGUESET)));
        if (/menucolor|menu-negative/.test(part.name))
            check('real inventory renders red bold quarterstaff', () => {
                assert.ok(output.screens.some(screen => decodeScreen(screen).some(cells => {
                    const str = cells.map(renderCell).join(''), at = str.indexOf('quarterstaff');
                    return at >= 0 && cells.slice(at, at + 12).every(c => c.color === CLR_RED && (c.attr & TERM_BOLD));
                })));
            });
        if (part.name.includes('autopickup-exception'))
            check('real drop and pickup consumes matching exception', () => {
                const first = states.find(s => s.inventory.length)?.inventory.find(o => o.invlet === 'a' || o.invlet === 97);
                assert.ok(first);
                assert.ok(states.some(s => !s.inventory.some(o => o.otyp === first.otyp)));
                assert.ok(states.at(-1).inventory.some(o => o.otyp === first.otyp));
                assert.ok(states.every(s => s.apes.some(a => a.grab && a.pattern === 'quarterstaff')));
            });
        if (part.name.includes('msgtype-'))
            check('real sit turns advance while the matching message is hidden', () => {
                assert.ok(states.at(-1).turn > states[0].turn);
                assert.ok(output.screens.every(screen => !text(screen).includes('You sit on the stairs.')));
            });
        if (part.name.includes('eof-pending'))
            check('pending SYMBOLS never reaches the real handler', () => {
                assert.ok(states.every(s => s.symbolDirectives.length === 0));
            });
        row.hashes = hashes(output); row.canonicalHashes = hashes(reference);
        row.boundaries = output.screens.length; row.calls = output.calls.length;
        row.frames = output.frames.flat().length;
        row.unaffectedControl = recipe.derivations[index].unaffectedControl;
        row.pass = row.checks.every(c => c.pass); results.push(row);
    }
    for (const negative of negatives.controls) {
        const row = results.find(r => r.name === negative.name);
        assert.ok(row?.unaffectedControl);
        assert.deepEqual(Object.keys(negative.hashes).sort(), ['calls', 'cursors', 'frames', 'screens', 'slices']);
        assert.deepEqual(row.hashes, negative.hashes, negative.name);
    }
    const report = {nativePreflight, recipeSHA256: sha(recipeBytes), total: results.length,
        passed: results.filter(r => r.pass).length, nativeStatus: 'mandatory exact C preflight passed', results};
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
