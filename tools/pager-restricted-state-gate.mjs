// C pager.c:730, 779, 1301 and 1431. Constructed display cells and view modes;
// actual underwater/form producers. Ordinary keyboard witnesses are separate.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, form, seed, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { set_uinwater } from '../js/hack.js';
import { Underwater } from '../js/youprop.js';
import { show_glyph_cell } from '../js/display.js';
import { do_screen_description } from '../js/pager.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES } from '../js/monst_data.js';
import { cmap_names as CM } from '../js/drawing_data.js';
import { STONE, TER_DETECT, TER_MAP, Is_waterlevel } from '../js/const.js';
import { NO_COLOR } from '../js/terminal.js';

const cases = [
    ['dry unexplored near', false, false, 1, 0, 'unexplored', true, 0, 'unexplored area'],
    ['submerged unexplored near', true, false, 1, 0, 'unexplored', true, 0, 'land'],
    ['submerged unexplored far', true, false, 2, 0, 'unexplored', true, 0, 'unreconnoitered'],
    ['water plane near', true, true, 1, 0, 'unexplored', true, 0, 'unexplored area'],
    ['water plane far', true, true, 2, 0, 'unexplored', true, 0, 'unexplored area'],
    ['submerged mapped stone near', true, false, 1, 0, 'cmap', true, 0, 'land'],
    ['submerged unmapped stone near', true, false, 1, 0, 'cmap', false, 0, 'unexplored'],
    ['submerged mapped stone far', true, false, 2, 0, 'cmap', true, 0, 'unreconnoitered'],
    ['dry mapped stone', false, false, 1, 0, 'cmap', true, 0, 'stone'],
    ['detection background near', false, false, 1, 0, 'cmap', true, TER_DETECT, 'unreconnoitered'],
    ['detection background far', false, false, 2, 0, 'cmap', true, TER_DETECT, 'unreconnoitered'],
    ['detection with map', false, false, 1, 0, 'cmap', true, TER_DETECT | TER_MAP, 'stone'],
    ['map without detection', false, false, 1, 0, 'cmap', true, TER_MAP, 'stone'],
    ['unexplored detection glyph', false, false, 1, 0, 'unexplored', true, TER_DETECT, 'unexplored area'],
    ['submerged adjacent diagonal', true, false, 1, 1, 'unexplored', true, 0, 'land'],
    ['submerged distant diagonal', true, false, 2, 1, 'unexplored', true, 0, 'unreconnoitered'],
];

for (const [name, submerged, waterPlane, dx, dy, kind, seen, mode, expected] of cases)
test(name, async () => {
    await setup();
    if (submerged) {
        form(PMNAMES.PM_GIANT_EEL);
        await set_uinwater(1);
    }
    assert.equal(Underwater(), submerged);
    if (waterPlane) game.u.uz = { ...game.water_level };
    assert.equal(Is_waterlevel(game.u.uz), waterPlane);
    game.iflags.terrainmode = mode;
    const xx = x + dx, yy = y + dy;
    Object.assign(game.level.at(xx, yy), { typ: STONE, seenv: seen ? 255 : 0 });
    show_glyph_cell(xx, yy, ' ', NO_COLOR, false, 0,
        kind === 'cmap' ? { kind, cmap: CM.S_stone } : { kind });
    seed();
    const result = do_screen_description({ x: xx, y: yy }, true, 0);
    assert.equal(result.firstmatch, expected);
    assert.ok(result.out_str.includes(expected));
    assert.equal(result.pm, null);
    if (expected === 'unreconnoitered') {
        assert.equal(result.found, 1);
        assert.equal(result.out_str, `         ${expected}`);
    }
    assert.deepEqual(getRngLog(), []);
});

test('typed symbol lookup bypasses positional restrictions', async () => {
    await setup();
    form(PMNAMES.PM_GIANT_EEL);
    await set_uinwater(1);
    game.iflags.terrainmode = TER_DETECT;
    seed();
    const result = do_screen_description({ x: x + 3, y }, false, '.');
    assert.ok(!result.out_str.includes('unreconnoitered'));
    assert.deepEqual(getRngLog(), []);
});

test('swallowed view rejects distant squares before inspecting the glyph', async () => {
    await setup();
    // Construct the restriction flag only. The early C branch never reads
    // an engulfer. Adjacent swallowed descriptions are outside this control.
    game.u.uswallow = true;
    seed();
    const result = do_screen_description({ x: x + 2, y }, true, 0);
    assert.equal(result.found, 1);
    assert.equal(result.firstmatch, 'unreconnoitered');
    assert.equal(result.pm, null);
    assert.deepEqual(getRngLog(), []);
});
