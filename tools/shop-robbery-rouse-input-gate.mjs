// Read-only ordinary-input reach and immutable native C provenance.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {canspotmon} from '../js/display.js';
import {ONAMES} from '../js/objects_data.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};
const bytes = readFileSync(new URL('gen-sessions/generated/shop-robbery-wakeup.session.json', import.meta.url));
const input = JSON.parse(bytes);
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/shop-robbery-wakeup.json', import.meta.url)));
test('unchanged source:c/v5 native cases, five fields and asserted More branches', () => {
    assert.equal(input.source, 'c'); assert.equal(input.version, 5);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), 'e897159e7c8d6ce380e9a9396b46f5ebdecde71d1a984c42a88bb6d66c167f7b');
    assert.equal(recipe.name, 'shop-robbery-wakeup');
    assert.equal(input.segments.length, 2); assert.equal(recipe.segments.length, 2);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const valid = new Set(tags.requirements.map(t => t.id));
    for (const tag of recipe.coverage) assert.ok(valid.has(tag), tag);
    for (const [i, part] of input.segments.entries()) {
        assert.equal(part.steps.length, part.moves.length + 1);
        assert.equal(part.steps[0].key, null);
        assert.deepEqual(part.steps.slice(1).map(step => step.key), Array.from(part.moves));
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[key], recipe.segments[i][key]);
    }
    assert.deepEqual(recordingIntegrityErrors(input), []);
    assert.deepEqual(branchAssertionErrors(recipe, input), []);
    const positive = input.segments[0].steps;
    const wake = positive.findIndex(step => step.screen.startsWith('Samoe can move again.--More--'));
    assert.ok(wake > 0);
    assert.equal(positive[wake].key, 'y');
    assert.ok(positive[wake + 1].screen.startsWith(
        'Your credit of 600 zorkmids is used to cover your shopping bill.--More--'));
    assert.equal(positive[wake + 1].key, ' ');
    assert.ok(positive[wake + 2].screen.startsWith('Samoe zaps an oak wand!  Boing!'));
    assert.equal(positive[wake + 2].key, ' ');
});

for (const [i, part] of recipe.segments.entries()) test(part.name, async () => {
    const states = [], prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            const m = g.level.monsters.find(m => m.isshk && m.eshk.shd.x === 29 && m.eshk.shd.y === 5);
            states.push({step, x:g.u.ux, y:g.u.uy, hp:g.u.uhp,
                mortality:g.u.umortality || 0, over:!!g.program_state?.gameover,
                owner:m && {id:m.m_id, x:m.mx, y:m.my, sleeping:m.msleeping || 0,
                    frozen:m.mfrozen || 0, mobile:!!m.mcanmove, visible:canspotmon(m),
                    credit:m.eshk.credit, bill:m.eshk.billct, debit:m.eshk.debit,
                    robbed:m.eshk.robbed, following:!!m.eshk.following},
                inventory:g.invent.map(o => ({id:o.o_id, type:o.otyp, unpaid:!!o.unpaid})),
                floor:g.level.objects.map(o => ({id:o.o_id, type:o.otyp, unpaid:!!o.unpaid,
                    x:o.ox, y:o.oy})),
                text:g.nhDisplay.grid.map(row => row.map(c => c.ch).join('').trimEnd()).join('\n')});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length, part.moves.length + 1);
    for (const s of states) assert.ok(s.hp > 0 && !s.mortality && !s.over);
    const deposited = states.find(s => s.owner?.credit === 600 && s.owner.bill === 1);
    const paralyzed = states.find(s => s.step > deposited?.step && s.owner
        && !s.owner.mobile && s.owner.frozen > 0 && s.owner.credit === 600 && s.owner.bill === 1);
    assert.ok(deposited && paralyzed, 'real gold deposit, stock bill and thrown-potion paralysis');
    assert.equal(paralyzed.owner.sleeping, 0); assert.equal(paralyzed.owner.visible, true);
    assert.equal(paralyzed.owner.debit, 0); assert.equal(paralyzed.owner.robbed, 0);
    assert.deepEqual([paralyzed.x, paralyzed.y], [30, 6]);
    const stock = paralyzed.inventory.find(o => o.type === ONAMES.FORTUNE_COOKIE && o.unpaid);
    assert.ok(stock);
    const last = states.at(-1);
    assert.equal(last.hp, paralyzed.hp);
    assert.deepEqual([last.x, last.y], [29, 5]);
    assert.equal(last.owner.robbed, 0); assert.equal(last.owner.following, false);
    if (!i) {
        const recovery = states.find(s => s.step > paralyzed.step && s.text.includes('Samoe can move again.'));
        assert.ok(recovery, 'visible recovery feedback is reached before settlement');
        assert.ok(recovery.text.includes('Samoe can move again.--More--'));
        const nativeWake = input.segments[i].steps.findIndex(step =>
            step.screen.startsWith('Samoe can move again.--More--'));
        assert.equal(recovery.step, nativeWake);
        assert.equal(recovery.owner.mobile, true); assert.equal(recovery.owner.frozen, 0);
        assert.equal(recovery.owner.bill, 1); assert.equal(recovery.owner.credit, 600);
        const settlement = states.find(s => s.step > recovery.step && s.owner.bill === 0 && s.owner.credit === 0);
        assert.ok(settlement);
        assert.equal(settlement.step, recovery.step + 1);
        assert.ok(settlement.text.includes(
            'Your credit of 600 zorkmids is used to cover your shopping bill.--More--'));
        const continuation = states.find(s => s.step === settlement.step + 1);
        assert.ok(continuation.text.includes('Samoe zaps an oak wand!  Boing!'));
        assert.equal(settlement.inventory.find(o => o.id === stock.id)?.unpaid, false);
        assert.equal(last.owner.bill, 0); assert.equal(last.owner.credit, 0);
    } else {
        const returned = states.find(s => s.step > paralyzed.step && s.owner.bill === 0);
        assert.ok(returned && !returned.inventory.some(o => o.id === stock.id));
        assert.ok(returned.floor.some(o => o.id === stock.id && !o.unpaid));
        assert.equal(last.owner.bill, 0); assert.equal(last.owner.credit, 600);
        // The short paralysis expires naturally while returning the stock.
        // This is a no-debt settlement control, not a persistent-paralysis claim.
        assert.equal(last.owner.mobile, true); assert.equal(last.owner.frozen, 0);
    }
    const observed = {segments:recipe.segments.map((_, j) =>
        ({steps:j === i ? states.map(s => ({screen:s.text})) : []}))};
    assert.deepEqual(branchAssertionErrors({...recipe, branches:[recipe.branches[i]],
        branchAssertions:[recipe.branchAssertions[i]]}, observed), []);
});
