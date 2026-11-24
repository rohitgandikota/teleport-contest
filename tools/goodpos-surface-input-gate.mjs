// Read-only reach observations; raw C parity is checked independently.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {Swimming, Amphibious, Fire_resistance, Wwalking, Levitation, Flying} from '../js/youprop.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {POOL, ROOM, LAVAPOOL, DRAWBRIDGE_UP, DB_UNDER, DB_ICE, DB_MOAT, Upolyd} from '../js/const.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};

const read = path => readFileSync(new URL(path, import.meta.url));
const recipe = JSON.parse(read('gen-sessions/recipes/goodpos-surface-placement.json'));
const raw = read('gen-sessions/generated/goodpos-surface-placement.session.json');
const native = JSON.parse(raw);
await test('native provenance, input identity and branch assertions', () => {
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '3364a690a6bcbde2d2208c4a7e871689d8932360801d82e1d86b3ad46fabd574');
    assert.equal(native.source, 'c'); assert.equal(native.version, 5);
    assert.equal(native.segments.length, 8);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    for (const tag of recipe.coverage) assert.ok(coverage.requirements.some(r => r.id === tag));
    for (let i = 0; i < 8; i++) {
        const a = recipe.segments[i], b = native.segments[i];
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves', 'initial']) {
            assert.equal(Object.hasOwn(a, key), Object.hasOwn(b, key));
            assert.deepEqual(a[key], b[key]);
        }
        assert.deepEqual(b.steps.map(s => s.key), [null, ...b.moves]);
    }
});
for (const [index, part] of recipe.segments.entries())
await test(part.name, async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            const loc = g.level.at(g.u.ux, g.u.uy);
            states.push({step, x:g.u.ux, y:g.u.uy, hp:g.u.uhp, formHp:g.u.mh,
                polymorphed:Upolyd(g.u), mortality:g.u.umortality || 0,
                swimming:Swimming(), amphibious:Amphibious(), flying:Flying(),
                levitating:Levitation(), fire:Fire_resistance(), walking:Wwalking(),
                form:g.u.umonnum, terrain:loc.typ, under:loc.drawbridgemask & DB_UNDER,
                amulet:g.u.uamul?.otyp, boots:g.u.uarmf?.otyp,
                proof:!!g.u.uarmf?.oerodeproof});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length, part.moves.length + 1);
    assert.ok(states.every(s => s.hp > 0 && s.mortality === 0
        && (!s.polymorphed || s.formHp > 0)));
    assert.ok(!game.program_state?.gameover);
    const last = states.at(-1);
    assert.deepEqual([last.x, last.y], index < 2 ? [14, 11] : [40, 6]);
    if (index < 2) {
        assert.equal(last.terrain, DRAWBRIDGE_UP);
        assert.equal(last.under, index === 0 ? DB_ICE : DB_MOAT);
        assert.ok(last.levitating);
    } else if (index === 2 || index === 3) {
        assert.equal(last.amulet, O.AMULET_OF_MAGICAL_BREATHING);
        assert.ok(last.amphibious && !last.swimming && !last.flying);
        assert.equal(last.terrain, index === 2 ? POOL : ROOM);
    } else if (index === 4) {
        assert.equal(last.amulet, O.AMULET_OF_FLYING);
        assert.ok(last.flying); assert.equal(last.terrain, POOL);
    } else if (index === 5) {
        assert.equal(last.form, P.PM_GIANT_EEL);
        assert.ok(last.swimming && last.amphibious); assert.equal(last.terrain, POOL);
    } else if (index === 6) {
        assert.equal(last.form, P.PM_SALAMANDER);
        assert.ok(last.fire && !last.walking); assert.equal(last.terrain, LAVAPOOL);
    } else {
        assert.equal(last.boots, O.WATER_WALKING_BOOTS);
        assert.ok(last.fire && last.walking && last.proof); assert.equal(last.terrain, LAVAPOOL);
    }
    const text = run.getScreens().map(s => decodeScreen(s)
        .map(row => row.map(renderCell).join('')).join('\n')).join('\n');
    for (const wanted of recipe.branchAssertions[index].screenIncludes)
        assert.ok(text.includes(wanted), wanted);
    for (const unwanted of recipe.branchAssertions[index].screenExcludes)
        assert.ok(!text.includes(unwanted), unwanted);
});
