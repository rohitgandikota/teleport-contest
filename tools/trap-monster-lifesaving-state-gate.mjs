// Separate pre-existing mondied contract, through real trap/equipment helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup,seed,clearMessages,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mksobj} from '../js/mkobj.js';
import {mpickobj} from '../js/steal.js';
import {m_dowear} from '../js/worn.js';
import {mlifesaver} from '../js/mon.js';
import {maketrap} from '../js/mklev.js';
import {mintrap,Trap_Effect_Finished,Trap_Killed_Mon} from '../js/trap.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import * as C from '../js/const.js';

for(const worn of [false,true])test(`lethal falling rock, life-saving amulet ${worn?'worn':'carried'}`,async()=>{
    await setup();
    const mon=await makemon(game.mons[P.PM_TROLL],x+1,y,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    const amulet=mksobj(O.AMULET_OF_LIFE_SAVING,false,false);
    await mpickobj(mon,amulet);
    if(worn)await m_dowear(mon,true);
    assert.equal(mlifesaver(mon),worn?amulet:null);
    const trap=await maketrap(mon.mx,mon.my,C.ROCKTRAP);
    trap.madeby_u=0;
    mon.mhp=1;
    const deaths=game.mvitals[P.PM_TROLL].died||0;
    clearMessages();seed(2);
    assert.equal(await mintrap(mon,C.FORCETRAP),worn?Trap_Effect_Finished:Trap_Killed_Mon);
    assert.equal(mon.mhp>0,worn);
    assert.equal(game.level.monsters.includes(mon),worn);
    const corpses=game.level.objectsAt(mon.mx,mon.my).filter(o=>o.otyp===O.CORPSE);
    assert.equal(corpses.length,worn?0:1,'life-saved monster has no remains');
    assert.equal(game.mvitals[P.PM_TROLL].died||0,deaths+(worn?0:1));
    if(worn) {
        assert.equal(mlifesaver(mon),null);
        assert.ok(!mon.minvent.includes(amulet));
        assert.equal(mon.mhp,mon.mhpmax);
    }
});
