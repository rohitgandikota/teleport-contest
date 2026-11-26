// Installed runtime only. Original C and retained evidence are checked first.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const evidence = new URL('tools/gen-sessions/evidence/autoquiver-equipment/', root);
const json = url => JSON.parse(readFileSync(url));
const read = name => json(new URL(name,evidence));
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = url => sha(readFileSync(url));
const hash = value => sha(JSON.stringify(value));
const persisted = value => JSON.parse(JSON.stringify(value));
assert(process.argv.length <= 3, 'usage: node tools/autoquiver-equipment-gate.mjs [new-report.json]');
const reportPath = process.argv[2] || null;
assert(!reportPath || (!reportPath.startsWith('-') && !existsSync(reportPath)), 'report must be a new file');
const contractFile = new URL('source-contract.json',evidence);
assert.equal(digest(contractFile),'013a5e3d9d1c95040d5b0af2ff5521973a8b73de7d554ea46557dd29ecf7bcb8');
const contract = json(contractFile);
for (const [name,expected] of Object.entries(contract.evidencePins))
    assert.equal(digest(new URL(name,evidence)),expected,name);
for (const [name,expected] of Object.entries(contract.portableDependencyPins))
    assert.equal(digest(new URL(name,root)),expected,name);
for (const [label,pin] of Object.entries(contract.sealedPackets)) {
    assert.equal(digest(new URL(label+'/SEAL.json',evidence)),pin.sealSHA256);
    const seal = read(label+'/SEAL.json'), manifest = read(label+'/manifest.json');
    assert.equal(digest(new URL(label+'/manifest.json',evidence)),seal.manifestSHA256);
    assert.equal(seal.manifestSHA256,pin.manifestSHA256);
    assert.equal(seal.members,pin.members);
    assert.equal(Object.keys(manifest.members).length,pin.members);
}
for (const [name,origin] of Object.entries(contract.sealedEvidence))
    assert.equal(digest(new URL(name,evidence)),read(origin.packet+'/manifest.json').members[origin.member].sha256,name);

const originalRecipe = read('source26/recipe.json');
const originalPredictions = read('source26/predictions.json');
const predictions = read('source26/parent-predictions-proposal.json');
const recipeFile = new URL(contract.recipe.path,root);
assert.equal(digest(recipeFile),contract.recipe.sha256);
const recipe = json(recipeFile), lock = read('source26/input-lock.json');
assert.equal(digest(new URL('source26/input-lock.json',evidence)),contract.originalInputLockSHA256);
const expectedRecipe = structuredClone(originalRecipe), expectedPredictions = structuredClone(originalPredictions);
for (const index of [0,3]) {
    let values = expectedRecipe.branchAssertions[index].screenIncludes;
    values[values.indexOf('(weapon in hands)')] = '(weapon in right hand)';
    values = expectedPredictions.cases[index].inventoryRows[0].includes;
    values[values.indexOf('(weapon in hands)')] = '(weapon in right hand)';
}
assert.deepEqual(recipe,expectedRecipe); assert.deepEqual(predictions,expectedPredictions);
const metadataReview = read('parent/metadata-review.json');
assert(metadataReview.beforeC && metadataReview.allInputFieldsAndEveryKeyUnchanged && metadataReview.original86of96DiagnosticPreserved);
assert.equal(metadataReview.originalRecipeSHA256,digest(new URL('source26/recipe.json',evidence)));
assert.equal(metadataReview.primaryProposalSHA256,contract.recipe.sha256);
assert.deepEqual(metadataReview.differences,[
    {path:'.branchAssertions[0].screenIncludes[0]',old:'(weapon in hands)',new:'(weapon in right hand)'},
    {path:'.branchAssertions[3].screenIncludes[0]',old:'(weapon in hands)',new:'(weapon in right hand)'}]);
const sourceText = readFileSync(new URL('source26/probe.mjs',evidence),'utf8');
const gateText = readFileSync(new URL(import.meta.url),'utf8');
const bodyStart = 'const outputs = ' + 'run =>';
const bodyEnd = '\nconst report = ' + '{classification:';
const publicEnd = '\n// Portable ' + 'invocation.';
const originalBody = sourceText.slice(sourceText.indexOf(bodyStart),sourceText.indexOf(bodyEnd));
assert.equal(sha(originalBody),contract.observationBodySHA256);
assert.equal(gateText.slice(gateText.indexOf(bodyStart),gateText.indexOf(publicEnd)),originalBody);
const original = read('source26/reports/baseline.json');
const sealedCurrent = read('candidate313/reports/ordinary.json');
const sealedLegacy = read('candidate313/reports/original-expectations.json');
assert.equal(original.summary.pass,86); assert.equal(original.summary.total,96);
assert.equal(sealedCurrent.summary.passed,96); assert.equal(sealedCurrent.summary.total,96);
assert.equal(sealedLegacy.summary.passed,94); assert.equal(sealedLegacy.summary.total,96);
assert.deepEqual(sealedLegacy.rows.map(row=>row.checks.filter(c=>!c.ok).length),[1,0,0,1,0,0]);
const negative = read('source26/reports/negative-controls.json');
assert.deepEqual(negative.indexes,[3,4,5]); assert.deepEqual(negative.rows,original.rows.slice(3));
const nativeBefore = read('parent/baseline-native.json'), candidateNative = read('candidate313/reports/native.json');
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact && row.fullRngExact && row.animationExact;
assert.equal(nativeBefore.filter(exact).length,3); assert.equal(candidateNative.filter(exact).length,6);
for (const index of [3,4,5]) {
    assert.deepEqual(sealedLegacy.rows[index],original.rows[index]);
    assert.deepEqual(candidateNative[index],nativeBefore[index]);
    assert.deepEqual(sealedCurrent.rows[index].hashes,original.rows[index].hashes);
    const corrected = structuredClone(original.rows[index]);
    if (index === 3) {
        const check = corrected.checks.find(c=>c.name==='decoded inventory row suffixes match C equipment readers');
        assert.equal(check.ok,false); check.ok = true; delete check.error;
    }
    assert.deepEqual(sealedCurrent.rows[index],corrected);
}
const parentLock = read('parent/input-lock.json'), recording = read('parent/native-recording.json');
assert(parentLock.beforeC && recording.cExecutedOnce && recording.exit === 0);
assert.equal(parentLock.sourceSealSHA256,contract.sealedPackets.source26.sealSHA256);
assert.equal(recording.sourceSealSHA256,contract.sealedPackets.source26.sealSHA256);
assert.equal(parentLock.primaryRecipeSHA256,contract.recipe.sha256);
assert.equal(recording.primaryRecipeSHA256,contract.recipe.sha256);
assert.equal(recording.inputSHA256,parentLock.minimalSHA256);
assert.equal(recording.rawSha256,contract.native.sha256);
assert.equal(recording.cPin,contract.cPin);
assert.equal(recording.binarySha256,contract.recordedBinarySHA256);
assert.equal(recording.recorderSha256,contract.recordedRecorderSHA256);
const rawBytes = readFileSync(new URL(contract.native.path,root));
assert.equal(sha(rawBytes),contract.native.sha256); assert.equal(rawBytes.length,775691);
const native = JSON.parse(rawBytes);
assert.equal(native.source,'c'); assert.equal(native.version,5);
assert.deepEqual(Object.keys(native).sort(),Object.keys(recipe).sort());
for (const name of Object.keys(recipe)) if (name !== 'segments') assert.deepEqual(native[name],recipe[name],name);
assert.equal(native.segments.length,6); assert.equal(recipe.segments.length,6);
for (const [index,part] of recipe.segments.entries()) {
    assert.deepEqual(part,lock.inputs[index].fields);
    assert.deepEqual(Array.from(part.moves,ch=>ch.charCodeAt(0)),lock.inputs[index].keys);
    for (const field of ['name','seed','datetime','nethackrc','moves']) {
        assert.equal(Object.hasOwn(part,field),lock.inputs[index].presence[field]);
        assert.equal(Object.hasOwn(native.segments[index],field),lock.inputs[index].presence[field]);
        assert.deepEqual(native.segments[index][field],part[field]);
    }
    assert.deepEqual(native.segments[index].steps.map(step=>step.key),[null,...part.moves]);
}
const {branchAssertionErrors,recordingIntegrityErrors} = await import('./gen-sessions/assertions.mjs');
const {decodeScreen,renderCell} = await import('../frozen/screen-decode.mjs');
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.equal(recipe.requireBranchAssertions,true); assert.equal(recipe.branchAssertions.length,6);
const requirements = read('requirements-additions.json');
assert.deepEqual(requirements.map(row=>row.id),recipe.branches);
assert(requirements.every(row=>row.cFile==='src/invent.c' && row.cFunction==='hold_another_object'));
const inventoryRows = [];
for (const prediction of predictions.cases) {
    const step = native.segments[prediction.index].steps[prediction.inventory];
    const decoded = decodeScreen(step.screen).map(row=>row.map(renderCell).join('').trimEnd());
    for (const rule of prediction.inventoryRows) {
        const matches = decoded.filter(row=>new RegExp('^\\s*'+rule.letter+' [-+] ').test(row));
        assert.equal(matches.length,1);
        for (const text of rule.includes) assert(matches[0].includes(text),text);
        for (const text of rule.excludes) assert(!matches[0].includes(text),text);
        inventoryRows.push({index:prediction.index,step:prediction.inventory,letter:rule.letter,
            row:matches[0],includes:rule.includes,excludes:rule.excludes});
    }
}
assert.equal(inventoryRows.length,10);
assert.deepEqual(inventoryRows,read('parent/inventory-preflight.json').checked);
const totals = {keys:recipe.segments.reduce((n,s)=>n+s.moves.length,0),
    boundaries:native.segments.reduce((n,s)=>n+s.steps.length,0),
    calls:native.segments.reduce((n,s)=>n+s.steps.reduce((m,step)=>m+(step.rng||[]).length,0),0),
    frames:native.segments.reduce((n,s)=>n+s.steps.reduce((m,step)=>m+(step.animation_frames||[]).length,0),0)};
assert.deepEqual(totals,{keys:278,boundaries:284,calls:15162,frames:0});
const nativePreflight = {beforeGameplayImports:true,sourceC5:true,rawSHA256:contract.native.sha256,
    recipeSHA256:contract.recipe.sha256,allRootMetadata:true,fiveFieldPresenceAndValues:true,allKeysExact:true,
    integrityErrors:[],primaryErrors:[],primaryAssertions:6,decodedInventoryRows:10,totals};

// All imports below resolve against the current installed runtime.
const {runSegment,NethackGame} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {GameDisplay} = await import('../js/game_display.js');
const {moveloop_core} = await import('../js/allmain.js');
const state = await import('../js/gstate.js');
const {ONAMES} = await import('../js/objects_data.js');
const {W_WEP,W_SWAPWEP,W_QUIVER,OBJ_INVENT} = await import('../js/const.js');

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

// Portable invocation. The original observation and assertion body ends above.
const results = [];
for (const [index,part] of recipe.segments.entries()) {
    const result = {index,name:part.name};
    let currentRow,legacyRow;
    try {
        const observation = await observed(part);
        const plain = structuredClone(outputs(await runSegment({...part,storage:new InMemoryStorage()})));
        const delayed = await deferred(part);
        const streams = {hashes:hashes(observation.output),plainHashes:hashes(plain),deferredHashes:hashes(delayed.output),
            pending:delayed.pending,boundaries:observation.output.screens.length,
            calls:observation.output.calls.length,frames:observation.output.frames.flat().length};
        currentRow = {index,name:part.name}; legacyRow = {index,name:part.name};
        Object.assign(currentRow,evaluate(part,predictions.cases[index],observation,plain,delayed),streams);
        Object.assign(legacyRow,evaluate(part,originalPredictions.cases[index],observation,plain,delayed),streams);
        assert(currentRow.checks.every(check=>check.ok),'all authoritative checks');
        assert.deepEqual(persisted(currentRow),sealedCurrent.rows[index],'complete authoritative row');
        assert.deepEqual(persisted(legacyRow),sealedLegacy.rows[index],'complete legacy row');
        if ([3,4,5].includes(index)) {
            assert.deepEqual(persisted(legacyRow),original.rows[index],'complete original negative row, including old wording failure');
            assert.deepEqual(currentRow.hashes,original.rows[index].hashes,'five negative hashes');
        }
        Object.assign(result,{authoritativePassed:currentRow.checks.filter(c=>c.ok).length,
            legacyPassed:legacyRow.checks.filter(c=>c.ok).length,total:currentRow.checks.length,
            setupPassed:currentRow.checks.filter(c=>c.kind==='setup' && c.ok).length,
            neutralityPassed:currentRow.checks.filter(c=>c.kind==='neutrality' && c.ok).length,
            pendingEOF:true,hashes:currentRow.hashes,
            authoritativeRowSHA256:hash(persisted(currentRow)),legacyRowSHA256:hash(persisted(legacyRow)),
            fullAuthoritativeRowExact:true,fullLegacyRowExact:true,
            legacyFailures:legacyRow.checks.filter(c=>!c.ok)});
    } catch (error) {
        result.error = {message:error.message,stack:error.stack};
        // Preserve every observed failure if this gate ever regresses.
        result.currentRow = currentRow; result.legacyRow = legacyRow;
    }
    results.push(result);
}
const report = {nativePreflight,sourcePreflight:{immutableEvidence:Object.keys(contract.evidencePins).length,
    originalAssertionsVerbatim:true,onlyApprovedTwoLiteralCorrection:true,historicalSource:'86/96',candidateLegacy:'94/96',
    historicalNative:'3/6 -> 6/6',nativeReplay:false,completeHistoricalNativeNegatives:3},
    runtimeOwnerSHA256:digest(new URL('js/invent.js',root)),results,
    summary:{cases:results.length,authoritativePassed:results.reduce((n,r)=>n+(r.authoritativePassed||0),0),
        legacyPassed:results.reduce((n,r)=>n+(r.legacyPassed||0),0),
        total:results.reduce((n,r)=>n+(r.total||0),0),setupPassed:results.reduce((n,r)=>n+(r.setupPassed||0),0),
        neutralityPassed:results.reduce((n,r)=>n+(r.neutralityPassed||0),0),pendingEOF:results.filter(r=>r.pendingEOF).length,
        negativeHashes:results.filter(r=>[3,4,5].includes(r.index)&&!r.error).length*5,
        completeOriginalOrdinaryNegatives:results.filter(r=>[3,4,5].includes(r.index)&&!r.error).length,
        errors:results.filter(r=>r.error).length}};
if (reportPath) writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
if (report.summary.errors || report.summary.authoritativePassed !== 96 || report.summary.legacyPassed !== 94
    || report.summary.total !== 96 || report.summary.setupPassed !== 42 || report.summary.neutralityPassed !== 12
    || report.summary.pendingEOF !== 6 || report.summary.negativeHashes !== 15)
    process.exitCode = 1;
