// Read-only ordinary-input assertions. Native parity is verified separately.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {get_wall_for_db} from '../js/dbridge.js';
import {normalizeSession} from '../frozen/session_loader.mjs';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {ONAMES} from '../js/objects_data.js';
import {DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, DBWALL, DOOR, MOAT,
    DB_EAST, DB_WEST, DB_MOAT, IS_DRAWBRIDGE} from '../js/const.js';

const fixture = process.argv[2] || new URL(
    './gen-sessions/generated/flipped-drawbridge-direction.session.json', import.meta.url);
const bytes = readFileSync(fixture);
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '69dd4938830b80ebbffdd50247a56f10b59ebc29a16913b574eeca34ae0e276b');
const raw = JSON.parse(bytes);
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
const input = normalizeSession(raw);
const recipe = JSON.parse(readFileSync(new URL(
    './gen-sessions/recipes/flipped-drawbridge-direction.json', import.meta.url)));
assert.equal(input.segments.length, 3);
for (const [index, segment] of raw.segments.entries())
    for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
        assert.deepEqual(segment[field], recipe.segments[index][field]);

const calls = entries => entries.map(String)
    .map(s => s.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim())
    .filter(s => /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s));
const decoded = screen => decodeScreen(screen).map(row => row.map(cell => cell.ch).join('')).join('\n');

for (const [index, segment] of input.segments.entries()) {
    const horizontal = index === 0;
    const bridgeX = horizontal ? 66 : 14, wallX = horizontal ? 65 : 15;
    const openStep = index < 2 ? 95 : 78, closeStep = openStep + 6, destroyStep = openStep + 12;
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        Object.defineProperty(globalThis, '__step_snapshot', {configurable: true, value: {
            step: '*', cb(observed, step) {
                assert.equal(observed, game);
                const bridges = [];
                for (let x = 1; x < 80; x++) for (let y = 0; y < 21; y++) {
                    const cell = game.level.at(x, y);
                    if (IS_DRAWBRIDGE(cell.typ)) {
                        const wall = {x, y};
                        get_wall_for_db(wall);
                        bridges.push({x, y, typ: cell.typ, mask: cell.drawbridgemask,
                            wall, wallType: game.level.at(wall.x, wall.y).typ});
                    }
                }
                states[step] = {bridges, hero: [game.u.ux, game.u.uy], hp: game.u.uhp,
                    level: {...game.u.uz}, spanType: game.level.at(bridgeX, 11).typ,
                    wallType: game.level.at(wallX, 11).typ,
                    wands: game.invent.filter(o => [ONAMES.WAN_STRIKING, ONAMES.WAN_OPENING,
                        ONAMES.WAN_LOCKING].includes(o.otyp)).map(o => [o.otyp, o.invlet, o.spe])};
            }
        }});
        run = await runSegment({...segment, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const result = {segment: index, boundaries: run.getScreens().length, pass: false};
    try {
        assert.equal(result.boundaries, [113, 113, 96][index]);
        assert.equal(result.boundaries, segment.moves.length + 1);
        assert.equal(states.length, result.boundaries, 'the existing snapshot hook actually observed each boundary');
        assert.equal(states.filter(Boolean).length, result.boundaries);
        const before = states[75], ready = states[openStep - 1];
        assert.deepEqual(before.level, {dnum: 0, dlevel: 26});
        assert.deepEqual(before.hero, [9, 11]);
        assert.deepEqual(before.bridges, [{x: 14, y: 11, typ: DRAWBRIDGE_UP,
            mask: DB_EAST | DB_MOAT, wall: {x: 15, y: 11}, wallType: DBWALL}]);
        assert.deepEqual(before.wands.map(([type, letter]) => [type, letter]),
            [[ONAMES.WAN_STRIKING, 'n'], [ONAMES.WAN_OPENING, 'o'], [ONAMES.WAN_LOCKING, 'p']]);
        assert.ok(before.wands.every(([, , charges]) => charges > 0));
        assert.deepEqual(ready.hero, horizontal ? [71, 11] : [9, 11]);
        assert.deepEqual(ready.bridges, [{x: bridgeX, y: 11, typ: DRAWBRIDGE_UP,
            mask: (horizontal ? DB_WEST : DB_EAST) | DB_MOAT,
            wall: {x: wallX, y: 11}, wallType: DBWALL}]);
        if (index < 2) {
            assert.equal(states[89].bridges[0].x, 14);
            assert.deepEqual(states[90].bridges, ready.bridges);
            assert.equal(segment.moves[89], horizontal ? '2' : '1');
        } else assert.ok(!segment.moves.includes('#wizfliplevel'));
        assert.equal(states[openStep].spanType, DRAWBRIDGE_DOWN);
        assert.equal(states[openStep].wallType, DOOR);
        assert.equal(states[closeStep].spanType, DRAWBRIDGE_UP);
        assert.equal(states[closeStep].wallType, DBWALL);
        assert.equal(states[destroyStep].spanType, MOAT);
        assert.equal(states[destroyStep].wallType, DOOR);
        assert.deepEqual(states[destroyStep].bridges, []);
        assert.ok(states.slice(0, destroyStep + 1).every(s => s.hp > 0),
            'the real bridge cycle completes before any lethal attack');
        assert.ok(!game.program_state.gameover);
        const screens = run.getScreens().map(decoded);
        if (index < 2) {
            assert.ok(states.at(-1).hp <= 0, 'C suffix reaches lethal minotaur attacks');
            assert.ok(screens.some(s => s.includes('You die...')));
            assert.ok(screens.at(-1).startsWith(index === 0 ? 'Die? [yn] (n)' : 'You die...'));
        } else {
            assert.ok(states.every(s => s.hp > 0));
            assert.ok(screens.at(-1).startsWith('Call a scroll labeled FOOBIE BLETCH:'));
        }
        for (const [step, text] of [[openStep, 'You see a drawbridge coming down!'],
            [closeStep, 'You see a drawbridge coming up!'],
            [destroyStep, 'The portcullis of the drawbridge falls into the moat!']])
            assert.ok(screens[step].includes(text), `step ${step}: ${text}`);
        for (const step of [openStep, closeStep, destroyStep]) {
            const c = decoded(segment.steps[step].screen);
            assert.equal(screens[step].split('\n')[0], c.split('\n')[0]);
        }
        const actual = calls(run.getRngLog());
        const expected = segment.steps.flatMap(s => calls(s.rng || []));
        assert.deepEqual(actual, expected, 'complete stream, including length');
        assert.deepEqual(run.getRngSlices().map(calls), segment.steps.map(s => calls(s.rng || [])));
        result.calls = actual.length;
        result.transitions = [openStep, closeStep, destroyStep];
        result.wall = ready.bridges[0].wall;
        result.pass = true;
    } catch (error) {
        result.error = error.message;
        process.exitCode = 1;
    }
    console.log(JSON.stringify(result));
}
