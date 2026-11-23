// Source-derived feature contracts from invent.c:dfeature_at and pickup.c.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { dfeature_at, look_here, obj_extract_self } from '../js/invent.js';
import { describe_decor } from '../js/pickup.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { TOPLINE_EMPTY } from '../js/display.js';
import { ROOM, STONE, DOOR, DBWALL, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN,
    D_NODOOR, D_ISOPEN, D_BROKEN, D_CLOSED,
    DB_WEST, DB_EAST, DB_SOUTH, DB_NORTH } from '../js/const.js';

const x = 35, y = 10;
async function setup() {
    const run = await runSegment({ seed: 7101, datetime: '20000110090000', moves: ' ',
        storage: new InMemoryStorage(),
        nethackrc: 'OPTIONS=role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' });
    run._display.onEmptyQueue = () => 32;
    game._preNhgetchHook = null;
    game.level.monsters = [];
    game.level.monAt.clear();
    game.level.traps = [];
    for (const object of [...game.level.objects]) await obj_extract_self(object);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
        Object.assign(game.level.at(x + dx, y + dy), { typ: ROOM, drawbridgemask: 0 });
    Object.assign(game.u, { ux: x, uy: y, uinwater: 0, utrap: 0, uswallow: false,
        ustuck: null, usteed: null, uprops: {}, intrinsic: {}, blocked: {} });
    Object.assign(game.flags, { mention_decor: true, verbose: true });
    Object.assign(game.iflags, { prev_decor: STONE, defer_decor: false });
    Object.assign(game, { _toplin: TOPLINE_EMPTY, _toplines: '', _prevmsg: '',
        _pending_message: '', _msg_history: [], _msg_maxrow: 0, _msg_maxcol: 0,
        _win_stop: false });
    initRng(7101); enableRngLog();
}
const directions = [[1, 0, DB_WEST], [-1, 0, DB_EAST],
    [0, -1, DB_SOUTH], [0, 1, DB_NORTH]];
for (const [dx, dy, direction] of directions)
    test(`portcullis feature uses the bridge facing ${direction}`, async () => {
        await setup();
        for (const span of [DRAWBRIDGE_UP, DRAWBRIDGE_DOWN])
            for (const mask of [D_NODOOR, D_ISOPEN, D_BROKEN, D_CLOSED]) {
                Object.assign(game.level.at(x, y), { typ: DOOR, doormask: mask });
                Object.assign(game.level.at(x + dx, y + dy), { typ: span, drawbridgemask: direction });
                assert.equal(dfeature_at(x, y), 'open drawbridge portcullis');
            }
        assert.deepEqual(getRngLog(), []);
    });
test('ordinary doors retain their descriptions beside an unrelated bridge', async () => {
    await setup();
    Object.assign(game.level.at(x + 1, y), { typ: DRAWBRIDGE_DOWN, drawbridgemask: DB_EAST });
    for (const [mask, name] of [[D_NODOOR, 'doorway'], [D_ISOPEN, 'open door'],
        [D_BROKEN, 'broken door'], [D_CLOSED, 'closed door']]) {
        Object.assign(game.level.at(x, y), { typ: DOOR, doormask: mask });
        assert.equal(dfeature_at(x, y), name);
    }
    assert.deepEqual(getRngLog(), []);
});
test('raised portcullis and lowered span have separate descriptions', async () => {
    await setup();
    game.level.at(x, y).typ = DBWALL;
    assert.equal(dfeature_at(x, y), 'raised drawbridge');
    game.level.at(x, y).typ = DRAWBRIDGE_DOWN;
    assert.equal(dfeature_at(x, y), 'lowered drawbridge');
    assert.deepEqual(getRngLog(), []);
});
for (const command of ['look_here', 'describe_decor'])
    test(`${command} describes a portcullis as a feature`, async () => {
        await setup();
        Object.assign(game.level.at(x, y), { typ: DOOR, doormask: D_NODOOR });
        Object.assign(game.level.at(x - 1, y), { typ: DRAWBRIDGE_DOWN, drawbridgemask: DB_EAST });
        if (command === 'look_here') await look_here(0, 0);
        else await describe_decor();
        assert.match([...game._msg_history, game._toplines, game._prevmsg].join('\n'),
            /There is an open drawbridge portcullis here\./);
        assert.deepEqual(getRngLog(), []);
    });
