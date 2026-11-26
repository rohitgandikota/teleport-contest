import {lock, native, recipe, preflight} from './preflight.mjs';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {questChecks} from './quest-checks.mjs';
import {tuneCheck} from './tune-check.mjs';
import {compareSegment} from './compare-native.mjs';
const root = new URL('./', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const predictions = read('predictions.json'), changes = read('source/producer-changes.json');
const reportPath = new URL('reports/candidate-observation.json', root);
for (const path of ['reports/candidate-observation.json', 'reports/candidate-native.json',
                    'reports/quest-candidate.json', 'reports/tune-candidate.json', 'reports/controls.json', 'reports/preflight.json',
                    'page-observation.json'])
    assert.ok(!existsSync(new URL(path, root)), path);
writeFileSync(new URL('reports/preflight.json', root), JSON.stringify(preflight, null, 2) + '\n', {flag:'wx'});
const nativeRows = [], pageObservations = [];

const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {ONAMES} = await import('./js/objects_data.js');
const arts = await import('./js/artilist_data.js');
const {FROMOUTSIDE} = await import('./js/const.js');
const {decodeScreen, renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./tools/half-damage-reader-observe.mjs');
const properties = ['HSee_invisible', 'HFire_resistance', 'HCold_resistance',
    'HShock_resistance', 'HSleep_resistance', 'HPoison_resistance'];
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const prediction = predictions[index];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn:g.moves, hp:g.u.uhp, mortality:g.u.umortality || 0,
                crown:g.u.uevent?.uhand_of_elbereth || 0,
                intrinsic:properties.map(p => g.u.intrinsic?.[p] || 0),
                objects:[...g.invent, ...g.level.objects].map(o => ({id:o.o_id,
                    type:o.otyp, artifact:o.oartifact || 0, blessed:!!o.blessed})),
                logs:(g.gamelog || []).map(e => ({flags:e.flags, turn:e.turn, text:e.text}))});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output = structuredClone(outputs(run)), streamHashes = hashes(output);
    nativeRows.push(compareSegment(index, native.segments[index], output));
    const last = states.at(-1), firstCrown = states.find(s => s.crown);
    const texts = output.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    if(index<3) {
        const at=changes.changes[index].insertAtKeyOffset;
        pageObservations.push({index,name:part.name,
            firstPage:{step:at,key:part.moves[at-1],rows:texts[at].split('\n')},
            nextPage:{step:at+1,key:part.moves[at],rows:texts[at+1].split('\n')},
            closed:{step:at+2,key:part.moves[at+1],rows:texts[at+2].split('\n')}});
        writeFileSync(new URL('page-observation.json',root),JSON.stringify(pageObservations,null,2)+'\n');
    }
    const expected = prediction.crown ? [prediction.title, prediction.gift] : [];
    const logs = last.logs.filter(e => e.text === prediction.title || e.text === prediction.gift);
    const checks = [];
    const check = (name, test) => {
        try { test(); checks.push({name, pass:true}); }
        catch (error) { checks.push({name, pass:false, error:error.message}); }
    };
    check('real crown and gift setup', () => {
        assert.equal(last.crown, prediction.crown);
        if (prediction.crown) {
            assert.ok(firstCrown);
            assert.ok(last.intrinsic.every(p => (p & FROMOUTSIDE) !== 0));
            assert.ok(last.objects.some(o => o.type === ONAMES[prediction.objectType]
                && (!prediction.artifact || o.artifact === arts[prediction.artifact]) && o.blessed));
        } else assert.equal(firstCrown, undefined);
    });
    check('C title and gift event order', () => assert.deepEqual(logs.map(e => e.text), expected));
    check('C event categories and turn', () => {
        assert.deepEqual(logs.map(e => e.flags), prediction.crown ? prediction.flags : []);
        if (prediction.crown) assert.deepEqual(logs.map(e => e.turn), [firstCrown.turn, firstCrown.turn]);
    });
    check('C chronicle entries', () => {
        assert.ok(texts.some(t => t.includes('Logged events:')));
        for (const text of [prediction.title, prediction.gift])
            assert.equal(texts.some(t => t.includes(text)), !!prediction.crown);
    });
    check('survival and every input boundary', () => {
        assert.ok(states.every(s => s.hp > 0 && !s.mortality));
        assert.equal(last.step, part.moves.length);
        assert.equal(output.screens.length, part.moves.length + 1);
        assert.deepEqual(output.slices.flat(), output.calls);
    });
    const plain = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
    check('observer preserves five streams', () => assert.deepEqual(hashes(plain), streamHashes));
    const delayed = await deferred(part);
    check('deferred input preserves five streams', () => assert.deepEqual(hashes(delayed), streamHashes));
    rows.push({name:part.name, checks, firstCrown, last, hashes:streamHashes,
        keys:part.moves.length, boundaries:output.screens.length,
        calls:output.calls.length, frames:output.frames.flat().length});
}
const report = {recipeSHA256:lock.files['recipe.json'], runtimeSHA256:lock.files['runtime.json'], rows};
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
const failures = rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({case:r.name, ...c})));
console.log(JSON.stringify({cases:rows.length, checks:rows.length * 7, failures}));
if (failures.length) process.exitCode = 1;

const quest = questChecks(rows);
const tune = tuneCheck(rows);
writeFileSync(new URL('reports/tune-candidate.json', root), JSON.stringify({check:tune}, null, 2) + '\n', {flag:'wx'});
writeFileSync(new URL('reports/quest-candidate.json', root), JSON.stringify({checks:quest}, null, 2) + '\n', {flag:'wx'});
writeFileSync(new URL('reports/candidate-native.json', root), JSON.stringify(nativeRows, null, 2) + '\n', {flag:'wx'});
const controls = [];
const control = (name, test) => {
    try { test(); controls.push({name, pass:true}); }
    catch (error) { controls.push({name, pass:false, error:error.message}); }
};
const before = read('source/baseline-observation.json').rows;
const storedRows = read('reports/candidate-observation.json').rows;
const nativeBefore = read('parent-review/baseline-native.json');
for (const [index, expected] of Object.entries(read('negative-hashes.json'))) {
    control(`negative ${index}: all five hashes`, () => assert.deepEqual(rows[index].hashes, expected));
    control(`negative ${index}: complete ordinary row`, () => assert.deepEqual(storedRows[index], before[index]));
    control(`negative ${index}: complete native row`, () => assert.deepEqual(nativeRows[index], nativeBefore[index]));
}
control('all six full native comparisons', () => assert.ok(nativeRows.every(row =>
    row.fullStyleExact && row.frozenScreenCursorExact && row.fullRngExact && row.animationExact)));
writeFileSync(new URL('reports/controls.json', root), JSON.stringify({controls}, null, 2) + '\n', {flag:'wx'});
console.log(JSON.stringify({supplementaryQuest:quest.filter(check => check.pass).length,
    supplementaryTotal:3, supplementaryTune:tune.pass, controls:controls.length, controlFailures:controls.filter(check => !check.pass),
    nativePassed:nativeRows.filter(row => row.fullStyleExact && row.frozenScreenCursorExact
        && row.fullRngExact && row.animationExact).length, nativeTotal:6,
    extraNativeReplay:false}));
if (!tune.pass || quest.some(check => !check.pass) || controls.some(check => !check.pass)) process.exitCode = 1;
