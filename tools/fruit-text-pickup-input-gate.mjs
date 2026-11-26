import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reportPath, repoRoot, js, root, sha, original, nativePreflight, sourcePreflight, markerAccounting } from './fruit-text-preflight.mjs';
const recipe = original.pickup2.recipe, recipeBytes = original.pickup2.recipeBytes, lockBytes = original.pickup2.lockBytes;
const { runSegment } = await import(new URL('jsmain.js', js));
const { InMemoryStorage } = await import(new URL('storage.js', js));
const { ONAMES } = await import(new URL('objects_data.js', js));
const { MSGTYP_STOP } = await import(new URL('const.js', js));
const { outputs, hashes, deferred } = await import(new URL('tools/half-damage-reader-observe.mjs', repoRoot));
const { decodeScreen } = await import(new URL('frozen/screen-decode.mjs', repoRoot));
const hex = value => Array.from(String(value ?? ''), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
const timeout = setTimeout(() => process.exit(124), 55_000);
const rows = [];
try {
    for (const [i, part] of recipe.segments.entries()) {
        const want = recipe.expectations[i], states = [], checks = [];
        const check = (name, fn) => {
            try { fn(); checks.push({ name, pass: true }); }
            catch (e) { checks.push({ name, pass: false, error: String(e.message).slice(0, 450) }); }
        };
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let output;
        try {
            globalThis.__step_snapshot = { step: '*', cb(g, step) {
                const fruit = o => o.otyp === ONAMES.SLIME_MOLD;
                states.push({ step, xy: [g.u?.ux, g.u?.uy], moves: g.moves,
                    fruitHex: hex(g.svp?.pl_fruit), chainHex: hex(g.ffruit?.fname),
                    heroHex: hex(g.plname), titleHex: hex(g.blstats?.[g.now_or_before_idx]?.[0]?.val),
                    eightBit: !!g.iflags?.wc_eight_bit_input,
                    autopickup: g.flags?.autopickup, droppedNopick: g.flags?.dropped_nopick,
                    inventoryFruit: (g.invent || []).filter(fruit).map(o => ({ id: o.o_id, spe: o.spe, quan: o.quan })),
                    floorFruit: (g.level?.objects || []).filter(fruit).map(o => ({ id: o.o_id, xy: [o.ox, o.oy], spe: o.spe })),
                    exceptions: (g.apelist || []).map(a => ({ hex: hex(a.pattern), grab: a.grab })),
                    menuPatterns: (g.menu_colorings || []).map(c => ({ hex: hex(c.origstr), color: c.color, attr: c.attr })),
                    msgPatterns: (g.plinemsg_types || []).map(m => ({ hex: hex(m.pattern), type: m.msgtype })),
                    errors: [...(g.rc?.errors || [])], unhandled: [...(g.rc?.unhandled || [])],
                    pending: g._pending_message || '', toplin: g._toplin });
            }};
            output = outputs(await runSegment({ ...part, storage: new InMemoryStorage() }));
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
        const plain = outputs(await runSegment({ ...part, storage: new InMemoryStorage() }));
        const late = await deferred(part);
        check('all keys and five streams observer/plain/deferred', () => {
            assert.deepEqual(output, plain); assert.deepEqual(output, late);
            assert.deepEqual(output.slices.flat(), output.calls);
            for (const key of ['screens', 'cursors', 'slices', 'frames'])
                assert.equal(output[key].length, part.moves.length + 1);
            assert.equal(states.length, part.moves.length + 1);
        });
        check('ordinary valid RC', () => assert.ok(states.every(s => !s.errors.length && !s.unhandled.length)));
        const first = states[0], last = states.at(-1);
        if (want.fruitHex) check('C stored fruit bytes', () => {
            assert.ok(states.every(s => s.fruitHex === want.fruitHex && s.chainHex === want.fruitHex));
        });
        if (want.family !== 'hero') check('real inventory fruit result', () => {
            assert.equal(first.inventoryFruit.length, 0);
            assert.equal(last.inventoryFruit.length, want.inventoryFruit);
            for (const obj of last.inventoryFruit) assert.equal(obj.spe, 1);
        });
        if (Object.hasOwn(want, 'floorFruit')) check('real floor fruit result', () => assert.equal(last.floorFruit.length, want.floorFruit));
        if (want.family === 'stop') check('STOP waits at result and consumes acknowledgement', () => {
            assert.ok(output.screens[want.stopStep].includes('--More--'));
            assert.ok(!output.screens[want.ackStep].includes('--More--'));
            assert.ok(states[want.stopStep].msgPatterns.some(p => p.type === MSGTYP_STOP));
        });
        if (want.menuRedBold) check('ordinary menu coloring', () => {
            const grid = decodeScreen(output.screens[want.menuStep]);
            assert.ok(grid.some(row => row.some(cell => cell.color === 1 && (cell.attr & 2) && cell.ch !== ' ')));
            assert.equal(first.menuPatterns[0].hex, want.fruitHex);
        });
        if (want.family === 'pickup') check('ordinary automatic exception and return', () => {
            assert.deepEqual(last.xy, first.xy);
            assert.equal(first.autopickup, true);
            assert.equal(first.droppedNopick, false);
            assert.equal(first.exceptions.length, 1);
            assert.equal(first.exceptions[0].grab, false);
            assert.equal(first.exceptions[0].hex, want.fruitHex);
            assert.ok(last.floorFruit.every(o => JSON.stringify(o.xy) === JSON.stringify(first.xy)));
        });
        if (want.family === 'hero') check('RC name reaches formatted status in bytes', () => {
            assert.equal(last.heroHex, want.heroHex);
            assert.ok(last.titleHex.startsWith(want.titlePrefixHex));
        });
        const digest = hashes(output);
        if (want.asciiNegative) check('ASCII negative five hashes unchanged', () => {
            const negatives = JSON.parse(fs.readFileSync(new URL('reports/pickup-negative-hashes.json', root)));
            assert.deepEqual(digest, negatives.controls.find(c => c.name === part.name).hashes);
        });
        rows.push({ name: part.name, family: want.family, asciiNegative: want.asciiNegative,
            pass: checks.every(c => c.pass), checks, hashes: digest,
            boundaries: output.screens.length, calls: output.calls.length,
            first, last, relevantToplines: [...new Set([part.moves.length, want.stopStep, want.ackStep, want.menuStep].filter(Number.isInteger))]
                .map(step => ({ step, top: output.screens[step]?.split('\n').slice(0, 2).join('\n') })) });
        console.log(JSON.stringify({ name: part.name, pass: rows.at(-1).pass, failed: checks.filter(c => !c.pass).map(c => c.name) }));
    }
    // Portable composition accounting, outside the original assertion body.
    for (const row of rows) {
        const accounted = markerAccounting.rows.find(r => r.name === row.name);
        assert.deepEqual(row.hashes, accounted.afterHashes, row.name);
    }
    const report = { classification: 'Original pickup ordinary assertions on the installed root; no native comparison here.',
        sourcePreflight, nativePreflight, recipeSHA256: sha(recipeBytes), inputLockSHA256: sha(lockBytes),
        passed: rows.filter(r => r.pass).length, total: rows.length, rows };
    if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, total: report.total, negativeHashes: 5 }));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(timeout); }
