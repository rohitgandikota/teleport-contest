// Read-only native branch evidence and ordinary JS reach. No runtime instrumentation.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Hallucination, Deaf, Blind} from '../js/youprop.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {LL_ACHIEVE} from '../js/const.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};
const bytes = readFileSync(new URL('gen-sessions/generated/shop-robbery-chronicle.session.json', import.meta.url));
const input = JSON.parse(bytes);
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/shop-robbery-chronicle.json', import.meta.url)));

test('unchanged source:c/v5 raw, five fields, exact keys and native branch assertions', () => {
    assert.equal(input.source, 'c'); assert.equal(input.version, 5);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
        'c411d5c7704e7dbecdf186e6f166ec511e4e7670c7d7f8b1ff4415616fc3aad0');
    assert.equal(recipe.name, 'shop-robbery-chronicle');
    assert.equal(input.segments.length, 3); assert.equal(recipe.segments.length, 3);
    const valid = new Set(tags.requirements.map(r => r.id));
    for (const tag of recipe.coverage) assert.ok(valid.has(tag));
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, input), []);
    assert.deepEqual(recordingIntegrityErrors(input), []);
    for (const [i, part] of input.segments.entries()) {
        assert.equal(part.steps.length, part.moves.length + 1);
        assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[key], recipe.segments[i][key]);
    }
});

for (const [i, part] of recipe.segments.entries()) test(part.name, async () => {
    const states = [], previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let owner, run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            owner ||= g.level.monsters.find(m => m.isshk);
            states.push({step, turn:g.moves, hp:g.u.uhp, mortality:g.u.umortality || 0,
                over:!!g.program_state?.gameover, level:{...g.u.uz},
                hallucinating:Hallucination(), deaf:Deaf(), blind:Blind(),
                watchmen:g.level.monsters.filter(m => [PMNAMES.PM_WATCHMAN,
                    PMNAMES.PM_WATCH_CAPTAIN].includes(m.mnum)).length,
                owner:owner && {id:owner.m_id, name:owner.eshk.shknam,
                    bill:owner.eshk.billct, debit:owner.eshk.debit, credit:owner.eshk.credit,
                    robbed:owner.eshk.robbed, following:owner.eshk.following},
                inventory:g.invent.map(o => ({id:o.o_id, type:o.otyp, unpaid:!!o.unpaid})),
                log:structuredClone(g.gamelog || []),
                text:g.nhDisplay.grid.map(row => row.map(c => c.ch).join('').trimEnd()).join('\n')});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length, part.moves.length + 1);
    for (const s of states) {
        assert.equal(s.hp, 12); assert.equal(s.mortality, 0); assert.equal(s.over, false);
        assert.equal(s.watchmen, 0); assert.equal(s.deaf, false); assert.equal(s.blind, false);
    }
    const billed = states.find(s => s.owner?.bill === 1 && s.inventory.some(o => o.unpaid));
    assert.ok(billed); assert.equal(billed.owner.name, 'Demirci');
    const stock = billed.inventory.find(o => o.unpaid);
    assert.equal(stock.type, ONAMES.SCALE_MAIL);
    const last = states.at(-1);
    assert.deepEqual(last.level, {dnum:0, dlevel:3});
    assert.deepEqual([last.owner.bill, last.owner.debit, last.owner.credit], [0, 0, 0]);
    const window = states.find(s => s.text.startsWith('Logged events:'));
    assert.ok(window, 'the actual chronicle command displays the journal');
    const recorded = last.log.filter(e => e.text.startsWith('stole '));
    if (i < 2) {
        assert.equal(recorded.length, 1);
        const entry = recorded[0];
        const logged = states.find(s => s.log.some(e => e.text === entry.text));
        assert.equal(entry.flags, LL_ACHIEVE); assert.equal(entry.turn, logged.turn);
        assert.equal(logged.hallucinating, i === 1);
        assert.equal(last.owner.robbed, 60); assert.equal(last.owner.following, 1);
        assert.equal(last.inventory.find(o => o.id === stock.id)?.unpaid, false);
        assert.ok(window.text.includes('stole 60'));
        if (i === 0) {
            assert.equal(entry.text, "stole 60 zorkmids worth of merchandise from Demirci's used armor dealership");
            assert.ok(window.text.includes(entry.text));
        } else {
            assert.ok(states.some(s => s.hallucinating && s.text.includes('You stole 60 spacebucks worth of merchandise.')));
            assert.equal(entry.text, "stole 60 Triganic Pus worth of merchandise from Adjama's used armor dealership");
            assert.ok(window.text.includes("stole 60 Triganic Pus worth of merchandise from Adjama's used armor"));
        }
    } else {
        assert.deepEqual(recorded, []);
        assert.equal(last.owner.robbed, 0); assert.equal(last.owner.following, 0);
        const returned = states.find(s => s.step > billed.step && s.level.dlevel === 2
            && s.owner.bill === 0 && !s.inventory.some(o => o.id === stock.id));
        assert.ok(returned, 'the unpaid scale mail is really returned before teleporting');
        assert.ok(!window.text.includes('stole '));
    }
    const observed = {segments:recipe.segments.map((_, j) =>
        ({steps:j === i ? states.map(s => ({screen:s.text})) : []}))};
    assert.deepEqual(branchAssertionErrors({...recipe, branches:[recipe.branches[i]],
        branchAssertions:[recipe.branchAssertions[i]]}, observed), []);
});

// The native oracle supplies its own function provenance at these calls.
test('native journal text and the independently evaluated operands are observable', () => {
    const text = step => decodeScreen(step.screen)
        .map(row => row.map(c => c.ch).join('').trimEnd()).join('\n');
    const ordinary = input.segments[0].steps[63];
    const hallucinated = input.segments[1].steps[88];
    assert.ok(text(ordinary).includes("3: stole 60 zorkmids worth of merchandise from Demirci's used armor dealership"));
    assert.ok(text(hallucinated).includes("3: stole 60 Triganic Pus worth of merchandise from Adjama's used armor\ndealership"));
    const operands = input.segments[1].steps[68].rng;
    assert.deepEqual(operands, [
        'rn2(21)=18 @ currency(invent.c:1550)',
        'rn2(11)=0 @ shkname(shknam.c:884)',
        'rn2(30)=4 @ shkname(shknam.c:888)',
    ]);
    assert.ok(input.segments[1].steps.some(s => text(s).includes('You stole 60 spacebucks worth of merchandise.')));
    assert.ok(text(input.segments[2].steps[71]).includes('Logged events:'));
    assert.ok(!input.segments[2].steps.some(s => text(s).includes('stole 60')));
});
