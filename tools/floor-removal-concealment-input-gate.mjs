// Ordinary-input producer assertions, paired with unchanged native C output.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {SINK} from '../js/const.js';
import {normalizeSession} from '../frozen/session_loader.mjs';
import {decodeScreen} from '../frozen/screen-decode.mjs';

const fixture = process.argv[2] || new URL(
    './gen-sessions/generated/floor-removal-concealment.session.json', import.meta.url);
const bytes = readFileSync(fixture), raw = JSON.parse(bytes);
if (raw.segments.some(segment => segment.steps.length)) {
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
        '3f719c2a2a017dc49437745e9ff4ee2cd658561e27b6ea9daeb9280f2700c6f6');
    for (const segment of raw.segments) {
        assert.equal(segment.steps.length, segment.moves.length + 1);
        assert.equal(segment.steps[0].key, null);
        assert.deepEqual(segment.steps.slice(1).map(step => step.key), Array.from(segment.moves));
    }
}
const recipe = JSON.parse(readFileSync(new URL(
    './gen-sessions/recipes/floor-removal-concealment.json', import.meta.url)));
assert.equal(raw.source, 'c'); assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 3);
for (const [i, segment] of raw.segments.entries())
    for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
        assert.deepEqual(segment[field], recipe.segments[i][field]);
const decoded = screen => decodeScreen(screen).map(row => row.map(c => c.ch).join('')).join('\n');

for (const [index, segment] of normalizeSession(raw).segments.entries()) {
    const states = [], previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        Object.defineProperty(globalThis, '__step_snapshot', {configurable: true, value: {
            step: '*', cb(observed, step) {
                assert.equal(observed, game);
                states[step] = {hidden: game.u.uundetected || 0, form: game.u.umonnum,
                    hero: [game.u.ux, game.u.uy], moves: game.moves,
                    terrain: game.level.at(game.u.ux, game.u.uy).typ,
                    floor: game.level.objectsAt(game.u.ux, game.u.uy).map(o => [o.otyp, o.o_id]),
                    inventory: (game.invent || []).map(o => [o.otyp, o.invlet])};
            }
        }});
        run = await runSegment({...segment, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const result = {index, name: segment.name, pass: false,
        evidence: raw.segments[index].steps.length ? 'JS producer reach, native comparison separate' : 'JS only, native pending',
        inputSha256: createHash('sha256').update(bytes).digest('hex')};
    try {
        const screens = run.getScreens().map(decoded);
        assert.equal(screens.length, [121, 156, 108][index]);
        assert.equal(screens.length, segment.moves.length + 1);
        assert.equal(states.filter(Boolean).length, screens.length);
        const deletion = [104, 139, 91][index], before = states[deletion - 1], after = states[deletion];
        assert.equal(before.terrain, SINK); assert.equal(after.terrain, SINK);
        assert.equal(before.form, P.PM_PIT_VIPER); assert.equal(after.form, P.PM_PIT_VIPER);
        assert.deepEqual(after.hero, before.hero); assert.equal(after.moves, before.moves);
        assert.equal(before.hidden, index === 2 ? 0 : 1);
        assert.ok(before.inventory.some(([type]) => type === O.RIN_HUNGER));
        const dagger = before.floor.find(([type]) => type === O.DAGGER);
        assert.ok(dagger); assert.ok(!after.floor.some(([, id]) => id === dagger[1]));
        assert.equal(after.hidden, index === 1 ? 1 : 0,
            'cleanup occurs at deletion, before later commands can recheck hiding');
        assert.deepEqual(after.floor.map(([type]) => type), index === 1 ? [O.BELL_OF_OPENING] : []);
        assert.match(screens[deletion], /Suddenly, a dagger vanishes from the sink!/);
        assert.ok(!states.at(-1).inventory.some(([type]) => type === O.RIN_HUNGER));
        for (const text of recipe.branchAssertions[index].screenIncludes)
            assert.ok(screens.some(screen => screen.includes(text)), text);
        for (const text of recipe.branchAssertions[index].screenExcludes || [])
            assert.ok(screens.every(screen => !screen.includes(text)), text);
        for (const cell of recipe.branchAssertions[index].screenCells || [])
            assert.equal(decodeScreen(run.getScreens()[cell.step])[cell.y][cell.x].ch, cell.equals);
        assert.ok(!game.program_state.gameover);
        Object.assign(result, {pass: true, boundaries: screens.length,
            calls: run.getRngLog().length, deletion, before, after});
    } catch (error) {
        result.error = error.message; process.exitCode = 1;
    }
    console.log(JSON.stringify(result));
}
