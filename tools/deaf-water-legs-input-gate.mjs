// Actual commands, observed state, and source-derived branch expectations.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {observe} from './deaf-water-legs-observer.mjs';
import {POOL, WATER, ROOM, FROMOUTSIDE} from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';

const file = process.argv[2] || new URL(
    'gen-sessions/generated/deaf-water-legs-boundaries.session.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(file));
const labels = ['timed-deaf-explosion', 'conduct-deaf-explosion', 'hearing-explosion-control',
    'underwater-mixed-terrain', 'underwater-boulder-flight',
    'wizard-wounded-expiry', 'wounded-dog-healing'];
assert.equal(fixture.segments.length, labels.length);
const rows = [];
for (const [i, segment] of fixture.segments.entries()) {
    const {evidence:r} = await observe({name:labels[i], ...segment});
    rows.push(r);
    assert.equal(r.hooksRestored, true);
    console.log(JSON.stringify({name:r.name, boundaries:r.boundaries, calls:r.calls,
        animations:r.animations, hooksRestored:r.hooksRestored}));
}
if (process.env.DEAF_WATER_LEGS_EVIDENCE)
    fs.writeFileSync(process.env.DEAF_WATER_LEGS_EVIDENCE, JSON.stringify(rows, null, 2) + '\n');
const get = name => rows.find(r => r.name === name);
const text = r => r.messages.map(m => m.text).join('\n');

for (const [label, kind] of labels.slice(0, 3).map((label, i) => [label, i])) {
    test(`potion.c:2430 explosion hearing, ${label}`, () => {
        const r = get(label);
        const before = r.states.findLast(s => s.inventory.some(o =>
            o.type === ONAMES.POT_FRUIT_JUICE && o.cursed)
            && s.inventory.some(o => o.type === ONAMES.POT_BOOZE));
        assert.ok(before, 'actual wishes supplied both potions and a forced cursed explosion');
        assert.equal(before.deaf, kind !== 2);
        assert.equal(before.edeaf, 0);
        assert.equal(before.deafConduct, kind === 1);
        assert.equal(before.hdeaf, kind === 0 ? 100 : 0);
        assert.match(text(r), /They explode!/);
        if (kind === 2) assert.match(text(r), /BOOM!  They explode!/);
        else assert.doesNotMatch(text(r), /BOOM!/);
        assert.ok(r.states.at(-1).hp < before.hp, 'the real blast still deals damage');
    });
}
test('hack.c:1890 submerged hero enters a seen pool from a water wall without avoidance', () => {
    const r = get('underwater-mixed-terrain');
    const before = r.states.findLast(s => s.underwater && s.terrain === WATER);
    const after = r.states.at(-1);
    assert.ok(before && before.breathless && !before.stunned && !before.confused);
    assert.equal(before.underwaterFlatPresent, false);
    assert.ok(before.nearby.some(n => n.x === before.x - 1 && n.typ === POOL && n.seenv));
    assert.equal(after.x, before.x - 1);
    assert.equal(after.y, before.y);
    assert.equal(after.terrain, POOL);
    assert.equal(after.underwater, true);
    assert.doesNotMatch(text(r), /You avoid .*water/);
});
test('do.c:128 boulder filling a real submerged wall restores flight before dry-land feedback', () => {
    const r = get('underwater-boulder-flight');
    const before = r.states.findLast(s => s.underwater);
    const after = r.states.at(-1);
    assert.equal(before.form, PMNAMES.PM_AIR_ELEMENTAL);
    assert.equal(before.terrain, WATER);
    assert.equal(before.flying, false);
    assert.ok(before.blockedFlying & FROMOUTSIDE);
    assert.equal(after.terrain, ROOM);
    assert.equal(after.underwater, false);
    assert.equal(after.flying, true);
    assert.equal(after.blockedFlying & FROMOUTSIDE, 0);
    const words = text(r);
    assert.ok(words.indexOf('You start flying.') >= 0);
    assert.ok(words.indexOf('You start flying.') < words.indexOf('You find yourself on dry land again!'));
    assert.equal(after.inventory.some(o => o.type === ONAMES.BOULDER), false);
    assert.equal(after.floor.some(o => o.type === ONAMES.BOULDER), false);
});
test('wizcmds.c:1073 and timeout.c:774 H-only wizard injury blocks kicking and expires silently', () => {
    const r = get('wizard-wounded-expiry');
    const before = r.states.find(s => s.hwounded === 3);
    assert.ok(before && before.wounded);
    assert.equal(before.ewounded, 0);
    assert.equal(before.dexTemp, 0);
    assert.equal(before.woundFlat, 0);
    assert.equal(before.woundWizardTimer, 0);
    assert.match(text(r), /Your leg is in no shape for kicking/);
    assert.ok(r.states.some(s => s.hwounded === 1));
    const after = r.states.at(-1);
    assert.equal(after.hwounded, 0);
    assert.equal(after.ewounded, 0);
    assert.equal(after.wounded, false);
    assert.equal(after.dexTemp, 0);
    assert.doesNotMatch(text(r), /leg.*feel.*better/);
});
test('do.c:2462 real form and timed wound producers select the dog healing body part', () => {
    const r = get('wounded-dog-healing');
    const before = r.states.findLast(s => s.form === PMNAMES.PM_LITTLE_DOG && s.wounded);
    assert.ok(before);
    assert.equal(before.hwounded, 30);
    assert.equal(before.ewounded, 0);
    assert.ok(before.inventory.some(o => o.type === ONAMES.POT_SPEED));
    assert.match(text(r), /Your rear leg feels better\./);
    assert.doesNotMatch(text(r), /Your leg feels better\./);
    const after = r.states.at(-1);
    assert.equal(after.wounded, false);
    assert.equal(after.hwounded, 0);
    assert.equal(after.ewounded, 0);
});
