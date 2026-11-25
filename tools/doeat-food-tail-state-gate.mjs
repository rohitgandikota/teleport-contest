// C eat.c:2960-3084 through actual selection, object and meal helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {doeat,eatfood,do_reset_eat,obj_nutrition} from '../js/eat.js';
import {readobjnam} from '../js/objnam.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {cmdq_add_key} from '../js/cmd.js';
import {initRng,enableRngLog,getRngLog} from '../js/rng.js';
import {set_levltyp} from '../js/mkmaze.js';
import {u_on_newpos} from '../js/teleport.js';
import {vision_reset,vision_recalc} from '../js/vision.js';
import {is_lava} from '../js/mon.js';
import {pline} from '../js/display.js';
import {ONAMES as O} from '../js/objects_data.js';
import {CQ_CANNED,ECMD_TIME,OBJ_DELETED,LAVAPOOL,ROOM,NOT_HUNGRY} from '../js/const.js';

const messages=()=>[...game._msg_history,game._toplines].join('\n');
const reseed=()=>{initRng(2);enableRngLog();};
async function fixture(wish,{role='Wizard',hunger=500}={}){
    const run=await runSegment({seed:99812,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),
        nethackrc:`OPTIONS=name:Foodtail,role:${role},race:human,gender:male,align:neutral,playmode:debug\n`
            +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
    run._display.clearInputQueue();run._display.onEmptyQueue=()=>32;game._preNhgetchHook=null;
    game.u.uhunger=hunger;game.u.uhs=NOT_HUNGRY; // Explicit source hunger boundary.
    const obj=await readobjnam(wish,null);assert.ok(obj);await addinv(obj);
    game._toplines='';game._msg_history=[];game._toplin=0;game._pending_message='';game._win_stop=false;
    game.iflags.last_msg=0;game.command_queue=[];
    cmdq_add_key(CQ_CANNED,obj.invlet);reseed();
    return {run,obj};
}

for(const [wish,vegan,vegetarian]of [
    ['uncursed meatball',1,1],['uncursed egg',1,0],
    ['uncursed pancake',1,0],['uncursed fortune cookie',1,0],
    ['uncursed cream pie',1,0],['uncursed candy bar',1,0],
    ['uncursed lump of royal jelly',1,0],['uncursed carrot',0,0],
    ['uncursed cram ration',0,0],
])test(`material conduct for ${wish}`,async()=>{
    await fixture(wish);assert.equal(await doeat(),ECMD_TIME);
    assert.equal(game.u.uconduct.food,1);assert.equal(game.u.uconduct.unvegan,vegan);
    assert.equal(game.u.uconduct.unvegetarian,vegetarian);
    const conduct=game.gamelog.filter(e=>/first time/.test(e.text));
    assert.equal(conduct.length,1,'first food suppresses additional first-diet logs');
    assert.match(conduct[0].text,/ate for the first time/);
});

for(const role of ['Monk','Wizard'])test(`meat guilt uses real ${role} startup`,async()=>{
    await fixture('uncursed meatball',{role});
    const before=game.u.ualign.record,abuse=game.u.ualign.abuse||0;
    assert.equal(game.urole.name.m,role);await doeat();
    assert.equal(game.u.ualign.record,before-(role==='Monk'?1:0));
    assert.equal(game.u.ualign.abuse||0,abuse+(role==='Monk'?1:0));
    assert.equal(/You feel guilty\./.test(messages()),role==='Monk');
});

test('real half-eaten ration scales five turns to three with C rounding',async()=>{
    const {obj}=await fixture('partly eaten uncursed food ration');
    assert.equal(obj.oeaten,400);assert.equal(obj_nutrition(obj),800);
    await doeat();const v=game.context.victual;
    assert.equal(v.reqtime,3);assert.equal(v.nmod,-133);assert.equal(v.usedtime,1);
    assert.equal(obj.oeaten,267);assert.equal(game.u.uhunger,633);
    assert.equal(game.occupation,eatfood);assert.deepEqual(getRngLog(),[]);
});
test('partly eaten one-turn food announces completion through start_eating',async()=>{
    const {obj}=await fixture('partly eaten uncursed carrot');
    assert.equal(obj.oeaten,25);await doeat();
    assert.equal(obj.where,OBJ_DELETED);assert.equal(game.occupation,null);
    assert.match(messages(),/finish eating the carrot\./);
});
test('whole one-turn food does not gain a finish message',async()=>{
    const {obj}=await fixture('uncursed carrot');await doeat();
    assert.equal(obj.where,OBJ_DELETED);assert.doesNotMatch(messages(),/finish eating/);
});
test('whole ordinary ration retains unscaled delay and nutrition',async()=>{
    const {obj}=await fixture('uncursed food ration');await doeat();
    assert.equal(game.context.victual.reqtime,5);assert.equal(game.context.victual.nmod,-160);
    assert.equal(obj.oeaten,640);assert.equal(game.u.uhunger,660);
});
test('a resumed same object keeps the existing meal timing and conduct',async()=>{
    const {obj}=await fixture('uncursed food ration');await doeat();
    const first=game.context.victual;assert.equal(first.usedtime,1);
    await do_reset_eat();game.command_queue=[];cmdq_add_key(CQ_CANNED,obj.invlet);
    await doeat();assert.equal(game.context.victual.reqtime,5);
    assert.equal(game.context.victual.usedtime,2);assert.equal(game.u.uconduct.food,1);
    assert.match(messages(),/resume your meal/);
});
test('rotten ordinary ration scales after the real rottenfood reduction',async()=>{
    const {obj}=await fixture('cursed food ration');await doeat();
    assert.equal(game.context.victual.reqtime,3);assert.equal(game.context.victual.nmod,-133);
    assert.ok(obj.oeaten<=400);assert.match(messages(),/Blecch!/);
});
test('rotten-food unconsciousness retains scaled meal state without a first bite',async()=>{
    const {obj}=await fixture('cursed food ration');initRng(1);enableRngLog();
    await doeat();
    assert.deepEqual(getRngLog().slice(0,3),['rn2(4)=1','rn2(4)=2','rn2(3)=0']);
    assert.equal(game.context.victual.reqtime,3);assert.equal(game.context.victual.nmod,-133);
    assert.equal(game.context.victual.usedtime,0);assert.ok(!game.context.victual.eating);
    assert.ok(!game.occupation);assert.ok(game.multi<0);
    assert.equal(obj.oeaten,400);assert.equal(obj.owt,10);assert.equal(game.u.uhunger,500);
});

for(const food of ['apple','lichen corpse'])
for(const lava of [false,true])test(`real inventory overflow ${food} into ${lava?'lava':'room'}`,async()=>{
    const {obj}=await fixture(`2 uncursed ${food}s`);
    assert.equal(obj.quan,2);
    for(let i=0;i<51;i++){
        const ring=mksobj(O.RIN_ADORNMENT,false,false);ring.spe=i+1;await addinv(ring);
    }
    assert.equal(game.invent.length,52);
    // Constructed placement uses an overwritable square, not the protected startup stairs.
    assert.equal(set_levltyp(31,10,lava?LAVAPOOL:ROOM),true);
    u_on_newpos(31,10);vision_reset();vision_recalc();
    assert.equal(is_lava(game.u.ux,game.u.uy),lava);
    game.command_queue=[];cmdq_add_key(CQ_CANNED,obj.invlet);reseed();
    assert.equal(await doeat(),ECMD_TIME);
    assert.equal(obj.quan,1);assert.equal(game.u.uconduct.food,1);
    if(lava){
        assert.equal(game.context.victual.piece||null,null);
        assert.equal(game.context.victual.eating||0,0);
        assert.ok(!game.occupation,'a lost meal must not start an occupation');
        assert.equal(game.u.uhunger,500);
        assert.match(messages(),/hit lava and burn up/);
    }else assert.doesNotMatch(messages(),/hit lava/);
});

test('used-up corpse clears every victual field, including previous flags',async()=>{
    const {obj}=await fixture('uncursed goblin corpse');obj.age=-1000;
    // An old meal's retained fields are an explicit C struct boundary.
    game.context.victual={piece:null,o_id:0,usedtime:9,reqtime:20,nmod:-17,canchoke:1,fullwarn:1,eating:0,doreset:1};
    await doeat();assert.equal(obj.where,OBJ_DELETED);
    assert.deepEqual(game.context.victual,{});assert.match(messages(),/was tainted/);
});

test('Monk guilt feedback completes before alignment and first bite',async()=>{
    const {run,obj}=await fixture('uncursed meatball',{role:'Monk'});
    const record=game.u.ualign.record,hunger=game.u.uhunger;
    await pline('An existing message occupies enough of the line to require acknowledgement.');
    let arrived,release;const waiting=new Promise(resolve=>{arrived=resolve;});
    run._display.onEmptyQueue=()=>{arrived();return new Promise(resolve=>{release=resolve;});};
    const operation=doeat();
    const pending=await Promise.race([waiting.then(()=>true),operation.then(()=>false)]);
    const during={food:game.u.uconduct.food,unvegan:game.u.uconduct.unvegan,
        vegetarian:game.u.uconduct.unvegetarian,record:game.u.ualign.record,
        hunger:game.u.uhunger,eaten:obj.oeaten,reqtime:game.context.victual.reqtime};
    run._display.onEmptyQueue=()=>32;release?.(32);await operation;
    assert.equal(pending,true);
    assert.deepEqual(during,{food:1,unvegan:1,vegetarian:1,record,hunger,eaten:obj_nutrition(obj),reqtime:undefined});
    assert.equal(game.u.ualign.record,record-1);assert.equal(obj.where,OBJ_DELETED);
});

for(const [first,expectedLog]of [
    ['carrot','consumed animal products for the first time, by eating a meatball'],
    ['pancake','tasted meat for the first time, by eating a meatball'],
    ['meatball',null],
])test(`later meat meal preserves conduct-log suppression after ${first}`,async()=>{
    await fixture(`uncursed ${first}`);await doeat();
    while(game.occupation===eatfood)await eatfood();
    const previous=game.gamelog.length,unvegan=game.u.uconduct.unvegan;
    const meat=await readobjnam('uncursed meatball',null);await addinv(meat);
    game.command_queue=[];cmdq_add_key(CQ_CANNED,meat.invlet);await doeat();
    assert.equal(game.u.uconduct.food,2);assert.equal(game.u.uconduct.unvegan,unvegan+1);
    const logs=game.gamelog.slice(previous).filter(e=>/first time/.test(e.text));
    assert.deepEqual(logs.map(e=>e.text),expectedLog?[expectedLog]:[]);
});
