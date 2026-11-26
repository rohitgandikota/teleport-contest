// Source-only diagnostic. Missing C feedback remains a failure.
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
const runtime = JSON.parse(mapBytes);
assert.equal(Object.keys(runtime).length, 280);
for (const [path, expected] of Object.entries(runtime))
    assert.equal(sha(readFileSync(new URL(`../baseline/${path}`, import.meta.url))), expected, path);
const recipeBytes = readFileSync(new URL('../recipes/wallify-vault-tame-occupant.json', import.meta.url));
assert.equal(sha(recipeBytes), lock.recipeSHA256);
const recipe = JSON.parse(recipeBytes);
assert.equal(hash(recipe.segments.map(fields)), lock.inputFieldsSHA256);
assert.equal(hash(recipe.requirements), lock.requirementsSHA256);
assert.equal(hash(recipe.negativeOutputHashes), lock.negativeHashesSHA256);
for (const [i, part] of recipe.segments.entries()) {
    assert.deepEqual(fields(part), lock.segments[i].fields);
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
}

const {runSegment} = await import('../baseline/js/jsmain.js');
const {InMemoryStorage} = await import('../baseline/js/storage.js');
const {ROOM, THRONE, HWALL} = await import('../baseline/js/const.js');
const {PMNAMES, MSOUND} = await import('../baseline/js/monst_data.js');
const {ONAMES} = await import('../baseline/js/objects_data.js');
const {Deaf, Hallucination} = await import('../baseline/js/youprop.js');
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
const report = {classification: 'source-predicted C wallify yelp, ordinary JS baseline diagnostic',
    nativeParityClaimed: false, runtimePatchPaths: [], total: results.length,
    reached: results.filter(r => r.reach).length, cPredicatesPassed: results.filter(r => r.cPredicate).length, results};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({total: report.total, reached: report.reached, cPredicatesPassed: report.cPredicatesPassed,
    failed: results.filter(r => !r.cPredicate).map(({name, error}) => ({name, error})), hash: hash(results)}));
if (report.cPredicatesPassed !== report.total) process.exitCode = 1;
