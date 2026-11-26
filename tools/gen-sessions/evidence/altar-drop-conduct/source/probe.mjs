import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('./', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const lock = read('input-lock.json');
assert.equal(sha(readFileSync(new URL(import.meta.url))), lock.probeSHA256);
for (const [name, expected] of Object.entries(lock.files))
    assert.equal(sha(readFileSync(new URL(name, root))), expected, name);
const recipe = read('recipe.json');
const predictions = read('predictions.json');
const graph = read('baseline-runtime.json');
for (const [name, expected] of Object.entries(graph))
    assert.equal(sha(readFileSync(new URL('baseline/' + name, root))), expected, name);
for (const [name, expected] of Object.entries(read('source-pins.json')))
    assert.equal(sha(readFileSync(name)), expected, name);
const reportPath = new URL('baseline-observation.json', root);
assert.ok(!existsSync(reportPath));

const {runSegment} = await import('./baseline/js/jsmain.js');
const {InMemoryStorage} = await import('./baseline/js/storage.js');
const {ONAMES} = await import('./baseline/js/objects_data.js');
const {ALTAR, LL_CONDUCT} = await import('./baseline/js/const.js');
const {Blind} = await import('./baseline/js/youprop.js');
const {decodeScreen, renderCell} = await import('./baseline/frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./baseline/tools/half-damage-reader-observe.mjs');

const phrase = 'eschewed atheism, by dropping';
const object = o => ({id:o.o_id, type:o.otyp, quantity:o.quan, letter:o.invlet,
    blessed:!!o.blessed, cursed:!!o.cursed, known:!!o.bknown});
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const prediction = predictions[index];
    const types = prediction.types.map(name => ONAMES[name]);
    assert.ok(types.every(Number.isInteger));
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn:g.moves, hp:g.u.uhp, mortality:g.u.umortality || 0,
                terrain:g.level.at(g.u.ux, g.u.uy).typ, blind:!!Blind(),
                gnostic:g.u.uconduct?.gnostic || 0,
                inventory:g.invent.filter(o => types.includes(o.otyp)).map(object),
                floor:g.level.objects.filter(o => o.ox === g.u.ux && o.oy === g.u.uy
                    && types.includes(o.otyp)).map(object),
                logs:(g.gamelog || []).filter(e => e.text.startsWith(phrase))
                    .map(e => ({flags:e.flags, turn:e.turn, text:e.text}))});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output = structuredClone(outputs(run));
    const streamHashes = hashes(output);
    const before = states.find(s => s.step === prediction.beforeDrop);
    const after = states.find(s => s.step === prediction.afterDrop);
    const last = states.at(-1);
    const texts = output.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const checks = [];
    const check = (name, test) => {
        try { test(); checks.push({name,pass:true}); }
        catch (error) { checks.push({name,pass:false,error:error.message}); }
    };
    check('real altar, item and perception setup', () => {
        assert.ok(before && before.hp > 0);
        assert.equal(before.terrain === ALTAR, prediction.altar);
        assert.equal(before.blind, prediction.blind);
        assert.equal(before.gnostic, 0);
        assert.deepEqual(before.logs, []);
        assert.deepEqual(before.inventory.map(o => o.type).sort((a,b) => a-b),
            [...types].sort((a,b) => a-b));
    });
    check('drop ownership, conduct counter and turns', () => {
        assert.ok(after && after.hp > 0);
        assert.equal(after.gnostic, prediction.gnostic);
        assert.equal(after.turn - before.turn, prediction.turns);
        assert.deepEqual(after.inventory, []);
        assert.deepEqual(after.floor.map(o => o.id).sort((a,b) => a-b),
            before.inventory.map(o => o.id).sort((a,b) => a-b));
        if (index === 3) assert.ok(after.floor.every(o => !o.blessed && !o.cursed));
        if (index === 4) assert.equal(after.floor[0].known, before.inventory[0].known);
    });
    check('C first-drop conduct log', () => {
        assert.equal(after.logs.length, prediction.logs);
        if (prediction.logs) {
            assert.equal(after.logs[0].flags, LL_CONDUCT);
            assert.equal(after.logs[0].turn, before.turn);
            assert.ok(after.logs[0].text.includes('apple'));
            assert.ok(after.logs[0].text.endsWith(' on an altar'));
        }
        assert.deepEqual(last.logs, after.logs);
    });
    check('C chronicle visibility', () => {
        assert.ok(texts.some(text => text.includes('Logged events:')));
        assert.equal(texts.some(text => text.includes(phrase)), prediction.logs > 0);
    });
    check('survival, boundaries and random slices', () => {
        assert.ok(states.every(s => s.hp > 0 && !s.mortality));
        assert.equal(last.step, part.moves.length);
        assert.equal(output.screens.length, part.moves.length + 1);
        assert.deepEqual(output.slices.flat(), output.calls);
    });
    const plain = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
    check('observer preserves five streams', () => assert.deepEqual(hashes(plain), streamHashes));
    const delayed = await deferred(part);
    check('deferred input preserves five streams', () => assert.deepEqual(hashes(delayed), streamHashes));
    rows.push({name:part.name, checks, before, after, last, hashes:streamHashes,
        keys:part.moves.length, boundaries:output.screens.length,
        calls:output.calls.length, frames:output.frames.flat().length});
}
const report = {recipeSHA256:lock.files['recipe.json'],
    runtimeSHA256:lock.files['baseline-runtime.json'], rows};
writeFileSync(reportPath, JSON.stringify(report,null,2)+'\n', {flag:'wx'});
const failures = rows.flatMap(r => r.checks.filter(c => !c.pass)
    .map(c => ({case:r.name,...c})));
console.log(JSON.stringify({cases:rows.length, checks:42, failures}));
if (failures.length) process.exitCode = 1;
