// Ordinary input with read-only observations and an independent unobserved run.
// This is JS reach evidence. A proposal is not a C output oracle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { OBJ_INVENT, OBJ_ONBILL } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors } from './gen-sessions/assertions.mjs';

const recipePath = process.argv[2] || fileURLToPath(new URL(
    'gen-sessions/recipes/glob-billing-original-weight.json', import.meta.url));
const recipe = JSON.parse(fs.readFileSync(recipePath));
assert.equal(recipe.segments.length, 1);
assert.deepEqual(branchAssertionErrors(recipe), []);
const part = recipe.segments[0];
function output(run) {
    return structuredClone({ screens: run.getScreens(), cursors: run.getCursors(),
        rng: run.getRngLog(), slices: run.getRngSlices(),
        animations: run.getAnimationFramesByStep() });
}

if (process.argv.includes('--plain')) {
    const run = await runSegment({ ...part, storage: new InMemoryStorage() });
    fs.writeFileSync(1, JSON.stringify(output(run)));
    process.exit(0);
}

const states = [];
const oldHook = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
let observed;
try {
    globalThis.__step_snapshot = { step: '*', cb(game, step) {
        if (!game.invent || !game.level?.objects)
            return;
        const items = [...game.invent, ...game.level.objects, ...(game.billobjs || [])];
        states[step] = { step, moves: game.moves,
            globs: items.filter(obj => obj.globby).map(obj => ({
                id: obj.o_id, where: obj.where, weight: obj.owt,
                savedWeight: obj.oextra?.omid ?? null,
                unpaid: obj.unpaid || 0, timed: obj.timed || 0,
            })),
            bills: (game.level.monsters || []).filter(mon => mon.isshk)
                .flatMap(mon => (mon.eshk.bill_p || []).slice(0, mon.eshk.billct).map(entry => ({
                    id: entry.bo_id, quantity: entry.bquan,
                    price: entry.price, useup: entry.useup,
                }))),
        };
    }};
    observed = output(await runSegment({ ...part, storage: new InMemoryStorage() }));
} finally {
    if (oldHook)
        Object.defineProperty(globalThis, '__step_snapshot', oldHook);
    else
        delete globalThis.__step_snapshot;
}
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), oldHook);
const plain = spawnSync(process.execPath, [fileURLToPath(import.meta.url),
    recipePath, '--plain'], { encoding: 'utf8', timeout: 20000,
    maxBuffer: 16 * 1024 * 1024 });
assert.equal(plain.status, 0, plain.stderr || String(plain.error));
assert.deepEqual(observed, JSON.parse(plain.stdout), 'read-only observations preserve all output');

const rows = observed.screens.map(decodeScreen);
const created = states.find(state => state?.globs.some(obj => obj.weight === 120));
const billed = states.find(state => state?.globs.some(obj => obj.unpaid));
const final = states.filter(Boolean).at(-1);
const itemized = rows.findIndex(lines => lines.some(line => line.includes('Unpaid articles already used up:')));
const passed = [];
const failures = [];
function check(name, operation) {
    try {
        operation();
        passed.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}
check('every input reaches a boundary', () => {
    for (const key of ['screens', 'cursors', 'slices', 'animations'])
        assert.equal(observed[key].length, part.moves.length + 1, key);
});
check('the wish creates an unbilled medium glob without billing metadata', () => {
    assert.ok(created);
    assert.equal(created.globs.length, 1);
    assert.equal(created.globs[0].where, OBJ_INVENT);
    assert.equal(created.globs[0].unpaid, 0);
    assert.equal(created.globs[0].savedWeight, null);
});
check('actual shop pickup captures the glob current weight on its bill', () => {
    assert.ok(billed);
    assert.equal(billed.globs[0].where, OBJ_INVENT);
    assert.equal(billed.globs[0].weight, 120);
    assert.equal(billed.globs[0].savedWeight, 120);
    assert.deepEqual(billed.bills, [{ id: billed.globs[0].id,
        quantity: 1, price: 48, useup: false }]);
});
check('actual expiry retains original weight in the used-up bill owner', () => {
    assert.equal(final.globs.length, 1);
    assert.deepEqual(final.globs[0], { id: created.globs[0].id,
        where: OBJ_ONBILL, weight: 120, savedWeight: 120, unpaid: 0, timed: 0 });
    assert.deepEqual(final.bills, [{ id: created.globs[0].id,
        quantity: 1, price: 48, useup: true }]);
});
check('the used-up inventory lists the original medium size', () => {
    assert.ok(itemized >= 0);
    const text = rows[itemized].join('\n');
    assert.match(text, /x - a medium glob of gray ooze\s+48 zorkmids/);
    assert.doesNotMatch(text, /x - a small glob/);
});
check('all proposed recipe witnesses are visible in the JS replay', () => {
    const replay = { segments: [{ ...part, steps: observed.screens.map((screen, step) => ({
        screen, cursor: observed.cursors[step], rng: observed.slices[step],
        animation_frames: observed.animations[step],
    })) }] };
    assert.deepEqual(branchAssertionErrors(recipe, replay), []);
});

console.log(JSON.stringify({ evidence: 'ordinary JS input; native output comparison is separate',
    passed: passed.length, total: passed.length + failures.length, checks: passed,
    failures, name: part.name, keys: part.moves.length, boundaries: rows.length,
    calls: observed.rng.length,
    animations: observed.animations.reduce((sum, frames) => sum + frames.length, 0),
    observationsNeutral: true,
    outputSha256: createHash('sha256').update(JSON.stringify(observed)).digest('hex'),
    witnesses: { created, billed, final, itemizedStep: itemized,
        itemizedRows: itemized >= 0 ? rows[itemized].filter(line => /used up:|glob|Total:/.test(line)) : [] },
    nativeLimit: 'This gate checks billing producers; the recorded fixture also checks sale pricing.' }, null, 4));
process.exitCode = failures.length ? 1 : 0;
