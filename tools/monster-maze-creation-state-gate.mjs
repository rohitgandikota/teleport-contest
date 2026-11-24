// src/mkmaze.c:1097-1124: monsters, gold, then traps, each maker complete.
// Exercise private populate_maze through its real public caller, makemaz.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { GameMap } from '../js/game.js';
import { makemaz } from '../js/mkmaze.js';
import { create_des_coder, reset_xystart_size } from '../js/sp_lev.js';
import { TOPLINE_EMPTY } from '../js/display.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { G_GENOD, STATUE_TRAP } from '../js/const.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

test('random maze finishes monsters before gold and awaits a statue before later traps', async () => {
    const run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game._toplin = TOPLINE_EMPTY; game._toplines = game._pending_message = '';
    game.level = new GameMap(); game.level.flags.rndmongen = true;
    game.in_mklev = true; game.in_mk_themerooms = false;
    game.coder = null; create_des_coder(); reset_xystart_size();
    game.stairs = null; game.exclusion_zones = [];
    game.u.ulevel = 10; game.u.uz.dlevel = 10;
    game.flags.monpolycontrol = true;
    // Constrain the actual random reservoir. No maker, trap or RNG is replaced.
    for (const [index, vital] of game.mvitals.entries())
        if (index !== P.PM_CHAMELEON) vital.mvflags |= G_GENOD;
    // This seed reaches a real statue trap after the ordinary monster loop.
    initRng(7); enableRngLog();
    let signal, keys = [], monsterPrompts = 0;
    const waiting = new Promise(resolve => { signal = resolve; });
    run._display.onEmptyQueue = () => {
        if (!keys.length) {
            assert.match(game._toplines, /^Change the chameleon @ .* into what\? /);
            if (game.level.objects.some(o => o.otyp === O.STATUE)) {
                signal();
                return undefined;
            }
            ++monsterPrompts;
            assert.equal(game.level.monsters.length, monsterPrompts, 'no later monster starts early');
            assert.equal(game.level.objects.filter(o => o.otyp === O.GOLD_PIECE).length, 0);
            assert.equal(game.level.traps.length, 0);
            keys = [...'chameleon\r'];
        }
        return keys.shift().charCodeAt(0);
    };
    const creation = makemaz('');
    assert.ok(creation instanceof Promise);
    await Promise.race([waiting, creation.then(() => {
        throw new Error('Maze completed before the real statue selection');
    })]);
    assert.ok(monsterPrompts >= 7 && monsterPrompts <= 11, 'C rn1(5, 7) monster count');
    const gold = game.level.objects.filter(o => o.otyp === O.GOLD_PIECE);
    assert.ok(gold.length >= 7 && gold.length <= 12, 'gold loop precedes traps');
    const statue = game.level.objects.find(o => o.otyp === O.STATUE);
    assert.equal(statue.corpsenm, P.PM_CHAMELEON);
    const temporary = game.level.monsters[0];
    assert.ok(temporary.mhp > 0);
    assert.equal(game.level.monsters.length, monsterPrompts + 1);
    const trapsBefore = game.level.traps.length, drawsBefore = getRngLog().length;
    assert.ok(trapsBefore > 0);
    assert.ok(!game.level.traps.some(t => t.ttyp === STATUE_TRAP));
    await Promise.resolve();
    assert.equal(getRngLog().length, drawsBefore, 'later traps cannot draw during the prompt');
    assert.equal(game.level.traps.length, trapsBefore);
    run._display.onEmptyQueue = () => { throw new Error('Unexpected extra input: ' + game._toplines); };
    for (const key of 'chameleon\r') run._display.pushKey(key.charCodeAt(0));
    assert.equal(await creation, true);
    assert.equal(temporary.mhp, 0, 'temporary monster is cleaned up before maze completion');
    assert.ok(![...game.level.monAt.values()].includes(temporary));
    assert.equal(game.level.monsters.filter(m => m.mhp > 0).length, monsterPrompts);
    assert.ok(game.level.traps.some(t => t.ttyp === STATUE_TRAP
        && t.tx === statue.ox && t.ty === statue.oy));
    assert.ok(game.level.traps.length > trapsBefore + 1, 'trap loop resumes after the statue');
    assert.ok(getRngLog().length > drawsBefore);
});
