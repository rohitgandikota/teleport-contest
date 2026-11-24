// C pager.c:1979-2074. Constructed states, real producers, public menu entry.
// These checks establish source contracts, not native ordinary input reach.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, clearMessages, messages, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {do_look} from '../js/pager.js';
import {handler_whatis_coord} from '../js/options.js';
import {map_invisible, glyph_at, newsym, mon_warning, canspotself} from '../js/display.js';
import {makemon} from '../js/makemon.js';
import {mon_set_minvis, setworn} from '../js/worn.js';
import {mksobj, mksobj_at} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {Ring_on} from '../js/do_wear.js';
import {make_hallucinated, peffects} from '../js/potion.js';
import {Hallucination, Invis} from '../js/youprop.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {ECMD_OK, NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG, MM_ANGRY,
    W_RINGL, BOLT_LIM} from '../js/const.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const invisible = 'remembered, unseen, creature';
const flags = NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG;
const rows = run => decodeScreen(run._display.terminal.serialize())
    .map(row => row.map(renderCell).join('').trimEnd());
async function option(run, mode) {
    let reads = 0;
    run._display.onEmptyQueue = () => {
        assert.equal(++reads, 1);
        return mode.charCodeAt(0);
    };
    assert.equal(await handler_whatis_coord(), 0);
    assert.equal(game.iflags.getpos_coords, mode);
}
async function list(run, choice = 'm') {
    clearMessages(); newsym(x, y); seed();
    const panels = [], moves = game.moves;
    assert.equal(typeof moves, 'number');
    run._display.onEmptyQueue = () => {
        panels.push(rows(run));
        assert.ok(panels.length <= 12, 'bounded real menu/page reads');
        return panels.length === 1 ? choice.charCodeAt(0) : 32;
    };
    assert.equal(await do_look(0), ECMD_OK);
    assert.equal(game.moves, moves, 'inspection consumes no game turn');
    assert.deepEqual(getRngLog(), [], 'sober listing introduces no gameplay RNG');
    return {panels, text:panels.slice(1).flat().join('\n')};
}
async function ring(type) {
    const obj = mksobj(type, false, false);
    await addinv(obj); await setworn(obj, W_RINGL); await Ring_on(obj);
    assert.equal(game.u.uleft, obj);
    return obj;
}
async function monster(id = PMNAMES.PM_HILL_ORC, xx = x + 1, yy = y, extra = 0) {
    const mon = await makemon(game.mons[id], xx, yy, flags | extra);
    assert.ok(mon); newsym(xx, yy);
    return mon;
}

for (const [mode, header, prefix] of [
    ['n', '<31,10>', ' <32,10>  I  '],
    ['m', '<31,10>', ' <32,10>  I  '],
    ['s', '[12,31]', '[12,32]  I  '],
    ['c', 'you', '      (east)  I  '],
    ['f', '(here)', '      (east)  I  '],
]) test(`option ${mode}: header and invisible row use the C coordinate mode`, async () => {
    const run = await setup(); await option(run, mode); map_invisible(x + 1, y);
    const result = await list(run);
    assert.ok(result.text.includes(`Monsters currently shown near ${header}:`));
    assert.ok(result.text.includes(prefix + invisible));
});

test('map rows align one-digit and two-digit y values', async () => {
    const run = await setup(); await option(run, 'm');
    map_invisible(x + 1, y - 1); map_invisible(x + 1, y);
    const result = await list(run);
    assert.ok(result.text.includes(' <32,9>   I  ' + invisible));
    assert.ok(result.text.includes(' <32,10>  I  ' + invisible));
    assert.ok(result.text.indexOf('<32,9>') < result.text.indexOf('<32,10>'));
});
test('screen rows use row offset and zero padding without map spacer', async () => {
    const run = await setup(); await option(run, 's'); map_invisible(5, 7);
    const result = await list(run, 'M');
    assert.ok(result.text.includes('[09,05]  I  ' + invisible));
});
test('full compass retains long coordinate text and near header here', async () => {
    const run = await setup(); await option(run, 'f'); map_invisible(x + 3, y - 2);
    const result = await list(run);
    assert.ok(result.text.includes('Monsters currently shown near (here):'));
    assert.ok(result.text.includes('(2north,3east)  I  ' + invisible));
});
test('invisible hero uses your position in compact compass header', async () => {
    const run = await setup(); await option(run, 'c'); await ring(ONAMES.RIN_INVISIBILITY);
    assert.equal(Invis(), true); assert.equal(canspotself(), false);
    map_invisible(x + 1, y);
    const result = await list(run);
    assert.ok(result.text.includes('Monsters currently shown near your position:'));
    assert.ok(!result.text.includes('called wizard'));
});
test('visible hero uses real self description in compact compass', async () => {
    const run = await setup(); await option(run, 'c');
    const result = await list(run);
    assert.ok(result.text.includes('Monsters currently shown near you:'));
    assert.ok(result.text.includes('      (here)  @  human wizard called wizard'));
});
test('nearby rectangular boundary includes BOLT_LIM and excludes the next column', async () => {
    const run = await setup(); assert.equal(BOLT_LIM, 8);
    map_invisible(x + BOLT_LIM, y); map_invisible(x + BOLT_LIM + 1, y);
    const result = await list(run);
    assert.ok(result.text.includes('<39,10>')); assert.ok(!result.text.includes('<40,10>'));
});
test('global monster list includes both map corners and far remembered marker', async () => {
    const run = await setup();
    map_invisible(1, 0); map_invisible(79, 20); map_invisible(x + 9, y);
    const result = await list(run, 'M');
    assert.ok(result.text.includes('All monsters currently shown on the map:'));
    for (const coord of ['<1,0>', '<40,10>', '<79,20>']) assert.ok(result.text.includes(coord));
});
test('multiple real text pages are all awaited before the public caller returns', async () => {
    const run = await setup(); const coords = [];
    for (let yy = y - 3; yy <= y - 1; yy++) for (let xx = x - 4; xx <= x + 4; xx++) {
        map_invisible(xx, yy); coords.push(`<${xx},${yy}>`);
    }
    const result = await list(run);
    assert.ok(result.panels.length >= 3, 'menu plus multiple text pages');
    for (const coord of coords) assert.ok(result.text.includes(coord), coord);
});
test('worn warning ring creates a warning glyph for an unseen hostile dragon', async () => {
    const run = await setup(); await ring(ONAMES.RIN_WARNING);
    const mon = await monster(PMNAMES.PM_RED_DRAGON, x + 1, y, MM_ANGRY);
    mon_set_minvis(mon, false); newsym(mon.mx, mon.my);
    assert.equal(mon_warning(mon), true); assert.equal(glyph_at(mon.mx, mon.my).kind, 'warn');
    assert.equal(glyph_at(mon.mx, mon.my).wl, 3);
    const result = await list(run);
    assert.ok(result.text.includes('3  unknown creature causing you disquiet'));
    assert.ok(!result.text.includes('red dragon'));
});
test('visible hostile dragon is described as a monster rather than a warning', async () => {
    const run = await setup(); await ring(ONAMES.RIN_WARNING);
    const mon = await monster(PMNAMES.PM_RED_DRAGON, x + 1, y, MM_ANGRY);
    assert.equal(glyph_at(mon.mx, mon.my).kind, 'mon');
    const result = await list(run);
    assert.ok(result.text.includes('red dragon')); assert.ok(!result.text.includes('causing you'));
});
test('remembered invisible marker describes memory even without a live monster', async () => {
    const run = await setup(); map_invisible(x + 1, y);
    assert.equal(game.level.monAt.size, 0);
    const result = await list(run);
    assert.ok(result.text.includes(invisible));
});
test('invisible memory does not reveal a living unseen monster identity', async () => {
    const run = await setup(); const mon = await monster(); mon_set_minvis(mon, false);
    map_invisible(mon.mx, mon.my);
    const result = await list(run);
    assert.ok(result.text.includes(invisible)); assert.ok(!result.text.includes('hill orc'));
});
test('detected monster list preserves NULL monbuf, omitting the seen suffix', async () => {
    const run = await setup(); await monster();
    const potion = mksobj(ONAMES.POT_MONSTER_DETECTION, false, false); potion.blessed = true;
    await peffects(potion); assert.ok(game.u.intrinsic.HDetect_monsters > 0);
    const result = await list(run);
    assert.ok(result.text.includes('hill orc')); assert.ok(!result.text.includes('[seen:'));
});
test('object list uses canonical full-compass coordinates and actual floor item', async () => {
    const run = await setup(); await option(run, 'f');
    const obj = mksobj_at(ONAMES.ROCK, x + 1, y, false, false); newsym(obj.ox, obj.oy);
    assert.equal(glyph_at(obj.ox, obj.oy).kind, 'obj');
    const result = await list(run, 'o');
    assert.ok(result.text.includes('Objects currently shown near (here):'));
    assert.ok(result.text.includes('      (east)  *  a rock'));
    assert.ok(!result.text.includes('called wizard'));
});
test('monster list excludes a real floor object', async () => {
    const run = await setup(); const obj = mksobj_at(ONAMES.ROCK, x + 1, y, false, false);
    newsym(obj.ox, obj.oy); const result = await list(run);
    assert.ok(!result.text.includes('a rock'));
});
test('empty object list ignores invisible and warning markers and reports no objects', async () => {
    const run = await setup(); await ring(ONAMES.RIN_WARNING);
    const mon = await monster(PMNAMES.PM_RED_DRAGON, x + 1, y, MM_ANGRY);
    mon_set_minvis(mon, false); newsym(mon.mx, mon.my); map_invisible(x - 1, y);
    const result = await list(run, 'o');
    assert.equal(result.panels.length, 1);
    assert.match(messages(), /No objects are currently shown nearby\./);
});
test('empty monster list with invisible hero reports no monsters without a text wait', async () => {
    const run = await setup(); await ring(ONAMES.RIN_INVISIBILITY);
    const result = await list(run);
    assert.equal(result.panels.length, 1);
    assert.match(messages(), /No monsters are currently shown nearby\./);
});
test('sober look menu retains all four list choices and cancel returns', async () => {
    const run = await setup(); let panel;
    run._display.onEmptyQueue = () => {panel = rows(run).join('\n'); return 27;};
    assert.equal(await do_look(0), ECMD_OK);
    for (const label of ['m - nearby monsters','M - all monsters shown on map',
        'o - nearby objects','O - all objects shown on map']) assert.ok(panel.includes(label));
});
test('hallucination producer suppresses list choices but retains map and inventory', async () => {
    const run = await setup(); await make_hallucinated(100, false, 0); clearMessages();
    assert.equal(Hallucination(), true); let panel;
    run._display.onEmptyQueue = () => {panel = rows(run).join('\n'); return 27;};
    assert.equal(await do_look(0), ECMD_OK);
    assert.ok(panel.includes('/ - something on the map'));
    assert.ok(panel.includes("i - something you're carrying"));
    for (const label of ['nearby monsters','all monsters','nearby objects','all objects'])
        assert.ok(!panel.includes(label));
});
