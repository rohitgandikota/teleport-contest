// C eat.c:3362-3514, real polymorph/hunger/meal/death helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {polymon} from '../js/polyself.js';
import {newuhs,doeat,morehungry,eatfood,do_reset_eat} from '../js/eat.js';
import {readobjnam} from '../js/objnam.js';
import {addinv} from '../js/invent.js';
import {cmdq_add_key} from '../js/cmd.js';
import {pline} from '../js/display.js';
import {getRngLog,initRng,enableRngLog} from '../js/rng.js';
import {PMNAMES} from '../js/monst_data.js';
import {Upolyd,CQ_CANNED,NOT_HUNGRY,SATIATED,HUNGRY} from '../js/const.js';
let inputMessages=[];
function nextInput(){ inputMessages.push(game._toplines || ''); return 32; }
async function setup(poly=false){
 const run=await runSegment({seed:99812,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),
  nethackrc:'OPTIONS=name:Hungerform,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\nOPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
 run._display.clearInputQueue();run._display.onEmptyQueue=nextInput;game._preNhgetchHook=null;
 if(poly)assert.equal(await polymon(PMNAMES.PM_HILL_GIANT),1);
 assert.equal(!!Upolyd(game.u),poly);
 game._toplines='';game._msg_history=[];game._toplin=0;game._pending_message='';game._win_stop=false;game.iflags.last_msg=0;
 inputMessages=[];initRng(2);enableRngLog();return run;
}
// Death confirmation replaces the top line. Observe real reads before it does.
const messages=()=>[...inputMessages,...game._msg_history,game._toplines].join('\n');
for(const [label,poly,hp,mh,deaths]of [
 ['healthy human ignores unused zero monster HP',false,10,0,0],
 ['human zero HP remains fatal despite unused monster HP',false,0,20,1],
 ['healthy form survives nonpositive original HP',true,-1,20,0],
 ['zero-HP form dies despite healthy original HP',true,10,0,1],
 ['both HP pools nonpositive remains fatal',true,-1,0,1],
 ['one current-form HP is sufficient',true,-1,1,0],
])test(label,async()=>{
 await setup(poly);
 // Explicit source HP boundaries. No native or ordinary-producer claim.
 game.u.uhp=hp;game.u.mh=mh;game.u.uhunger=1100;game.u.uhs=NOT_HUNGRY;
 const before=game.u.umortality||0;await newuhs(false);
 assert.equal(game.u.umortality||0,before+deaths);
 assert.equal(/die from hunger and exhaustion/.test(messages()),!!deaths);
 assert.equal(game.u.uhs,SATIATED);
 if(deaths){assert.match(messages(),/OK, so you don't die/);assert.ok(game.u.uhp>0);if(poly)assert.ok(game.u.mh>0);}
 else{assert.equal(game.u.uhp,hp);assert.equal(game.u.mh,mh);}
 assert.deepEqual(getRngLog(),[]);
});
test('no hunger transition does not reach exhaustion check',async()=>{
 await setup(true);game.u.uhp=-1;game.u.uhunger=900;game.u.uhs=NOT_HUNGRY;
 await newuhs(false);assert.equal(game.u.umortality||0,0);assert.equal(game.u.uhp,-1);
 assert.equal(game.u.uhs,NOT_HUNGRY);assert.doesNotMatch(messages(),/exhaustion/);
});
test('one actual food meal retains a healthy polymorphed hero',async()=>{
 const run=await setup(true);game.u.uhp=-1;game.u.uhunger=900;game.u.uhs=NOT_HUNGRY;
 const food=await readobjnam('1 uncursed slime mold',null);assert.equal(food.quan,1);await addinv(food);
 game.command_queue=[];cmdq_add_key(CQ_CANNED,food.invlet);run._display.clearInputQueue();
 await doeat();while(game.occupation===eatfood)await eatfood();
 assert.equal(game.u.umortality||0,0);assert.equal(game.u.uhp,-1);assert.ok(game.u.mh>0);
 assert.equal(game.u.uhs,SATIATED);assert.equal(game.u.uhunger,1150);
 assert.ok(!game.invent.includes(food));assert.doesNotMatch(messages(),/exhaustion/);
});
test('morehungry uses active HP and keeps its normal hunger feedback',async()=>{
 await setup(true);game.u.uhp=-1;game.u.uhunger=151;game.u.uhs=NOT_HUNGRY;
 await morehungry(1);assert.equal(game.u.uhs,HUNGRY);assert.equal(game.u.uhunger,150);
 assert.equal(game.u.umortality||0,0);assert.equal(game.u.uhp,-1);
 assert.match(messages(),/beginning to feel hungry/);assert.doesNotMatch(messages(),/exhaustion/);
});
test('pending hunger feedback finishes before status and death resolution',async()=>{
 const run=await setup(true);game.u.uhp=10;game.u.mh=0;game.u.uhunger=150;game.u.uhs=NOT_HUNGRY;
 await pline('An existing message occupies enough of the line to require acknowledgement.');
 let reached,release;const waiting=new Promise(resolve=>{reached=resolve;});
 run._display.onEmptyQueue=()=>{reached();return new Promise(resolve=>{release=resolve;});};
 const operation=newuhs(true);const pending=await Promise.race([waiting.then(()=>true),operation.then(()=>false)]);
 const during={hs:game.u.uhs,mortality:game.u.umortality||0,hp:game.u.uhp,mh:game.u.mh};
 run._display.onEmptyQueue=nextInput;release?.(32);await operation;
 assert.equal(pending,true);assert.deepEqual(during,{hs:NOT_HUNGRY,mortality:0,hp:10,mh:0});
 assert.equal(game.u.umortality,1);assert.match(messages(),/die from hunger and exhaustion/);
 assert.match(messages(),/OK, so you don't die/);
});

test('the real first bite defers exhaustion until the meal ends or is interrupted',async()=>{
 const run=await setup(true);game.u.uhp=-1;game.u.uhunger=900;game.u.uhs=NOT_HUNGRY;
 const food=await readobjnam('1 uncursed food ration',null);await addinv(food);
 game.command_queue=[];cmdq_add_key(CQ_CANNED,food.invlet);run._display.clearInputQueue();
 await doeat();
 assert.equal(game.occupation,eatfood);assert.equal(game.context.victual.usedtime,1);
 assert.equal(game.u.uhunger,1060);assert.equal(game.u.uhs,SATIATED);
 assert.equal(game.saved_hs,true);assert.equal(game.save_hs,NOT_HUNGRY);
 assert.equal(game.u.umortality||0,0);assert.equal(game.u.uhp,-1);
 await do_reset_eat();
 assert.equal(game.occupation,null);assert.equal(game.saved_hs,false);
 assert.equal(game.u.uhs,SATIATED);assert.equal(game.u.umortality||0,0);
 assert.equal(game.u.uhp,-1);assert.equal(game.context.victual.piece,food);
});
test('mid-meal early return retains C nesting even at a constructed zero active HP',async()=>{
 const run=await setup(true);const food=await readobjnam('1 uncursed food ration',null);await addinv(food);
 game.command_queue=[];cmdq_add_key(CQ_CANNED,food.invlet);run._display.clearInputQueue();
 await doeat();assert.equal(game.occupation,eatfood);
 game.u.mh=0;game.u.uhunger=150;const hp=game.u.uhp;
 await newuhs(true);
 assert.equal(game.u.uhs,HUNGRY);assert.equal(game.u.umortality||0,0);
 assert.equal(game.u.uhp,hp);assert.equal(game.u.mh,0);assert.equal(game.occupation,eatfood);
 assert.doesNotMatch(messages(),/exhaustion/);
});
