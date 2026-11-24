// Constructed source controls through real guard, terrain, status and gold producers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {gd_move} from '../js/vault.js';
import {teleds} from '../js/teleport.js';
import {readobjnam} from '../js/objnam.js';
import {make_blinded} from '../js/potion.js';
import {litroom} from '../js/read.js';
import {money_cnt} from '../js/invent.js';
import {mkgold} from '../js/mkobj.js';
import {cansee, vision_recalc} from '../js/vision.js';
import {Passes_walls} from '../js/youprop.js';
import {resetInputState} from '../js/input.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {CORR, DOOR, STONE, POOL, THRONE, IS_WALL, OBJ_MINVENT, W_NONDIGGABLE} from '../js/const.js';
const parts = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-corridor-destination.json', import.meta.url))).segments;
const xy = m => [m.mx, m.my];
async function setup(index = 0, drop = true) {
    const part = parts[index];
    const moves = part.moves.slice(0, part.moves.indexOf('d$')) + (drop ? 'd$' : '');
    const run = await runSegment({...part, moves, storage: new InMemoryStorage()});
    game._preNhgetchHook = null; resetInputState();
    let reads = 0;
    run._display.onEmptyQueue = async () => {
        assert.ok(++reads < 40, 'bounded real prompt reads');
        await setImmediate(); return 32;
    };
    const guard = game.level.monsters.find(m => m.isgd);
    assert.deepEqual(xy(guard), [25, 5]); assert.equal(guard.mextra.egd.fcend, 1);
    assert.equal(guard.mpeaceful, 1); assert.equal(Passes_walls(), false);
    assert.equal(money_cnt(game.invent), drop ? 0 : 500);
    return guard;
}
async function terrainAt(x, y, wish) {
    await teleds(x, y, 0);
    await readobjnam(wish, null);
}
async function carve(guard, expected, original) {
    await teleds(24, 5, 0); vision_recalc(0);
    initRng(401); enableRngLog();
    assert.equal(await gd_move(guard), 1);
    assert.deepEqual(xy(guard), [26, 5]);
    assert.equal(game.level.at(26, 5).typ, expected);
    assert.equal(game.level.at(26, 5).flags, 0);
    assert.equal(game.level.at(26, 5).doormask, 0);
    if (expected === CORR) {
        for (const field of ['flags', 'doormask', 'wall_info', 'altarmask',
            'looted', 'icedpool', 'drawbridgemask', 'ladder', 'emptygrave'])
            assert.equal(game.level.at(26, 5)[field] ?? 0, 0, field);
    }
    assert.equal(guard.mextra.egd.fcend, 2);
    assert.deepEqual(guard.mextra.egd.fakecorr[1],
        {fx: 26, fy: 5, ftyp: original, flags: 0, doormask: 0});
    assert.deepEqual(getRngLog(), []);
    assert.equal(game.level.monAt.get('26,5'), guard);
    assert.equal(guard.mpeaceful, 1);
}
await test('terminal wall becomes corridor after both directional attempts', async () => {
    const guard = await setup(), old = game.level.at(26, 5).typ;
    assert.ok(IS_WALL(old));
    await carve(guard, CORR, old);
});
await test('terminal pool follows the same unconditional corridor arm', async () => {
    const guard = await setup(); await terrainAt(26, 5, 'pool');
    assert.equal(game.level.at(26, 5).typ, POOL);
    await carve(guard, CORR, POOL);
});
await test('existing closed door is not confused with a door opened by this function', async () => {
    const guard = await setup(); await terrainAt(26, 5, 'closed door');
    assert.equal(game.level.at(26, 5).typ, DOOR);
    await carve(guard, CORR, DOOR);
});
await test('stone keeps the existing corridor outcome', async () => {
    const guard = await setup(1); assert.equal(game.level.at(26, 5).typ, STONE);
    await carve(guard, CORR, STONE);
});
await test('room-like terrain keeps the final door-opening branch', async () => {
    const guard = await setup(2); assert.equal(game.level.at(26, 5).typ, THRONE);
    await carve(guard, DOOR, THRONE);
});
await test('wall with room-like terrain two squares ahead becomes a doorway', async () => {
    const guard = await setup(), old = game.level.at(26, 5).typ;
    await terrainAt(27, 5, 'throne');
    await carve(guard, DOOR, old);
});
await test('pool with room-like terrain two squares ahead also becomes a doorway', async () => {
    const guard = await setup(); await terrainAt(27, 5, 'throne');
    await terrainAt(26, 5, 'pool');
    await carve(guard, DOOR, POOL);
});
await test('a distant hero in the vault stays in the warning arm before corridor carving', async () => {
    const guard = await setup(), old = game.level.at(26, 5).typ;
    initRng(401); enableRngLog();
    assert.equal(await gd_move(guard), 0);
    assert.deepEqual(xy(guard), [25, 5]); assert.equal(game.level.at(26, 5).typ, old);
    assert.equal(guard.mextra.egd.fcend, 1); assert.equal(guard.mextra.egd.warncnt, 2);
    // fcend==1 while the hero remains in the vault returns before rn2(10).
    assert.deepEqual(getRngLog(), []);
});
await test('carried gold preserves the pre-carving warning gate', async () => {
    const guard = await setup(0, false), old = game.level.at(26, 5).typ;
    await teleds(24, 5, 0); const warn = guard.mextra.egd.warncnt;
    initRng(401); enableRngLog();
    assert.equal(await gd_move(guard), 0); assert.equal(guard.mextra.egd.warncnt, warn + 1);
    assert.equal(game.level.at(26, 5).typ, old); assert.deepEqual(xy(guard), [25, 5]);
    assert.equal(money_cnt(game.invent), 500); assert.deepEqual(getRngLog(), []);
});
await test('real blindness changes visibility but not the terrain operation', async () => {
    const guard = await setup(), old = game.level.at(26, 5).typ;
    await make_blinded(100, false); assert.equal(cansee(26, 5), false);
    await carve(guard, CORR, old);
});
await test('gold on the newly carved square uses the separate gold dependency', async () => {
    const guard = await setup(), old = game.level.at(26, 5).typ;
    await teleds(24, 5, 0); await litroom(true, null); vision_recalc(0);
    assert.ok(cansee(26, 5));
    const gold = mkgold(50, 26, 5); await carve(guard, CORR, old);
    assert.equal(gold.where, OBJ_MINVENT); assert.equal(gold.ocarry, guard);
    assert.equal(money_cnt(guard.minvent), 50); assert.equal(game.level.objectAt(26, 5), null);
    assert.ok(game._toplines.includes('The guard picks up some gold.'));
});
await test('carving clears wall flags before the original wall type is later restored', async () => {
    const guard = await setup(); await terrainAt(26, 5, 'undiggable wall');
    const old = game.level.at(26, 5).typ;
    assert.ok(game.level.at(26, 5).wall_info & W_NONDIGGABLE);
    await carve(guard, CORR, old); assert.equal(game.level.at(26, 5).wall_info, 0);
    await teleds(25, 5, 0); assert.equal(await gd_move(guard), 1);
    await teleds(28, 18, 0); assert.equal(await gd_move(guard), 0);
    assert.equal(game.level.at(26, 5).typ, old); assert.equal(game.level.at(26, 5).wall_info, 0);
});
await test('real corridor cleanup restores the recorded wall after the hero leaves sight', async () => {
    const guard = await setup(), old = game.level.at(26, 5).typ;
    await carve(guard, CORR, old);
    await teleds(25, 5, 0); assert.equal(await gd_move(guard), 1);
    await teleds(28, 18, 0); assert.equal(await gd_move(guard), 0);
    assert.equal(game.level.at(26, 5).typ, old);
    assert.ok(guard.mextra.egd.fcbeg >= 2);
});
