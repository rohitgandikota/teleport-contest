// Read-only actual-input reach and unchanged native C provenance. Score parity separately.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Flying, Levitation, Swimming, Amphibious, Breathless, Wwalking}
    from '../js/youprop.js';
import {near_capacity} from '../js/attrib.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {POOL, ROOM, W_AMUL, OBJ_FLOOR, UNENCUMBERED, SLT_ENCUMBER}
    from '../js/const.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/amulet-flight-pool-crawl.json', import.meta.url)));
const inputBytes = readFileSync(new URL('gen-sessions/generated/amulet-flight-pool-crawl.session.json', import.meta.url));
const input = JSON.parse(inputBytes);
test('two unchanged source:c/v5 native segments match the recipe and asserted branches', () => {
    assert.equal(input.version, 5);
    assert.equal(input.source, 'c');
    assert.equal(createHash('sha256').update(inputBytes).digest('hex'),
        '67f9ced058c042d42986f6aa1e61a40c3e93339ff66d773fab76d84417ed9468');
    assert.equal(recipe.name, 'amulet-flight-pool-crawl');
    assert.equal(input.segments.length, 2);
    assert.equal(recipe.segments.length, 2);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const valid = new Set(tags.requirements.map(t => t.id));
    for (const tag of recipe.coverage) assert.ok(valid.has(tag), tag);
    for (const [i, part] of input.segments.entries()) {
        assert.equal(part.steps.length, [135, 136][i]);
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[key], recipe.segments[i][key]);
    }
    assert.deepEqual(recordingIntegrityErrors(input), []);
    assert.deepEqual(branchAssertionErrors(recipe, input), []);
});

for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const states = [], previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const object = o => ({id:o.o_id, type:o.otyp, mask:o.owornmask || 0,
        where:o.where, x:o.ox, y:o.oy, weight:o.owt, inUse:!!o.in_use,
        howLost:o.how_lost ?? null});
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            states.push({step, x:g.u.ux, y:g.u.uy, x0:g.u.ux0, y0:g.u.uy0,
                terrain:g.level.at(g.u.ux, g.u.uy).typ, form:g.u.umonnum,
                hp:g.u.uhp, mh:g.u.mh, mortality:g.u.umortality || 0,
                capacity:near_capacity(), amulet:g.u.uamul?.o_id ?? null,
                flying:Flying(), levitation:Levitation(), swimming:Swimming(),
                amphibious:Amphibious(), breathless:Breathless(), walking:Wwalking(),
                intrinsicFlight:g.u.intrinsic?.HFlying || 0,
                flightMask:g.u.uprops?.FLYING || 0,
                underwater:!!g.u.uinwater, gameover:!!g.program_state?.gameover,
                initialDon:!!g.initial_don, dressing:!!g.afternmv,
                polyselfs:g.u.uconduct?.polyselfs || 0,
                inventory:(g.invent || []).map(object), floor:g.level.objects.map(object),
                text:g.nhDisplay.grid.map(row => row.map(c => c.ch).join('').trimEnd()).join('\n')});
        }};
        await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const ready = states.findLast(s => s.amulet && s.terrain === POOL);
    const cleared = states.find(s => ready && s.step > ready.step && !s.amulet);
    const escaped = states.find(s => cleared && s.step > cleared.step && s.terrain === ROOM);
    const last = states.at(-1);
    assert.ok(ready && cleared && escaped, 'worn pool, cleared slot, then completed crawl');
    const old = ready.inventory.find(o => o.id === ready.amulet);
    assert.equal(ready.form, index ? PMNAMES.PM_GIANT_ANT : PMNAMES.PM_GRID_BUG);
    assert.equal(ready.polyselfs, 1);
    assert.equal(old.type, ONAMES.AMULET_OF_FLYING);
    assert.equal(old.mask, W_AMUL);
    assert.equal(ready.flightMask, W_AMUL);
    assert.equal(ready.flying, true);
    assert.equal(ready.initialDon, false);
    assert.equal(ready.dressing, false);
    assert.equal(ready.inventory.length, 1);
    assert.ok(ready.capacity > SLT_ENCUMBER);
    for (const s of states) {
        assert.ok(s.hp > 0 && !s.mortality && !s.gameover);
        assert.ok(!s.levitation && !s.swimming && !s.amphibious && !s.breathless
            && !s.walking && !s.intrinsicFlight && !s.underwater);
    }
    assert.equal(cleared.terrain, POOL);
    assert.equal(cleared.flying, false);
    assert.equal(cleared.flightMask, 0);
    assert.equal(cleared.inventory[0].id, old.id);
    assert.equal(cleared.inventory[0].mask, 0);
    assert.equal(cleared.inventory[0].inUse, false);
    assert.ok(cleared.capacity > SLT_ENCUMBER);
    assert.equal(last.amulet, null);
    assert.equal(last.flying, false);
    assert.equal(last.form, ready.form);
    assert.equal(last.mh, ready.mh);
    assert.equal(last.capacity, UNENCUMBERED);
    assert.deepEqual(last.inventory, []);
    const dropped = last.floor.find(o => o.id === old.id);
    assert.ok(dropped, 'emergency_disrobe leaves the same amulet at the pool');
    assert.equal(dropped.where, OBJ_FLOOR);
    assert.deepEqual([dropped.x, dropped.y], [ready.x, ready.y]);
    assert.equal(dropped.weight, old.weight);
    assert.equal(dropped.howLost, old.howLost);
    assert.equal(dropped.inUse, false);
    assert.equal(dropped.mask, 0);
    assert.deepEqual([escaped.x0, escaped.y0], [ready.x, ready.y]);
    const dx = Math.abs(escaped.x - ready.x), dy = Math.abs(escaped.y - ready.y);
    assert.equal(Math.max(dx, dy), 1);
    if (!index) assert.equal(dx + dy, 1, 'C NODIAG forbids a grid-bug diagonal crawl');
    else assert.equal(dx + dy, 2, 'matched ordinary form retains the first diagonal');
    assert.deepEqual([last.x, last.y], [escaped.x, escaped.y]);
    const observed = {segments:recipe.segments.map((_, i) =>
        ({steps:i === index ? states.map(s => ({screen:s.text})) : []}))};
    assert.deepEqual(branchAssertionErrors({...recipe, branches:[recipe.branches[index]],
        branchAssertions:[recipe.branchAssertions[index]]}, observed), []);
});
