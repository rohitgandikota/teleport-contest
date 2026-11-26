// C trap.c4233-4314: floor feedback uses sight saved at fire entry.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const root = new URL('../', import.meta.url);
const evidence = new URL('tools/gen-sessions/evidence/dofiretrap-entry-vision/', root);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = name => readFileSync(new URL(name, evidence));
const json = name => JSON.parse(bytes(name));
assert.ok(process.argv.length <= 3, 'usage: gate.mjs [new-report.json]');
const reportPath = process.argv[2];
assert.ok(!reportPath || (!reportPath.startsWith('-') && !existsSync(reportPath)), 'report must be a new file');
assert.equal(sha(bytes('contract.json')), 'bcda270b52375f2b8a7b38d394a5fdeb8838a198aa73f71d2e8f50e40a530224');
const contract = json('contract.json');
for (const [name, digest] of Object.entries(contract.evidencePins))
    assert.equal(sha(bytes(name)), digest, name);
for (const [name, digest] of Object.entries(contract.supportPins))
    assert.equal(sha(readFileSync(new URL(name, root))), digest, name);
for (const [label, members] of Object.entries(contract.selectedSourceMembers)) {
    const seal = json(label + '/SEAL.json'), manifest = json(label + '/MANIFEST.json');
    assert.equal(sha(bytes(label + '/MANIFEST.json')), seal.manifestSHA256);
    for (const name of members) if (name !== 'SEAL.json' && name !== 'MANIFEST.json')
        assert.equal(sha(bytes(label + '/' + name)), manifest[name], label + '/' + name);
}
assert.equal(sha(bytes('initial/SEAL.json')), contract.initialSourceSealSHA256);
assert.equal(json('initial/summary.json').checksPassed, 26);
assert.equal(json('initial/summary.json').setupCases, 0);
const correction = json('floor/correction-receipt.json');
assert.equal(correction.oldSealSHA256, contract.initialSourceSealSHA256);
assert.ok(correction.beforeGameplay && correction.sameSeedDateConfiguration && correction.sameOriginal121KeyPrefix);
assert.equal(correction.runtimeChanged, false);
assert.equal(sha(bytes('candidate-seal.json')), contract.candidateSealSHA256);
assert.equal(json('candidate-checks.json').source, '84/84');
assert.equal(json('candidate-checks.json').native, '7/7');
const family = contract.families.floor;
const read = name => json('floor/' + name);
const input = read('input-lock.json'), sourceSeal = read('SEAL.json');
assert.equal(sha(bytes('floor/SEAL.json')), family.sourceSealSHA256);
assert.equal(sha(bytes('floor/input-lock.json')), family.inputLockSHA256);
for (const [name, digest] of Object.entries(input.files))
    assert.equal(read('MANIFEST.json')[name], digest, name);
assert.equal(input.files['runtime.json'], sourceSeal.runtimeSHA256);
assert.deepEqual(input.fields, ['name', 'seed', 'datetime', 'nethackrc', 'moves']);
const recipeBytes = readFileSync(new URL(family.recipe, root));
assert.equal(sha(recipeBytes), family.recipeSHA256);
assert.equal(recipeBytes.toString(), bytes('floor/recipe.json').toString());
const recipe = JSON.parse(recipeBytes), predictions = read('predictions.json');
const tuples = parts => parts.map(part => input.fields.map(field =>
    ({field, present: Object.hasOwn(part, field),
        ...(Object.hasOwn(part, field) ? {value: part[field]} : {})})));
assert.deepEqual(tuples(recipe.segments), input.tuples);
assert.deepEqual(recipe.segments.map(part => [...part.moves].map(c => c.charCodeAt(0))), input.keys);
const parentLock = read('parent-input-lock.json'), recording = read('recording.json');
assert.ok(parentLock.beforeC && recording.cExecutedOnce);
assert.equal(recording.exit, 0);
for (const proof of [parentLock, recording]) {
    assert.equal(proof.sourceSealSHA256, family.sourceSealSHA256);
    assert.equal(proof.primaryRecipeSHA256, family.recipeSHA256);
}
const rawBytes = readFileSync(new URL(family.raw, root));
assert.equal(sha(rawBytes), family.rawSHA256);
assert.equal(rawBytes.length, family.rawBytes);
assert.equal(recording.rawSha256, family.rawSHA256);
const native = JSON.parse(rawBytes);
assert.equal(native.source, 'c');
assert.equal(native.version, 5);
assert.equal(native.segments.length, family.cases);
for (const key of Object.keys(recipe)) if (key !== 'segments') {
    assert.ok(Object.hasOwn(native, key)); assert.deepEqual(native[key], recipe[key]);
}
assert.deepEqual(tuples(native.segments), input.tuples);
for (const [i, part] of recipe.segments.entries())
    assert.deepEqual(native.segments[i].steps.map(step => step.key), [null, ...part.moves]);
assert.equal(recipe.segments.reduce((n, part) => n + part.moves.length, 0), family.keys);
assert.equal(native.segments.reduce((n, part) => n + part.steps.length, 0), family.bounds);
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branchAssertions.length, family.cases);
const supplement = read('native-supplement.json');
assert.ok(supplement.beforeGameplay);
for (const index of supplement.segments) {
    const actionTexts = native.segments[index].steps.slice(predictions[index].before + 1)
        .map(step => decodeScreen(step.screen).map(row => row.map(renderCell).join('')).join('\n'));
    assert.ok(actionTexts.some(text => supplement.screenContainsAny.some(term => text.includes(term))),
        `visible floor feedback ${index}`);
}
const before = read('baseline-observation.json'), candidate = read('candidate-observation.json');
const nativeBefore = read('baseline-native.json'), nativeAfter = read('candidate-native.json');
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact && row.fullRngExact && row.animationExact;
assert.equal(before.flatMap(row => row.checks).filter(c => c.pass).length, family.baseline);
assert.equal(candidate.flatMap(row => row.checks).filter(c => c.pass).length, family.checks);
assert.equal(nativeBefore.filter(exact).length, family.cases - 1);
assert.ok(nativeAfter.every(exact));
for (const index of family.negatives) {
    assert.deepEqual(before[index], candidate[index]);
    assert.deepEqual(nativeBefore[index], nativeAfter[index]);
}
assert.deepEqual(read('negative-hashes.json'), family.negatives.map(index => ({index, outputHashes: before[index].outputHashes})));
const original = bytes('floor/probe.mjs').toString();
const originalBody = original.slice(original.indexOf(contract.bodyStart), original.indexOf(contract.sourceBodyEnd));
assert.equal(sha(originalBody), family.originalBodySHA256);
const self = readFileSync(new URL(import.meta.url), 'utf8');
assert.equal(self.slice(self.indexOf('\nconst snapshotObject =') + 1,
    self.indexOf(contract.portableBodyEnd)), originalBody);

// The original progress statements remain in the body; collect them in the report.
const progress = [];
const console = {log: line => progress.push(JSON.parse(line))};
// Tested game imports follow the complete mandatory native/source preflight.
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ONAMES} = await import('../js/objects_data.js');
const {PMNAMES} = await import('../js/monst_data.js');
const {FIRE_TRAP, ROOM, OBJ_INVENT, OBJ_FLOOR} = await import('../js/const.js');
const {Blind, Fire_resistance, Underwater, Fumbling, Flying, Levitation} = await import('../js/youprop.js');
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');
const snapshotObject = o => ({id: o.o_id, type: o.otyp, count: o.quan,
    letter: o.invlet, where: o.where, worn: o.owornmask || 0,
    blessed: !!o.blessed, cursed: !!o.cursed});
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const p = predictions[index], states = [], checks = [];
    const check = (kind, name, fn) => {
        try { fn(); checks.push({kind, name, pass: true}); }
        catch (error) { checks.push({kind, name, pass: false, error: error.message}); }
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.u || !g.level) return;
            const trap = g.level.traps.find(t => t.tx === g.u.ux && t.ty === g.u.uy);
            states.push({step, turn: g.moves, hp: g.u.uhp, maxHp: g.u.uhpmax,
                mh: g.u.mh, mhmax: g.u.mhmax, form: g.u.umonnum,
                mortality: g.u.umortality || 0, gameover: !!g.program_state?.gameover,
                xy: [g.u.ux, g.u.uy], terrain: g.level.at(g.u.ux, g.u.uy).typ,
                blind: !!Blind(), blinded: g.u.intrinsic?.HBlinded || 0,
                fireResistant: !!Fire_resistance(), underwater: !!Underwater(),
                fumbling: !!Fumbling(), flying: !!Flying(), levitating: !!Levitation(),
                trap: trap ? {type: trap.ttyp, seen: !!trap.tseen} : null,
                liveMonsters: g.level.monsters.filter(m => m.mhp > 0).length,
                inventory: (g.invent || []).map(snapshotObject),
                floor: g.level.objectsAt(g.u.ux, g.u.uy).map(snapshotObject)});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = structuredClone(outputs(run));
    const texts = out.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const before = states.find(s => s.step === p.before), after = states.at(-1);
    const during = states.filter(s => s.step > p.before);
    const actionTexts = texts.slice(p.before + 1);
    const has = text => actionTexts.some(s => s.includes(text));
    const paper = s => s?.floor.find(o => o.type === ONAMES.SCR_AMNESIA);
    const potionType = p.potion === 'blindness' ? ONAMES.POT_BLINDNESS : ONAMES.POT_FRUIT_JUICE;
    const potions = s => s?.inventory.find(o => o.type === potionType);
    check('producer', 'real sighted iron form waits on the dry unseen fire trap', () => {
        assert.deepEqual(before.xy, [58, 6]); assert.equal(before.terrain, ROOM);
        assert.equal(before.form, PMNAMES.PM_IRON_GOLEM); assert.ok(before.mh > 12);
        assert.equal(before.blind, false); assert.equal(before.fireResistant, true);
        assert.equal(before.underwater, false); assert.equal(before.liveMonsters, 0);
        assert.deepEqual(before.trap, {type: FIRE_TRAP, seen: false});
        assert.equal(before.fumbling || before.flying || before.levitating, false);
    });
    check('producer', 'twelve real paper scrolls occupy the trap square', () => {
        assert.equal(before.floor.length, 1); assert.equal(paper(before).count, 12);
        assert.equal(paper(before).where, OBJ_FLOOR);
        assert.equal(paper(before).blessed || paper(before).cursed, false);
    });
    check('producer', 'twenty unprotected carried potions have the selected type', () => {
        assert.equal(before.inventory.length, 1); assert.equal(potions(before).count, 20);
        assert.equal(potions(before).where, OBJ_INVENT); assert.equal(potions(before).worn, 0);
        assert.equal(potions(before).blessed || potions(before).cursed, false);
    });
    check('producer', 'ordinary movement returns to the trap and produces the declared fire', () => {
        assert.equal(has('A tower of flame erupts'), p.fire);
        assert.equal(during.some(s => s.xy[0] === 59 && s.xy[1] === 6), p.fire);
        assert.deepEqual(after.xy, before.xy);
        assert.deepEqual(after.trap, {type: FIRE_TRAP, seen: p.fire});
    });
    check('producer', 'fire actually consumes carried potions and floor paper', () => {
        assert.ok(potions(before)); assert.ok(paper(before));
        const remainingPotions = potions(after)?.count || 0;
        const remainingPaper = paper(after)?.count || 0;
        if (p.fire) {
            assert.ok(remainingPotions < potions(before).count);
            assert.ok(remainingPaper < paper(before).count);
            assert.equal(has('boil and explode!') || has('boils and explodes!'), true);
        } else {
            assert.equal(remainingPotions, 20); assert.equal(remainingPaper, 12);
        }
    });
    check('producer', 'only actual blindness vapor changes the entry vision', () => {
        assert.equal(has('It suddenly gets dark.'), p.dark);
        assert.equal(during.some(s => s.blind && s.blinded > 0)
            || has('You can see again.'), p.dark);
    });
    check('producer', 'all inputs finish with the hero alive in the same form', () => {
        assert.equal(after.step, part.moves.length); assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality && !s.gameover));
        assert.equal(after.form, PMNAMES.PM_IRON_GOLEM); assert.ok(after.mh > 0);
    });
    check('source', 'entry sight retains visible paper-burning feedback', () => {
        assert.equal(has(' burn.') || has(' burns.'), p.fire);
    });
    check('source', 'a sighted entry never substitutes paper-smell feedback', () => {
        assert.equal(has('You smell paper burning.'), false);
    });
    check('source', 'look keeps vision, objects and world time unchanged', () => {
        if (!p.fire) {
            assert.equal(after.blind, before.blind); assert.equal(after.turn, before.turn);
            assert.deepEqual(after.floor, before.floor); assert.deepEqual(after.inventory, before.inventory);
        }
    });
    const plain = structuredClone(outputs(await runSegment({...part, storage: new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality', 'passive observation preserves all five streams', () => assert.deepEqual(out, plain));
    check('neutrality', 'deferred input preserves all five streams', () => assert.deepEqual(out, delayed));
    rows.push({index, name: part.name, negative: p.negative, checks, before, after, during,
        producer: checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source: checks.filter(c => c.kind === 'source').every(c => c.pass),
        actionMessages: [...new Set(actionTexts.map(t => t.split('\n')[0]))],
        statesSHA256: sha(JSON.stringify(states)), outputHashes: hashes(out),
        actionCalls: out.slices.slice(p.before + 1).flat(), boundaries: out.screens.length,
        calls: out.calls.length, frames: out.frames.flat().length});
    console.log(JSON.stringify({index, failed: checks.filter(c => !c.pass)}));
}
// End original source assertions.
// Historical reports are JSON, so compare the whole fresh row in that representation.
const persisted = JSON.parse(JSON.stringify(rows));
for (const index of family.negatives)
    assert.deepEqual(persisted[index], before[index], `complete negative row ${index}`);
const checks = rows.flatMap(row => row.checks);
assert.equal(checks.length, family.checks);
assert.ok(checks.every(check => check.pass), JSON.stringify(checks.filter(check => !check.pass)));
const summary = {family: family.name, cases: rows.length,
    checks: checks.filter(check => check.pass).length, total: family.checks,
    producerChecks: checks.filter(check => check.kind === 'producer' && check.pass).length,
    neutrality: checks.filter(check => check.kind === 'neutrality' && check.pass).length,
    negativeHashes: family.negatives.length * 5, completeNegativeRows: family.negatives.length,
    primaryCAssertions: family.cases, supplementalCAssertions: 2,
    keys: family.keys, boundaries: family.bounds, rawSHA256: family.rawSHA256,
    recipeSHA256: family.recipeSHA256};
assert.equal(summary.producerChecks, family.producer);
assert.equal(summary.neutrality, family.neutrality);
if (reportPath) writeFileSync(reportPath, JSON.stringify({summary, rows, progress}, null, 2) + '\n', {flag: 'wx'});
globalThis.console.log(JSON.stringify(summary));
