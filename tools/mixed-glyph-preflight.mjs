import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reportPath, js, sha } from './fruit-text-preflight.mjs';

// Shared metadata preflight. Gameplay imports occur only in the two callers.
const repoRoot = new URL('../', import.meta.url);
const evidence = new URL('tools/gen-sessions/evidence/mixed-glyph-contract/', repoRoot);
const read = name => JSON.parse(fs.readFileSync(new URL(name, evidence)));
const contractBytes = fs.readFileSync(new URL('contract.json', evidence));
assert.equal(sha(contractBytes), 'b19f96023935b9d5c060f560d8ae3f6d1a1581fa12db68c1300cd7549c79fb4a');
const contract = JSON.parse(contractBytes);
assert.equal(contract.reviewedCVersion, '16ff59115315917b93185d026aeefea06db9b0f4');
for (const [file, digest] of Object.entries(contract.portableDependencyPins))
    assert.equal(sha(fs.readFileSync(new URL(file, repoRoot))), digest, file);
for (const [file, digest] of Object.entries(contract.evidencePins))
    assert.equal(sha(fs.readFileSync(new URL(file, evidence))), digest, file);
const derivation = read('source-gate-derivation.json');
let source = fs.readFileSync(new URL('source/original-gate.mjs', evidence), 'utf8');
assert.equal(sha(source), derivation.originalSHA256);
for (const [before, after] of derivation.replacements) {
    assert.equal(source.split(before).length, 2);
    source = source.replace(before, after);
}
assert.equal(sha(source), derivation.portableSHA256);
assert.equal(fs.readFileSync(new URL('tools/mixed-glyph-source-gate.mjs', repoRoot), 'utf8'), source);
assert.equal(derivation.assertionsChanged, false);
const baselineSource = read('source/baseline.json'), firstCandidate = read('source/candidate-v1.json');
assert.equal(baselineSource.passed, 5); assert.equal(baselineSource.total, 16);
assert.equal(firstCandidate.passed, 15); assert.equal(firstCandidate.total, 16);
assert.deepEqual(firstCandidate.rows.filter(r => !r.pass).map(r => r.name), ['message/NOSTOP-overrides-once']);
assert.match(fs.readFileSync(new URL('source/setup1-failure.log', evidence), 'utf8'), /real wall producer/);
assert.equal(read('source/setup2-baseline.json').passed, 4);
assert.equal(read('source/setup2-candidate.json').passed, 7);

const { recordingIntegrityErrors } = await import(new URL('tools/gen-sessions/assertions.mjs', repoRoot));
const { decodeScreen, renderCell } = await import(new URL('frozen/screen-decode.mjs', repoRoot));
const pins = read('fixture-pins.json'), fixtures = {}, expected = {};
assert.equal(Object.keys(pins).length, 9);
const fields = ['seed', 'datetime', 'nethackrc', 'moves', 'name'];
let boundaries = 0, oldBlankStyleCells = 0;
const styleFailures = [];
for (const [name, pin] of Object.entries(pins)) {
    const raw = fs.readFileSync(new URL(pin.canonical, repoRoot));
    assert.equal(sha(raw), pin.sha256, name); assert.equal(raw.length, pin.bytes);
    const fixture = JSON.parse(raw);
    assert.equal(fixture.source, 'c'); assert.equal(fixture.version, 5);
    assert.equal(fixture.segments.length, pin.segments);
    assert.deepEqual(recordingIntegrityErrors(fixture), [], name);
    for (const [i, part] of fixture.segments.entries()) {
        // Original optional-field presence is preserved, including unnamed public segments.
        const tuple = fields.map(f => [f, Object.hasOwn(part, f), part[f] ?? null]);
        assert.equal(sha(JSON.stringify(tuple)), pin.parts[i].fieldsSHA256, `${name}/${i}`);
        assert.equal(part.moves.length, pin.parts[i].keys);
        assert.equal(part.steps.length, pin.parts[i].boundaries);
        assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
        boundaries += part.steps.length;
    }
    const published = read('reports/published-' + name), regressed = read('reports/regressed-' + name);
    assert.equal(published.length, fixture.segments.length);
    assert.equal(regressed.length, published.length);
    for (const [i, row] of published.entries()) {
        assert.ok(row.frozenScreenCursorExact && row.fullRngExact && row.animationExact);
        assert.equal(row.boundaries.actual, fixture.segments[i].steps.length);
        for (const stream of ['cursors', 'calls', 'slices', 'frames'])
            assert.equal(row.rawHashes.js[stream], regressed[i].rawHashes.js[stream]);
        oldBlankStyleCells += row.blankStyleMismatches;
    }
    if (published.some(r => !r.fullStyleExact)) styleFailures.push(name);
    fixtures[name] = fixture; expected[name] = published;
}
assert.equal(boundaries, 6160); assert.equal(oldBlankStyleCells, 1182);
assert.deepEqual(styleFailures.sort(), [...contract.knownFullStyleFailureFixtures].sort());
const accounting = read('accounting.json');
assert.equal(accounting.newRegressions.length, 17);
for (const row of accounting.newRegressions) {
    const { x, y, c } = row.difference;
    const grid = decodeScreen(fixtures[row.fixture].segments[row.segment].steps[row.step].screen);
    assert.deepEqual({ch: renderCell(grid[y][x]), color: grid[y][x].color, attr: grid[y][x].attr}, c);
}
export { reportPath, js, sha, fixtures, expected, baselineSource, accounting, decodeScreen, renderCell };
