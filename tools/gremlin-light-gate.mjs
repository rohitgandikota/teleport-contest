// C monmove.c448-571: actual lit hero equipment and light-specific fleeing feedback.
// All five real keyboard cases, original assertions, and complete negative rows.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen as preflightDecode, renderCell as preflightCell} from '../frozen/screen-decode.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'usage: gremlin-light-gate.mjs [new-report.json]');
const reportPath = process.argv[2];
assert.ok(!reportPath || !existsSync(reportPath), 'report must be a new file');
const evidence = new URL('gen-sessions/evidence/gremlin-light/', import.meta.url);
const evidencePins = {
    "README.md": "a533b2a11d119d9f58a89989be82f3d5634ed3f0d3f0c102ca31f922d54b1e24",
    "SETVOICE-REVIEW.md": "5f3971695849b11206d6476f86d61fd707a15b5ed2eed8e0ea879ffa00ff9cd5",
    "baseline-accounting.json": "90daa6e8bd9949b0608cc9422d374fe81a9c5bb900f1bcc7bf1a7c0524578d46",
    "baseline-command.json": "522776d5809cafb69725cb8329f7374d23dc1f80adcb7acf4c4dbfd491b8b6ce",
    "baseline-native.json": "13c6a28e0c01f4fb5d5b3ccdd01fe07adb82477b0985cc0b8ea846523dba06ee",
    "baseline-observation.json": "4290f1b41a1b9c77315db24ce7c8cdc5f5434a3206b7bbe9ab52e1aa053c135b",
    "baseline.log": "44e475a46e8fae45d80caa2b397fab8d3e921b31eb2c343100891ee7a67ec731",
    "candidate-checks.json": "2fecb87962a0b06b400e64560bae2c3d20e302d14113f675dcaae2ad749c483d",
    "candidate-native.json": "74606ba99fd3b1e2b2ad54996095c5844d930c5a3d7ba3dfcdc581175885a268",
    "candidate-observation.json": "44ed0c25c04fb9a0245281b5c8cfaef6f30f0bf0f9956acf0c035bcd4ac70f74",
    "candidate-preflight.json": "13e9c7c166dc138caeb1ebbd950b843c9dd8e04baf086f4ffa835d8aac4eb8f7",
    "candidate-review.md": "7811c82e9547fe1eab615b72631eef5fb27a2e04915751ef937db6c3095169a6",
    "candidate-seal.json": "2f334c58d869f1e7533879c8668de9a078ce9107809b4cdc5ae9c3c371470134",
    "derivation.json": "749fb48e967e28a7aef3ae336cf1045418a9d1895090f11c62d0938889c060fd",
    "input-lock.json": "270bd442da012af85006629c3643d52c6682881fc7bf68b8517a50aa4d1e848d",
    "native-supplement.json": "9334a7f17a56ff31a1a0a92c2c7066a191f2a4ed305c0a517f28d8ee5a08d316",
    "negative-hashes.json": "00de2a54d91ca6b127167df3dab605669b79116fa8f069d112466f42fd2b6b31",
    "ordinary-original.mjs": "5932b26fe5f7bc7f9256d44aa6cf9fee51c3cc50f0d73d8badb596d0f7a42819",
    "parent-input-lock.json": "f10ab9d242955e6125129259ffbc5085cfe109de07c9e5b756f04449394ec453",
    "parent-supplemental-preflight.json": "afaae0ae852fec4d2f27ede4a1223179f5e3d154a1787e5ad09ede0324d0e591",
    "predictions.json": "35830b0c4130f582947177dd635b16a9ae493ff9755887ace116da4bca04f788",
    "provenance.json": "057d4132f04b3ef65e320d78347a6c22d68b23f4b68d808dba50fc2425bb4dc6",
    "recording-receipt.json": "1cad51cd20d9e60ff680049ae44601d063b2c38c72330672722ef60a5b5b0cca",
    "recording.log": "62957afb40e1d3a34304ae5a1fc63ee6c355191a55d15a16b732c567a850e861",
    "setvoice-source.json": "1c10ed1f2e84431179e6435b6cb75cbdc63c55df75c5c1557692e42a5783718a",
    "sound-build-evidence.json": "80f023166aba72089d37399ae62f0e21147ff8128d977af43478741ea85528ee",
    "source-checks.json": "8928eb23c3d50bc5efd7d7cb2383bdccb0fcab2665ef7e53b36e7bc40f886961",
    "source-ranges.json": "dea91e267396bdab0818ff2a1404c75558e34461c6fe87a20b0a9d83425f2361",
    "source-review.md": "761a647ba55a251aeea296e53b4425c404f0bfb29b274414af4a91ea214670b2",
    "source-seal.json": "610345bc6dfc8a470c9629d52bff306aeed62907b58b6bf24a2fc3776106b5f4"
};
for (const [name, digest] of Object.entries(evidencePins))
    assert.equal(sha(readFileSync(new URL(name, evidence))), digest, name);
const supportPins = {
    "half-damage-reader-observe.mjs": "201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07",
    "gen-sessions/assertions.mjs": "aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc",
    "gen-sessions/screen-decode.mjs": "0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0",
    "../frozen/screen-decode.mjs": "cb4a0fbfed3dda28c14736e6ae9c8b9eb8c87d75916c50d6df80f40eb0368cbe"
};
for (const [name, digest] of Object.entries(supportPins))
    assert.equal(sha(readFileSync(new URL(name, import.meta.url))), digest, name);
const read = name => JSON.parse(readFileSync(new URL(name, evidence)));
const lock = read('input-lock.json'), parentLock = read('parent-input-lock.json');
const sourceSeal = read('source-seal.json'), candidateSeal = read('candidate-seal.json');
const receipt = read('recording-receipt.json');
assert.equal(candidateSeal.originalSourceSealSHA256, evidencePins['source-seal.json']);
assert.equal(parentLock.sourceSealSHA256, evidencePins['source-seal.json']);
assert.equal(receipt.sourceSealSHA256, evidencePins['source-seal.json']);
assert.equal(receipt.exit, 0); assert.equal(receipt.cExecutedOnce, true);
assert.equal(read('sound-build-evidence.json').recordingBinarySHA256, receipt.binarySha256);
const recipeBytes = readFileSync(new URL('gen-sessions/recipes/gremlin-light.json', import.meta.url));
const recipeSHA256 = sha(recipeBytes);
assert.equal(recipeSHA256, 'b0a1ba4e870c0f688a611c8ba792f97e596444fe7d77acca35fde8599b594fed');
assert.equal(sourceSeal.recipeSHA256, recipeSHA256);
assert.equal(candidateSeal.recipeSHA256, recipeSHA256);
assert.equal(lock.files['recipe.json'], recipeSHA256);
assert.equal(lock.files['predictions.json'], evidencePins['predictions.json']);
assert.equal(lock.files['native-supplement.json'], evidencePins['native-supplement.json']);
assert.equal(lock.probeSHA256, evidencePins['ordinary-original.mjs']);
for (const key of ['sourceRecipeSHA256', 'primaryRecipeSHA256', 'minimalSHA256'])
    assert.equal(parentLock[key], recipeSHA256);
assert.equal(receipt.inputSHA256, recipeSHA256);
assert.equal(receipt.primaryRecipeSHA256, recipeSHA256);
const recipe = JSON.parse(recipeBytes), plans = read('predictions.json');
assert.equal(recipe.segments.length, 5);
assert.equal(recipe.branches.length, 5);
assert.equal(recipe.branchAssertions.length, 5);
assert.equal(recipe.requireBranchAssertions, true);
assert.deepEqual(lock.fields, ['name', 'seed', 'datetime', 'nethackrc', 'moves']);
const tuples = parts => parts.map(part => lock.fields.map(field =>
    ({field, present:Object.hasOwn(part, field), value:part[field]})));
assert.deepEqual(tuples(recipe.segments), lock.tuples);
const rawBytes = readFileSync(new URL('gen-sessions/generated/gremlin-light.session.json', import.meta.url));
const rawSHA256 = sha(rawBytes);
assert.equal(rawSHA256, '2edde5d3498453eb4f3c7d91a19d9808ea392caeff791bfcfeff6db90f93a452');
assert.equal(rawBytes.length, 975494);
assert.equal(receipt.rawSha256, rawSHA256);
assert.equal(candidateSeal.rawSHA256, rawSHA256);
const native = JSON.parse(rawBytes);
assert.equal(native.source, 'c'); assert.equal(native.version, 5);
assert.equal(native.segments.length, 5);
assert.deepEqual(tuples(native.segments), lock.tuples);
for (const key of Object.keys(recipe)) {
    if (key === 'segments') continue;
    assert.ok(Object.hasOwn(native, key)); assert.deepEqual(native[key], recipe[key]);
}
for (const [i, part] of recipe.segments.entries()) {
    assert.deepEqual(native.segments[i].steps.map(step => step.key), [null, ...part.moves]);
    assert.deepEqual([...Buffer.from(part.moves)], lock.keyBytes[i]);
    assert.equal(sha(part.moves), lock.movesSHA256[i]);
    assert.equal(recipe.branchAssertions[i].branch, recipe.branches[i]);
    assert.equal(recipe.branchAssertions[i].segment, i);
}
assert.equal(recipe.segments.reduce((n,p) => n + p.moves.length, 0), 755);
assert.equal(native.segments.reduce((n,p) => n + p.steps.length, 0), 760);
assert.equal(native.segments.flatMap(p => p.steps).flatMap(s => s.rng || []).length, 13811);
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
const nativeTexts = native.segments.map(part => part.steps.map(step => preflightDecode(step.screen)
    .map(row => row.map(preflightCell).join('').trimEnd()).join('\n').replace(/\s+/g, ' ')));
const supplement = read('native-supplement.json'), alternatives = [];
assert.deepEqual(supplement.negativeIndexes, [2,3,4]);
assert.deepEqual(supplement.positiveAnyOf.map(p => p.segment), [0,1]);
assert.ok(supplement.chosenBeforeGameplay && supplement.requiredAlongsideBaseAssertions);
for (const predicate of supplement.positiveAnyOf) {
    const matched = predicate.anyOf.map(option => nativeTexts[predicate.segment]
        .some(text => option.screenIncludes.every(phrase => text.includes(phrase))));
    assert.ok(matched.some(Boolean), `mandatory source feedback OR ${predicate.segment}`);
    alternatives.push({segment:predicate.segment, matched});
}
for (const i of supplement.negativeIndexes)
    assert.ok(nativeTexts[i].every(text => supplement.negativeScreenExcludes.every(phrase => !text.includes(phrase))));
const baselineRows = read('baseline-observation.json'), candidateRows = read('candidate-observation.json');
const nativeBefore = read('baseline-native.json'), nativeAfter = read('candidate-native.json');
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact && row.fullRngExact && row.animationExact;
assert.equal(nativeBefore.filter(exact).length, 3);
assert.equal(nativeAfter.length, 5); assert.ok(nativeAfter.every(exact));
assert.equal(evidencePins['candidate-native.json'], candidateSeal.nativeReportSHA256);
assert.equal(baselineRows.flatMap(r => r.checks).filter(c => c.pass).length, 71);
assert.equal(baselineRows.flatMap(r => r.checks).filter(c => !c.pass).length, 4);
assert.equal(read('baseline-command.json').exit, 1);
assert.deepEqual(read('baseline-accounting.json').failed, [0,1]);
for (const i of [2,3,4]) {
    assert.deepEqual(baselineRows[i], candidateRows[i]);
    assert.deepEqual(nativeBefore[i], nativeAfter[i]);
}
assert.deepEqual([2,3,4].map(index => ({index, hashes:baselineRows[index].hashes})), read('negative-hashes.json'));
const original = readFileSync(new URL('ordinary-original.mjs', evidence), 'utf8');
const derivation = read('derivation.json');
const start = original.indexOf(derivation.start);
const originalBody = original.slice(start, original.indexOf(derivation.end, start));
assert.equal(sha(original), derivation.originalProbeSHA256);
assert.equal(sha(originalBody), derivation.originalBodySHA256);
let portableBody = originalBody;
for (const [before, after] of derivation.importRelocations)
    portableBody = portableBody.replaceAll(before, after);
assert.equal(sha(portableBody), derivation.portableBodySHA256);
const current = readFileSync(new URL(import.meta.url), 'utf8');
assert.equal(current.split('// BEGIN ORIGINAL ORDINARY BODY\n')[1]
    .split('\n// END ORIGINAL ORDINARY BODY')[0], portableBody);
// Exact C/data/history preflight finishes before tested gameplay imports.
// BEGIN ORIGINAL ORDINARY BODY
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ONAMES} = await import('../js/objects_data.js');
const {PMNAMES} = await import('../js/monst_data.js');
const artifacts = await import('../js/artilist_data.js');
const {W_WEP, W_ARM} = await import('../js/const.js');
const {artifact_light} = await import('../js/artifact.js');
const {arti_light_radius} = await import('../js/light.js');
const {couldsee} = await import('../js/vision.js');
const {canseemon} = await import('../js/display.js');
const {monnear, onscary, in_your_sanctuary} = await import('../js/monmove.js');
const {Blind, Deaf, Unaware, Invis, Displaced, Hallucination} = await import('../js/youprop.js');
const {decodeScreen, renderCell} = await import('../frozen/screen-decode.mjs');
const {outputs, hashes, hash, deferred} = await import('./half-damage-reader-observe.mjs');
const rows = [];
const object = obj => obj ? {id:obj.o_id, type:obj.otyp, letter:obj.invlet,
    artifact:obj.oartifact || 0, worn:obj.owornmask || 0, lamplit:!!obj.lamplit,
    artifactLight:!!artifact_light(obj), radius:arti_light_radius(obj),
    blessed:!!obj.blessed, cursed:!!obj.cursed} : null;
for (const [index, part] of recipe.segments.entries()) {
    const plan = plans[index], states = [], checks = [];
    const check = (kind, name, fn) => {
        try {fn(); checks.push({kind, name, pass:true});}
        catch (error) {checks.push({kind, name, pass:false, error:error.message});}
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run, error;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level) return;
            const primary = object(g.u.uwep), armor = object(g.u.uarm);
            const activeLight = !!((primary?.lamplit && primary.artifactLight)
                || (armor?.lamplit && armor.artifactLight));
            states.push({step, turn:g.moves, hp:g.u.uhp, hpmax:g.u.uhpmax,
                mortality:g.u.umortality || 0, level:g.u.ulevel, female:!!g.flags.female,
                hero:[g.u.ux,g.u.uy], primary, armor, inventory:(g.invent || []).map(object),
                activeLight, legacyPrimary:!!g.uwep, legacyArmor:!!g.uarm,
                blind:!!Blind(), deaf:!!Deaf(), unaware:!!Unaware(), invisible:!!Invis(),
                displaced:!!Displaced(), hallucinating:!!Hallucination(),
                lightSources:(g.light_sources || []).map(s => ({id:s.id, type:s.type, range:s.range})),
                liveIds:g.level.monsters.filter(m => m.mhp > 0).map(m => m.m_id),
                monsters:g.level.monsters.filter(m => m.mhp > 0 && m.mnum === PMNAMES[plan.species])
                    .map(m => ({id:m.m_id, species:m.mnum, xy:[m.mx,m.my], apparent:[m.mux,m.muy],
                        hp:m.mhp, hpmax:m.mhpmax, movement:m.movement,
                        peaceful:!!m.mpeaceful, tame:!!m.mtame, sleeping:!!m.msleeping,
                        canmove:!!m.mcanmove, speed:g.mons[m.mnum].mmove,
                        cansee:!!m.mcansee, couldsee:couldsee(m.mx,m.my), visible:canseemon(m),
                        adjacent:monnear(m,g.u.ux,g.u.uy), nearbyImage:monnear(m,m.mux,m.muy),
                        scaredSquare:onscary(g.u.ux,g.u.uy,m), sanctuary:in_your_sanctuary(m,0,0),
                        flee:!!m.mflee, fleetim:m.mfleetim || 0,
                        lightEligible:m.mnum === PMNAMES.PM_GREMLIN && activeLight
                            && !!m.mcansee && couldsee(m.mx,m.my)}))});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } catch (e) {error = String(e.stack || e).split('\n').slice(0,7).join('\n');}
    finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = run ? structuredClone(outputs(run)) : null;
    const texts = (out?.screens || []).map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const before = states.find(s => s.step === plan.beforeCreation);
    const created = states.find(s => s.step === plan.creationEnd);
    const fresh = created?.monsters.filter(m => !before?.liveIds.includes(m.id)) || [];
    const id = fresh[0]?.id;
    const targetStates = states.filter(s => s.step >= plan.creationEnd)
        .flatMap(s => s.monsters.filter(m => m.id === id).map(mon => ({state:s, mon})));
    const encounter = targetStates.find(({state:s,mon:m}) => m.adjacent && m.nearbyImage
        && m.apparent[0] === s.hero[0] && m.apparent[1] === s.hero[1]);
    const firstFlee = targetStates.find(({mon}) => mon.flee);
    const last = states.at(-1);
    const desiredItem = created?.inventory.find(o => o.type === ONAMES[plan.item]);
    const feedback = texts.slice(plan.creationEnd).map(text => text.replace(/\s+/g,' '));
    const lightFeedback = feedback.some(text => (text.includes('painful light')
        && text.includes(plan.sourceName)) || text.includes('"Bright light!"'));
    check('producer', 'all input consumed with slice consistency and no runtime error', () => {
        assert.equal(error, undefined); assert.equal(last?.step, part.moves.length);
        assert.equal(out?.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
    });
    check('producer', 'actual valid female level30 hero remains alive', () => {
        assert.equal(created?.female, true); assert.equal(created?.level, 30);
        assert.ok(created.hp > 120); assert.ok(states.every(s => s.hp > 0 && !s.mortality));
    });
    check('producer', 'exactly one new live hostile awake target after creation acknowledgments', () => {
        assert.ok(before && created); assert.equal(fresh.length, 1);
        assert.equal(fresh[0].peaceful, false); assert.equal(fresh[0].tame, false);
        assert.equal(fresh[0].sleeping, false); assert.ok(fresh[0].hp > 0);
    });
    check('producer', 'wished equipment type artifact and inventory really exist', () => {
        assert.equal(created?.inventory.length, 1); assert.ok(desiredItem);
        assert.equal(desiredItem.artifact, plan.artifact ? artifacts[plan.artifact] : 0);
        assert.equal(desiredItem.blessed, false); assert.equal(desiredItem.cursed, false);
    });
    check('producer', 'actual primary and suit slots and worn masks match the keyboard proposal', () => {
        assert.equal(created?.primary?.id ?? null, plan.slot === 'weapon' ? desiredItem.id : null);
        assert.equal(created?.armor?.id ?? null, plan.slot === 'armor' ? desiredItem.id : null);
        assert.equal(!!(desiredItem.worn & W_WEP), plan.slot === 'weapon');
        assert.equal(!!(desiredItem.worn & W_ARM), plan.slot === 'armor');
    });
    check('producer', 'actual light flag predicate radius and registration match equipment', () => {
        assert.equal(desiredItem?.lamplit, plan.lit);
        assert.equal(desiredItem.artifactLight, !!plan.artifact || plan.slot === 'armor');
        assert.equal(created.activeLight, plan.lit);
        assert.equal(desiredItem.radius, plan.lit ? (plan.slot === 'armor' ? 3 : 2) : 0);
        assert.equal(created.lightSources.some(s => s.id === desiredItem.id && s.range === desiredItem.radius), plan.lit);
    });
    check('producer', 'visible sighted mobile target reaches adjacent apparent hero', () => {
        assert.ok(encounter); const m = encounter.mon;
        assert.ok(m.cansee && m.couldsee && m.visible && m.canmove && m.speed > 0);
    });
    check('producer', 'no competing scary square or sanctuary at the encounter', () => {
        assert.ok(encounter); assert.equal(encounter.mon.scaredSquare, false);
        assert.equal(encounter.mon.sanctuary, false);
    });
    check('producer', 'hero is aware hearing sighted and not displaced invisible or hallucinating', () => {
        assert.ok(encounter);
        for (const key of ['blind','deaf','unaware','invisible','displaced','hallucinating'])
            assert.equal(encounter.state[key], false, key);
    });
    check('producer', 'real turns advance and the same target survives without extra spawned targets', () => {
        assert.ok(last.turn > created.turn); assert.ok(targetStates.length);
        assert.ok(states.filter(s => s.step >= plan.creationEnd).every(s =>
            s.monsters.filter(m => !before.liveIds.includes(m.id)).length === 1
            && s.monsters.some(m => m.id === id && m.hp > 0)));
    });
    check('source', 'C light eligibility matches the preselected positive or negative branch', () => {
        assert.ok(encounter); assert.equal(encounter.mon.lightEligible, plan.positive);
    });
    check('source', 'C positive eventually flees while matched negatives do not', () => {
        if (plan.positive) {
            assert.ok(firstFlee, 'requires original-C confirmation if absent in baseline JS');
            assert.ok(firstFlee.mon.fleetim > 0 && firstFlee.mon.fleetim <= 127);
        } else assert.equal(targetStates.some(x => x.mon.flee), false);
    });
    check('source', 'C painful-light OR Bright-light feedback, with neither in negatives', () => {
        assert.equal(lightFeedback, plan.positive);
        if (!plan.positive) assert.ok(feedback.every(t => !t.includes('painful light') && !t.includes('Bright light!')));
    });
    let plain, delayed, plainError, deferredError;
    try {plain = structuredClone(outputs(await runSegment({...part, storage:new InMemoryStorage()})));}
    catch (e) {plainError = String(e.stack || e).split('\n').slice(0,7).join('\n');}
    try {delayed = await deferred(part);}
    catch (e) {deferredError = String(e.stack || e).split('\n').slice(0,7).join('\n');}
    check('neutrality', 'passive observer preserves all five output streams', () => {
        assert.equal(plainError, undefined); assert.ok(out && plain); assert.deepEqual(out, plain);
    });
    check('neutrality', 'deferred input preserves all five streams and pending EOF', () => {
        assert.equal(deferredError, undefined); assert.ok(out && delayed); assert.deepEqual(out, delayed);
    });
    const compact = pair => pair ? {step:pair.state.step, turn:pair.state.turn, hp:pair.state.hp,
        hero:pair.state.hero, activeLight:pair.state.activeLight, mon:pair.mon} : null;
    rows.push({index, name:part.name, negative:!plan.positive, checks,
        producer:checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source:checks.filter(c => c.kind === 'source').every(c => c.pass),
        firstUnmetProducer:checks.find(c => c.kind === 'producer' && !c.pass)?.name || null,
        error, plainError, deferredError, before, created, encounter:compact(encounter), firstFlee:compact(firstFlee), final:last,
        observedSteps:states.length, statesSHA256:hash(states), hashes:out ? hashes(out) : null,
        boundaries:out?.screens.length, calls:out?.calls.length, frames:out?.frames.flat().length,
        feedback:lightFeedback, messages:texts.flatMap((t,step) => step >= plan.creationEnd
            && /painful light|Bright light|gremlin|newt/.test(t.split('\n')[0])
            ? [{step,top:t.split('\n')[0]}] : []),
        postCreationRngPrefix:out?.slices.slice(plan.creationEnd).flat().slice(0,45),
        nativeParityClaimed:false});
}
// END ORIGINAL ORDINARY BODY
const persistedRows = JSON.parse(JSON.stringify(rows));
for (const i of [2,3,4])
    assert.deepEqual(persistedRows[i], baselineRows[i], `complete ordinary negative ${i}`);
assert.deepEqual([2,3,4].map(index => ({index, hashes:rows[index].hashes})), read('negative-hashes.json'));
const checks = rows.flatMap(row => row.checks);
const report = {cases:rows.length,
    sourceAndProducer:checks.filter(c => c.kind !== 'neutrality' && c.pass).length,
    sourceAndProducerTotal:65, neutrality:checks.filter(c => c.kind === 'neutrality' && c.pass).length,
    neutralityTotal:10, totalChecks:75, passed:checks.filter(c => c.pass).length,
    producerCases:rows.filter(r => r.producer).length, sourceCases:rows.filter(r => r.source).length,
    negativeHashes:15, completeOrdinaryNegativeRows:3,
    preflight:{beforeGameplayImports:true, source:'c', version:5, rawSHA256, recipeSHA256,
        fieldsAndPresence:true, keysExact:true, keys:755, boundaries:760,
        basePrimaryAssertions:5, supplementalPositiveOR:2, supplementalNegatives:3,
        alternatives, integrityErrors:[], branchErrors:[]},
    archivedNative:{baseline:'3/5', candidate:'5/5', completeNegativeRowsUnchanged:3,
        reportSHA256:evidencePins['candidate-native.json']}, nativeReplays:0,
    rows:persistedRows.map(row => ({index:row.index, name:row.name,
        rowSHA256:hash(row), allKeyStatesSHA256:row.statesSHA256,
        retainedStatesSHA256:hash({before:row.before, created:row.created, encounter:row.encounter,
            firstFlee:row.firstFlee, final:row.final}), outputHashes:row.hashes,
        failedChecks:row.checks.filter(c => !c.pass)}))};
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
process.stdout.write(JSON.stringify(report) + '\n');
assert.equal(rows.length, 5); assert.equal(checks.length, 75);
assert.ok(checks.every(c => c.pass), 'all65 source/producer and10 neutrality assertions pass');
assert.equal(report.sourceAndProducer, 65); assert.equal(report.neutrality, 10);
