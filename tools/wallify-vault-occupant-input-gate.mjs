// C vault.c:669-674: await tame-occupant yelp before relocation.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
const fields = s => ['name', 'seed', 'datetime', 'nethackrc', 'moves']
    .map(field => ({field, present: Object.hasOwn(s, field), value: s[field]}));
assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'usage: wallify-vault-occupant-input-gate.mjs [new-report.json]');
assert.ok(!process.argv[2] || !existsSync(process.argv[2]), 'report must be a new file');
const evidence = new URL('gen-sessions/evidence/wallify-vault-occupant/', import.meta.url);
const evidencePins = {
    "candidate-seal.json": "4974f9f78c3d8811a578e1173471e18ce18c44979de48e16a9ea343e04cc39cb",
    "input-lock.json": "f4c86d50f52c0b01512ce983b3bd6943d49db113cb62a6df8f15f8cf5dd4c04a",
    "native-primary-checks.json": "d49b1a4c7d114eec3ad67a6e6f744954cf4658de62a5134208702a682caea70f",
    "native-validation.json": "4e15533b8dd813d0360502424f105c7c7289e3d19ae264ac6eeb01f5dc159eeb",
    "ordinary-original.mjs": "0bbd95fc22d8c2fa56bf4ec5c85fbd559c78e8d94d8f528f792f0c92b379244c",
    "recipe-derivation.json": "126bc9e5feef4aae5db407782c56e8a8b9adc81cd5d45708494fd4efd87feae8",
    "recipe-original.json": "3e4941a0a8cb8f9dfa4b0843e201013ebc65145eab802f956e2a249b705c3e28",
    "recording-receipt.json": "f1b2ae8078e9f55d52448293d46cc2bccee18f37bee6f921d583a62a3d3a5f75",
    "source-seal.json": "3bf0fdfc8492d1ad7a30e4d8f8da914ab4423624cfc7192fff99ffaa4240bca1"
};
for (const [name, expected] of Object.entries(evidencePins))
    assert.equal(sha(readFileSync(new URL(name, evidence))), expected, name);
const read = name => JSON.parse(readFileSync(new URL(name, evidence)));
const lock = read('input-lock.json');
const originalRecipe = read('recipe-original.json');
const derivation = read('recipe-derivation.json');
const recipeBytes = readFileSync(new URL('gen-sessions/recipes/wallify-vault-tame-occupant.json', import.meta.url));
assert.equal(sha(recipeBytes), 'dd9b54853d3ec190ad8f35416d9cce8e0eb45b5b2e3a450cebe41c4432ec2d1c');
const recipe = JSON.parse(recipeBytes);
const {coverage, ...withoutCoverage} = recipe;
assert.deepEqual(coverage, ['mode.debug', 'social.vault-guard', 'ui.map-memory-vision']);
assert.deepEqual(withoutCoverage, originalRecipe, 'coverage is the only recipe addition');
assert.equal(derivation.originalRecipeSHA256, lock.recipeSHA256);
assert.equal(derivation.canonicalRecipeSHA256, sha(recipeBytes));
assert.equal(hash(recipe.segments.map(fields)), lock.inputFieldsSHA256);
assert.equal(hash(recipe.requirements), lock.requirementsSHA256);
assert.equal(hash(recipe.negativeOutputHashes), lock.negativeHashesSHA256);
assert.equal(recipe.segments.length, 3);
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
assert.equal(sourceSeal.members, 36); assert.equal(candidateSeal.members, 326);
assert.equal(sourceSeal.recipeSHA256, lock.recipeSHA256);
assert.equal(candidateSeal.recipeSHA256, lock.recipeSHA256);
assert.equal(candidateSeal.sourceSealSHA256, evidencePins['source-seal.json']);
assert.equal(candidateSeal.negativeOrdinaryHashesExact, 10);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branches.length, 3); assert.equal(recipe.branchAssertions.length, 3);
const rawBytes = readFileSync(new URL('gen-sessions/generated/wallify-vault-tame-occupant.session.json', import.meta.url));
assert.equal(sha(rawBytes), '32e6861d010437146682a1fa6bbaaf4db4685b6a77f34e76ab5ec2a7efe7e553');
assert.equal(rawBytes.length, 3079339);
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c'); assert.equal(raw.version, 5);
assert.deepEqual(raw.segments.map(fields), recipe.segments.map(fields));
for (const [i, part] of raw.segments.entries()) {
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
    assert.deepEqual(part.steps.map(s => s.key), [null, ...recipe.segments[i].moves]);
}
assert.equal(raw.segments.reduce((n, s) => n + s.moves.length, 0), 773);
const steps = raw.segments.flatMap(s => s.steps);
assert.equal(steps.length, 776);
assert.equal(steps.reduce((n, s) => n + s.rng.length, 0), 20282);
assert.equal(steps.reduce((n, s) => n + (s.animation_frames || []).length, 0), 0);
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.deepEqual(branchAssertionErrors(recipe, raw), []);
assert.deepEqual(read('native-primary-checks.json'),
    {cases: 3, branches: 3, branchErrors: [], integrityErrors: [], source: 'c', version: 5});
const recording = read('recording-receipt.json');
assert.equal(recording.rawSha256, sha(rawBytes));
assert.equal(recording.primaryRecipeSHA256, lock.recipeSHA256);
assert.ok(recording.cExecutedOnce && recording.fiveInputFieldsAndPresencePreserved && recording.allKeysExact);
assert.equal(candidateSeal.parentRawSHA256, sha(rawBytes));
// The current repository runtime is imported only after all metadata and C checks.
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ROOM, THRONE, HWALL} = await import('../js/const.js');
const {PMNAMES, MSOUND} = await import('../js/monst_data.js');
const {ONAMES} = await import('../js/objects_data.js');
const {Deaf, Hallucination} = await import('../js/youprop.js');
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
                const guard = g.level.monsters.find(m => m.isgd || m.mextra?.egd);
                const e = guard?.mextra?.egd, room = g.level.rooms[e?.vroom];
                states.push({step, turn: g.moves, hero: [g.u.ux, g.u.uy],
                    hp: g.u.uhp, mortality: g.u.umortality || 0,
                    deaf: !!Deaf(), hallucinating: !!Hallucination(),
                    run: g.context?.run || 0, typ: g.level.at(x, y).typ,
                    occupant: g.level.monAt.get(`${x},${y}`)?.m_id ?? null,
                    objects: g.level.objects.filter(o => o.ox === x && o.oy === y)
                        .map(o => ({id: o.o_id, type: o.otyp, corpse: o.corpsenm,
                            quantity: o.quan, where: o.where})),
                    pets: g.level.monsters.filter(m => m.mtame).map(m => ({
                        id: m.m_id, species: m.mnum, xy: [m.mx, m.my], hp: m.mhp,
                        tame: m.mtame, peaceful: !!m.mpeaceful, eating: m.meating || 0,
                        sleeping: !!m.msleeping, canmove: !!m.mcanmove, sound: m.data.msound})),
                    guard: guard ? {id: guard.m_id, xy: [guard.mx, guard.my],
                        hp: guard.mhp, peaceful: !!guard.mpeaceful, done: !!e.gddone,
                        bounds: [room.lx, room.hx, room.ly, room.hy],
                        corridor: (e.fakecorr || []).slice(e.fcbeg, e.fcend).map(c => [c.fx, c.fy])} : null});
            }};
            run = await runSegment({...part, storage: new InMemoryStorage()});
        } finally {
            if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
        const output = outputs(run), last = states.at(-1);
        const texts = output.screens.map(s => decodeScreen(s)
            .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
        assert.equal(output.screens.length, part.moves.length + 1);
        assert.equal(last.step, part.moves.length);
        assert.deepEqual(output.slices.flat(), output.calls);
        assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));
        assert.deepEqual(last.hero, [26, 5]);
        assert.ok(last.guard.peaceful && last.guard.hp > 0 && !last.guard.done);
        assert.deepEqual(last.guard.xy, [28, 5]);
        assert.deepEqual(last.guard.bounds, [23, 24, 5, 6]);
        assert.equal(last.guard.corridor.some(c => c[0] === x && c[1] === y), false);
        assert.ok(texts.some(t => t.includes('Please drop that gold and follow me.')));
        assert.ok(texts.some(t => t.includes('You drop 500 gold pieces.')));
        assert.ok(texts.every(t => !/Program in disorder!|newsym: attempting screen update/.test(t)));
        const incantation = texts.findIndex(t => t.includes('whispers an incantation.'));
        const restoration = texts.findIndex(t => t.includes("The damaged vault's walls are magically restored!"));
        assert.ok(incantation >= 0 && restoration >= incantation);
        assert.ok(states.some(s => s.typ === THRONE));
        const changed = states.findIndex((s, n) => n && s.typ === HWALL && states[n - 1].typ === ROOM);
        assert.ok(changed > 0);
        const before = states[changed - 1], after = states[changed];
        assert.equal(last.typ, HWALL);
        assert.equal(last.occupant, null);
        assert.ok(!before.deaf && !before.hallucinating && !before.run);
        assert.ok(states.some(s => s.objects.some(o => o.type === ONAMES.CORPSE
            && o.corpse === PMNAMES.PM_GRAY_DRAGON && o.where === 1 && o.quantity === 1)));
        if (req.kind === 'empty') {
            assert.equal(before.occupant, null);
            assert.deepEqual(before.pets, []);
            assert.equal(last.objects.length, 1);
        } else {
            const pet = before.pets.find(m => m.id === before.occupant);
            assert.ok(pet && pet.tame > 0 && pet.peaceful && pet.hp > 0);
            assert.deepEqual(pet.xy, [x, y]);
            assert.ok(pet.canmove && !pet.sleeping);
            const moved = after.pets.find(m => m.id === pet.id);
            assert.ok(moved && moved.hp === pet.hp && moved.tame === pet.tame);
            assert.notDeepEqual(moved.xy, [x, y]);
            assert.equal(after.occupant, null);
            if (req.kind === 'audible-tame') {
                assert.equal(pet.species, PMNAMES.PM_LITTLE_DOG);
                assert.equal(pet.sound, MSOUND.MS_BARK);
                assert.ok(pet.eating > 0 && moved.eating > 0);
                assert.ok(texts.some(t => t.includes('Your little dog eats a gray dragon corpse.')));
                assert.deepEqual(last.objects, []);
            } else {
                assert.equal(pet.species, PMNAMES.PM_BLUE_JELLY);
                assert.equal(pet.sound, MSOUND.MS_SILENT);
                assert.equal(pet.eating, 0);
                assert.ok(texts.some(t => t.includes('A blue jelly appears next to you.')));
                assert.equal(last.objects.length, 1);
            }
        }
        if (recipe.negativeOutputHashes[part.name])
            assert.deepEqual(hashes(output), recipe.negativeOutputHashes[part.name]);
        assert.deepEqual(output, outputs(await runSegment({...part, storage: new InMemoryStorage()})), 'observer neutrality');
        assert.deepEqual(output, await deferred(part), 'deferred input and held EOF neutrality');
        const yelp = texts.findIndex(t => t.includes('yelps!'));
        Object.assign(r, {reach: true, observerNeutral: true, deferredNeutral: true,
            boundaries: output.screens.length, calls: output.calls.length,
            frames: output.frames.flat().length, hashes: hashes(output), stateSHA256: hash(states),
            before, after, final: last, incantation, restoration, yelp});
        assert.equal(yelp >= 0, req.expectedYelp, 'C wallify tame occupant yelp before relocation');
        if (req.expectedYelp)
            assert.ok(yelp <= incantation, 'C yelp precedes restoration feedback');
        r.cPredicate = true;
    } catch (error) { r.cPredicate = false; r.error = error.message; }
    results.push(r);
}
// END ORIGINAL ORDINARY BODY
const report = {classification: 'C wallify tame-occupant ordinary regression gate',
    nativeParityClaimed: false, runtimePatchPaths: [], total: results.length,
    reached: results.filter(r => r.reach).length, cPredicatesPassed: results.filter(r => r.cPredicate).length, results};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({total: report.total, reached: report.reached, cPredicatesPassed: report.cPredicatesPassed,
    failed: results.filter(r => !r.cPredicate).map(({name, error}) => ({name, error})), hash: hash(results)}));
if (report.cPredicatesPassed !== report.total) process.exitCode = 1;
