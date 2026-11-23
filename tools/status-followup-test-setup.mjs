// Test fixtures use actual status, terrain, form and mount producers.
import assert from 'node:assert/strict';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {set_uasmon} from '../js/polyself.js';
import {set_levltyp} from '../js/mkmaze.js';
import {obj_extract_self} from '../js/invent.js';
import {resetInputState} from '../js/input.js';
import {vision_reset, vision_recalc} from '../js/vision.js';
import {initRng, enableRngLog} from '../js/rng.js';
import {makemon} from '../js/makemon.js';
import {tamedog} from '../js/dog.js';
import {put_saddle_on_mon, mount_steed} from '../js/steed.js';
import {mksobj} from '../js/mkobj.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {ROOM, NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG} from '../js/const.js';

export const x = 31, y = 10;
export function clearMessages() {
    game._toplines = ''; game._msg_history = []; game._toplin = 0;
    game._pending_message = ''; game._win_stop = false;
    game.iflags.last_msg = 0;
}
export const messages = () => [...game._msg_history, game._toplines].join('\n');
export function seed(value = 2) { initRng(value); enableRngLog(); }
export function form(id) { game.u.umonnum = id; set_uasmon(); }
export async function setup() {
    const run = await runSegment({seed:99812, datetime:'20000110090000', moves:' ',
        storage:new InMemoryStorage(),
        nethackrc:'OPTIONS=name:Desired,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
    let reads = 0;
    run._display.onEmptyQueue = () => {
        if (++reads > 30) throw Error('unexpected repeated prompt');
        return 32;
    };
    game._preNhgetchHook = null; resetInputState();
    game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) await obj_extract_self(obj);
    game.level.traps = []; game.regions = []; game.timer_base = [];
    Object.assign(game.u, {ux:x, uy:y, dx:0, dy:0, utrap:0, uswallow:false,
        ustuck:null, usteed:null, usleep:0, mtimedone:0, usptime:0});
    game.multi = 0;
    for (let xx = x - 4; xx <= x + 4; xx++) for (let yy = y - 4; yy <= y + 4; yy++) {
        assert.equal(set_levltyp(xx, yy, ROOM), true);
        Object.assign(game.level.at(xx, yy), {lit:1, waslit:1, seenv:255, roomno:0});
    }
    vision_reset(); vision_recalc();
    clearMessages(); seed();
    return run;
}
export async function mount() {
    const pony = await makemon(game.mons[PMNAMES.PM_PONY], x + 1, y,
        NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG);
    assert.ok(pony && await tamedog(pony, null, false));
    put_saddle_on_mon(mksobj(ONAMES.SADDLE, false, false), pony);
    assert.equal(await mount_steed(pony, true), true);
    assert.equal(game.u.usteed, pony);
    clearMessages(); seed();
}
