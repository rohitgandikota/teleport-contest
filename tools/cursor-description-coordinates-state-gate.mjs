// C getpos.c:640: real descriptions, coordinate formatting and message output.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {game} from '../js/gstate.js';
import {auto_describe,getpos_sethilite} from '../js/getpos.js';
import {getRngLog} from '../js/rng.js';
import {setup,clearMessages,seed} from './status-followup-test-setup.mjs';

for(const [mode,coords] of [['n',''],['c',' (2e)'],['f',' (2east)'],
    ['m',' <33,10>'],['s',' [12,33]']])
for(const validation of ['none','valid','invalid','disabled'])
test(`coordinates ${mode}, target validation ${validation}`,async()=>{
    await setup();
    // C display.c2573: exclude frame-paint validation from this coordinate fixture.
    game.iflags.bgcolors=false;
    game.iflags.getpos_coords=mode;
    game.iflags.autodescribe=validation!=='disabled';
    game.iflags.getloc_travelmode=false;
    let calls=0;
    await getpos_sethilite(null,validation==='none'?null:()=>{calls++;return validation==='valid';});
    calls=0;clearMessages();seed();
    await auto_describe(33,10);
    const expected='floor of a room'+coords+(validation==='invalid'?' (invalid target)':'');
    assert.equal(game._prevmsg,expected);
    assert.equal(game.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd(),expected);
    assert.equal(calls,validation==='none'||validation==='disabled'?0:1);
    assert.deepEqual(game._map_cursor,{col:32,row:11});
    assert.deepEqual(game._msg_history,[],'automatic descriptions suppress history');
    assert.deepEqual(getRngLog(),[]);
    await getpos_sethilite(null,null);
});
