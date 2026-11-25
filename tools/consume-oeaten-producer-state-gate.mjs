// Reachability controls for C eat.c:3808-3874; no consume_oeaten repair is included.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {readobjnam} from '../js/objnam.js';
import {consume_oeaten,obj_nutrition,doeat,eatfood} from '../js/eat.js';
import {addinv} from '../js/invent.js';
import {shrink_glob} from '../js/mkobj.js';
import {cmdq_add_key} from '../js/cmd.js';
import {initRng,enableRngLog,getRngLog} from '../js/rng.js';
import {ONAMES as O,OCLASSES} from '../js/objects_data.js';
import {CQ_CANNED,OBJ_DELETED} from '../js/const.js';
async function setup(){
 const run=await runSegment({seed:99812,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),
 nethackrc:'OPTIONS=name:Nutrition,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\nOPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
 run._display.clearInputQueue();run._display.onEmptyQueue=()=>32;game._preNhgetchHook=null;
 game._toplines='';game._msg_history=[];game._toplin=0;game._pending_message='';game._win_stop=false;game.iflags.last_msg=0;
 return run;
}
async function begin(wish){
 const run=await setup(),food=await readobjnam(wish,null);await addinv(food);
 game.command_queue=[];cmdq_add_key(CQ_CANNED,food.invlet);initRng(2);enableRngLog();
 await doeat();return {run,food};
}
test('real ordinary food table has no zero-nutrition type outside corpse and tin owners',async()=>{
 await setup();const zero=game.objects.flatMap((o,i)=>o.oc_class===OCLASSES.FOOD_CLASS&&!o.oc_nutrition?[i]:[]);
 assert.deepEqual(zero.sort((a,b)=>a-b),[O.GENERIC_FOOD,O.CORPSE,O.TIN].sort((a,b)=>a-b));
 // C objects.h:72-108 reserves the leading generic entries for glyphs.
 assert.equal(game.objects[O.GENERIC_FOOD].oc_nowish,1);
 assert.ok(O.GENERIC_FOOD<game.bases[OCLASSES.FOOD_CLASS]);
 assert.deepEqual(zero.filter(i=>i>=game.bases[OCLASSES.FOOD_CLASS]),[O.CORPSE,O.TIN]);
});
for(const [wish,nut,eaten] of [
 ['1 partly eaten uncursed wraith corpse',0,0],
 ['1 partly eaten uncursed eucalyptus leaf',1,0],
 ['1 partly eaten uncursed food ration',800,400],
])test('real wish exclusion: '+wish,async()=>{
 await setup();const obj=await readobjnam(wish,null);
 assert.equal(obj_nutrition(obj),nut);assert.equal(obj.oeaten,eaten);
 assert.equal(obj.quan,1);
});
for(const [amount,initial,expected] of [[1,100,50],[2,100,25],[-30,100,70],[-100,100,1],[-101,100,1]])
 test(`positive food reduction ${initial}, ${amount}`,async()=>{
  await setup();const obj=await readobjnam('1 uncursed food ration',null);assert.equal(obj_nutrition(obj),800);
  obj.oeaten=initial;initRng(2);enableRngLog();
  assert.equal(consume_oeaten(obj,amount),undefined);assert.equal(obj.oeaten,expected);assert.deepEqual(getRngLog(),[]);
 });
test('last-bite clamp ends a real meal without restoring untouched nutrition',async()=>{
 const {food}=await begin('1 uncursed food ration');assert.equal(game.occupation,eatfood);
 const v=game.context.victual;assert.equal(v.reqtime,5);assert.equal(v.usedtime,1);
 consume_oeaten(food,-1000);assert.equal(food.oeaten,1);assert.equal(v.reqtime,v.usedtime);
 await eatfood();assert.equal(food.where,OBJ_DELETED);assert.equal(game.occupation,null);
});
test('off-meal object clamp leaves the active meal timing intact',async()=>{
 await begin('1 uncursed food ration');const v=game.context.victual;
 const obj=await readobjnam('1 partly eaten uncursed apple',null);
 assert.notEqual(v.piece,obj);assert.equal(obj.oeaten,25);
 consume_oeaten(obj,-25);assert.equal(obj.oeaten,1);assert.equal(v.reqtime,5);assert.equal(v.usedtime,1);
});
test('zero-nutrition rotten corpse is removed before any partial-food reduction',async()=>{
 const run=await setup(),food=await readobjnam('1 uncursed wraith corpse',null);await addinv(food);
 assert.equal(obj_nutrition(food),0);food.orotten=true; // Constructed source flag; real corpse owner follows.
 game.command_queue=[];cmdq_add_key(CQ_CANNED,food.invlet);initRng(2);enableRngLog();await doeat();
 assert.equal(food.where,OBJ_DELETED);assert.ok(!game.context.victual.piece);assert.notEqual(game.occupation,eatfood);
});
test('on-time glob shrink preserves a real active meal and its nutrition',async()=>{
 const {food}=await begin('uncursed glob of brown pudding');assert.equal(food.globby,1);
 assert.equal(game.occupation,eatfood);assert.equal(game.context.victual.piece,food);
 const weight=food.owt,eaten=food.oeaten;assert.ok(weight>0&&eaten>0);
 await shrink_glob(food,game.moves);assert.equal(food.owt,weight);assert.equal(food.oeaten,eaten);
 assert.equal(game.context.victual.piece,food);
});
