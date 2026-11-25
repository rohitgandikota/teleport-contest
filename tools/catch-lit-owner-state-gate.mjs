// Constructed owner contracts. Ordinary caller reach is checked separately.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const module=name=>import(new URL(`../js/${name}.js`,import.meta.url));
const {setup,seed,clearMessages,messages,x,y}=await import(new URL(
    './half-damage-intrinsic-setup.mjs',import.meta.url));
const state=await module('gstate');
const {catch_lit}=await module('apply');
const {mksobj,place_object,add_to_container}=await module('mkobj');
const {addinv}=await module('invent');
const {makemon}=await module('makemon');
const {mpickobj}=await module('steal');
const {begin_burn}=await module('timeout');
const {make_blinded}=await module('potion');
const {dosave0}=await module('save');
const {dorecover}=await module('restore');
const {getRngLog,rn2}=await module('rng');
const {ONAMES:O}=await module('objects_data');
const {PMNAMES:P}=await module('monst_data');
const C=await module('const');
const rows=[];
async function check(name,fn) {
    try {await setup();await fn(state.game);rows.push({name,pass:true});}
    catch(error) {rows.push({name,pass:false,error:error.message.slice(0,400)});}
}
function object(type) {
    const obj=mksobj(type,false,false);
    Object.assign(obj,{age:200,spe:1,quan:1,cursed:false});
    return obj;
}
function floor(obj) {place_object(obj,x+1,y);return obj;}
function light(game,obj) {return game.light_sources.find(l=>l.id===obj.o_id);}
function timer(game,obj) {return game.timer_base.find(t=>t.arg===obj && t.func_index===C.BURN_OBJECT);}

for(const [name,type] of [['oil lamp',O.OIL_LAMP],['oil potion',O.POT_OIL],
    ['tallow candle',O.TALLOW_CANDLE],['wax candle',O.WAX_CANDLE],
    ['magic lamp',O.MAGIC_LAMP],['Candelabrum',O.CANDELABRUM_OF_INVOCATION]]) {
    await check(`${name}: exposed floor source without hero inventory`,async game=>{
        assert.ok(!game.invent?.length,'normal pauper startup has no inventory');
        const obj=floor(object(type));clearMessages();seed();
        assert.equal(await catch_lit(obj),true);assert.equal(obj.lamplit,1);
        assert.ok(light(game,obj));assert.equal(!!timer(game,obj),type!==O.MAGIC_LAMP);
        assert.ok(!game.invent?.length);
        assert.deepEqual(getRngLog(),type===O.POT_OIL ? ['rn2(19)=4'] : []);
        assert.match(messages(),/catch(?:es)? light!/);
        if(type===O.POT_OIL)assert.ok(game.objects[type].oc_name_known);
    });
}
for(const [name,type,changes] of [
    ['ordinary floor rock',O.FLINT,{}],['lantern',O.BRASS_LANTERN,{}],
    ['spent lamp',O.OIL_LAMP,{age:0}],['empty magic lamp',O.MAGIC_LAMP,{spe:0}],
    ['empty Candelabrum',O.CANDELABRUM_OF_INVOCATION,{spe:0}],
    ['cursed Candelabrum',O.CANDELABRUM_OF_INVOCATION,{cursed:true}],
]) await check(`${name}: refused without side effects`,async game=>{
    const obj=floor(Object.assign(object(type),changes));clearMessages();seed();
    assert.equal(await catch_lit(obj),false);assert.ok(!obj.lamplit);
    assert.ok(!timer(game,obj));assert.ok(!light(game,obj));
    assert.equal(messages(),'');assert.deepEqual(getRngLog(),[]);
});
for(const location of ['free','contained','buried','migrating','monster-migrating']) {
    await check(`${location}: hidden source is not ignited`,async game=>{
        const obj=object(O.OIL_LAMP);
        if(location==='contained')add_to_container(floor(object(O.SACK)),obj);
        else if(location==='buried')obj.where=C.OBJ_BURIED;
        else if(location==='migrating')obj.where=C.OBJ_MIGRATING;
        else if(location==='monster-migrating'){
            const mon=await makemon(game.mons[P.PM_GNOME],x+1,y,C.NO_MINVENT|C.MM_NOGRP);
            mpickobj(mon,obj);mon.mx=0; // Constructed C migrating-carrier boundary.
        }
        clearMessages();seed();assert.equal(await catch_lit(obj),false);
        assert.ok(!obj.lamplit);assert.ok(!timer(game,obj));assert.ok(!light(game,obj));
        assert.deepEqual(getRngLog(),[]);
    });
}
await check('already lit: no second timer or light',async game=>{
    const obj=floor(object(O.OIL_LAMP));await begin_burn(obj,false);
    const age=obj.age,oldTimer=timer(game,obj),oldLight=light(game,obj);
    clearMessages();seed();assert.equal(await catch_lit(obj),false);
    assert.equal(obj.age,age);assert.equal(timer(game,obj),oldTimer);
    assert.equal(light(game,obj),oldLight);assert.deepEqual(getRngLog(),[]);
});
await check('monster inventory: carrier coordinates and no hero inventory alias',async game=>{
    const mon=await makemon(game.mons[P.PM_GNOME],x+1,y,C.NO_MINVENT|C.MM_NOGRP);
    const obj=object(O.WAX_CANDLE);mpickobj(mon,obj);clearMessages();seed();
    assert.equal(await catch_lit(obj),true);assert.equal(obj.ocarry,mon);
    assert.equal(light(game,obj).x,mon.mx);assert.equal(light(game,obj).y,mon.my);
    assert.ok(!game.invent?.length);assert.deepEqual(getRngLog(),[]);
});
for(const rngSeed of [0,1,2,3]) await check(`cursed lamp seed ${rngSeed}: one refusal draw`,async game=>{
    const obj=floor(object(O.OIL_LAMP));obj.cursed=true;
    seed(rngSeed);const expected=rn2(2);seed(rngSeed);clearMessages();
    assert.equal(await catch_lit(obj),!!expected);
    assert.deepEqual(getRngLog(),[`rn2(2)=${expected}`]);
    assert.equal(!!obj.lamplit,!!expected);assert.equal(!!timer(game,obj),!!expected);
});
await check('accessible floor feedback identifies the object square',async game=>{
    const obj=floor(object(O.OIL_LAMP));game.flags.accessiblemsg=true;
    game.iflags.getpos_coords='m';clearMessages();seed();
    assert.equal(await catch_lit(obj),true);assert.match(messages(),/<32,10>: .*catches light!/);
    assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
await check('blind carried source feels warm and starts burning',async game=>{
    const obj=object(O.OIL_LAMP);await addinv(obj);await make_blinded(100,false);
    clearMessages();seed();assert.equal(await catch_lit(obj),true);
    assert.match(messages(),/feels warm\./);assert.ok(timer(game,obj));
});
await check('blind floor source lights without visible feedback',async game=>{
    const obj=floor(object(O.POT_OIL));await make_blinded(100,false);
    clearMessages();seed();assert.equal(await catch_lit(obj),true);
    assert.equal(messages(),'');assert.ok(game.objects[O.POT_OIL].oc_name_known);
});
await check('reset creates a distinct empty inventory for each game',async()=>{
    const first=state.resetGame();assert.deepEqual(first.invent,[]);
    const second=state.resetGame();assert.deepEqual(second.invent,[]);
    assert.notEqual(first.invent,second.invent);
});
await check('new game drops the previous inventory chain',async game=>{
    await addinv(object(O.OIL_LAMP));assert.equal(game.invent.length,1);
    const old=game.invent;await setup();assert.deepEqual(state.game.invent,[]);
    assert.notEqual(state.game.invent,old);
});
await check('empty inventory survives save and recovery',async game=>{
    assert.deepEqual(game.invent,[]);assert.equal(await dosave0(),true);
    assert.equal(await dorecover(),true);assert.deepEqual(state.game.invent,[]);
});
const report={kind:'source-derived owner and inventory lifecycle controls',passed:rows.filter(r=>r.pass).length,total:rows.length,rows};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(report.passed!==report.total)process.exitCode=1;
