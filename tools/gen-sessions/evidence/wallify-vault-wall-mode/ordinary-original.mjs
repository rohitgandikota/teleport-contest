// Source-only ordinary diagnostic. C wall modes and visible predicates stay strict.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
const fields = s => ['name', 'seed', 'datetime', 'nethackrc', 'moves']
    .map(field => ({field, present: Object.hasOwn(s, field), value: s[field]}));
assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'));
const lock = JSON.parse(readFileSync(new URL('../input-lock.json', import.meta.url)));
const mapBytes = readFileSync(new URL('../baseline-runtime.json', import.meta.url));
assert.equal(sha(mapBytes), lock.runtimeSHA256);
assert.equal(Object.keys(JSON.parse(mapBytes)).length, 280);
for (const [path, expected] of Object.entries(JSON.parse(mapBytes)))
    assert.equal(sha(readFileSync(new URL(`../baseline/${path}`, import.meta.url))), expected, path);
for (const dep of JSON.parse(readFileSync(new URL('../dependencies.json', import.meta.url)))) {
    const bytes = readFileSync(new URL(`../${dep.path}`, import.meta.url));
    assert.equal(sha(bytes), dep.sha256, dep.path);
    assert.equal(bytes.length, dep.bytes, dep.path);
}
const recipeBytes = readFileSync(new URL('../recipes/wallify-vault-wall-mode.json', import.meta.url));
assert.equal(sha(recipeBytes), lock.recipeSHA256);
const recipe = JSON.parse(recipeBytes);
assert.equal(hash(recipe.segments.map(fields)), lock.inputFieldsSHA256);
assert.equal(hash(recipe.requirements), lock.requirementsSHA256);
assert.equal(hash(recipe.negativeOutputHashes), lock.negativeHashesSHA256);
assert.equal(hash(recipe.branchAssertions), lock.branchesSHA256);
for (const [i, part] of recipe.segments.entries()) {
    assert.deepEqual(fields(part), lock.segments[i].fields);
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
    assert.equal(sha(part.moves), lock.segments[i].movesSHA256);
}
const {branchAssertionErrors} = await import('../baseline/tools/gen-sessions/assertions.mjs');
assert.deepEqual(branchAssertionErrors(recipe), []);

const {runSegment} = await import('../baseline/js/jsmain.js');
const {InMemoryStorage} = await import('../baseline/js/storage.js');
const {VAULT, ROOM, VWALL, HWALL, DOOR, WM_MASK, W_NONDIGGABLE} = await import('../baseline/js/const.js');
const {ONAMES} = await import('../baseline/js/objects_data.js');
const {Blind, Passes_walls} = await import('../baseline/js/youprop.js');
const {cansee, couldsee} = await import('../baseline/js/vision.js');
const {decodeScreen, renderCell} = await import('../baseline/frozen/screen-decode.mjs');
const {hashes, outputs, deferred} = await import('../baseline/tools/half-damage-reader-observe.mjs');
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
const report = {classification: 'source-predicted C wall modes, ordinary JS baseline diagnostic',
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
