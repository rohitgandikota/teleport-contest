// Constructed states through real domove and terrain/object producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, x, y, seed} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {domove} from '../js/cmd.js';
import {set_levltyp} from '../js/mkmaze.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {near_capacity} from '../js/attrib.js';
import {getRngLog} from '../js/rng.js';
import {ONAMES} from '../js/objects_data.js';
import {STONE, OVERLOADED} from '../js/const.js';

async function start() {
    await setup();
    game.bhitpos = {x: 2, y: 2};
    game.u.dx = 1; game.u.dy = 0;
    game.context.run = 0; game.context.travel = 0;
    game.context.forcefight = false;
    seed(2);
}

test('ordinary movement records the selected destination', async () => {
    await start();
    await domove();
    assert.deepEqual([game.u.ux,game.u.uy],[x+1,y]);
    assert.deepEqual([game.u.ux0,game.u.uy0],[x,y]);
    assert.deepEqual(game.bhitpos,{x:x+1,y});
});

test('blocked terrain retains the attempted destination', async () => {
    await start();
    assert.equal(set_levltyp(x+1,y,STONE),true);
    await domove();
    assert.deepEqual([game.u.ux,game.u.uy],[x,y]);
    assert.deepEqual(game.bhitpos,{x:x+1,y});
    assert.deepEqual(getRngLog(),[]);
});

test('an empty forced attack records its square without moving', async () => {
    await start();
    game.context.forcefight = true;
    await domove();
    assert.deepEqual([game.u.ux,game.u.uy],[x,y]);
    assert.deepEqual(game.bhitpos,{x:x+1,y});
});

test('overloaded rejection occurs before the destination write', async () => {
    await start();
    for(let i=0;i<5;i++)await addinv(mksobj(ONAMES.CHEST,false,false));
    assert.equal(near_capacity(),OVERLOADED);
    seed(2);
    await domove();
    assert.deepEqual([game.u.ux,game.u.uy],[x,y]);
    assert.deepEqual(game.bhitpos,{x:2,y:2});
    assert.deepEqual(getRngLog(),[]);
});
