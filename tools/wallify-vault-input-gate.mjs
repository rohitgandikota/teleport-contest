// C vault.c:712-716: restore embedded-object display through newsym.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
const fields = s => ['name', 'seed', 'datetime', 'nethackrc', 'moves']
    .map(field => ({field, present: Object.hasOwn(s, field), value: s[field]}));
assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'usage: wallify-vault-input-gate.mjs [new-report.json]');
assert.ok(!process.argv[2] || !existsSync(process.argv[2]), 'report must be a new file');
const evidence = new URL('gen-sessions/evidence/wallify-vault/', import.meta.url);
const evidencePins = {
    "candidate-seal.json": "68f30e8cf046744457b8d947103b2405c2fcb45929dabf8af3d8174a0af7cd79",
    "input-lock.json": "6a5c9c846feabb3627614d5fae15bddf451da90c8a671738df5c43f6387a6577",
    "native-branch-checks.json": "0423578ba05583aaf404dce4a6f50a399aa094ab757f235c59f0d5adf54d66ef",
    "native-validation.json": "279025fe6afa2b0c33386d1c791597ba24fae2c450014625937f518bddf86fd4",
    "ordinary-original.mjs": "56a36336391c5f05d05b07df93fc59d91094904eec112e86ce038db652a3c73c",
    "recipe-derivation.json": "9d78a4b0e36930ac1d4ace02f788b3537ca0e4dfd16edb12dd1249ba867e37ef",
    "recipe-original.json": "98aea767f3b70c05bb6f9dcd8533b28dff67e1b609d28d9da307b54fe740d1cb",
    "recording-receipt.json": "ad58ac5b0b7ae761502b5e253c0ac63c41847a8a501315039659917b70ccfaa0",
    "source-seal.json": "eaf3356e5076892ba1291b5c2b9aee1893aad9bf4cf297c83193f74edf13a2ee"
};
for (const [name, expected] of Object.entries(evidencePins))
    assert.equal(sha(readFileSync(new URL(name, evidence))), expected, name);
const read = name => JSON.parse(readFileSync(new URL(name, evidence)));
const lock = read('input-lock.json');
const originalRecipe = read('recipe-original.json');
const derivation = read('recipe-derivation.json');
const recipeBytes = readFileSync(new URL('gen-sessions/recipes/wallify-vault-retained-object.json', import.meta.url));
assert.equal(sha(recipeBytes), '0f3896ba2f1d3473f1f25ee1ae10f7d3ddece85c029f80dc8a7cbc194e1abb82');
const recipe = JSON.parse(recipeBytes);
const {coverage, ...withoutCoverage} = recipe;
assert.deepEqual(coverage, ['mode.debug', 'social.vault-guard', 'ui.map-memory-vision']);
assert.deepEqual(withoutCoverage, originalRecipe, 'coverage is the only recipe addition');
assert.equal(derivation.originalRecipeSHA256, lock.recipeSHA256);
assert.equal(derivation.canonicalRecipeSHA256, sha(recipeBytes));
assert.equal(hash(recipe.segments.map(fields)), lock.inputFieldsSHA256);
assert.equal(hash(recipe.requirements), lock.requirementsSHA256);
assert.equal(hash(recipe.negativeOutputHashes), lock.negativeHashesSHA256);
assert.equal(recipe.segments.length, 4);
for (const [i, part] of recipe.segments.entries()) {
    assert.deepEqual(fields(part), lock.segments[i].fields);
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
}
const originalTool = readFileSync(new URL('ordinary-original.mjs', evidence), 'utf8');
const originalBody = originalTool.slice(originalTool.indexOf('const results = [];'), originalTool.indexOf('const report = {'));
const self = readFileSync(new URL(import.meta.url), 'utf8');
const body = self.split('\n// BEGIN ORIGINAL ORDINARY BODY\n')[1].split('// END ORIGINAL ORDINARY BODY\n')[0];
assert.equal(body, originalBody, 'all original ordinary assertions are unchanged');
assert.equal(sha(body), derivation.originalAssertionBodySHA256);
const sourceSeal = read('source-seal.json'), candidateSeal = read('candidate-seal.json');
assert.equal(sourceSeal.members, 38); assert.equal(candidateSeal.members, 318);
assert.equal(sourceSeal.recipeSHA256, lock.recipeSHA256);
assert.equal(candidateSeal.originalRecipeSHA256, lock.recipeSHA256);
assert.equal(candidateSeal.sourceSealSHA256, evidencePins['source-seal.json']);
assert.equal(candidateSeal.negativeOrdinaryHashesExact, 15);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branches.length, 4); assert.equal(recipe.branchAssertions.length, 4);
const rawBytes = readFileSync(new URL('gen-sessions/generated/wallify-vault-retained-object.session.json', import.meta.url));
assert.equal(sha(rawBytes), 'a6950b5b46dbf3331891d441bc6c9388bc4ae7bef1fde855b05fa4e7c66b4915');
assert.equal(rawBytes.length, 3578159);
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c'); assert.equal(raw.version, 5);
assert.deepEqual(raw.segments.map(fields), recipe.segments.map(fields));
for (const [i, part] of raw.segments.entries()) {
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
    assert.deepEqual(part.steps.map(s => s.key), [null, ...recipe.segments[i].moves]);
}
assert.equal(raw.segments.reduce((n, s) => n + s.moves.length, 0), 876);
const steps = raw.segments.flatMap(s => s.steps);
assert.equal(steps.length, 880);
assert.equal(steps.reduce((n, s) => n + s.rng.length, 0), 25465);
assert.equal(steps.reduce((n, s) => n + (s.animation_frames || []).length, 0), 0);
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.deepEqual(branchAssertionErrors(recipe, raw), []);
assert.deepEqual(read('native-branch-checks.json'), {integrityErrors: [], branchErrors: [], primaryBranches: 4});
const recording = read('recording-receipt.json');
assert.equal(recording.rawSha256, sha(rawBytes));
assert.equal(recording.primaryRecipeSHA256, lock.recipeSHA256);
assert.ok(recording.cExecutedOnce && recording.fiveInputFieldsAndPresencePreserved && recording.allKeysExact);
assert.equal(candidateSeal.parentRawSHA256, sha(rawBytes));
// The current repository runtime is imported only after all metadata and C checks.
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ROOM, THRONE, HWALL} = await import('../js/const.js');
const {ONAMES} = await import('../js/objects_data.js');
const {Blind, Hallucination} = await import('../js/youprop.js');
const {cansee, couldsee} = await import('../js/vision.js');
const {decodeScreen, renderCell} = await import('../frozen/screen-decode.mjs');
const {hashes, outputs, deferred} = await import('./half-damage-reader-observe.mjs');
// BEGIN ORIGINAL ORDINARY BODY
const results = [];
for (const [i, part] of recipe.segments.entries()) {
    const req = recipe.requirements[i], states = [], r = {name: part.name};
    const [x, y] = req.target;
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    try {
        let run;
        try {
            globalThis.__step_snapshot = {step: '*', cb(g, step) {
                if (!g.u || !g.level) return;
                const loc = g.level.at(x, y);
                const guard = g.level.monsters.find(m => m.isgd || m.mextra?.egd);
                const e = guard?.mextra?.egd;
                const room = g.level.rooms[e?.vroom];
                states.push({step, turn: g.moves, level: [g.u.uz.dnum, g.u.uz.dlevel], hero: [g.u.ux, g.u.uy],
                    hp: g.u.uhp, mortality: g.u.umortality || 0,
                    blind: !!Blind(), hallucinating: !!Hallucination(),
                    underwater: !!g.u.uinwater, swallowed: !!g.u.uswallow,
                    heroMemory: !!g.level.flags.hero_memory,
                    typ: loc.typ, wallInfo: loc.wall_info || 0,
                    visible: !!cansee(x, y), couldSee: !!couldsee(x, y),
                    viz: g.viz_array?.[y]?.[x] || 0,
                    memory: structuredClone(loc.remembered_glyph ?? null),
                    occupant: g.level.monAt.get(`${x},${y}`)?.m_id ?? null,
                    objects: g.level.objects.filter(o => o.ox === x && o.oy === y)
                        .map(o => ({id: o.o_id, type: o.otyp, quantity: o.quan,
                            where: o.where, unpaid: !!o.unpaid})),
                    traps: g.level.traps.filter(t => t.tx === x && t.ty === y).map(t => t.ttyp),
                    guard: guard ? {id: guard.m_id, xy: [guard.mx, guard.my],
                        hp: guard.mhp, peaceful: !!guard.mpeaceful, room: e.vroom,
                        bounds: [room.lx, room.hx, room.ly, room.hy], begin: e.fcbeg,
                        end: e.fcend, done: e.gddone,
                        corridor: (e.fakecorr || []).slice(e.fcbeg, e.fcend).map(c => [c.fx, c.fy])} : null});
            }};
            run = await runSegment({...part, storage: new InMemoryStorage()});
        } finally {
            if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
        const output = outputs(run), last = states.at(-1);
        const grids = output.screens.map(decodeScreen);
        const texts = grids.map(grid => grid.map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
        assert.equal(output.screens.length, part.moves.length + 1);
        assert.equal(last.step, part.moves.length);
        assert.deepEqual(output.slices.flat(), output.calls);
        assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));
        assert.deepEqual(last.hero, [26, 5]);
        assert.ok(last.guard.peaceful && last.guard.hp > 0);
        assert.deepEqual(last.guard.bounds, [23, 24, 5, 6]);
        assert.equal(last.guard.corridor.some(c => c[0] === x && c[1] === y), false);
        assert.ok(texts.some(s => s.includes('Please drop that gold and follow me.')));
        assert.ok(texts.some(s => s.includes('You drop 500 gold pieces.')));
        assert.ok(texts.some(s => s.includes(req.expectedPrimaryVisibleText)));
        const restore = texts.findIndex(s => s.includes("The damaged vault's walls are magically restored!"));
        assert.equal(restore >= 0, req.restored);
        if (req.restored) {
            assert.ok(states.some(s => s.typ === THRONE));
            assert.ok(states.some(s => s.typ === ROOM));
            assert.equal(last.visible, false); assert.equal(last.couldSee, false); assert.equal(last.viz, 0);
        } else {
            assert.ok(states.filter(s => s.level[0] === 0 && s.level[1] === 2)
                .every(s => s.typ === HWALL));
            assert.ok(texts.some(s => s.includes('Room|floor|ground not allowed here.')));
        }
        assert.equal(last.typ, HWALL);
        assert.equal(last.blind, false); assert.equal(last.hallucinating, false);
        assert.equal(last.underwater, false); assert.equal(last.swallowed, false);
        assert.equal(last.heroMemory, true); assert.equal(last.occupant, null);
        assert.deepEqual(last.traps, []);
        if (req.retainedFood) {
            assert.equal(last.objects.length, 1);
            assert.deepEqual(last.objects[0], {id: 121, type: ONAMES.FOOD_RATION,
                quantity: 1, where: 1, unpaid: false});
            assert.ok(states.some(s => s.memory?.ch === '%' && s.objects.some(o => o.id === 121)));
        } else {
            assert.deepEqual(last.objects, []);
            if (part.name === 'rock-north-wall')
                assert.ok(states.some(s => s.objects.some(o => o.type === ONAMES.ROCK && o.where === 1)));
        }
        if (recipe.negativeOutputHashes[part.name])
            assert.deepEqual(hashes(output), recipe.negativeOutputHashes[part.name]);
        assert.deepEqual(output, outputs(await runSegment({...part, storage: new InMemoryStorage()})), 'observer neutrality');
        assert.deepEqual(output, await deferred(part), 'deferred input and held EOF neutrality');
        const transition = states.find((s, n) => n && s.typ === HWALL && states[n - 1].typ === ROOM);
        Object.assign(r, {reach: true, observerNeutral: true, deferredNeutral: true,
            boundaries: output.screens.length, calls: output.calls.length,
            frames: output.frames.flat().length, hashes: hashes(output), stateSHA256: hash(states),
            restorationStep: restore, before: transition ? states[states.indexOf(transition) - 1] : null,
            transition: transition ?? null, final: last,
            expectedChar: req.expectedScreenChar,
            observedCell: grids.at(-1)[y + 1][x - 1],
            observedChar: renderCell(grids.at(-1)[y + 1][x - 1])});
        // C newsym's visible arm maps retained objects before the wall background.
        assert.equal(last.memory?.glyph?.kind, req.expectedMemoryKind, 'C remembered object/background priority');
        assert.equal(r.observedChar, req.expectedScreenChar, 'C displayed object/background priority');
        r.cPredicate = true;
    } catch (error) { r.cPredicate = false; r.error = error.message; }
    results.push(r);
}
// END ORIGINAL ORDINARY BODY
const report = {classification: 'ordinary current-runtime wallify controls; native comparison is separate',
    nativeParityClaimed: false, total: results.length, reached: results.filter(r => r.reach).length,
    cPredicatesPassed: results.filter(r => r.cPredicate).length, results};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({total: report.total, reached: report.reached, cPredicatesPassed: report.cPredicatesPassed,
    failed: results.filter(r => !r.cPredicate).map(({name, error}) => ({name, error})), hash: hash(results)}));
if (report.cPredicatesPassed !== report.total) process.exitCode = 1;
