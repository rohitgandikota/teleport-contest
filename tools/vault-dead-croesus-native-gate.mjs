// Immutable C witnesses, independent of runtime replay and observer state.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const bytes = fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-dead-croesus-response.session.json', import.meta.url));
const raw = JSON.parse(bytes);
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-dead-croesus-response.json', import.meta.url)));
const requirements = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/coverage-requirements.json', import.meta.url)));
const boundaries = [135, 158, 163, 135], calls = [6055, 5914, 5914, 5960];
const steps = [[128, 129, 130], [151, 152, 153], [156], [128]];
const messages = [
    ['The guard gets angry!--More--', '"Back from the dead, are you?  I\'ll remedy that!"--More--',
        'The guard wields a dagger!'],
    ['The guard gets angry!--More--', 'The guard mouths something and looks very angry!--More--',
        "The guard wields a knife!  The knife welds itself to the guard's hand!"],
    ['It gets angry!'],
    ['"Oh, yes, of course.  Sorry to have disturbed you."'],
];
const cursors = [[[29, 0, 1], [57, 0, 1], [22, 6, 1]],
    [[29, 0, 1], [56, 0, 1], [22, 6, 1]], [[22, 6, 1]], [[22, 6, 1]]];

function boundary(index, step) {
    const value = raw.segments[index].steps[step];
    const grid = decodeScreen(value.screen);
    const lines = grid.map(row => row.map(cell => cell.ch).join('').trimEnd());
    return {key: value.key, message: lines[0], status: lines[23],
        cursor: value.cursor, rng: value.rng, ledger: lines.slice(0, 4).map(s => s.trim()),
        hero: grid[6][22], guard: grid[6][24]};
}
function witness(index) {
    return {forced: boundary(index, 53).key, kill: boundary(index, 66),
        ledger: boundary(index, 82), events: steps[index].map(step => boundary(index, step))};
}
function assertWitness(index, value) {
    assert.equal(value.forced, index === 3 ? 'n' : 'y');
    // The kill message alone is deliberately identical for the shapechanger.
    assert.match(value.kill.message, /^You kill Croesus!/);
    assert.match(value.kill.rng[0], /@ xkilled\(mon\.c:3587\)$/);
    assert.equal(value.ledger.ledger[0], 'Vanquished creatures:');
    assert.equal(value.ledger.ledger[2], index === 3 ? 'a doppelganger' : 'Croesus');
    assert.deepEqual(value.ledger.cursor, [49, 3, 1]);
    assert.deepEqual(value.ledger.rng, []);
    assert.deepEqual(value.events.map(e => e.message), messages[index]);
    assert.deepEqual(value.events.map(e => e.cursor), cursors[index]);
    for (const event of value.events.slice(0, -1)) assert.deepEqual(event.rng, []);
    const final = value.events.at(-1);
    assert.equal(final.status.includes(' Deaf'), index === 1 || index === 2);
    assert.equal(final.status.includes(' Blind'), index === 2);
    assert.deepEqual(final.hero, {ch: '@', color: 15, attr: 0, decgfx: 0});
    assert.deepEqual(final.guard, index === 3
        ? {ch: 'x', color: 8, attr: 0, decgfx: 1}
        : index === 2 ? {ch: 'I', color: 8, attr: 0, decgfx: 0}
            : {ch: '@', color: 4, attr: 0, decgfx: 0});
    if (index < 3) {
        assert.deepEqual(final.rng, [
            `rn2(67)=${index === 0 ? 18 : 20} @ moveloop_core(allmain.c:360)`]);
    } else {
        // mongone finishes its entire disposal packet before the next turn call.
        assert.deepEqual(final.rng, [26, 11, 87, 5, 37]
            .map(n => `rn2(100)=${n} @ obj_resists(zap.c:1469)`)
            .concat('rn2(67)=6 @ moveloop_core(allmain.c:360)'));
    }
}

test('unchanged C bytes, five input fields, every key, recipe tags and frame counts', () => {
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
        '3af6cdad42040a889919296776e961f44a7557859a2c3412dc583b419a951738');
    assert.equal(raw.source, 'c');
    assert.equal(raw.version, 5);
    assert.equal(raw.segments.length, 4);
    assert.equal(recipe.branchAssertions.length, 4);
    for (const [i, part] of raw.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[field], recipe.segments[i][field], field);
        assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
        assert.equal(part.steps.length, boundaries[i]);
        assert.equal(part.steps.reduce((n, step) => n + step.rng.length, 0), calls[i]);
        assert.equal(part.steps.reduce((n, step) => n + (step.animation_frames || []).length, 0), 0);
    }
    assert.deepEqual(recordingIntegrityErrors(raw), []);
    assert.deepEqual(branchAssertionErrors(recipe, raw), []);
    const tags = new Set(requirements.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(tag => tags.has(tag)));
});
for (const [index, part] of raw.segments.entries()) {
    test(`${part.name}: actual native ledger, feedback order and caller boundary`, () => {
        assertWitness(index, witness(index));
    });
}
test('negative: a Croesus kill message cannot substitute for a true-species ledger entry', () => {
    const changed = structuredClone(witness(3));
    changed.ledger.ledger[2] = 'Croesus';
    assert.throws(() => assertWitness(3, changed), assert.AssertionError);
});
test('negative: name answer cannot substitute for forcing true Croesus creation', () => {
    const changed = structuredClone(witness(0));
    changed.forced = 'n';
    assert.throws(() => assertWitness(0, changed), assert.AssertionError);
});
test('negative: response cannot precede the anger message', () => {
    const changed = structuredClone(witness(0));
    [changed.events[0], changed.events[1]] = [changed.events[1], changed.events[0]];
    assert.throws(() => assertWitness(0, changed), assert.AssertionError);
});
test('negative: turn RNG cannot run while anger feedback still waits', () => {
    const changed = structuredClone(witness(1));
    changed.events[0].rng.push(changed.events[2].rng.shift());
    assert.throws(() => assertWitness(1, changed), assert.AssertionError);
});
test('negative: a blind/deaf response cannot expose the visual gesture', () => {
    const changed = structuredClone(witness(2));
    changed.events[0].message = 'The guard mouths something and looks very angry!';
    assert.throws(() => assertWitness(2, changed), assert.AssertionError);
});
test('negative: peaceful dismissal must finish every inventory disposal call', () => {
    const changed = structuredClone(witness(3));
    changed.events[0].rng.splice(2, 1);
    assert.throws(() => assertWitness(3, changed), assert.AssertionError);
});
