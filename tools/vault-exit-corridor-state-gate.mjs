// Constructed C contracts through a real escort and public runtime producers.
// These checks do not claim a native recording of the constructed variants.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {gd_move, vault_occupied} from '../js/vault.js';
import {teleds} from '../js/teleport.js';
import {readobjnam} from '../js/objnam.js';
import {make_blinded} from '../js/potion.js';
import {engr_at} from '../js/engrave.js';
import {dig_corridor} from '../js/mklev.js';
import {makemon} from '../js/makemon.js';
import {dmonsfree} from '../js/mon.js';
import {mkgold} from '../js/mkobj.js';
import {pline} from '../js/display.js';
import {money_cnt} from '../js/invent.js';
import {cansee, vision_recalc} from '../js/vision.js';
import {resetInputState} from '../js/input.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {CORR, SCORR, SDOOR, DOOR, D_NODOOR, D_LOCKED, D_TRAPPED,
    OBJ_FLOOR, MM_NOMSG} from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';

const part = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-exit-corridor.json', import.meta.url))).segments[0];
const xy = mon => [mon.mx, mon.my];
async function setup() {
    // Stop just before the third escort move chooses the outside-vault exit.
    const stop = part.moves.indexOf('d$lll') + 'd$ll'.length;
    assert.ok(stop > 4);
    const run = await runSegment({...part, moves: part.moves.slice(0, stop),
        storage: new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    const guard = game.level.monsters.find(mon => mon.isgd);
    assert.ok(guard);
    assert.deepEqual(xy(guard), [27, 5]);
    assert.equal(guard.mextra.egd.fcend, 3);
    assert.equal(guard.mextra.egd.gddone, 0);
    assert.equal(game.level.at(27, 4).typ, SDOOR);
    assert.ok(engr_at(27, 4));
    const prompts = [];
    run._display.onEmptyQueue = async () => {
        assert.ok(prompts.length < 30, 'bounded real message acknowledgments');
        prompts.push({message: game._toplines, xy: xy(guard),
            record: structuredClone(guard.mextra.egd), engraving: !!engr_at(27, 4)});
        await setImmediate();
        return 32;
    };
    await teleds(26, 5, 0);
    assert.equal(!!vault_occupied(game.u.urooms), false);
    vision_recalc(0);
    prompts.length = 0;
    return {guard, prompts};
}
async function changeExit(wish) {
    await teleds(27, 4, 0);
    await readobjnam(wish, null);
    await teleds(26, 5, 0);
    vision_recalc(0);
}
async function finish(guard, original, result, added = true) {
    initRng(401); enableRngLog();
    assert.equal(await gd_move(guard), 1);
    assert.deepEqual(xy(guard), [0, 0]);
    assert.equal(guard.mextra.egd.gddone, 1);
    assert.equal(guard.mextra.egd.fcend, added ? 4 : 3);
    assert.equal(game.level.at(27, 4).typ, result);
    if (added) {
        assert.deepEqual(guard.mextra.egd.fakecorr.at(-1),
            {fx: 27, fy: 4, ftyp: original, flags: 0, doormask: 0});
        assert.equal(engr_at(27, 4), null);
    }
    assert.equal(guard.mpeaceful, 1);
}

await test('secret-door exit records original terrain before the real disappearance prompt', async () => {
    const {guard, prompts} = await setup();
    await finish(guard, SDOOR, DOOR);
    assert.equal(game.level.at(27, 4).doormask, D_NODOOR);
    assert.deepEqual(getRngLog(), []);
    const prompt = prompts.find(p => p.message.includes('guard disappears'));
    assert.ok(prompt);
    assert.equal(prompt.record.fcend, 4); assert.equal(prompt.engraving, false);
    assert.deepEqual(prompt.xy, [0, 0]);
});
await test('generated secret corridor takes the distinct CORR conversion and records SCORR', async () => {
    const {guard} = await setup();
    const point = {x: 27, y: 4}, count = {v: 0};
    // The real level-generation helper owns this constructed terrain mutation.
    assert.equal(dig_corridor(point, point, count, false, SCORR, SDOOR), true);
    assert.equal(count.v, 1); assert.equal(game.level.at(27, 4).typ, SCORR);
    await finish(guard, SCORR, CORR);
    assert.equal(game.level.at(27, 4).flags, 0);
    assert.deepEqual(getRngLog(), []);
});
await test('trapped locked secret door saves converted flags, not its original lock and trap', async () => {
    const {guard} = await setup();
    await changeExit('trapped locked secret door');
    assert.equal(game.level.at(27, 4).typ, SDOOR);
    assert.equal(game.level.at(27, 4).doormask, D_LOCKED | D_TRAPPED);
    await finish(guard, SDOOR, DOOR);
    assert.equal(game.level.at(27, 4).doormask, D_NODOOR);
    assert.deepEqual(getRngLog(), []);
});
await test('accessible trapped locked door preserves its mask, engraving and record count', async () => {
    const {guard} = await setup();
    await changeExit('trapped locked door');
    const engraving = engr_at(27, 4), records = structuredClone(guard.mextra.egd.fakecorr);
    assert.ok(engraving);
    await finish(guard, DOOR, DOOR, false);
    assert.equal(game.level.at(27, 4).doormask, D_LOCKED | D_TRAPPED);
    assert.equal(engr_at(27, 4), engraving);
    assert.deepEqual(guard.mextra.egd.fakecorr, records);
    assert.deepEqual(getRngLog(), []);
});
await test('real blindness does not suppress exit ownership or engraving removal', async () => {
    const {guard} = await setup();
    await make_blinded(100, false);
    assert.equal(cansee(27, 4), false);
    await finish(guard, SDOOR, DOOR);
    assert.deepEqual(getRngLog(), []);
});
await test('completed exit skips movement and mpickgold, retaining real floor gold identity', async () => {
    const {guard} = await setup();
    const gold = mkgold(50, 27, 4), before = money_cnt(guard.minvent);
    await finish(guard, SDOOR, DOOR);
    assert.equal(gold.where, OBJ_FLOOR); assert.equal(game.level.objectAt(27, 4), gold);
    assert.equal(money_cnt(guard.minvent), before);
    assert.deepEqual(getRngLog(), []);
});
await test('real exit occupant is displaced after the restoration record and engraving change', async () => {
    const {guard, prompts} = await setup();
    const occupant = makemon(game.mons[PMNAMES.PM_XORN], 27, 4, MM_NOMSG);
    assert.ok(occupant); assert.deepEqual(xy(occupant), [27, 4]);
    // A real pending topline makes the guard's first verbalize await input.
    await pline('Waiting for the guard to displace the monster at the corridor exit.');
    await finish(guard, SDOOR, DOOR);
    assert.notDeepEqual(xy(occupant), [27, 4]);
    const prompt = prompts.find(p => p.message.includes('Waiting for the guard to displace'));
    assert.ok(prompt); assert.equal(prompt.record.fcend, 4);
    assert.equal(prompt.engraving, false); assert.deepEqual(prompt.xy, [27, 5]);
});
await test('real cleanup restores the converted square when the hero leaves its recorded corridor', async () => {
    const {guard} = await setup();
    await finish(guard, SDOOR, DOOR);
    await teleds(23, 5, 0);
    await gd_move(guard);
    assert.equal(game.level.at(27, 4).typ, SDOOR);
    assert.equal(engr_at(27, 4), null);
    assert.equal(guard.isgd, 0); assert.equal(guard.mhp, 0);
    // mongone detaches immediately; the normal monster-loop sweep frees it.
    dmonsfree();
    assert.equal(game.level.monsters.includes(guard), false);
});
