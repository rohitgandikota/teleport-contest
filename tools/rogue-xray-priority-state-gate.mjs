// Real equipment/level producers and explicit helper-call controls.
// These assertions are source-derived, not native evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate, setTimeout} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {vision_recalc, cansee, couldsee} from '../js/vision.js';
import {Blindf_on, Blindf_off} from '../js/do_wear.js';
import {ready_weapon} from '../js/wield.js';
import {make_blinded} from '../js/potion.js';
import {Blind} from '../js/youprop.js';
import {Is_rogue_level, W_TOOL, W_WEP, ROOMOFFSET} from '../js/const.js';
import {ART_EYES_OF_THE_OVERWORLD} from '../js/artilist_data.js';
import {docrt, pline, display_nhwindow_message} from '../js/display.js';

const parts = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/rogue-xray-priority.json', import.meta.url))).segments;
async function boot(index = 0, carried = false) {
    const part = parts[index];
    const cut = carried ? part.moves.indexOf('Pa') : part.moves.length;
    const run = await runSegment({...part, moves: part.moves.slice(0, cut),
        storage: new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    run._display.onEmptyQueue = async () => { await setImmediate(); return 32; };
    await display_nhwindow_message();
    return run;
}
function eyes() {
    const obj = game.invent.find(o => o.oartifact === ART_EYES_OF_THE_OVERWORLD);
    assert.ok(obj, 'real wished artifact is in inventory');
    return obj;
}
function view() {
    const u = game.u, cells = [], outside = [], through = [];
    for (let y = 0; y < 21; y++) for (let x = 1; x < 80; x++) {
        if (!cansee(x, y)) continue;
        cells.push([x, y]);
        if (Math.max(Math.abs(x - u.ux), Math.abs(y - u.uy)) > 1) outside.push([x, y]);
        if (!couldsee(x, y)) through.push([x, y]);
    }
    return {cells, outside, through};
}
function darkRogue() {
    assert.ok(Is_rogue_level(game.u.uz));
    const rnum = game.level.at(game.u.ux, game.u.uy).roomno - ROOMOFFSET;
    assert.ok(rnum >= 0);
    assert.equal(game.level.rooms[rnum].rlit, 0);
    assert.equal((game.light_sources || []).length, 0);
}

await test('carried real Eyes do not enable x-ray', async () => {
    await boot(0, true); darkRogue();
    assert.equal(eyes().owornmask || 0, 0);
    assert.equal(game.u.xray_range, -1);
    assert.equal(view().outside.length, 0);
});
await test('real facewear retains range three but Rogue excludes its circle', async () => {
    await boot(0, true); darkRogue();
    const obj = eyes(), rng = [...getRngLog()];
    await Blindf_on(obj); vision_recalc(0);
    assert.equal(game.u.ublindf, obj);
    assert.ok(obj.owornmask & W_TOOL);
    assert.equal(game.u.xray_range, 3);
    assert.equal(Blind(), false);
    assert.equal(view().outside.length, 0);
    assert.equal(view().cells.length, 9);
    assert.deepEqual(getRngLog(), rng);
});
await test('Rogue exclusion preserves unseen far-cell angles', async () => {
    await boot(0, true); darkRogue();
    const x = game.u.ux, y = game.u.uy - 3;
    const loc = game.level.at(x, y), before = loc.seenv || 0;
    assert.equal(before, 0);
    await Blindf_on(eyes()); vision_recalc(0);
    assert.equal(loc.seenv || 0, before);
    assert.equal(cansee(x, y), false);
});
await test('ordinary level retains real x-ray through blocked geometry', async () => {
    await boot(1);
    assert.equal(!!Is_rogue_level(game.u.uz), false);
    assert.equal(game.u.ublindf, eyes());
    assert.equal(game.u.xray_range, 3);
    const before = view(), rng = [...getRngLog()];
    assert.ok(before.through.length > 0);
    vision_recalc(0);
    assert.deepEqual(view(), before);
    assert.deepEqual(getRngLog(), rng);
});
await test('ordinary lenses on Rogue never provide artifact x-ray', async () => {
    await boot(2); darkRogue();
    assert.equal(game.u.ublindf.oartifact || 0, 0);
    assert.equal(game.u.xray_range, -1);
    assert.equal(view().outside.length, 0);
});
await test('real removal disables range and retains object identity', async () => {
    await boot(); const obj = eyes();
    await Blindf_off(obj); vision_recalc(0);
    assert.equal(game.u.ublindf, null);
    assert.ok(game.invent.includes(obj));
    assert.equal(obj.owornmask & W_TOOL, 0);
    assert.equal(game.u.xray_range, -1);
    assert.equal(view().outside.length, 0);
});
await test('control two clears sight before Rogue/x-ray selection', async () => {
    await boot(); const rng = [...getRngLog()];
    vision_recalc(2);
    assert.equal(view().cells.length, 0);
    assert.equal(game.u.xray_range, 3);
    assert.deepEqual(getRngLog(), rng);
});
await test('control one uses Rogue priority like a full recalculation', async () => {
    await boot(); const rng = [...getRngLog()];
    vision_recalc(2); vision_recalc(1);
    assert.equal(view().outside.length, 0);
    assert.equal(view().cells.length, 9);
    assert.deepEqual(getRngLog(), rng);
});
await test('real wielded Eyes plus timed blindness takes the Blind branch', async () => {
    await boot(0, true); const obj = eyes();
    await ready_weapon(obj);
    assert.equal(game.u.uwep, obj);
    assert.ok(obj.owornmask & W_WEP);
    assert.equal(game.u.xray_range, 3);
    await make_blinded(100, false);
    assert.equal(Blind(), true);
    assert.equal(view().cells.length, 0);
    assert.ok(game.viz_array.some(row => row.some(bits => bits & 1)),
        'Blind preserves could-see geometry for monster vision');
});
await test('restored sight with wielded Eyes still uses Rogue geometry', async () => {
    await boot(0, true); await ready_weapon(eyes());
    await make_blinded(100, false); await make_blinded(0, false);
    assert.equal(Blind(), false);
    assert.equal(game.u.xray_range, 3);
    assert.equal(view().outside.length, 0);
});
await test('real pending More retains redraw ownership and nested redraw is quiet', async () => {
    const run = await boot();
    await pline('A message waits before the Rogue redraw.');
    let release, settled = false, failure;
    run._display.onEmptyQueue = () => new Promise(resolve => { release = resolve; });
    const operation = docrt().then(() => { settled = true; }, error => {
        failure = error; settled = true;
    });
    try {
        for (let i = 0; i < 200 && !release && !settled; i++) await setTimeout(1);
        assert.ok(release, 'actual More input is pending');
        assert.equal(settled, false);
        assert.equal(game.program_state.in_docrt, true);
        const pixels = run._display.terminal.serialize();
        const rng = [...getRngLog()];
        await docrt();
        assert.equal(game.program_state.in_docrt, true);
        assert.equal(run._display.terminal.serialize(), pixels);
        assert.deepEqual(getRngLog(), rng);
    } finally {
        run._display.onEmptyQueue = async () => { await setImmediate(); return 32; };
        release?.(32); await operation;
    }
    if (failure) throw failure;
    assert.equal(game.program_state.in_docrt, false);
    assert.equal(view().outside.length, 0);
});
