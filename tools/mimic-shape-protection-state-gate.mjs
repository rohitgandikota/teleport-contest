// C makemon.c:2401: protection skips disguise selection before any draw.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { makemon, set_mimic_sym } from '../js/makemon.js';
import { seemimic } from '../js/mon.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { Protection_from_shape_changers } from '../js/youprop.js';
import { ROOM, NO_MINVENT, MM_NOGRP, MM_NOWAIT, W_RINGL, FROMOUTSIDE,
    M_AP_NOTHING, M_AP_OBJECT } from '../js/const.js';
for (const mode of ['null', 'unprotected', 'extrinsic', 'intrinsic', 'protected prior disguise']) {
    test(mode, async () => {
        await runSegment({seed:6202,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),
            nethackrc:'OPTIONS=role:Barbarian,race:human,gender:male,align:neutral,playmode:debug\n'
                +'OPTIONS=!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
        game.level.monsters=[];game.level.monAt.clear();
        Object.assign(game.level.at(35,10),{typ:ROOM,roomno:0});
        const mon=await makemon(game.mons[PMNAMES.PM_SMALL_MIMIC],35,10,NO_MINVENT|MM_NOGRP|MM_NOWAIT);
        seemimic(mon);
        await place_object(mksobj(ONAMES.DAGGER,false,false),35,10);
        game.u.uprops.PROT_FROM_SHAPE_CHANGERS=mode==='extrinsic'?W_RINGL:0;
        game.u.intrinsic.HProtection_from_shape_changers=
            ['intrinsic','protected prior disguise'].includes(mode)?FROMOUTSIDE:0;
        if(mode==='protected prior disguise') {mon.m_ap_type=M_AP_OBJECT;mon.mappearance=ONAMES.CHEST;}
        const before=[mon.m_ap_type,mon.mappearance];
        initRng(6202);enableRngLog();
        assert.equal(set_mimic_sym(mode==='null'?null:mon),undefined);
        assert.deepEqual(getRngLog(),[],'existing-object choice or early guard spends no gameplay RNG');
        if(mode==='unprotected') {
            assert.equal(Protection_from_shape_changers(),false);
            assert.deepEqual([mon.m_ap_type,mon.mappearance],[M_AP_OBJECT,ONAMES.DAGGER]);
        } else {
            if(mode!=='null') assert.equal(Protection_from_shape_changers(),true);
            assert.deepEqual([mon.m_ap_type,mon.mappearance],before,'early return leaves disguise untouched');
            if(mode!=='protected prior disguise') assert.equal(mon.m_ap_type,M_AP_NOTHING);
        }
    });
}
