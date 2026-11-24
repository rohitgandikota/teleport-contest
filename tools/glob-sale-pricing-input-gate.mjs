// Ordinary shop sale with read-only observations through normal runtime imports.
// Optional native input is checked without rewriting or normalizing its bytes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { money_cnt } from '../js/invent.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/glob-billing-original-weight.json', import.meta.url));
const recipe = JSON.parse(fs.readFileSync(recipePath));
assert.equal(recipe.segments.length, 1);
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
        const keeper = game.level.monsters.find(mon => mon.isshk);
        states[step] = { step, gold: money_cnt(game.invent),
            shopGold: keeper ? money_cnt(keeper.minvent || []) : null,
            globs: [...game.invent, ...game.level.objects, ...(game.billobjs || [])]
                .filter(obj => obj.globby).map(obj => ({ id: obj.o_id,
                    weight: obj.owt, quantity: obj.quan, unpaid: obj.unpaid || 0 })),
            bills: (keeper?.eshk.bill_p || []).map(row => ({ id: row.bo_id,
                price: row.price, quantity: row.bquan, useup: row.useup })),
        };
    }};
    observed = output(await runSegment({ ...part, storage: new InMemoryStorage() }));
} finally {
    if (oldHook)
        Object.defineProperty(globalThis, '__step_snapshot', oldHook);
    else
        delete globalThis.__step_snapshot;
}
const plain = spawnSync(process.execPath, [fileURLToPath(import.meta.url), recipePath, '--plain'],
    { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024 });
assert.equal(plain.status, 0, plain.stderr || String(plain.error));
assert.deepEqual(observed, JSON.parse(plain.stdout), 'observations preserve every output field');
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), oldHook);

const rows = observed.screens.map(decodeScreen);
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
check('every key reaches a boundary and all output collections agree', () => {
    for (const field of ['screens', 'cursors', 'slices', 'animations'])
        assert.equal(observed[field].length, part.moves.length + 1, field);
});
check('ordinary wish and sale operate on a quantity-one medium glob', () => {
    for (const step of [125, 130]) {
        assert.equal(states[step].globs.length, 1);
        assert.equal(states[step].globs[0].weight, 120);
        assert.equal(states[step].globs[0].quantity, 1);
        assert.equal(states[step].globs[0].unpaid, 0);
    }
});
check('the real sale offer and acceptance use eighteen gold pieces', () => {
    assert.match(rows[130].join('\n'), /offers 18 gold pieces/);
    assert.match(rows[131].join('\n'), /sold a medium glob of gray ooze for 18 gold pieces/);
});
check('the actual money transfer pays eighteen and debits the same shopkeeper', () => {
    assert.equal(states[131].gold - states[130].gold, 18);
    assert.equal(states[130].shopGold - states[131].shopGold, 18);
});
check('repurchase keeps the independent forty-eight-zorkmid acquisition price', () => {
    assert.equal(states[134].globs[0].unpaid, 1);
    assert.deepEqual(states[134].bills, [{ id: states[134].globs[0].id,
        price: 48, quantity: 1, useup: false }]);
});

let nativeWitnesses = null;
if (args[1]) {
    const bytes = fs.readFileSync(args[1]);
    const native = JSON.parse(bytes);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, 1);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
        assert.equal(native.segments[0][field], part[field], field);
    const frames = native.segments[0].steps;
    const sale = decodeScreen(frames[130].screen);
    const accepted = decodeScreen(frames[131].screen);
    const usedUp = decodeScreen(frames[149].screen);
    assert.match(sale.join('\n'), /offers 18 gold pieces/);
    assert.match(accepted.join('\n'), /sold a medium glob of gray ooze for 18 gold pieces/);
    assert.match(usedUp.join('\n'), /Unpaid articles already used up:/);
    assert.match(usedUp.join('\n'), /x - a medium glob of gray ooze\s+48 zorkmids/);
    nativeWitnesses = { sha256: createHash('sha256').update(bytes).digest('hex'),
        inputFieldsExact: true, saleStep: 130, acceptedStep: 131, weightDisplayStep: 149,
        sale: sale.slice(0, 2), usedUp: usedUp.filter(row => /used up:|glob|Total:/.test(row)) };
}
console.log(JSON.stringify({ evidence: nativeWitnesses
    ? 'ordinary JS input and independently recorded native witnesses' : 'ordinary JS input only',
    passed: passed.length, total: passed.length + failures.length, checks: passed, failures,
    keys: part.moves.length, boundaries: rows.length, calls: observed.rng.length,
    animations: observed.animations.reduce((sum, frames) => sum + frames.length, 0),
    observationsNeutral: true, nativeWitnesses,
    witnesses: [states[125], states[130], states[131], states[134]],
    scope: 'JS assertions isolate sale pricing; the native used-up display separately witnesses original-weight capture.' }, null, 4));
process.exitCode = failures.length ? 1 : 0;
