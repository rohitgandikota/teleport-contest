// Ordinary-key branch reach and all-five observer neutrality, not native parity.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {observe, unobserved, hashes} from './brain-drain-owner-observe.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {W_AMUL, W_ARMH} from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/brain-drain-owner.json', import.meta.url)));
assert.equal(recipe.requireBranchAssertions, true);
assert.deepEqual(branchAssertionErrors(recipe), []);
const tuple = part => ['name','seed','datetime','nethackrc','moves']
    .map(field => ({field,present:Object.hasOwn(part,field),value:part[field]}));
if (process.argv[2]) {
    const input = JSON.parse(readFileSync(process.argv[2]));
    assert.equal(input.source, 'c'); assert.equal(input.version, 5);
    assert.equal(input.segments.length, recipe.segments.length);
    for (const [i, part] of input.segments.entries()) {
        assert.deepEqual(tuple(part), tuple(recipe.segments[i]));
        if (part.steps.length) assert.deepEqual(part.steps.map(s => s.key), [null,...part.moves]);
    }
    if (input.segments.some(part => part.steps.length)) {
        assert.deepEqual(recordingIntegrityErrors(input), []);
        assert.deepEqual(branchAssertionErrors(recipe, input), []);
    }
}
const at = (states, step) => states.findLast(s => s.step <= step);
for (const [i, part] of recipe.segments.entries()) test(`${part.name}: executable branch, real producers and all-five neutrality`, async () => {
    const seen = await observe(part, true), plain = await unobserved(part);
    assert.deepEqual(seen.output, plain);
    assert.deepEqual(seen.hashes, hashes(plain));
    assert.equal(seen.boundaries, part.moves.length + 1);
    assert.deepEqual(seen.output.calls, seen.output.slices.flat());
    const assertion = recipe.branchAssertions[i];
    const generated = {source:'js', version:5, segments:[]};
    generated.segments[i] = {steps:seen.output.screens.map((screen, step) => ({
        screen, cursor:seen.output.cursors[step], rng:seen.output.slices[step],
    }))};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[assertion.branch],
        branchAssertions:[assertion]}, generated), []);
    const text = seen.lines.map(line => line.text).join('\n');
    assert.doesNotMatch(text, /Die\?|OK, so you don't die|possessions identified/);
    assert.ok(seen.states.every(s => (s.mortality || 0) === 0));
    assert.ok(seen.states.at(-1).hp > 0 && seen.states.at(-1).mh > 0);

    if (i <= 2) {
        const touch = seen.lines.find(l => /Your tentacles suck the green slime/.test(l.text));
        const harmless = seen.lines.find(l => l.step > touch?.step && /green slime doesn't seem harmed/.test(l.text));
        assert.ok(touch && harmless); assert.match(touch.text, /--More--/);
        const before = at(seen.states, touch.step), after = seen.states.at(-1);
        assert.equal(before.form, P.PM_MIND_FLAYER);
        const mon = before.monsters.find(m => m.type === P.PM_GREEN_SLIME);
        assert.ok(mon && mon.hp > 0);
        assert.ok(Math.abs(mon.x-before.hero[0]) <= 1 && Math.abs(mon.y-before.hero[1]) <= 1);
        assert.equal(after.monsters.find(m => m.id === mon.id).hp, mon.hp);
        assert.equal(after.skipdrin, true);
        if (i === 0) {
            assert.equal(before.slimed, 0); assert.equal(before.unchanging, false);
            const pending = at(seen.states, harmless.step);
            assert.equal(pending.slimed, 0); assert.equal(pending.skipdrin, true);
            assert.match(harmless.text, /--More--/);
            const warning = seen.lines.find(l => /You suck in some slime/.test(l.text));
            assert.ok(warning && warning.step > harmless.step);
            // The owner sets ten, then this ordinary turn consumes one tick.
            assert.equal(after.slimed, 9);
        } else if (i === 1) {
            assert.equal(before.unchanging, true); assert.equal(after.slimed, 0);
            assert.ok(before.inventory.some(o => o.type === O.AMULET_OF_UNCHANGING && o.worn === W_AMUL));
        } else {
            assert.equal(before.slimed, 100); assert.equal(after.slimed, 99);
            assert.equal(before.unchanging, false);
        }
    } else if (i === 3 || i === 4) {
        const touch = seen.lines.find(l => /master mind flayer's tentacles suck the gray ooze/.test(l.text));
        const harmless = seen.lines.find(l => l.step > touch?.step && /gray ooze doesn't seem harmed/.test(l.text));
        assert.ok(touch && harmless);
        const before = at(seen.states, touch.step), after = at(seen.states, harmless.step + 1);
        const attacker = before.monsters.find(m => m.type === P.PM_MASTER_MIND_FLAYER);
        const target = before.monsters.find(m => m.type === P.PM_GRAY_OOZE);
        assert.ok(attacker?.tame > 0 && target?.tame === 0 && target.hp > 0);
        assert.ok(Math.abs(attacker.x-target.x) <= 1 && Math.abs(attacker.y-target.y) <= 1);
        assert.equal(before.form, P.PM_STONE_GOLEM);
        assert.equal(before.accessible, i === 3);
        assert.equal(after.monsters.find(m => m.id === target.id).hp, target.hp);
        assert.equal(harmless.text.includes(`<${target.x},${target.y}>:`), i === 3);
        assert.ok(!seen.states.some(s => s.slimed));
    } else {
        const constriction = seen.lines.find(l => /Your cap constricts briefly/.test(l.text));
        assert.ok(constriction);
        const before = at(seen.states, constriction.step - 1), after = at(seen.states, constriction.step);
        assert.equal(before.form, P.PM_MASTER_MIND_FLAYER);
        assert.equal(before.helmet, O.DUNCE_CAP);
        assert.ok(before.inventory.some(o => o.type === O.DUNCE_CAP && o.worn === W_ARMH && o.cursed));
        assert.ok(before.monsters.some(m => m.type === P.PM_MIND_FLAYER && !m.peaceful));
        assert.equal(after.intelligence, before.intelligence);
        assert.equal(after.mh, before.mh);
        assert.deepEqual(seen.output.slices[constriction.step - 1], ['rn2(8)=0','rnd(2)=1']);
        assert.match(seen.output.slices[constriction.step][0], /^rn2\(5\)=/);
        assert.match(seen.output.slices[constriction.step][1], /^rn2\(5\)=/);
        assert.ok(seen.states.some(s => s.mh > after.mh));
    }
    if ([1,2,4].includes(i)) assert.deepEqual(seen.hashes, recipe.negativeOutputHashes[i]);
});
