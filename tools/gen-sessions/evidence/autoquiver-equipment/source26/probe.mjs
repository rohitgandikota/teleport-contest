// One locked source-only batch. This file never changes gameplay state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';

const here = new URL('./', import.meta.url);
const read = name => fs.readFileSync(new URL(name, here));
const json = name => JSON.parse(read(name));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => sha(JSON.stringify(value));
const write = (name, value) => fs.writeFileSync(new URL(name, here), JSON.stringify(value, null, 2) + '\n');
const lock = json('input-lock.json');
for (const [name, expected] of Object.entries(lock.files))
    assert.equal(sha(read(name)), expected, name);
const pins = json('source-pins.json');
for (const [name, expected] of Object.entries(pins.externalFiles))
    assert.equal(sha(read(name)), expected, name);
const runtime = json('baseline-runtime.json');
assert.equal(Object.keys(runtime).length, 280);
for (const [name, expected] of Object.entries(runtime))
    assert.equal(sha(read('baseline/' + name)), expected, name);
const recipe = json('recipe.json');
const predictions = json('predictions.json');
const fields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
assert.equal(recipe.segments.length, 6);
for (const [i, part] of recipe.segments.entries()) {
    assert.deepEqual(Object.keys(part).sort(), [...fields].sort());
    assert.deepEqual(part, lock.inputs[i].fields);
    assert.deepEqual(Array.from(part.moves, ch => ch.charCodeAt(0)), lock.inputs[i].keys);
}

// No gameplay imports occur before every input, source and graph pin passes.
const {runSegment, NethackGame} = await import('./baseline/js/jsmain.js');
const {InMemoryStorage} = await import('./baseline/js/storage.js');
const {GameDisplay} = await import('./baseline/js/game_display.js');
const {moveloop_core} = await import('./baseline/js/allmain.js');
const state = await import('./baseline/js/gstate.js');
const {ONAMES} = await import('./baseline/js/objects_data.js');
const {W_WEP, W_SWAPWEP, W_QUIVER, OBJ_INVENT} = await import('./baseline/js/const.js');
const {decodeScreen, renderCell} = await import('../../../frozen/screen-decode.mjs');
const {branchAssertionErrors} = await import('../../../tools/gen-sessions/assertions.mjs');
assert.deepEqual(branchAssertionErrors(recipe), []);

const outputs = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    calls:run.getRngLog(), slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
const hashes = value => Object.fromEntries(Object.entries(value).map(([k,v]) => [k,hash(v)]));
const rows = screen => decodeScreen(screen).map(row => row.map(renderCell).join('').trimEnd());
const slotId = obj => obj?.o_id ?? null;

function snapshot(g, step) {
    return {step, turn:g.moves, hp:g.u?.uhp ?? null, mortality:g.u?.umortality ?? 0,
        gameover:!!g.program_state?.gameover, wizard:!!g.wizard,
        autoquiver:!!g.flags?.autoquiver, pauper:!!g.u?.uroleplay?.pauper,
        rcErrors:g.rc?.errors ?? [], unhandled:g.rc?.unhandled ?? [],
        slots:{uwep:slotId(g.u?.uwep), uswapwep:slotId(g.u?.uswapwep), uquiver:slotId(g.u?.uquiver)},
        topLevelSlots:['uwep','uswapwep','uquiver'].filter(name => Object.hasOwn(g,name)),
        inventory:(g.invent || []).map(obj => ({id:obj.o_id, type:obj.otyp, letter:obj.invlet,
            quantity:obj.quan, mask:obj.owornmask || 0, where:obj.where,
            blessed:!!obj.blessed, cursed:!!obj.cursed, artifact:obj.oartifact || 0,
            howLost:obj.how_lost ?? null, skill:g.objects?.[obj.otyp]?.oc_skill ?? null}))};
}

async function observed(part) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g,step) { states.push(snapshot(g,step)); }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    return {states, output:structuredClone(outputs(run))};
}

// The normal delayed-input producer, with explicit proof that EOF stays pending.
// Display attachment follows jsmain/runSegment; no hero or equipment is changed.
async function deferred(part) {
    const display = new GameDisplay(null);
    const run = new NethackGame({...part, storage:new InMemoryStorage()});
    run._pendingDisplay = display;
    const keys = Array.from(part.moves, ch => ch.charCodeAt(0));
    let consumed = 0, stop, atEnd, settled = false;
    const exhausted = new Promise(resolve => { atEnd = resolve; });
    const end = new Error('locked delayed input complete');
    display.onEmptyQueue = async () => {
        await setImmediate();
        if (consumed < keys.length) return keys[consumed++];
        return new Promise((_resolve, reject) => { stop = () => reject(end); atEnd('input'); });
    };
    const operation = (async () => {
        try {
            await run.start();
            while (!state.game.program_state?.gameover) await moveloop_core();
        } catch (error) { if (error !== end) throw error; }
        finally { settled = true; }
    })();
    try {
        const winner = await Promise.race([exhausted, operation.then(() => 'exit')]);
        const output = structuredClone(outputs(run));
        const before = hashes(output);
        await setImmediate();
        await setImmediate();
        return {output, pending:{winner, consumed, expected:keys.length, settled,
            unchanged:JSON.stringify(before) === JSON.stringify(hashes(outputs(run)))}};
    } finally {
        if (stop) stop();
        await operation;
    }
}

// The source-derived assertion body is locked before the first game runs.
function evaluate(part, prediction, observedRun, plain, delayed) {
    const checks = [];
    const check = (kind, name, fn) => {
        try { fn(); checks.push({kind,name,ok:true}); }
        catch (error) { checks.push({kind,name,ok:false,error:error.message}); }
    };
    const states = observedRun.states;
    const at = step => states.find(s => s.step === step);
    const initial = at(0), before = at(prediction.beforeLastWish);
    const after = at(prediction.afterDelivery), final = at(part.moves.length);
    const inventoryRows = rows(observedRun.output.screens[prediction.inventory]);
    const wantedItems = prediction.items.map(item => [item.letter,ONAMES[item.type],item.quantity]);
    const itemTriples = s => s.inventory.map(item => [item.letter,item.type,item.quantity]);
    const idFor = (s, letter) => letter === null ? null : s.inventory.find(item => item.letter === letter)?.id;
    const expectedSlots = s => Object.fromEntries(Object.entries(prediction.slots)
        .map(([slot,letter]) => [slot,idFor(s,letter)]));
    const launcherSlots = s => ({uwep:s.slots.uwep,uswapwep:s.slots.uswapwep});
    const expectedLaunchers = s => ({uwep:idFor(s,prediction.slots.uwep),uswapwep:idFor(s,prediction.slots.uswapwep)});

    check('setup','empty healthy pauper and exact RC option', () => {
        assert(initial.hp > 0 && initial.wizard && initial.pauper);
        assert.equal(initial.autoquiver, prediction.autoquiver);
        assert.deepEqual(initial.inventory, []);
        assert.deepEqual(initial.rcErrors, []); assert.deepEqual(initial.unhandled, []);
    });
    check('setup','real launchers before receipt', () => {
        assert.deepEqual(itemTriples(before), prediction.priorItems.map(item => [item.letter,ONAMES[item.type],item.quantity]));
        assert.deepEqual(launcherSlots(before), expectedLaunchers(before));
    });
    check('setup','real prior quiver', () => {
        assert.equal(before.slots.uquiver, idFor(before,prediction.priorQuiver));
        if (prediction.priorQuiver !== null)
            assert.equal(before.inventory.find(item => item.letter === prediction.priorQuiver).mask, W_QUIVER);
    });
    check('setup','all intended wishes delivered as distinct inventory objects', () => {
        assert.deepEqual(itemTriples(after), wantedItems);
        assert.equal(new Set(after.inventory.map(item => item.id)).size, wantedItems.length);
    });
    check('setup','received objects carried uncursed and not artifacts', () => {
        assert(after.inventory.every(item => item.where === OBJ_INVENT && !item.blessed && !item.cursed && !item.artifact));
    });
    check('setup','survival and canonical slot ownership at every boundary', () => {
        assert(states.length > 0);
        assert(states.every(s => s.hp > 0 && !s.gameover && s.mortality === 0));
        assert(states.every(s => s.autoquiver === prediction.autoquiver && s.topLevelSlots.length === 0));
    });
    check('contract','active and alternate launcher identities preserved', () => {
        assert.deepEqual(launcherSlots(after), launcherSlots(before));
        assert.deepEqual(launcherSlots(after), expectedLaunchers(after));
    });
    check('contract','canonical quiver has source-selected object', () => {
        assert.deepEqual(after.slots, expectedSlots(after));
    });
    check('contract','all inventory worn masks agree with source equipment', () => {
        const masks = {uwep:W_WEP,uswapwep:W_SWAPWEP,uquiver:W_QUIVER};
        for (const item of after.inventory) {
            let expected = 0;
            for (const [slot,letter] of Object.entries(prediction.slots))
                if (item.letter === letter) expected |= masks[slot];
            assert.equal(item.mask, expected, 'inventory ' + item.letter);
        }
    });
    check('contract','inventory display and Escape preserve all equipment', () => {
        assert.deepEqual(final.slots, after.slots); assert.deepEqual(final.inventory, after.inventory);
    });
    check('setup','inventory menu contains each actual inventory letter once', () => {
        for (const item of prediction.items)
            assert.equal(inventoryRows.filter(row => new RegExp('^\\s*' + item.letter + ' [-+] ').test(row)).length, 1);
    });
    check('contract','decoded inventory row suffixes match C equipment readers', () => {
        for (const rule of prediction.inventoryRows) {
            const row = inventoryRows.find(value => new RegExp('^\\s*' + rule.letter + ' [-+] ').test(value));
            assert.equal(typeof row,'string', 'inventory row ' + rule.letter);
            for (const text of rule.includes) assert(row.includes(text), rule.letter + ' missing ' + text + ': ' + row);
            for (const text of rule.excludes) assert(!row.includes(text), rule.letter + ' unexpected ' + text + ': ' + row);
        }
    });
    check('boundary','all keys and five streams captured without lost RNG slices', () => {
        assert.deepEqual(states.map(s => s.step), Array.from({length:part.moves.length+1},(_,i) => i));
        for (const output of [observedRun.output,plain,delayed.output]) {
            for (const name of ['screens','cursors','slices','frames']) assert.equal(output[name].length,part.moves.length+1,name);
            assert.deepEqual(output.slices.flat(),output.calls);
        }
    });
    check('neutrality','observer-free five streams exact', () => assert.deepEqual(hashes(observedRun.output),hashes(plain)));
    check('neutrality','delayed-input five streams exact', () => assert.deepEqual(hashes(observedRun.output),hashes(delayed.output)));
    check('boundary','delayed EOF remains pending with unchanged output', () => {
        assert.deepEqual(delayed.pending,{winner:'input',consumed:part.moves.length,expected:part.moves.length,settled:false,unchanged:true});
    });
    return {checks, checkpoints:{initial,before,after,final}, inventoryStep:prediction.inventory, inventoryRows};
}

const report = {classification:'source-only baseline, not native confirmation',
    inputLockSHA256:sha(read('input-lock.json')), runtimeSHA256:pins.runtimeSHA256,
    preselectedNegativeIndexes:predictions.negativeIndexes, rows:[]};
write('reports/baseline.json',report);
for (const [i, part] of recipe.segments.entries()) {
    const row = {index:i,name:part.name};
    try {
        const observedRun = await observed(part);
        const plain = structuredClone(outputs(await runSegment({...part, storage:new InMemoryStorage()})));
        const delayed = await deferred(part);
        Object.assign(row,evaluate(part,predictions.cases[i],observedRun,plain,delayed),{
            hashes:hashes(observedRun.output), plainHashes:hashes(plain), deferredHashes:hashes(delayed.output),
            pending:delayed.pending, boundaries:observedRun.output.screens.length,
            calls:observedRun.output.calls.length, frames:observedRun.output.frames.flat().length});
    } catch (error) { row.error = {message:error.message,stack:error.stack}; }
    report.rows.push(row);
    write('reports/baseline.json',report);
    console.log(JSON.stringify({index:i,name:part.name,pass:row.checks?.filter(c=>c.ok).length,
        total:row.checks?.length,error:row.error?.message}));
}
const checks = report.rows.flatMap(row => row.checks || []);
report.summary = {cases:report.rows.length, pass:checks.filter(c=>c.ok).length,total:checks.length,
    casePass:report.rows.filter(row=>row.checks?.every(c=>c.ok) && !row.error).length,
    setup:checks.filter(c=>c.kind==='setup').map(c=>c.ok),
    neutrality:checks.filter(c=>c.kind==='neutrality').map(c=>c.ok),
    errors:report.rows.filter(row=>row.error).length};
write('reports/baseline.json',report);
write('reports/negative-controls.json',{inputLockSHA256:report.inputLockSHA256,
    indexes:predictions.negativeIndexes, rows:report.rows.filter(row=>predictions.negativeIndexes.includes(row.index))});
console.log(JSON.stringify(report.summary));
process.exitCode = report.summary.errors || report.summary.pass !== report.summary.total ? 1 : 0;
