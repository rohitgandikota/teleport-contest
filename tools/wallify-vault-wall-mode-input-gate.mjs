// C vault.c:704-707: set wall mode before engraving removal and redraw.
// This exact C recording lacks root source; preserve its pinned attribution.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
const fields = s => ['name', 'seed', 'datetime', 'nethackrc', 'moves']
    .map(field => ({field, present: Object.hasOwn(s, field), value: s[field]}));
assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'usage: wallify-vault-wall-mode-input-gate.mjs [new-report.json]');
assert.ok(!process.argv[2] || !existsSync(process.argv[2]), 'report must be a new file');
const evidence = new URL('gen-sessions/evidence/wallify-vault-wall-mode/', import.meta.url);
const evidencePins = {
    "candidate-seal.json": "2a33732d5731255f71dc7dec457e1744f5448758d19ebd2f942ee4913b2c7c11",
    "input-lock.json": "09bee5ddaf8686d99bfe83ca2f9cd18043d6b812e40230d6d4015c2b7d9ab370",
    "minimal-input.json": "78c0c30164f83bae4baeaa78b86dd0f2f4f6d2d800eb36d6e4a92d287bfc33dd",
    "native-baseline.json": "d87389aacb34f2eb0d0d1dc97ff4048c2b588c3be66f6d3f25ce9b83cd984444",
    "native-candidate.json": "3c40507440f0803e785bd8e33813af020328e91208757ab266b9deab770b4a8d",
    "native-checks.json": "b43d897925e2a53e57c71bdf1886610da3c862fad051e5f34a32516d258d7480",
    "native-primary-check.json": "b74c29b1911c44c55bed0228abb4f889b0db64dbe389c92c28c02691c864f279",
    "ordinary-original.mjs": "94126706be6a412c291da3d9d115d2d4454207b489407dba8f4ce1016e14e1d1",
    "recipe-derivation.json": "e928f0333d437872d4621b79f809950904aabb5af5366a15f6e54d81f47712de",
    "recipe-original.json": "4c185a49dd8fd192de24f1adaf03e220bbdffa69a0fae9633a26e99aa8454159",
    "recording-receipt.json": "c07033b263a422299b8b52e4a6db0300f2130d035e2ca1c9010a12f32f90b8e2",
    "recording.log": "9df36b229ca4c7d2babe357b0a00a60fa92b542919782782f8d8718a17cbc29e",
    "source-seal.json": "d756366a80994a98e1bf995fa4c5c370e2df217b6aa9689367e7296ec4f7f1ff"
};
for (const [name, expected] of Object.entries(evidencePins))
    assert.equal(sha(readFileSync(new URL(name, evidence))), expected, name);
const read = name => JSON.parse(readFileSync(new URL(name, evidence)));
const lock = read('input-lock.json'), originalRecipe = read('recipe-original.json');
const derivation = read('recipe-derivation.json');
const recipeBytes = readFileSync(new URL('gen-sessions/recipes/wallify-vault-wall-mode.json', import.meta.url));
assert.equal(sha(recipeBytes), '436b24ba680e26785c6cc00d9fa6d2ec47f71f537c98c1a017c301076093d2a9');
const recipe = JSON.parse(recipeBytes);
const {coverage, ...withoutCoverage} = recipe;
assert.deepEqual(coverage, ['mode.debug', 'social.vault-guard', 'ui.map-memory-vision']);
assert.deepEqual(withoutCoverage, originalRecipe, 'coverage is the only recipe addition');
assert.equal(derivation.originalRecipeSHA256, lock.recipeSHA256);
assert.equal(derivation.canonicalRecipeSHA256, sha(recipeBytes));
assert.equal(hash(recipe.segments.map(fields)), lock.inputFieldsSHA256);
assert.equal(hash(recipe.requirements), lock.requirementsSHA256);
assert.equal(hash(recipe.negativeOutputHashes), lock.negativeHashesSHA256);
assert.equal(hash(recipe.branchAssertions), lock.branchesSHA256);
assert.equal(recipe.segments.length, 3);
for (const [i, part] of recipe.segments.entries()) {
    assert.deepEqual(fields(part), lock.segments[i].fields);
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
    assert.equal(sha(part.moves), lock.segments[i].movesSHA256);
}
const originalTool = readFileSync(new URL('ordinary-original.mjs', evidence), 'utf8');
const originalBody = originalTool.slice(originalTool.indexOf('const results = [];'), originalTool.indexOf('const report = {'));
const self = readFileSync(new URL(import.meta.url), 'utf8');
const body = self.split('\n// BEGIN ORIGINAL ORDINARY BODY\n')[1].split('// END ORIGINAL ORDINARY BODY\n')[0];
assert.equal(body, originalBody, 'all original assertions and state expectations are unchanged');
assert.equal(sha(body), derivation.originalAssertionBodySHA256);
const sourceSeal = read('source-seal.json'), candidateSeal = read('candidate-seal.json');
assert.equal(sourceSeal.members, 322);
assert.equal(candidateSeal.members, 325);
assert.equal(sourceSeal.recipeSHA256, lock.recipeSHA256);
assert.equal(candidateSeal.sourceSealSHA256, evidencePins['source-seal.json']);
assert.equal(candidateSeal.ordinaryBodySHA256, sha(body));
assert.equal(candidateSeal.negativeOrdinaryHashes, 10);

const rawBytes = readFileSync(new URL('gen-sessions/generated/wallify-vault-wall-mode.session.json', import.meta.url));
assert.equal(sha(rawBytes), '3c56e3f4e461404b3c83003fbe0ed2b924ba378f9d4c6173c5ef3425b54be5ee');
assert.equal(rawBytes.length, 2807052);
const raw = JSON.parse(rawBytes), minimal = read('minimal-input.json');
assert.equal(raw.version, 5);
assert.equal(minimal.version, 5);
assert.equal(Object.hasOwn(raw, 'source'), false, 'preserve the original absent root source');
assert.equal(Object.hasOwn(minimal, 'source'), false);
assert.deepEqual(Object.keys(raw), ['version', 'segments']);
assert.deepEqual(raw.segments.map(fields), recipe.segments.map(fields));
assert.deepEqual(minimal.segments.map(fields), recipe.segments.map(fields));
for (const [i, part] of raw.segments.entries()) {
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
    assert.deepEqual(part.steps.map(s => s.key), [null, ...recipe.segments[i].moves]);
}
assert.equal(raw.segments.reduce((n, s) => n + s.moves.length, 0), 1280);
const steps = raw.segments.flatMap(s => s.steps);
assert.equal(steps.length, 1283);
assert.equal(steps.reduce((n, s) => n + s.rng.length, 0), 25837);
assert.equal(steps.reduce((n, s) => n + (s.animation_frames || []).length, 0), 4);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branches.length, 3);
assert.equal(recipe.branchAssertions.length, 3);
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.deepEqual(branchAssertionErrors(recipe, raw), []);

// Attribution comes from the exact original successful C invocation, not a tag.
const recording = read('recording-receipt.json'), primary = read('native-primary-check.json');
assert.equal(recording.exit, 0);
assert.equal(recording.inputSHA256, evidencePins['minimal-input.json']);
assert.equal(recording.primaryRecipeSHA256, lock.recipeSHA256);
assert.equal(recording.rawSha256, sha(rawBytes));
assert.equal(recording.bytes, rawBytes.length);
assert.equal(recording.binarySha256, 'ba4dbc1c823f8d4b0cfb6fd594d00ff0ff5754daaaa2036bee15baeffdf85aa7');
assert.equal(recording.recorderSha256, 'b129caee2ca3941b30c36f5c26644bd37ff610344332eb511c474b8709b70648');
assert.equal(recording.cPin, '16ff59115315917b93185d026aeefea06db9b0f4');
assert.equal(recording.timezone, 'Etc/GMT+4');
assert.equal(recording.logSHA256, evidencePins['recording.log']);
assert.equal(recording.command[0], 'node');
assert.ok(recording.command[1].endsWith('/scripts/record-session.mjs'));
assert.ok(recording.command[2].endsWith('/wallify-vault-wall-mode-parent-minimal.session.json'));
assert.ok(recording.command[3].endsWith('/wallify-vault-wall-mode-parent-native.session.json'));
assert.equal(primary.recorderExit, 0);
assert.equal(primary.rawSHA256, sha(rawBytes));
assert.equal(primary.postRecordingAssertionFailed, "KeyError: 'source'");
assert.ok(primary.rootMetadataIssue.includes('only copies existing root metadata'));
assert.ok(primary.inputsAndPresenceExact && primary.allKeysExact);
assert.deepEqual(primary.integrityErrors, []);
assert.deepEqual(primary.branchErrors, []);
assert.equal(primary.primaryBranches, 3);
assert.equal(candidateSeal.rawSHA256, sha(rawBytes));

const nativeChecks = read('native-checks.json');
const nativeBefore = read('native-baseline.json'), nativeAfter = read('native-candidate.json');
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact
    && row.fullRngExact && row.animationExact;
assert.equal(nativeChecks.originalRawSHA256, sha(rawBytes));
assert.equal(nativeChecks.baselineNativeSHA256, evidencePins['native-baseline.json']);
assert.equal(nativeChecks.candidateNativeSHA256, evidencePins['native-candidate.json']);
assert.equal(nativeBefore.length, 3);
assert.equal(nativeAfter.length, 3);
assert.equal(nativeBefore.filter(exact).length, 2);
assert.ok(nativeAfter.every(exact));
assert.deepEqual(nativeBefore.slice(1), nativeAfter.slice(1));
assert.equal(nativeChecks.negativeOrdinaryHashesExact, 10);
assert.equal(nativeChecks.rawSourceMetadataPresent, false);
assert.equal(nativeChecks.rawUnchanged, true);
// No game imports, cache paths, C build files or recorder invocation occur above.
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {VAULT, ROOM, VWALL, HWALL, DOOR, WM_MASK, W_NONDIGGABLE} = await import('../js/const.js');
const {ONAMES} = await import('../js/objects_data.js');
const {Blind, Passes_walls} = await import('../js/youprop.js');
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
                if (!g.u || !g.level || g.u.uz.dnum !== 0 || g.u.uz.dlevel !== 2) return;
                const room = g.level.rooms.find(r => r.rtype === VAULT);
                if (!room) return;
                const loc = g.level.at(x, y), north = g.level.at(x, y - 1);
                const guard = g.level.monsters.find(m => m.isgd || m.mextra?.egd);
                const e = guard?.mextra?.egd;
                const wand = g.invent.find(o => o.otyp === ONAMES.WAN_DIGGING);
                states.push({step, turn: g.moves, hero: [g.u.ux, g.u.uy],
                    hp: g.u.uhp, mortality: g.u.umortality || 0,
                    blind: !!Blind(), passwalls: !!Passes_walls(),
                    room: [room.lx, room.hx, room.ly, room.hy],
                    typ: loc.typ, flags: loc.flags, door: loc.doormask,
                    wall: loc.wall_info, mode: loc.wall_info & WM_MASK,
                    seenv: loc.seenv, north: north.typ, northWall: north.wall_info,
                    south: g.level.at(x, y + 1).typ,
                    visible: !!cansee(x, y), couldsee: !!couldsee(x, y),
                    memory: loc.remembered_glyph?.glyph?.cmap ?? null,
                    occupant: g.level.monAt.get(`${x},${y}`)?.m_id ?? null,
                    objects: g.level.objects.filter(o => o.ox === x && o.oy === y)
                        .map(o => ({id: o.o_id, type: o.otyp, where: o.where, quantity: o.quan})),
                    traps: g.level.traps.filter(t => t.tx === x && t.ty === y)
                        .map(t => ({type: t.ttyp, conjoined: t.conjoined || 0})),
                    wand: wand ? {id: wand.o_id, charges: wand.spe, cursed: !!wand.cursed} : null,
                    guard: guard ? {id: guard.m_id, xy: [guard.mx, guard.my],
                        hp: guard.mhp, peaceful: !!guard.mpeaceful, done: !!e.gddone,
                        corridor: (e.fakecorr || []).slice(0, e.fcend).map(c => [c.fx, c.fy])} : null});
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
        assert.deepEqual(last.hero, [22, 3]);
        assert.deepEqual(last.room, [23, 24, 5, 6]);
        assert.equal(last.typ, HWALL);
        assert.equal(last.north, VWALL);
        assert.ok(last.northWall & W_NONDIGGABLE);
        assert.equal(last.south, ROOM);
        assert.equal(last.seenv, req.expectedSeenv);
        assert.ok(!last.blind && last.passwalls && last.visible && last.couldsee);
        assert.equal(last.guard, null);
        assert.equal(last.occupant, null);
        assert.deepEqual(last.objects, []);
        assert.deepEqual(last.traps, []);
        assert.equal(last.wand.charges, req.dug ? 9 : 10);
        assert.equal(last.wand.cursed, false);
        assert.ok(states.some(s => s.guard?.peaceful && s.guard.hp > 0));
        assert.ok(states.every(s => !s.guard?.corridor.some(c => c[0] === x && c[1] === y)),
            'chosen target is never the fake corridor');
        assert.ok(texts.some(t => t.includes('Please drop that gold and follow me.')));
        assert.ok(texts.some(t => t.includes('You drop 500 gold pieces.')));
        assert.ok(texts.every(t => !/Program in disorder!|newsym: attempting screen update/.test(t)));
        const sight = states.find((s, n) => n && !s.blind && states[n - 1].blind);
        assert.ok(sight);
        assert.equal(sight.step, req.sightStep);
        assert.equal(sight.turn, 101);
        const incantation = texts.findIndex(t => t.includes('whispers an incantation.'));
        const restoration = texts.findIndex(t => t.includes("The damaged vault's walls are magically restored!"));
        const changed = states.findIndex((s, n) => n && s.typ === HWALL && states[n - 1].typ === DOOR);
        let before, after;
        if (req.dug) {
            assert.ok(changed > 0);
            before = states[changed - 1]; after = states[changed];
            assert.ok(before.blind && after.blind);
            assert.equal(before.seenv, req.mapped ? 255 : 0);
            assert.equal(after.seenv, before.seenv);
            assert.ok(before.guard.peaceful && before.guard.hp > 0);
            assert.equal(before.occupant, null);
            assert.deepEqual(before.objects, []);
            assert.deepEqual(before.traps, []);
            assert.equal(after.flags, 0);
            assert.equal(after.door, 0);
            assert.ok(incantation >= 0 && restoration >= incantation && restoration < sight.step);
        } else {
            assert.equal(changed, -1);
            assert.ok(states.every(s => s.typ === HWALL && s.mode === 1));
            assert.equal(incantation, -1);
            assert.equal(restoration, -1);
        }
        if (recipe.negativeOutputHashes[part.name])
            assert.deepEqual(hashes(output), recipe.negativeOutputHashes[part.name]);
        assert.deepEqual(output, outputs(await runSegment({...part, storage: new InMemoryStorage()})),
            'observer neutrality, all five output channels');
        assert.deepEqual(output, await deferred(part), 'deferred input and held EOF neutrality');
        const cell = renderCell(decodeScreen(output.screens.at(-1))[y + 1][x - 1]);
        Object.assign(r, {reach: true, observerNeutral: true, deferredNeutral: true,
            boundaries: output.screens.length, calls: output.calls.length,
            frames: output.frames.flat().length, hashes: hashes(output), stateSHA256: hash(states),
            before, after, sight, final: last, incantation, restoration, cell});
        try {
            assert.equal(last.mode, req.expectedMode, 'C xy_set_wall_state after restoration');
            if (after) assert.equal(after.mode, req.expectedMode);
            r.cMode = true;
        } catch (error) { r.cMode = false; r.modeError = error.message; }
        try {
            assert.equal(cell, req.expectedCell, 'C wall_angle visible terminal cell');
            assert.equal(last.memory, req.expectedMemoryCmap);
            r.cVisible = true;
        } catch (error) { r.cVisible = false; r.visibleError = error.message; }
        const generated = {segments: []};
        generated.segments[i] = {steps: output.screens.map((screen, n) => ({screen, rng: output.slices[n]}))};
        r.branchErrors = branchAssertionErrors({...recipe, branches: [recipe.branches[i]],
            branchAssertions: [recipe.branchAssertions[i]]}, generated);
        r.cPredicate = r.cMode && r.cVisible && r.branchErrors.length === 0;
    } catch (error) { r.cPredicate = false; r.error = error.message; }
    results.push(r);
}
// END ORIGINAL ORDINARY BODY
const report = {classification: 'C-confirmed wall modes, original ordinary assertions on current repository',
    nativeParityClaimed: false, runtimePatchPaths: [], total: results.length,
    reached: results.filter(r => r.reach).length,
    visiblePassed: results.filter(r => r.cVisible).length,
    modePassed: results.filter(r => r.cMode).length,
    cPredicatesPassed: results.filter(r => r.cPredicate).length, results};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({total: report.total, reached: report.reached,
    visiblePassed: report.visiblePassed, modePassed: report.modePassed,
    failed: results.filter(r => !r.cPredicate).map(({name, error, modeError, visibleError, branchErrors}) =>
        ({name, error, modeError, visibleError, branchErrors})), hash: hash(results)}));
if (report.cPredicatesPassed !== report.total) process.exitCode = 1;
