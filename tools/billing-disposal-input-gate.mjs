// Read-only ordinary-input observations. Native evidence is optional and explicit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { money_cnt } from '../js/invent.js';
import { OBJ_ONBILL, OBJ_DELETED } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const inputPath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/billing-object-disposal.json', import.meta.url));
const input = JSON.parse(fs.readFileSync(inputPath));
assert.equal(input.segments.length, 2);
const outputs = run => structuredClone({ screens: run.getScreens(), cursors: run.getCursors(),
    rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep() });
if (process.argv.includes('--plain')) {
    const runs = [];
    for (const part of input.segments)
        runs.push(outputs(await runSegment({ ...part, storage: new InMemoryStorage() })));
    fs.writeFileSync(1, JSON.stringify(runs));
    process.exit(0);
}

const observed = [], states = [];
const oldHook = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
try {
    for (const part of input.segments) {
        const steps = [];
        let receipt = null;
        globalThis.__step_snapshot = { step: '*', cb(game, step) {
            if (!game.level || !game.invent)
                return;
            if (!receipt && game.billobjs?.length)
                receipt = game.billobjs[0];
            const shkp = game.level.monsters.find(mon => mon.isshk);
            steps[step] = {
                gold: money_cnt(game.invent), keeper: !!shkp,
                bills: (shkp?.eshk.bill_p || []).map(bp => ({ id: bp.bo_id,
                    quantity: bp.bquan, price: bp.price, useup: bp.useup })),
                billobjs: (game.billobjs || []).map(obj => ({ id: obj.o_id,
                    where: obj.where, quantity: obj.quan })),
                receipt: receipt ? { id: receipt.o_id ?? null, where: receipt.where ?? null,
                    keys: Object.keys(receipt).length } : null,
            };
        }};
        observed.push(outputs(await runSegment({ ...part, storage: new InMemoryStorage() })));
        states.push(steps);
    }
} finally {
    if (oldHook)
        Object.defineProperty(globalThis, '__step_snapshot', oldHook);
    else
        delete globalThis.__step_snapshot;
}
const plain = spawnSync(process.execPath, [fileURLToPath(import.meta.url), inputPath, '--plain'],
    { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024 });
assert.equal(plain.status, 0, plain.stderr || String(plain.error));
assert.deepEqual(observed, JSON.parse(plain.stdout), 'read-only observations preserve all outputs');
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), oldHook);
const rows = observed.map(run => run.screens.map(screen => decodeScreen(screen).join('\n')));
const passed = [], failures = [];
function check(name, operation) {
    try {
        operation();
        passed.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}

check('all ordinary inputs reach every boundary with consistent collections', () => {
    for (let i = 0; i < observed.length; i++)
        for (const field of ['screens', 'cursors', 'slices', 'frames'])
            assert.equal(observed[i][field].length, input.segments[i].moves.length + 1);
});
check('sale, repurchase and drinking create a real used-up bill record in both cases', () => {
    for (const steps of states) {
        assert.equal(steps[82].bills.length, 1);
        assert.equal(steps[82].bills[0].price, 27);
        assert.equal(steps[82].bills[0].useup, false);
        assert.equal(steps[86].bills[0].useup, true);
        assert.deepEqual(steps[86].billobjs, [{ id: steps[82].bills[0].id,
            where: OBJ_ONBILL, quantity: 1 }]);
    }
});
check('both used-up menus show the actual named potion and its bill', () => {
    for (const screens of rows) {
        assert.match(screens[90], /a potion of healing named Receipt/);
        assert.match(screens[90], /27 zorkmids/);
    }
});
check('the pre-removal stats screen counts one bill record', () => {
    assert.match(rows[0][99], /billobjs\s+1\s+152/);
});
check('shopkeeper death cancels and disposes the retained record', () => {
    assert.match(rows[0][127], /You kill Upernavik!/);
    assert.equal(states[0][127].keeper, false);
    assert.deepEqual(states[0][127].billobjs, []);
    assert.equal(states[0][140].receipt.keys, 0);
});
check('post-removal stats no longer includes the cancelled bill owner', () => {
    assert.match(rows[0][138], /Current memory statistics:/);
    assert.doesNotMatch(rows[0][138], /billobjs/);
});
check('ordinary payment removes the bill only after charging the actual amount', () => {
    assert.equal(states[1][114].bills.length, 1);
    assert.equal(states[1][114].gold - states[1][115].gold, 27);
    assert.deepEqual(states[1][115].bills, []);
    assert.deepEqual(states[1][115].billobjs, []);
    assert.match(rows[1][115], /You paid for a potion of healing named Receipt/);
});
check('paid used-up record is staged at feedback and zeroed by the next turn', () => {
    assert.equal(states[1][115].receipt.where, OBJ_DELETED);
    assert.equal(states[1][130].receipt.keys, 0);
    assert.doesNotMatch(rows[1][128], /billobjs/);
});

let native = null;
if (args[1]) {
    const bytes = fs.readFileSync(args[1]);
    const raw = JSON.parse(bytes);
    assert.equal(raw.version, 5);
    assert.equal(raw.source, 'c');
    assert.equal(raw.segments.length, input.segments.length);
    assert.deepEqual(recordingIntegrityErrors(raw), []);
    for (let i = 0; i < input.segments.length; i++)
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(raw.segments[i][field], input.segments[i][field], `${i}.${field}`);
    const screens = raw.segments.map(part => part.steps.map(step => decodeScreen(step.screen).join('\n')));
    assert.match(screens[0][99], /billobjs\s+1\s+152/);
    assert.match(screens[0][127], /You kill Upernavik!/);
    assert.match(screens[0][138], /Current memory statistics:/);
    assert.doesNotMatch(screens[0][138], /billobjs/);
    assert.match(screens[1][115], /You paid for a potion of healing named Receipt/);
    native = { sha256: createHash('sha256').update(bytes).digest('hex'),
        witnesses: 5, limit: 'Payment text proves reach; canonical deletion is independently source/state checked.' };
}
console.log(JSON.stringify({ evidence: native ? 'JS state and native screen witnesses' : 'JS input only; C recording pending',
    passed: passed.length, total: passed.length + failures.length, checks: passed, failures,
    observationsNeutral: true, native,
    segments: observed.map((run, i) => ({ name: input.segments[i].name,
        boundaries: run.screens.length, calls: run.rng.length,
        frames: run.frames.reduce((sum, group) => sum + group.length, 0) })),
    witnesses: [states[0][86], states[0][127], states[0][140],
        states[1][114], states[1][115], states[1][130]] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
