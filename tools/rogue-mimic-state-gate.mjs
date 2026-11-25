// C makemon.c:2393-2550. Real level, monster, terrain and object producers.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES, MONSYMS} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {makemon, set_mimic_sym} from '../js/makemon.js';
import {seemimic} from '../js/mon.js';
import {mksobj, place_object} from '../js/mkobj.js';
import {obj_extract_self} from '../js/invent.js';
import {set_levltyp} from '../js/mkmaze.js';
import {vision_reset, vision_recalc, does_block, clear_path} from '../js/vision.js';
import {is_door_mappear, is_lightblocker_mappear} from '../js/monst.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';

assert.ok(process.argv.length <= 3);
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/rogue-mimic-wall.json', import.meta.url)));
const base = recipe.segments[0], x = 33, y = 10, results = [];
const limit = setTimeout(() => { console.error('45 second source limit'); process.exit(2); }, 45000);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function fresh(rogue) {
    const run = await runSegment({...base, moves:rogue ? ' \x16the rogue level\r   ' : ' ', storage:new InMemoryStorage()});
    assert.equal(!!C.Is_rogue_level(game.u.uz), rogue);
    game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) await obj_extract_self(obj);
    for (let xx=x-2; xx<=x+2; xx++) for (let yy=y-2; yy<=y+2; yy++) {
        set_levltyp(xx,yy,C.ROOM);
        Object.assign(game.level.at(xx,yy), {roomno:0,lit:1,waslit:1,seenv:255});
    }
    Object.assign(game.u,{ux:x-1,uy:y});
    let reads=0; run._display.onEmptyQueue=()=>{assert.ok(++reads<20);return 32;};
    game._preNhgetchHook=null;
    const mon=await makemon(game.mons[PMNAMES.PM_SMALL_MIMIC],x,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(mon && mon.mx===x && mon.my===y);
    await seemimic(mon);
    return mon;
}
function terrain(xx,typ) {
    set_levltyp(xx,y,typ);
    Object.assign(game.level.at(xx,y),{roomno:0,doormask:C.D_ISOPEN,lit:1,waslit:1,seenv:255});
}
function reset() { vision_reset(); vision_recalc(); initRng(2); enableRngLog(); }
async function check(name,fn) {
    const row={name};
    try { row.state=await fn(); row.pass=true; }
    catch(error) { row.pass=false; row.error=error.message; process.exitCode=1; }
    results.push(row); console.log(`${row.pass?'PASS':'FAIL'} ${name}`);
}
async function wall(rogue,left,target,horizontal) {
    const mon=await fresh(rogue); terrain(x,target); terrain(x-1,left);
    mon.mcorpsenm=PMNAMES.PM_GNOME; reset(); set_mimic_sym(mon);
    const expected=rogue ? (horizontal?MONSYMS.S_hwall:MONSYMS.S_vwall)
        : (horizontal?MONSYMS.S_hcdoor:MONSYMS.S_vcdoor);
    assert.equal(mon.m_ap_type,C.M_AP_FURNITURE); assert.equal(mon.mappearance,expected);
    assert.equal(mon.mcorpsenm,C.NON_PM); assert.equal(!!is_door_mappear(mon),!rogue);
    assert.equal(!!is_lightblocker_mappear(mon),true); assert.equal(does_block(x,y,game.level.at(x,y)),1);
    assert.equal(clear_path(x,y-1,x,y+1),false); assert.deepEqual(getRngLog(),[]);
    return {appearance:mon.mappearance,type:mon.m_ap_type,payload:mon.mcorpsenm,rng:hash(getRngLog())};
}
for (const rogue of [false,true]) {
    for (const left of [C.HWALL,C.TLCORNER,C.TRWALL,C.BLCORNER,C.TDWALL,C.CROSSWALL,C.TUWALL])
        await check(`connecting wall ${left}, rogue=${rogue}`,()=>wall(rogue,left,C.DOOR,true));
    for (const left of [C.VWALL,C.ROOM,C.STONE,C.DOOR])
        await check(`nonconnecting terrain ${left}, rogue=${rogue}`,()=>wall(rogue,left,C.DOOR,false));
    for (const target of [C.SDOOR,C.SCORR,C.HWALL,C.VWALL])
        await check(`wall-like target ${target}, rogue=${rogue}`,()=>wall(rogue,C.ROOM,target,false));
    await check(`object precedes doorway, rogue=${rogue}`,async()=>{
        const mon=await fresh(rogue); terrain(x,C.DOOR);
        await place_object(mksobj(ONAMES.DAGGER,false,false),x,y); reset(); set_mimic_sym(mon);
        assert.equal(mon.m_ap_type,C.M_AP_OBJECT); assert.equal(mon.mappearance,ONAMES.DAGGER);
        assert.deepEqual(getRngLog(),[]); return {type:mon.m_ap_type,appearance:mon.mappearance};
    });
    await check(`shape protection preserves disguise, rogue=${rogue}`,async()=>{
        const mon=await fresh(rogue); terrain(x,C.DOOR);
        game.u.uprops.PROT_FROM_SHAPE_CHANGERS=C.W_RINGL;
        const before=[mon.m_ap_type,mon.mappearance,mon.mcorpsenm]; reset(); set_mimic_sym(mon);
        assert.deepEqual([mon.m_ap_type,mon.mappearance,mon.mcorpsenm],before);
        assert.deepEqual(getRngLog(),[]); return {before};
    });
}
await check('null monster returns before any random draw',async()=>{
    await fresh(false);reset();assert.equal(set_mimic_sym(null),undefined);assert.deepEqual(getRngLog(),[]);return {};
});
clearTimeout(limit);
const report={passed:results.filter(x=>x.pass).length,total:results.length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
