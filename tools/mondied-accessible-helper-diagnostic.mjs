// Separate unchanged helper limitation, not a passing mondied owner gate.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {set_levltyp} from '../js/mkmaze.js';
import {accessible} from '../js/monmove.js';
import {db_under_typ} from '../js/dbridge.js';
import {DRAWBRIDGE_UP,DB_ICE,DB_MOAT,ICE,MOAT} from '../js/const.js';
// C monmove.c:2188-2194 and rm.h:146-149, with dbridge.c:116-129.
for(const [name,mask,terrain,expected] of [
    ['ice',DB_ICE,ICE,true],['moat',DB_MOAT,MOAT,false],
])await test(`accessible sees raised-drawbridge ${name} surface`,async()=>{
    await setup();
    assert.ok(set_levltyp(x+1,y,DRAWBRIDGE_UP));
    game.level.at(x+1,y).drawbridgemask=mask;
    assert.equal(db_under_typ(mask),terrain);
    assert.equal(accessible(x+1,y),expected);
});
