// One fixed-source keyboard observation. No runtime setters or state injection.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const packet = new URL('../', import.meta.url);
const root = new URL('../../../../', import.meta.url);
const json = url => JSON.parse(readFileSync(url, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = json(new URL('source-pins.json', packet));
const lock = json(new URL('proposals/input-lock.json', packet));
const recipeFile = new URL('proposals/recipe.json', packet);
const predictionsFile = new URL('proposals/predictions.json', packet);
assert.equal(sha(readFileSync(recipeFile)), lock.recipeSha256);
assert.equal(sha(readFileSync(predictionsFile)), lock.predictionsSha256);
assert.equal(sha(readFileSync(new URL('source/runtime.json', packet))), pins.runtimeMapSha256);
const runtime = json(new URL('source/runtime.json', packet));
assert.equal(Object.keys(runtime).length, 280);
for (const [path, hash] of Object.entries(runtime))
    assert.equal(sha(readFileSync(new URL(`source/${path}`, packet))), hash, path);
for (const [path, hash] of Object.entries(pins.pins))
    assert.equal(sha(readFileSync(new URL(path, root))), hash, path);
const recipe = json(recipeFile), predictions = json(predictionsFile);
assert.equal(recipe.segments.length, lock.segments.length);
for (const [index, part] of recipe.segments.entries()) {
    for (const field of lock.fields) {
        assert.equal(Object.hasOwn(part, field), lock.segments[index].fields[field].present);
        assert.deepEqual(part[field], lock.segments[index].fields[field].value);
    }
    assert.deepEqual(Array.from(part.moves, c => c.charCodeAt(0)), lock.segments[index].keys);
}

// Gameplay imports occur only after all fixed source and original input checks.
const { runSegment } = await import('../source/js/jsmain.js');
const { InMemoryStorage } = await import('../source/js/storage.js');
const { CQ_REPEAT } = await import('../source/js/const.js');
const { ONAMES } = await import('../source/js/objects_data.js');
const { outputs, hashes, deferred } = await import('../source/tools/half-damage-reader-observe.mjs');
const { decodeScreen, renderCell } = await import('../source/screen-decode.mjs');
const typeNames = Object.fromEntries(Object.entries(ONAMES).map(([k,v]) => [v,k]));
const text = screen => decodeScreen(screen).map(row => row.map(renderCell).join('').trimEnd()).join('\n');
const expectedTypes = ['HAWAIIAN_SHIRT','LEATHER_ARMOR','LEATHER_CLOAK','HELMET',
    'SMALL_SHIELD','LEATHER_GLOVES','LOW_BOOTS','RIN_PROTECTION','RIN_ADORNMENT',
    'AMULET_OF_REFLECTION','LENSES'];
const report = { runtimeMapSha256:pins.runtimeMapSha256, recipeSha256:lock.recipeSha256,
    nativeRecorded:false, runtimeChanged:false, rows:[] };
const destination = new URL('reports/observation.json', packet);
const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');

function snapshot(g, step) {
    return { step, turn:g.moves, multi:g.multi, afternmv:g.afternmv?.name || null,
        hp:g.u.uhp, form:g.u.umonnum, gameover:!!g.program_state?.gameover,
        slots:Object.fromEntries(predictions.slots.map(s => [s,g.u[s]?.invlet || null])),
        inventory:(g.invent || []).map(o => ({letter:o.invlet,type:typeNames[o.otyp],
            cursed:!!o.cursed,artifact:o.oartifact || 0,worn:o.owornmask || 0})),
        repeat:(g.command_queue?.[CQ_REPEAT] || []).map(q => ({type:q.typ,
            command:q.ec_entry?.ef_txt || null,key:q.key ?? null})),
        inDoagain:!!g.in_doagain };
}

try {
    for (const [index, part] of recipe.segments.entries()) {
        const plan = predictions.cases[index];
        const points = new Set(plan.points.flatMap(p => Object.values(p).filter(Number.isInteger)));
        const states = new Map();
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (points.has(step)) states.set(step, snapshot(g, step));
        }};
        const run = await runSegment({...part, storage:new InMemoryStorage()});
        delete globalThis.__step_snapshot;
        const output = structuredClone(outputs(run));
        const row = {name:part.name, kind:plan.kind, keys:part.moves.length,
            boundaries:output.screens.length, hashes:hashes(output), checks:[], observations:[]};
        report.rows.push(row);
        const check = (name, body, category='source-prediction') => {
            try { body(); row.checks.push({name,category,pass:true}); }
            catch (error) { row.checks.push({name,category,pass:false,error:error.message}); }
        };
        check('all input boundaries and RNG slices', () => {
            assert.equal(output.screens.length,part.moves.length+1);
            assert.deepEqual(output.slices.flat(),output.calls);
        }, 'integrity');
        for (const p of plan.points) {
            const captured = Object.fromEntries(Object.entries(p).filter(([,v]) => Number.isInteger(v))
                .map(([label,step]) => [label,{state:states.get(step),text:text(output.screens[step])}]));
            row.observations.push({label:p.label,...captured});
            const before = captured.before.state;
            check(`${p.label}: real producer setup`, () => {
                assert.equal(before.gameover,false);
                assert.ok(before.hp > 0);
                assert.equal(before.multi,0);
                assert.equal(before.afternmv,null);
                assert.deepEqual(before.inventory.map(o => o.type),
                    plan.kind.includes('equipment') || plan.kind==='missing-slot-negative'
                        ? expectedTypes : ['HAWAIIAN_SHIRT','LOW_BOOTS']);
                assert.ok(before.inventory.every(o => !o.cursed && !o.artifact));
                const worn = Object.values(before.slots).filter(Boolean);
                assert.equal(worn.length,plan.kind==='full-equipment' ? 11
                    : plan.kind==='missing-slot-negative' ? 10 : 0);
                if (plan.missing) assert.equal(before.slots[plan.missing],null);
            }, 'setup');
            if (plan.kind==='full-equipment' || plan.kind==='missing-slot-negative') {
                check(`${p.label}: C entry feedback`, () => {
                    assert.ok(captured.after.text.includes(plan.kind==='full-equipment'
                        ? predictions.cPredictions[p.command==='W' ? 'wearFull' : 'putonFull']
                        : `What do you want to ${p.label}?`));
                });
                check(`${p.label}: slots and time unaffected at entry`, () => {
                    assert.deepEqual(captured.after.state.slots,before.slots);
                    assert.equal(captured.after.state.turn,before.turn);
                });
            } else {
                check(`${p.label}: cancelled getobj clears repeat`, () => {
                    assert.deepEqual(captured.cancelled.state.repeat,[]);
                });
                check(`${p.label}: Ctrl-A has no command available`, () => {
                    assert.ok(captured.repeated.text.includes('There is no command available to repeat.'));
                });
                check(`${p.label}: cancellation consumes no time or equipment`, () => {
                    assert.equal(captured.repeated.state.turn,before.turn);
                    assert.deepEqual(captured.repeated.state.slots,before.slots);
                });
            }
        }
        const plain = await runSegment({...part, storage:new InMemoryStorage()});
        check('observer-free five streams unchanged', () => {
            assert.deepEqual(hashes(outputs(plain)),row.hashes);
        }, 'neutrality');
        const late = await deferred(part);
        check('deferred five streams unchanged', () => {
            assert.deepEqual(hashes(late),row.hashes);
        }, 'neutrality');
        writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
        console.log(JSON.stringify({name:row.name,checks:row.checks.length,
            failures:row.checks.filter(c => !c.pass).map(c => c.name)}));
    }
} catch (error) {
    report.workerFailure = {message:error.message,stack:error.stack};
} finally {
    if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
    else delete globalThis.__step_snapshot;
    report.summary = {cases:report.rows.length,
        checks:report.rows.reduce((n,r) => n+r.checks.length,0),
        failures:report.rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({name:r.name,...c}))),
        observerRestored:JSON.stringify(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'))
            === JSON.stringify(previous)};
    writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
}
process.exitCode = report.workerFailure || report.summary.failures.length ? 1 : 0;
