// C hack.c:2444,2463,2495,3898. Public owners and real state producers.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {game as g} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {lookaround,avoid_moving_on_trap,avoid_running_into_trap_or_liquid} from '../js/hack.js';
import {moveloop_core} from '../js/allmain.js';
import {set_levltyp} from '../js/mkmaze.js';
import {maketrap} from '../js/mklev.js';
import {seetrap} from '../js/trap.js';
import {set_itimeout,make_blinded} from '../js/potion.js';
import {Blind} from '../js/youprop.js';
import {vision_reset,vision_recalc} from '../js/vision.js';
import {mksobj} from '../js/mkobj.js';
import {addinv_nomerge} from '../js/invent.js';
import {oname} from '../js/do_name.js';
import {Blindf_on} from '../js/do_wear.js';
import {doapply} from '../js/apply.js';
import {makemon} from '../js/makemon.js';
import {setmangry} from '../js/mon.js';
import {tamedog} from '../js/dog.js';
import {is_door_mappear} from '../js/monst.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {setup,form,x,y,seed,clearMessages,messages} from './status-followup-test-setup.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const results=[],hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const bound=setTimeout(()=>{console.error('55 second source bound');process.exit(2);},55000);
function terrain(xx,yy,typ=C.ROOM,mask=0){assert.ok(set_levltyp(xx,yy,typ));Object.assign(g.level.at(xx,yy),{seenv:255,lit:1,waslit:1,doormask:mask,roomno:0});}
function vision(){vision_reset();vision_recalc();}
function arm(run=3,travel=false){g.context.run=run;g.context.travel=g.context.travel1=+travel;g.context.mv=1;g.context.move=1;g.multi=12;g.u.dx=1;g.u.dy=0;g.u.last_str_turn=0;clearMessages();seed();}
async function fresh(){const run=await setup();g.flags.mention_walls=true;g.flags.accessiblemsg=true;g.iflags.getpos_coords='m';g.flags.runmode=C.RUN_TPORT;g.stairs=null;vision();arm();return run;}
function state(){return {blind:Blind(),cached:!!g.u.ublind,run:g.context.run,multi:g.multi,d:[g.u.dx,g.u.dy],turn:g.u.last_str_turn,xy:[g.u.ux,g.u.uy],text:messages(),rng:getRngLog()};}
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,350);}const s=state();r.after={...s,text:s.text.slice(0,180),rng:s.rng.length,hash:hash(s)};results.push(r);}
function stopped(){assert.equal(g.context.run,0);assert.equal(g.multi,0);assert.equal(g.context.travel,0);assert.equal(g.context.mv,0);}
async function eyes(){const obj=await oname(mksobj(O.LENSES,false,false),'The Eyes of the Overworld',0);assert.ok(obj.oartifact);await addinv_nomerge(obj);await Blindf_on(obj);assert.ok(g.u.blocked.BLINDED);}
async function blindness(source,run){
    if(source==='setter'||source==='timeout-clear')await make_blinded(10,false);
    if(source==='timeout-set')set_itimeout('HBlinded',10);
    if(source==='timeout-clear')set_itimeout('HBlinded',0);
    if(source==='blindfold'){const obj=mksobj(O.BLINDFOLD,false,false);await addinv_nomerge(obj);await Blindf_on(obj);}
    if(source==='eyeless')form(P.PM_GRAY_OOZE);
    if(source==='cream-eyes'){
        await eyes();const pie=mksobj(O.CREAM_PIE,false,false);await addinv_nomerge(pie);clearMessages();
        const keys=[pie.invlet.charCodeAt(0)];let reads=0;
        run._display.onEmptyQueue=()=>{assert.ok(++reads<20);return keys.shift()??32;};
        assert.equal(await doapply(),C.ECMD_OK);assert.ok(g.u.ucreamed>0);assert.ok(g.u.intrinsic.HBlinded>0);
        assert.equal(Blind(),false);
    }
    vision();clearMessages();seed();
}

for(const source of ['sighted','setter','timeout-set','timeout-clear','cream-eyes'])
for(const obstacle of ['door','trap'])await check(`canonical ${source} ${obstacle}`,async r=>{
    const run=await fresh();
    if(obstacle==='door')terrain(x,y+1,C.DOOR,C.D_CLOSED);
    else {const t=await maketrap(x+1,y,C.WEB);seetrap(t);}
    await blindness(source,run);arm();r.before={blind:Blind(),cached:!!g.u.ublind};
    await lookaround();assert.equal(g.context.run,r.before.blind?3:0);
    if(r.before.blind){assert.equal(g.multi,12);assert.equal(messages(),'');}
    else {stopped();assert.match(messages(),obstacle==='door'?/stop in front of the door/:/stop in front of a web/);}
    assert.deepEqual(getRngLog(),[]);
});
for(const source of ['blindfold','eyeless'])await check(`synchronized ${source} ignores side door`,async r=>{
    const run=await fresh();terrain(x,y+1,C.DOOR,C.D_CLOSED);await blindness(source,run);arm();
    assert.equal(Blind(),true);await lookaround();assert.equal(g.context.run,3);assert.equal(messages(),'');
});
for(const blind of [false,true])await check(`grid bug diagonal precedes blindness ${blind}`,async()=>{
    await fresh();form(P.PM_GRID_BUG);if(blind)await make_blinded(10,false);arm();g.u.dy=1;
    await lookaround();stopped();assert.match(messages(),/cannot move diagonally/);
});
await check('grid bug ignores diagonal interesting terrain',async()=>{
    await fresh();form(P.PM_GRID_BUG);terrain(x+1,y+1,C.STAIRS);arm();await lookaround();assert.equal(g.context.run,3);
});
await check('run zero returns without scanning',async()=>{
    await fresh();terrain(x,y+1,C.DOOR,C.D_CLOSED);arm(0);await lookaround();assert.equal(g.multi,12);assert.equal(messages(),'');
});

for(const kind of ['absent','unknown','known','vibrating'])for(const [msg,mention] of [[true,true],[false,true],[true,false]])
await check(`trap helper ${kind} message ${msg} option ${mention}`,async()=>{
    await fresh();if(kind!=='absent'){const t=await maketrap(x+1,y,kind==='vibrating'?C.VIBRATING_SQUARE:C.WEB);if(kind!=='unknown')seetrap(t);}
    arm();g.flags.mention_walls=mention;assert.equal(await avoid_moving_on_trap(x+1,y,msg),kind==='known');
    assert.equal(g.context.run,3);assert.equal(g.multi,12);
    assert.equal(messages().includes('<32,10>: You stop in front of a web.'),kind==='known'&&msg&&mention);
    assert.deepEqual(g.a11y.msg_loc,{x:0,y:0});assert.deepEqual(getRngLog(),[]);
});
for(const [run,dx,dy,stop] of [[1,1,0,false],[2,1,0,true],[3,1,0,true],[8,1,0,true],[3,0,1,false],[3,-1,0,false]])
await check(`lookaround trap run ${run} offset ${dx},${dy}`,async()=>{
    await fresh();const t=await maketrap(x+dx,y+dy,C.WEB);seetrap(t);arm(run,run===8);await lookaround();assert.equal(g.context.run,stop?0:run);
});
for(const [run,travel,dx,dy,stop] of [[3,false,0,1,true],[3,false,1,1,false],[1,false,1,0,false],[8,true,1,0,false]])
await check(`door run ${run} travel ${travel} offset ${dx},${dy}`,async()=>{
    await fresh();terrain(x+dx,y+dy,C.DOOR,C.D_CLOSED);arm(run,travel);await lookaround();assert.equal(g.context.run,stop?0:run);
});
await check('real door mimic stops beside an open doorway',async()=>{
    await fresh();terrain(x,y+1,C.DOOR,C.D_ISOPEN);const mon=await makemon(g.mons[P.PM_SMALL_MIMIC],x,y+1,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(mon&&is_door_mappear(mon));vision();arm();await lookaround();stopped();assert.match(messages(),/stop in front of the door/);
});
for(const [pet,run,front,travel,stop] of [[false,3,false,false,true],[false,1,false,false,false],[true,3,true,false,true],[true,8,true,true,false]])
await check(`monster pet ${pet} run ${run} front ${front} travel ${travel}`,async()=>{
    await fresh();const mon=await makemon(g.mons[P.PM_LITTLE_DOG],x+(front?1:0),y+(front?0:1),C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);assert.ok(mon);
    if(pet)assert.ok(await tamedog(mon,null,false));else await setmangry(mon,false);
    vision();arm(run,travel);await lookaround();assert.equal(g.context.run,stop?0:run);
    if(stop)assert.match(messages(),/blocks your path/);
});

for(const [label,squares,last,expected,turn,stop] of [
    ['half left',[[1,-1]],0,[1,-1],-1,false],
    ['full right',[[0,1]],0,[0,1],2,false],
    ['reject excess turn',[[0,1]],1,[1,0],1,false],
    ['nonadjacent fork',[[0,-1],[1,1]],0,[1,0],0,false],
    ['widening',[[1,0],[1,1]],0,[1,0],0,true],
])await check(`corridor ${label}`,async()=>{
    await fresh();for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)terrain(x+dx,y+dy,C.STONE);
    terrain(x,y,C.CORR);for(const [dx,dy]of squares)terrain(x+dx,y+dy,C.CORR);vision();arm(stop?2:3);g.u.last_str_turn=last;
    await lookaround();assert.deepEqual([g.u.dx,g.u.dy],expected);assert.equal(g.u.last_str_turn,turn);assert.equal(g.context.run,stop?0:3);
    if(stop)assert.match(messages(),/corridor widens here/);assert.deepEqual(getRngLog(),[]);
});
for(const blind of [false,true])await check(`liquid caller canonical blind ${blind}`,async()=>{
    await fresh();terrain(x+1,y,C.POOL);if(blind)set_itimeout('HBlinded',10);arm();
    assert.equal(await avoid_running_into_trap_or_liquid(x+1,y),blind);
    assert.equal(g.context.run,blind?0:3);if(blind){assert.equal(g.context.move,0);assert.match(messages(),/edge of the water/);}
});

for(const obstacle of ['trap','door'])await check(`pending ${obstacle} message precedes stop`,async()=>{
    const run=await fresh();if(obstacle==='door')terrain(x,y+1,C.DOOR,C.D_CLOSED);else{const t=await maketrap(x+1,y,C.WEB);seetrap(t);}arm();
    await pline('An earlier message leaves too little room for the movement warning.');
    let enter,release,timer,finished=false;const waiting=new Promise(resolve=>{enter=resolve;});
    run._display.onEmptyQueue=()=>{enter();return new Promise(resolve=>{release=resolve;});};
    const pending=lookaround().then(()=>{finished=true;});
    try{await Promise.race([waiting,pending.then(()=>{throw Error('missing pending prompt');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('pending message timeout')),2000);})]);
        await setImmediate();assert.equal(finished,false);assert.equal(g.multi,12);assert.equal(g.context.run,3);
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await pending;}
    stopped();assert.ok(messages().includes(obstacle==='door'?'<31,11>: You stop in front of the door.':'<32,10>: You stop in front of a web.'));
});
for(const source of ['sighted','timeout-set','timeout-clear'])await check(`moveloop continuation ${source}`,async r=>{
    const run=await fresh();terrain(x,y+1,C.DOOR,C.D_CLOSED);await blindness(source,run);arm();g.context.move=0;
    r.before={blind:Blind(),cached:!!g.u.ublind};await moveloop_core();
    assert.deepEqual([g.u.ux,g.u.uy],r.before.blind?[x+1,y]:[x,y]);
    assert.equal(g.context.run,r.before.blind?3:0);if(!r.before.blind)assert.equal(g.context.move,0);
});
clearTimeout(bound);
const report={total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>r.name),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
