// Current installed runtime, with original C and immutable history checked first.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const evidence = new URL('tools/gen-sessions/evidence/crowning-log/', root);
const json = url => JSON.parse(readFileSync(url));
const read = name => json(new URL(name, evidence));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = url => sha(readFileSync(url));
assert.ok(process.argv.length <= 3, 'usage: node tools/crowning-log-input-gate.mjs [new-report.json]');
const reportPath = process.argv[2] || null;
assert.ok(!reportPath || (!reportPath.startsWith('-') && !existsSync(reportPath)), 'report must be a new file');
const contractFile = new URL('source-contract.json', evidence);
assert.equal(digest(contractFile), 'a1c526451b164ab5ca1ea5f475a5aa93281acc4936d51f5417eee5c4a1e5eb56');
const contract = json(contractFile);
for (const [name, hash] of Object.entries(contract.evidencePins))
    assert.equal(digest(new URL(name, evidence)), hash, name);
for (const [name, hash] of Object.entries(contract.portableDependencyPins))
    assert.equal(digest(new URL(name, root)), hash, name);
for (const [label, pin] of Object.entries(contract.sealedPackets)) {
    assert.equal(digest(new URL(label + '/SEAL.json', evidence)), pin.sealSHA256);
    const seal = read(label + '/SEAL.json'), manifest = read(label + '/' + pin.manifest);
    assert.equal(seal.members, pin.members);
    assert.equal(digest(new URL(label + '/' + pin.manifest, evidence)), seal[pin.manifestField]);
    assert.equal(Object.keys(manifest.members || manifest).length, pin.members);
}
for (const [name, origin] of Object.entries(contract.sealedEvidence)) {
    const pin = contract.sealedPackets[origin.packet];
    const manifest = read(origin.packet + '/' + pin.manifest);
    const entry = (manifest.members || manifest)[origin.member];
    assert.equal(digest(new URL(name, evidence)), typeof entry === 'string' ? entry : entry.sha256);
}
const original = read('source12/recipe.json');
const recipeFile = new URL(contract.recipe.path, root);
assert.equal(digest(recipeFile), contract.recipe.sha256);
const recipe = json(recipeFile), lock = read('source35/input-lock.json');
assert.deepEqual(recipe, read('parent/primary-recipe.json'));
assert.equal(contract.recipe.sha256, lock.files['recipe.json']);
const corrected = structuredClone(original);
corrected.name = 'crowning-log-paged';
corrected.branches = corrected.branches.map(branch => branch.replace('crowning-log.', 'crowning-log-paged.'));
for (const branch of corrected.branchAssertions)
    branch.branch = branch.branch.replace('crowning-log.', 'crowning-log-paged.');
for (const change of read('source35/producer-changes.json').changes) {
    const moves = corrected.segments[change.index].moves, at = change.insertAtKeyOffset;
    assert.equal(at, moves.length - 1);
    assert.equal(moves.slice(at - 1), 'v\x1b');
    corrected.segments[change.index].moves = moves.slice(0, at) + ' ' + moves.slice(at);
}
assert.deepEqual(recipe, corrected);
const predictions = read('source12/predictions.json');
assert.equal(digest(new URL('source12/predictions.json', evidence)), lock.files['predictions.json']);
const oldRows = read('source12/baseline-observation.json').rows;
const baselineRows = read('source35/baseline-observation.json').rows;
const priorRows = read('candidate334/reports/candidate-observation.json').rows;
const sealedRows = read('tune343/reports/candidate-observation.json').rows;
for (const [rows, passed] of [[oldRows, 33], [baselineRows, 33], [priorRows, 42], [sealedRows, 42]]) {
    assert.equal(rows.flatMap(row => row.checks).length, 42);
    assert.equal(rows.flatMap(row => row.checks).filter(check => check.pass).length, passed);
}
assert.deepEqual(oldRows.map(row => row.checks), baselineRows.map(row => row.checks));
const historicalBody = readFileSync(new URL('source12/probe.mjs', evidence), 'utf8');
const publicBody = readFileSync(new URL(import.meta.url), 'utf8');
const checkStart = '    const check = ' + '(name, test) => {';
const checkEnd = '    rows.' + 'push({name:part.name';
const originalChecks = historicalBody.slice(historicalBody.indexOf(checkStart), historicalBody.indexOf(checkEnd));
assert.equal(publicBody.slice(publicBody.indexOf(checkStart), publicBody.indexOf(checkEnd)), originalChecks);
const oldPage = read('source35/parent-page-proof.json');
assert.equal(oldPage.rawSha256, contract.originalFailedPageRawSHA256);
assert.equal(oldPage.oldNativeComparisonPerformed, false);
assert.equal(oldPage.preservedPrimaryErrors.length, 6);
assert.equal(digest(new URL('original-parent/baseline-native.log', evidence)), oldPage.failedPreflightLogSha256);
assert.equal(read('original-parent/native-recording.json').rawSha256, contract.originalFailedPageRawSHA256);
const failedControls = read('candidate334/reports/controls.json').controls.filter(check => !check.pass);
assert.deepEqual(failedControls.map(check => check.name), [
    'negative 3: complete ordinary row', 'negative 4: complete ordinary row',
    'negative 5: complete ordinary row', 'all six full native comparisons']);
assert.ok(failedControls.slice(0, 3).every(check => check.error.includes('firstCrown: undefined')));
assert.equal(read('candidate334/reports/worker.json').exitCode, 1);
assert.equal(read('tune343/attempts/preflight-1/provenance.json').actualObservedPlainDeferredBatches, 0);
assert.equal(read('tune343/reports/worker.json').observedPlainDeferredBatches, 1);
assert.equal(read('tune343/reports/worker.json').exitCode, 0);
assert.ok(read('candidate334/reports/quest-baseline.json').checks.every(check => !check.pass));
assert.equal(read('tune343/reports/tune-baseline.json').check.pass, false);
assert.equal(read('tune343/reports/tune-candidate.json').check.pass, true);
const nativeBefore = read('parent/baseline-native.json');
const priorNative = read('candidate334/reports/candidate-native.json');
const sealedNative = read('tune343/reports/candidate-native.json');
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact && row.fullRngExact && row.animationExact;
assert.equal(nativeBefore.filter(exact).length, 3);
assert.equal(priorNative.filter(exact).length, 5);
assert.equal(sealedNative.filter(exact).length, 6);
const negativeHashes = read('source12/negative-hashes.json');
assert.deepEqual(Object.keys(negativeHashes), ['3', '4', '5']);
for (const index of [3, 4, 5]) {
    assert.deepEqual(oldRows[index], baselineRows[index]);
    assert.deepEqual(priorRows[index], baselineRows[index]);
    assert.deepEqual(sealedRows[index], baselineRows[index]);
    assert.deepEqual(sealedRows[index].hashes, negativeHashes[index]);
    assert.deepEqual(priorNative[index], nativeBefore[index]);
    assert.deepEqual(sealedNative[index], nativeBefore[index]);
}
const parentLock = read('parent/input-lock.json'), recording = read('parent/native-recording.json');
assert.equal(parentLock.sourceSealSHA256, contract.sealedPackets.source35.sealSHA256);
assert.equal(parentLock.sourceRecipeSHA256, contract.recipe.sha256);
assert.equal(parentLock.primaryRecipeSHA256, contract.recipe.sha256);
assert.equal(recording.primaryRecipeSHA256, contract.recipe.sha256);
assert.equal(recording.inputSHA256, parentLock.minimalSHA256);
assert.equal(recording.rawSha256, contract.native.sha256);
assert.equal(recording.cPin, contract.cPin);
assert.equal(recording.binarySha256, contract.recordedBinarySHA256);
assert.equal(recording.recorderSha256, contract.recorderSHA256);
assert.equal(recording.cExecutedOnce, true);
assert.equal(recording.exit, 0);
const rawBytes = readFileSync(new URL(contract.native.path, root));
assert.equal(sha(rawBytes), contract.native.sha256);
assert.equal(rawBytes.length, 2236525);
const native = JSON.parse(rawBytes);
assert.equal(native.source, 'c');
assert.equal(native.version, 5);
assert.equal(native.segments.length, 6);
assert.deepEqual(Object.keys(native).sort(), Object.keys(recipe).sort());
for (const key of Object.keys(recipe))
    if (key !== 'segments') assert.deepEqual(native[key], recipe[key]);
assert.deepEqual(lock.fields, ['name', 'seed', 'datetime', 'nethackrc', 'moves']);
for (const [i, segment] of recipe.segments.entries()) {
    for (const field of lock.fields) for (const part of [segment, native.segments[i]]) {
        assert.equal(Object.hasOwn(part, field), lock.inputs[i].fields[field].present);
        assert.deepEqual(part[field], lock.inputs[i].fields[field].value);
    }
    assert.deepEqual(Array.from(segment.moves, key => key.charCodeAt(0)), lock.inputs[i].keys);
    assert.deepEqual(native.segments[i].steps.map(step => step.key), [null, ...segment.moves]);
}
const {branchAssertionErrors, recordingIntegrityErrors} = await import('./gen-sessions/assertions.mjs');
const {decodeScreen, renderCell, diffCell} = await import('../frozen/screen-decode.mjs');
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branchAssertions.length, 6);
const steps = native.segments.flatMap(segment => segment.steps);
const totals = {keys:recipe.segments.reduce((n, part) => n + part.moves.length, 0), boundaries:steps.length,
    calls:steps.reduce((n, step) => n + (step.rng || []).length, 0),
    frames:steps.reduce((n, step) => n + (step.animation_frames || []).length, 0)};
assert.deepEqual(totals, {keys:893, boundaries:899, calls:32391, frames:9});
const expectations = read('candidate334/quest-expectations.json');
const expected = read('tune343/tune-expectation.json');
for (const item of expectations) {
    const row = decodeScreen(native.segments[item.index].steps[item.sourceFirstPageBoundary].screen)[item.sourceRow]
        .map(renderCell).join('').trimEnd();
    assert.equal(row, item.sourceDecodedRow);
    assert.equal(Number(row.trimStart().split(': ', 1)[0]), item.event.turn);
    assert.equal(row.slice(row.indexOf(': ') + 2), item.event.text);
    assert.equal(item.event.flags, 2);
}
const tuneRow = decodeScreen(native.segments[expected.index].steps[expected.cBoundary].screen)[expected.cRow]
    .map(renderCell).join('').trimEnd();
assert.equal(tuneRow, expected.decodedCRow);
assert.equal(Number(tuneRow.trimStart().split(': ', 1)[0]), expected.event.turn);
assert.equal(tuneRow.slice(tuneRow.indexOf(': ') + 2), expected.event.text);
assert.equal(expected.event.flags, 4096);
const sourceRequirements = read('requirements-additions.json');
assert.deepEqual(sourceRequirements.map(row => row.id), recipe.branches);
assert.ok(sourceRequirements.every(row => row.cFile === 'src/pray.c' && row.cFunction === 'gcrownu'));
const prerequisiteRequirements = read('prerequisite-requirements-additions.json');
assert.equal(prerequisiteRequirements.length, 4);
assert.ok(prerequisiteRequirements.slice(0, 3).every(row => row.cFile === 'src/quest.c' && row.cFunction === 'chat_with_leader'));
assert.equal(prerequisiteRequirements[3].cFunction, 'pleased');
const sourcePreflight = {evidenceFiles:Object.keys(contract.evidencePins).length,
    historicalChecks:['source12 33/42 and failed C page producer', 'source35 33/42',
        'candidate334 42+3, native5/6 and three serialization failures', 'tune343 42+3+1, native6/6'],
    original42BodyVerbatim:true, negativeHashes:15, reviewedCProvenanceOnly:true};
const nativePreflight = {sha256:contract.native.sha256, source:'c', version:5, cases:6, ...totals,
    fieldsAndPresence:true, allKeysExact:true, primaryAssertions:6, supplementaryQuestRows:3,
    supplementaryTuneRows:1, integrityErrors:[], branchErrors:[], beforeGameplayImports:true};

// Read-only comparisons and supplementary predicates follow. Gameplay imports
// occur only after the original C and all installed evidence pass above.
const calls=a=>(a||[]).map(s=>{
    const call=String(s).replace(/\s*@\s.*$/,'').replace(/^\d+\s+/,'').trim();
    assert.match(call,/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/,'every raw entry is a retained core RNG call');
    return call;
});
const hash=a=>createHash('sha256').update(JSON.stringify(a)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const styled=c=>({ch:renderCell(c),color:c.color,attr:c.attr});
function gridDiff(c,j) {
    const cg=decodeScreen(c),jg=decodeScreen(j);
    const out={frozenEqual:true,fullStyleEqual:true,totalCells:0,matchingStyleCells:0,
        blankStyleMismatches:0,nonblankStyleMismatches:0,glyphMismatches:0};
    for(let y=0;y<24;y++)for(let x=0;x<80;x++){
        const cv=styled(cg[y][x]),jv=styled(jg[y][x]);out.totalCells++;
        if(same(cv,jv))out.matchingStyleCells++;
        else {
            out.fullStyleEqual=false;
            const difference={x,y,c:cv,js:jv};
            out.firstFullStyleDifference??=difference;
            if(cv.ch!==jv.ch)out.glyphMismatches++;
            else if(cv.ch===' ')out.blankStyleMismatches++;
            else out.nonblankStyleMismatches++;
        }
        const frozen=diffCell(cg[y][x],jg[y][x]);
        if(frozen){out.frozenEqual=false;out.firstFrozenDifference??={x,y,kind:frozen,c:cv,js:jv};}
    }
    return out;
}
function firstArrayDiff(c,j) {
    for(let i=0;i<Math.max(c.length,j.length);i++)if(!same(c[i],j[i]))return {index:i,c:c[i]??null,js:j[i]??null};
    return null;
}
function compareSegment(segment, part, j) {
    const c={screens:part.steps.map(s=>s.screen),cursors:part.steps.map(s=>s.cursor),
        calls:part.steps.flatMap(s=>s.rng||[]),slices:part.steps.map(s=>s.rng||[]),
        frames:part.steps.map(s=>s.animation_frames||[])};
    const expectedCalls=calls(c.calls),actualCalls=calls(j.calls);
    const expectedSlices=c.slices.map(calls),actualSlices=j.slices.map(calls);
    const result={segment,name:part.name,boundaries:{expected:c.screens.length,actual:j.screens.length},
        frozenScreens:0,fullStyleScreens:0,matchingStyleCells:0,totalCells:0,blankStyleMismatches:0,
        nonblankStyleMismatches:0,glyphMismatches:0,screenDifferences:[],
        cursors:{expected:c.cursors.length,actual:j.cursors.length,matched:0,firstDifference:firstArrayDiff(c.cursors,j.cursors)},
        calls:{rawExpected:c.calls.length,rawActual:j.calls.length,discardedEntries:0,expected:expectedCalls.length,actual:actualCalls.length,firstDifference:firstArrayDiff(expectedCalls,actualCalls)},
        slices:{expected:expectedSlices.length,actual:actualSlices.length,matched:0,differences:[]},
        frames:{expected:c.frames.flat().length,actual:j.frames.flat().length,expectedSlices:c.frames.length,actualSlices:j.frames.length,countMismatches:[],fullStyleMatches:0,cursorMatches:0},
        rawHashes:{c:Object.fromEntries(Object.entries(c).map(([k,v])=>[k,hash(v)])),js:Object.fromEntries(Object.entries(j).map(([k,v])=>[k,hash(v)]))},
        normalizedHashes:{c:{calls:hash(expectedCalls),slices:hash(expectedSlices)},js:{calls:hash(actualCalls),slices:hash(actualSlices)}}};
    for(let step=0;step<c.screens.length;step++){
        if(j.screens[step]!==undefined){const d=gridDiff(c.screens[step],j.screens[step]);
            result.frozenScreens+=+d.frozenEqual;result.fullStyleScreens+=+d.fullStyleEqual;
            for(const k of ['matchingStyleCells','totalCells','blankStyleMismatches','nonblankStyleMismatches','glyphMismatches'])result[k]+=d[k];
            if(!d.fullStyleEqual)result.screenDifferences.push({step,...d});
        }
        result.cursors.matched+=+same(c.cursors[step],j.cursors[step]);
        if(same(expectedSlices[step],actualSlices[step]))result.slices.matched++;
        else result.slices.differences.push({step,expected:expectedSlices[step].length,actual:actualSlices[step]?.length??null,
            first:firstArrayDiff(expectedSlices[step],actualSlices[step]||[])});
        const cf=c.frames[step],jf=j.frames[step]||[];
        if(cf.length!==jf.length)result.frames.countMismatches.push({step,expected:cf.length,actual:jf.length});
        for(let frame=0;frame<cf.length;frame++)if(jf[frame]){
            const d=gridDiff(cf[frame].screen,jf[frame].screen);result.frames.fullStyleMatches+=+d.fullStyleEqual;
            result.frames.cursorMatches+=+same(cf[frame].cursor,jf[frame].cursor);
            if(!d.fullStyleEqual)(result.frames.styleDifferences??=[]).push({step,frame,...d});
        }
    }
    result.frozenScreenCursorExact=result.boundaries.expected===result.boundaries.actual&&result.frozenScreens===c.screens.length&&result.cursors.matched===c.cursors.length;
    result.fullRngExact=expectedCalls.length===actualCalls.length&&!result.calls.firstDifference
        &&expectedSlices.length===actualSlices.length&&result.slices.matched===expectedSlices.length;
    result.fullStyleExact=result.boundaries.expected===result.boundaries.actual&&result.fullStyleScreens===c.screens.length;
    result.animationExact=result.frames.expected===result.frames.actual&&!result.frames.countMismatches.length
        &&result.frames.expectedSlices===result.frames.actualSlices&&result.frames.fullStyleMatches===result.frames.expected&&result.frames.cursorMatches===result.frames.expected;
    return result;
}

function questChecks(rows) {
    return expectations.map(({index, name, event}) => {
        const actual = rows[index].last.logs.filter(entry => entry.text === event.text);
        const check = {index, name, expected:[event], actual};
        try {
            assert.deepEqual(actual, [event]);
            check.pass = true;
        } catch (error) {
            check.pass = false;
            check.error = error.message;
        }
        return check;
    });
}

function tuneCheck(rows) {
    const actual = rows[expected.index].last.logs.filter(entry => entry.text === expected.event.text);
    const check = {index:expected.index, name:expected.name, expected:[expected.event], actual};
    try {
        assert.deepEqual(actual, [expected.event]);
        check.pass = true;
    } catch (error) {
        check.pass = false;
        check.error = error.message;
    }
    return check;
}

const nativeRows = [];

const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ONAMES} = await import('../js/objects_data.js');
const arts = await import('../js/artilist_data.js');
const {FROMOUTSIDE} = await import('../js/const.js');
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');
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

const quest = questChecks(rows), tune = tuneCheck(rows);
// The original serializer represents complete saved rows; no fields are selected.
const storedRows = JSON.parse(JSON.stringify(rows));
const negativeControls = [];
for (const index of [3, 4, 5]) {
    assert.deepEqual(storedRows[index], baselineRows[index]);
    assert.deepEqual(storedRows[index].hashes, negativeHashes[index]);
    assert.deepEqual(nativeRows[index], nativeBefore[index]);
    negativeControls.push({index, allFiveHashes:true, completeOrdinaryRow:true, completeNativeRow:true});
}
const report = {sourcePreflight, nativePreflight, recipeSHA256:contract.recipe.sha256,
    rows, questChecks:quest, tuneCheck:tune, nativeRows, negativeControls};
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
const checks = rows.flatMap(row => row.checks);
const summary = {ordinary:checks.filter(check => check.pass).length, ordinaryTotal:42,
    quest:quest.filter(check => check.pass).length, questTotal:3, tune:+tune.pass,
    native:nativeRows.filter(exact).length, nativeTotal:6, negativeHashes:15,
    completeNegativeRows:negativeControls.length,
    neutrality:rows.flatMap(row => row.checks.slice(-2)).filter(check => check.pass).length,
    keys:totals.keys, boundaries:totals.boundaries, calls:totals.calls, frames:totals.frames};
console.log(JSON.stringify(summary));
if (checks.some(check => !check.pass) || quest.some(check => !check.pass)
    || !tune.pass || nativeRows.some(row => !exact(row))) process.exitCode = 1;
