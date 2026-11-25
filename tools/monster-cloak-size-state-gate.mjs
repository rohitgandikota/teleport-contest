// Source controls use real creation, acquisition and wearing functions.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {mpickobj} from '../js/steal.js';
import {mpickstuff,m_at} from '../js/mon.js';
import {m_dowear,which_armor} from '../js/worn.js';
import {pline,tty_clear_nhwindow_message,canseemon} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P,MFLAGS as M,MMFLAGS} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {ROOM,W_ARMC,W_ARMH,I_SPECIAL,OBJ_MINVENT} from '../js/const.js';

const rc='OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
const reports=[];
const state=m=>({species:m.mnum,size:m.data.msize,xy:[m.mx,m.my],worn:m.misc_worn_check||0,
    canmove:!!m.mcanmove,frozen:m.mfrozen||0,
    inventory:m.minvent.map(o=>({typ:o.otyp,where:o.where,mask:o.owornmask||0})),top:game._toplines||''});
async function setup(species){
    const run=await runSegment({seed:713,datetime:'20000112093000',nethackrc:rc,moves:' ',storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<30,'bounded message completion');return 32;};
    const {ux,uy}=game.u;
    const pos=[[ux+1,uy],[ux-1,uy],[ux,uy+1],[ux,uy-1],[ux+1,uy+1],[ux-1,uy-1]]
        .find(([x,y])=>game.level.at(x,y)?.typ===ROOM&&!m_at(x,y));
    assert.ok(pos,'visible empty floor');
    const mon=await makemon(game.mons[species],...pos,MMFLAGS.NO_MINVENT|MMFLAGS.MM_NOWAIT);
    assert.ok(mon);assert.equal(mon.data,game.mons[species]);assert.equal((mon.minvent||[]).length,0);
    assert.ok(canseemon(mon));tty_clear_nhwindow_message(game._topl_cury||0);
    return {run,mon};
}
async function give(mon,typ){const item=mksobj(typ,false,false);await mpickobj(mon,item);
    assert.equal(item.where,OBJ_MINVENT);assert.ok(mon.minvent.includes(item));return item;}
async function check(name,body){await test(name,async()=>{
    const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message;throw e;}
    finally{reports.push(r);}
});}

for(const [species,size] of [[P.PM_HOBBIT,M.MZ_SMALL],[P.PM_HILL_ORC,M.MZ_MEDIUM],
    [P.PM_ROCK_TROLL,M.MZ_LARGE],[P.PM_HILL_GIANT,M.MZ_HUGE]])
for(const typ of [O.DWARVISH_CLOAK,O.MUMMY_WRAPPING])for(const creation of [true,false])
await check(`size ${size}, ${typ===O.MUMMY_WRAPPING?'wrapping':'cloak'}, creation ${creation}`,async r=>{
    const {mon}=await setup(species);assert.equal(mon.data.msize,size);
    const obj=await give(mon,typ),before=[...getRngLog()];r.before=state(mon);
    const result=m_dowear(mon,creation);
    if(creation)assert.equal(result,undefined,'creation remains synchronous');
    await result;r.after=state(mon);
    const allowed=typ===O.MUMMY_WRAPPING||size<=M.MZ_MEDIUM;
    assert.equal(which_armor(mon,W_ARMC),allowed?obj:null);
    assert.equal(obj.owornmask||0,allowed?W_ARMC:0);
    assert.equal(mon.misc_worn_check||0,allowed?W_ARMC:0);
    assert.equal(mon.mfrozen||0,creation||!allowed?0:game.objects[typ].oc_delay);
    assert.deepEqual(getRngLog(),before,'size selection adds no random draw');
});

for(const species of [P.PM_GRID_BUG,P.PM_LARGE_DOG,P.PM_STONE_GOLEM])
await check(`existing entry rejection: species ${species}`,async r=>{
    const {mon}=await setup(species);await give(mon,O.DWARVISH_CLOAK);
    r.before=state(mon);await m_dowear(mon,false);r.after=state(mon);
    assert.equal(which_armor(mon,W_ARMC),null);assert.deepEqual(r.after,r.before);
});
await check('large monster can still wear a helmet',async r=>{
    const {mon}=await setup(P.PM_ROCK_TROLL),obj=await give(mon,O.HELMET);
    r.before=state(mon);await m_dowear(mon,false);r.after=state(mon);
    assert.equal(which_armor(mon,W_ARMH),obj);assert.ok(mon.mfrozen);assert.equal(mon.mcanmove,0);
});
await check('large monster rejects a better ordinary cloak over its wrapping',async r=>{
    const {mon}=await setup(P.PM_ROCK_TROLL),wrap=await give(mon,O.MUMMY_WRAPPING);
    m_dowear(mon,true);assert.equal(which_armor(mon,W_ARMC),wrap);
    const cloak=await give(mon,O.CLOAK_OF_PROTECTION);r.before=state(mon);
    await m_dowear(mon,false);r.after=state(mon);
    assert.equal(which_armor(mon,W_ARMC),wrap);assert.equal(cloak.owornmask||0,0);
    assert.deepEqual(r.after,r.before);
});
await check('real floor pickup schedules gear; rejected cloak leaves the mask unchanged',async r=>{
    const {mon}=await setup(P.PM_ROCK_TROLL),obj=mksobj(O.DWARVISH_CLOAK,false,false);
    await place_object(obj,mon.mx,mon.my);assert.equal(await mpickstuff(mon),true);
    assert.equal(obj.where,OBJ_MINVENT);assert.ok(mon.misc_worn_check&I_SPECIAL);
    r.before=state(mon);await m_dowear(mon,false);r.after=state(mon);
    assert.equal(which_armor(mon,W_ARMC),null);assert.equal(mon.misc_worn_check,I_SPECIAL);
    assert.equal(mon.mfrozen||0,0);assert.ok(mon.mcanmove);
});
for(const [species,typ,label] of [[P.PM_HILL_ORC,O.DWARVISH_CLOAK,'medium cloak'],
    [P.PM_ROCK_TROLL,O.MUMMY_WRAPPING,'large wrapping']])
await check(`pending More preserves old state until completion: ${label}`,async r=>{
    const {mon,run}=await setup(species),obj=await give(mon,typ);
    await pline('A previous message occupies most of this line before the next action.');
    let release,paused,done=false;const atPause=new Promise(resolve=>{paused=resolve;});
    run._display.onEmptyQueue=()=>{paused('paused');return new Promise(resolve=>{release=resolve;});};
    const beforeRng=[...getRngLog()];r.before=state(mon);
    const action=Promise.resolve(m_dowear(mon,false)).then(()=>{done=true;});
    try{
        assert.equal(await Promise.race([atPause,action.then(()=>'completed')]),'paused');
        await setImmediate();assert.equal(done,false);r.pending=state(mon);
        assert.equal(which_armor(mon,W_ARMC),null);assert.equal(obj.owornmask||0,0);
        assert.equal(mon.mfrozen||0,0);assert.ok(mon.mcanmove);
        assert.deepEqual(getRngLog(),beforeRng);
    }finally{
        let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<10);return 32;};
        if(release)release(32);await action;
    }
    r.after=state(mon);assert.equal(done,true);assert.equal(which_armor(mon,W_ARMC),obj);
    assert.equal(obj.owornmask,W_ARMC);assert.deepEqual(getRngLog(),beforeRng);
});
await check('rejected large cloak completes without reading a pending message',async r=>{
    const {mon,run}=await setup(P.PM_ROCK_TROLL);await give(mon,O.DWARVISH_CLOAK);
    await pline('A previous message occupies most of this line before the next action.');
    let reads=0;run._display.onEmptyQueue=()=>{reads++;return 32;};r.before=state(mon);
    await m_dowear(mon,false);r.after=state(mon);
    assert.equal(reads,0);assert.deepEqual(r.after,r.before);
});
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({evidence:'Real-producer source controls, not native parity',reports},null,2)+'\n');
