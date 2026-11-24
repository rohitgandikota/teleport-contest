// Read-only ordinary producer assertions. Native parity is checked separately.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {get_level_extends} from '../js/mklev.js';
import {ICE, IS_DRAWBRIDGE} from '../js/const.js';
import {MELT_ICE_AWAY} from '../js/timeout.js';
import {ONAMES} from '../js/objects_data.js';
import {normalizeSession} from '../frozen/session_loader.mjs';
import {decodeScreen} from '../frozen/screen-decode.mjs';

const fixture = process.argv[2] || new URL(
    './gen-sessions/generated/random-level-flip-extras.session.json', import.meta.url);
const bytes = readFileSync(fixture);
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '90b26bc381cc6b24793a23dc2cd5156a2f26e150f66f9773765cb6900e2bc298');
const raw = JSON.parse(bytes);
assert.equal(raw.source, 'c'); assert.equal(raw.version, 5);
const recipe = JSON.parse(readFileSync(new URL(
    './gen-sessions/recipes/random-level-flip-extras.json', import.meta.url)));
assert.equal(raw.segments.length, 3);
for (const [index, part] of raw.segments.entries())
    for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
        assert.deepEqual(part[field], recipe.segments[index][field]);
for (const part of raw.segments) {
    assert.equal(part.steps.length, 126);
    assert.equal(part.steps[0].key, null);
    assert.deepEqual(part.steps.slice(1).map(step => step.key), Array.from(part.moves));
}
const input = normalizeSession(raw);
const decoded = screen => decodeScreen(screen).map(row => row.map(cell => cell.ch).join('')).join('\n');

for (const [index, part] of input.segments.entries()) {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        Object.defineProperty(globalThis, '__step_snapshot', {configurable: true, value: {
            step: '*', cb(observed, step) {
                assert.equal(observed, game);
                let bridges = 0;
                for (let x = 1; x < 80; x++) for (let y = 0; y < 21; y++)
                    bridges += +IS_DRAWBRIDGE(game.level.at(x, y).typ);
                states[step] = {hero: [game.u.ux, game.u.uy], hp: game.u.uhp,
                    moves: game.moves, terrain: game.level.at(game.u.ux, game.u.uy).typ,
                    timers: (game.timer_base || []).map(t => [t.func_index, t.arg, t.timeout]),
                    area: get_level_extends(), bridges,
                    boots: game.u.uarmf?.otyp, monsters: game.level.monsters.length};
            }
        }});
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const result = {segment: index, name: part.name, pass: false,
        evidence: raw.segments[index].steps.length ? 'JS reach, native comparison separate' : 'JS only, native pending',
        inputOrNativeSha256: createHash('sha256').update(bytes).digest('hex')};
    try {
        const screens = run.getScreens().map(decoded);
        assert.equal(screens.length, 126);
        assert.equal(screens.length, part.moves.length + 1);
        assert.equal(states.length, 126);
        assert.equal(states.filter(Boolean).length, 126);
        assert.ok(states.every(s => s.bridges === 0), 'no dependency on drawbridge direction repair');
        assert.ok(states.every(s => s.hp > 0));
        const before = states[99], after = states[114];
        assert.deepEqual(before.hero, [30, 7]);
        assert.equal(before.terrain, ICE);
        assert.equal(before.boots, ONAMES.WATER_WALKING_BOOTS);
        assert.equal(before.monsters, 0);
        assert.deepEqual(before.area, {xmin: 1, xmax: 75, ymin: 1, ymax: 20});
        assert.deepEqual(before.timers, [[MELT_ICE_AWAY, (30 << 16) | 7, 337]]);
        assert.equal(before.moves, 4);
        assert.equal(part.moves[113], ['0', '2', '\x1b'][index]);
        assert.ok(screens[113].includes('Flip 0=randomly, 1=vertically, 2=horizontally, 3=both:'));
        assert.deepEqual(run.getRngSlices()[114], index === 0 ? ['rn2(2)=0', 'rn2(2)=1'] : []);
        assert.deepEqual(after.hero, index === 2 ? [30, 7] : [46, 7]);
        assert.equal(after.terrain, ICE);
        assert.equal(after.moves, 4, 'debug reflection consumes no turn');
        assert.deepEqual(after.timers, [[MELT_ICE_AWAY, ((index === 2 ? 30 : 46) << 16) | 7, 337]]);
        for (const step of [117, 123]) assert.ok(screens[step].startsWith('There is steady ice here.'));
        if (index === 2) assert.ok(screens[114].startsWith('Never mind.'));
        assert.deepEqual(states[125].hero, after.hero);
        assert.deepEqual(states[125].timers, after.timers);
        assert.equal(states[125].moves, 5, 'ordinary rest suffix executes after the command');
        assert.ok(!game.program_state.gameover);
        result.boundaries = screens.length;
        result.calls = run.getRngLog().length;
        result.hero = after.hero;
        result.pass = true;
    } catch (error) {
        result.error = error.message; process.exitCode = 1;
    }
    console.log(JSON.stringify(result));
}
