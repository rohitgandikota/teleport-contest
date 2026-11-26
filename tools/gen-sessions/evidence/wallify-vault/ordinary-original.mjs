// Source-only diagnostic. A failed C predicate stays a failure, not an expected-pass mask.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
const fields = s => ['name', 'seed', 'datetime', 'nethackrc', 'moves']
    .map(field => ({field, present: Object.hasOwn(s, field), value: s[field]}));
assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'));
const lock = JSON.parse(readFileSync(new URL('../../input-lock.json', import.meta.url)));
const mapBytes = readFileSync(new URL('../../baseline-runtime.json', import.meta.url));
assert.equal(sha(mapBytes), lock.runtimeSHA256);
const runtime = JSON.parse(mapBytes);
assert.equal(Object.keys(runtime).length, 280);
for (const [path, expected] of Object.entries(runtime))
    assert.equal(sha(readFileSync(new URL(`../${path}`, import.meta.url))), expected, path);
const recipeBytes = readFileSync(new URL('../../recipes/wallify-vault.json', import.meta.url));
assert.equal(sha(recipeBytes), lock.recipeSHA256);
const recipe = JSON.parse(recipeBytes);
assert.equal(hash(recipe.segments.map(fields)), lock.inputFieldsSHA256);
assert.equal(hash(recipe.requirements), lock.requirementsSHA256);
assert.equal(hash(recipe.negativeOutputHashes), lock.negativeHashesSHA256);
for (const [i, part] of recipe.segments.entries()) {
    assert.deepEqual(fields(part), lock.segments[i].fields);
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
}

const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ROOM, THRONE, HWALL} = await import('../js/const.js');
const {ONAMES} = await import('../js/objects_data.js');
const {Blind, Hallucination} = await import('../js/youprop.js');
const {cansee, couldsee} = await import('../js/vision.js');
const {decodeScreen, renderCell} = await import('../frozen/screen-decode.mjs');
const {hashes, outputs, deferred} = await import('./half-damage-reader-observe.mjs');
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
const report = {classification: 'source-predicted C wallify redraw, ordinary JS baseline diagnostic',
    nativeParityClaimed: false, runtimePatchPaths: [], total: results.length,
    reached: results.filter(r => r.reach).length, cPredicatesPassed: results.filter(r => r.cPredicate).length, results};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({total: report.total, reached: report.reached, cPredicatesPassed: report.cPredicatesPassed,
    failed: results.filter(r => !r.cPredicate).map(({name, error}) => ({name, error})), hash: hash(results)}));
if (report.cPredicatesPassed !== report.total) process.exitCode = 1;
