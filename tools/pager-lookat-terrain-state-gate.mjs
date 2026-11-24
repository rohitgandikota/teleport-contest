// C pager.c:752-764 through the real terrain, bridge, glyph and public lookup producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {create_drawbridge, is_drawbridge_wall, get_wall_for_db} from '../js/dbridge.js';
import {set_levltyp} from '../js/mkmaze.js';
import {newsym, glyph_at} from '../js/display.js';
import {vision_reset, vision_recalc} from '../js/vision.js';
import {do_screen_description} from '../js/pager.js';
import {getRngLog} from '../js/rng.js';
import {cmap_names as CM} from '../js/drawing_data.js';
import {DB_NORTH, DB_SOUTH, DB_EAST, DB_WEST, MOAT, LAVAPOOL, HWALL,
    DOOR, CLOUD, D_NODOOR, D_ISOPEN, D_CLOSED, D_LOCKED, D_BROKEN,
    D_TRAPPED, Is_airlevel} from '../js/const.js';

function describe(xx, yy) {
    vision_reset();
    vision_recalc();
    newsym(xx, yy);
    seed();
    const result = do_screen_description({x: xx, y: yy}, true, 0);
    assert.equal(result.pm, null);
    assert.equal(typeof result.then, 'undefined');
    assert.deepEqual(getRngLog(), []);
    return result;
}

for (const [direction, dx, dy] of [
    [DB_NORTH, 0, -1], [DB_SOUTH, 0, 1], [DB_EAST, 1, 0], [DB_WEST, -1, 0],
]) for (const open of [false, true])
test(`real ${open ? 'open' : 'raised'} bridge in direction ${direction}`, async () => {
    await setup();
    const bx = x + 2, by = y + 2, wx = bx + dx, wy = by + dy;
    assert.ok(set_levltyp(bx, by, MOAT));
    assert.ok(set_levltyp(wx, wy, HWALL));
    assert.equal(create_drawbridge(bx, by, direction, open), true);
    assert.equal(is_drawbridge_wall(wx, wy), direction);
    const wall = {x: bx, y: by};
    get_wall_for_db(wall);
    assert.deepEqual(wall, {x: wx, y: wy});
    const result = describe(wx, wy);
    assert.equal(result.firstmatch, open ? 'open drawbridge portcullis' : 'raised drawbridge');
    assert.ok(result.out_str.includes(result.firstmatch));
    if (open) assert.equal(glyph_at(wx, wy).cmap, CM.S_ndoor);
});

test('open portcullis above lava uses the same canonical bridge predicate', async () => {
    await setup();
    set_levltyp(x + 2, y + 2, LAVAPOOL);
    set_levltyp(x + 2, y + 1, HWALL);
    assert.equal(create_drawbridge(x + 2, y + 2, DB_NORTH, true), true);
    assert.equal(describe(x + 2, y + 1).firstmatch, 'open drawbridge portcullis');
});

for (const [name, mask, expected] of [
    ['ordinary doorway', D_NODOOR, 'doorway'],
    ['open door', D_ISOPEN, 'open door'],
    ['closed door', D_CLOSED, 'closed door'],
    ['locked door', D_LOCKED, 'closed door'],
    ['broken door', D_BROKEN, 'broken door'],
    ['trapped broken door', D_BROKEN | D_TRAPPED, 'broken door'],
]) test(`${name} without a bridge retains its description`, async () => {
    await setup();
    set_levltyp(x + 1, y, DOOR);
    game.level.at(x + 1, y).doormask = mask;
    assert.equal(is_drawbridge_wall(x + 1, y), -1);
    assert.equal(describe(x + 1, y).firstmatch, expected);
});

test('an adjacent span facing another door does not identify an ordinary doorway', async () => {
    await setup();
    set_levltyp(x + 2, y + 2, MOAT);
    set_levltyp(x + 2, y + 1, HWALL);
    assert.equal(create_drawbridge(x + 2, y + 2, DB_NORTH, true), true);
    set_levltyp(x + 1, y + 2, DOOR);
    game.level.at(x + 1, y + 2).doormask = D_NODOOR;
    assert.equal(is_drawbridge_wall(x + 1, y + 2), -1);
    assert.equal(describe(x + 1, y + 2).firstmatch, 'doorway');
});

// These source controls vary the existing level identity fields explicitly.
// The separate ordinary-input Air proposal verifies a real level transition.
for (const mode of ['ordinary', 'Air', 'other dungeon', 'other level'])
test(`cloud in ${mode}`, async () => {
    await setup();
    if (mode !== 'ordinary') {
        game.u.uz = {...game.air_level};
        if (mode === 'other dungeon') game.u.uz.dnum++;
        if (mode === 'other level') game.u.uz.dlevel++;
    }
    assert.equal(Is_airlevel(game.u.uz), mode === 'Air');
    assert.equal(set_levltyp(x + 1, y, CLOUD), true);
    const result = describe(x + 1, y);
    assert.equal(glyph_at(x + 1, y).cmap, CM.S_cloud);
    assert.equal(result.firstmatch, mode === 'Air' ? 'cloudy area' : 'fog/vapor cloud');
});

test('typed cloud symbol does not inspect the current level', async () => {
    await setup();
    seed();
    const ordinary = do_screen_description({x, y}, false, '#');
    game.u.uz = {...game.air_level};
    const air = do_screen_description({x, y}, false, '#');
    assert.deepEqual(air, ordinary);
    assert.ok(!air.out_str.includes('cloudy area'));
    assert.deepEqual(getRngLog(), []);
});
