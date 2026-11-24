// Constructed direct/caller contracts for the native mapping dependency.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {readobjnam} from '../js/objnam.js';
import {teleds} from '../js/teleport.js';
import {make_engr_at, engr_at} from '../js/engrave.js';
import {dig_corridor} from '../js/mklev.js';
import {map_engraving, map_location, map_background, gbuf_at} from '../js/display.js';
import {show_map_spot} from '../js/detect.js';
import {resetInputState} from '../js/input.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {SDOOR, DOOR, ROOM, CORR, THRONE, DUST} from '../js/const.js';
import {CLR_BRIGHT_BLUE} from '../js/terminal.js';
import {cmap_names as CM} from '../js/drawing_data.js';
const part = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-exit-corridor.json', import.meta.url))).segments[0];
async function setup(terrain = SDOOR) {
    const stop = part.moves.indexOf('jhhhh');
    assert.ok(stop > 0);
    const run = await runSegment({...part, moves:part.moves.slice(0, stop),
        storage:new InMemoryStorage()});
    game._preNhgetchHook = null; resetInputState();
    let reads = 0;
    run._display.onEmptyQueue = async () => {
        assert.ok(++reads < 20); await setImmediate(); return 32;
    };
    assert.deepEqual([game.u.ux, game.u.uy], [27, 4]);
    assert.equal(game.level.at(27, 4).typ, SDOOR);
    if (terrain === DOOR) await readobjnam('doorless doorway', null);
    if (terrain === ROOM || terrain === THRONE) {
        await readobjnam('throne', null);
        if (terrain === ROOM) await readobjnam('floor', null);
    }
    if (terrain === CORR) {
        const point = {x:27,y:4};
        assert.ok(dig_corridor(point, point, null, false, CORR, SDOOR));
    }
    assert.equal(game.level.at(27, 4).typ, terrain);
    make_engr_at(27, 4, 'test engraving', null, game.moves, DUST);
    const ep = engr_at(27, 4);
    assert.ok(ep); assert.equal(!!ep.erevealed, false);
    map_background(27, 4, true);
    initRng(401); enableRngLog();
    return ep;
}
for (const [name, terrain, cmap] of [
    ['door', DOOR, CM.S_engroom], ['secret door', SDOOR, CM.S_engroom],
    ['room', ROOM, CM.S_engroom], ['corridor', CORR, CM.S_engrcorr],
]) {
    await test(`direct map_engraving maps ${name} without changing revelation or RNG`, async () => {
        const ep = await setup(terrain);
        map_engraving(ep, true);
        const remembered = game.level.at(27, 4).remembered_glyph;
        assert.equal(remembered.glyph.cmap, cmap);
        assert.equal(remembered.color, CLR_BRIGHT_BLUE);
        assert.equal(gbuf_at(27, 4).disp_glyph.cmap, cmap);
        assert.equal(!!ep.erevealed, false);
        assert.deepEqual(getRngLog(), []);
    });
}
await test('show false writes memory while leaving the displayed cell unchanged', async () => {
    const ep = await setup(DOOR), cell = structuredClone(gbuf_at(27, 4));
    map_engraving(ep, false);
    assert.equal(game.level.at(27, 4).remembered_glyph.glyph.cmap, CM.S_engroom);
    assert.deepEqual(gbuf_at(27, 4), cell);
    assert.equal(!!ep.erevealed, false); assert.deepEqual(getRngLog(), []);
});
await test('ordinary map_location retains its door-terrain exclusion', async () => {
    await setup(DOOR);
    map_location(27, 4, true);
    assert.notEqual(gbuf_at(27, 4).disp_glyph.cmap, CM.S_engroom);
    assert.deepEqual(getRngLog(), []);
});
await test('real mapping caller displays a door engraving without ordinary-vision filtering', async () => {
    await setup(DOOR);
    show_map_spot(27, 4, false);
    assert.equal(gbuf_at(27, 4).disp_glyph.cmap, CM.S_engroom);
    assert.deepEqual(getRngLog(), []);
});
await test('real mapping caller keeps furniture above engravings', async () => {
    await setup(THRONE);
    await teleds(23, 5, 0); // Keep the hero glyph off the tested throne.
    initRng(401); enableRngLog();
    show_map_spot(27, 4, false);
    assert.equal(gbuf_at(27, 4).disp_glyph.cmap, CM.S_throne);
    assert.deepEqual(getRngLog(), []);
});
