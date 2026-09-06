#!/usr/bin/env node

// C spell.c:687..833,1181..1379,1763..1831; mondata.c:580;
// potion.c:57..134; engrave.c:473; read.c:2055..2099.
// Constructed controls earn no native coverage or reachability credit.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {pushKeys,resetInputState} from '../js/input.js';
import {getRngLog,enableRngLog,initRng} from '../js/rng.js';
import {spelleffects_check,getspell} from '../js/spell.js';
import {cmdq_add_key,cmdq_add_int} from '../js/cmd.js';
import {can_chant} from '../js/mondata.js';
import {freehand} from '../js/engrave.js';
import {make_confused,make_stunned} from '../js/potion.js';
import {mksobj} from '../js/mkobj.js';
import {addinv,weight} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {ONAMES} from '../js/objects_data.js';
import {mons,PMNAMES} from '../js/monst_data.js';
import {TIMEOUT,FROMOUTSIDE,FROMFORM,A_INT,A_STR,NOT_HUNGRY,
    ECMD_OK,ECMD_TIME,W_WEP,W_ARMS,CQ_CANNED} from '../js/const.js';

const read=(name,dir='recipes')=>JSON.parse(readFileSync(new URL(
    `gen-sessions/${dir}/${name}${dir==='generated'?'.session':''}.json`,import.meta.url)));
const names=['spell-casting-preconditions','spell-forgetting',
    'spell-memory-selection','spell-identification'];
let replays=0,backfires=0,amnesias=0;
const outcomes=new Set();
for(const file of names) {
    const oracle=read(file,'generated');
    for(const [si,s]of read(file).segments.entries()) {
        const label=file+':'+s.name;
        const calls=oracle.segments[si].steps.flatMap(t=>t.rng||[]);
        const events=[];
        const lost=calls.flatMap((r,i)=>/losespells/.test(r)?[i]:[]);
        if(lost.length) {
            const n=Number(/rn2\((\d+)\)/.exec(calls[lost[0]])[1])-1;
            let count=Number(/=(\d+)/.exec(calls[lost[0]])[1]);
            const second=lost.find(i=>calls[i].includes('spell.c:1779'));
            if(second!==undefined)count=Math.max(count,Number(/=(\d+)/.exec(calls[second])[1]));
            const reroll=lost.find(i=>calls[i].startsWith('rnd('));
            if(reroll!==undefined)count=Number(/=(\d+)/.exec(calls[reroll])[1]);
            const forgotten=new Set();
            for(const i of lost.filter(i=>calls[i].includes('spell.c:1814'))) {
                const [,remaining,value]=/rn2\((\d+)\)=(\d+)/.exec(calls[i]);
                if(Number(value)<count){forgotten.add(n-Number(remaining));count--;}
            }
            assert.equal(count,0,label+': C loss selection exhausted');
            let before;
            events.push([lost[0],()=>{before=(game.spl_book||[]).map(s=>s.sp_know);}]);
            const after=calls.findIndex((r,i)=>i>lost.at(-1)&&r.includes('@ seffect_amnesia('));
            assert.ok(after>=0,label+': native post-amnesia boundary');
            events.push([after,()=>{
                for(let i=0;i<n;i++)assert.equal(game.spl_book[i].sp_know,
                    forgotten.has(i)?0:before[i],label+': selected spell '+i);
                assert.equal(game.context.spbook.book,null,label);
                assert.equal(game.context.spbook.o_id,0,label);
                amnesias++;
            }]);
        }
        const index=calls.findIndex(r=>/spell_backfire/.test(r));
        if(index>=0) {
            const value=Number(/=(\d+)/.exec(calls[index])[1]);
            const level=Number(/rnd\((\d+)\)/.exec(calls[index+1])[1])/5;
            const duration=[0,6,9,12,15,18,21,24][level];
            events.push([index,()=>{
                assert.equal(game.spl_book[0].sp_lev,level,label);
                assert.equal(game.spl_book[0].sp_know,0,label);
                const conf=game.u.intrinsic.HConfusion||0,stun=game.u.intrinsic.HStun||0;
                // The energy write follows both timer updates, before a turn
                // can expire either status. The RNG probe covers rn2 only.
                game.u=new Proxy(game.u,{set(target,key,valueWritten){
                    if(key==='uen') {
                        const c=value<4?duration:value<7?duration*2/3:value<9?duration/3:0;
                        assert.equal(target.intrinsic.HConfusion||0,conf+c,label+': confusion duration');
                        assert.equal(target.intrinsic.HStun||0,stun+duration-c,label+': stun duration');
                        outcomes.add(value);backfires++;
                        game.u=target;
                    }
                    target[key]=valueWritten;return true;
                }});
            }]);
        }
        events.sort((a,b)=>a[0]-b[0]);
        let event=0;
        const next=()=>{
            if(event===events.length){delete globalThis.__rng_probe_at;return;}
            globalThis.__rng_probe_at={at:events[event][0],cb:()=>{
                events[event++][1]();next();
            }};
        };
        next();
        try {await runSegment({...s,storage:new InMemoryStorage()});}
        finally {delete globalThis.__rng_probe_at;}
        assert.equal(event,events.length,label+': all native state boundaries reached');
        assert.equal(game.u.umortality||0,0,label+': no death during setup');
        if(['identify-select-one','identify-select-too-many'].includes(s.name)) {
            assert.ok(game.invent.find(o=>o.otyp===ONAMES.DAGGER).bknown,label);
            assert.ok(!game.invent.find(o=>o.otyp===ONAMES.SPE_IDENTIFY).bknown,label);
        }
        replays++;
    }
}
assert.equal(outcomes.size,10,'all native backfire switch values');

const source=read(names[0]).segments[0];
async function setup() {
    resetInputState();
    await runSegment({...source,moves:' ',storage:new InMemoryStorage()});
    game._preNhgetchHook=null;
    pushKeys(' '.repeat(500));
    game.iflags.debug_mongen=false;
    game.u.uhp=game.u.uhpmax=200;
    game.u.uen=game.u.uenmax=game.u.uenpeak=200;
    game.u.ulevel=30;game.u.uhunger=600;game.u.uhs=NOT_HUNGRY;
    game.u.abon={a:Array(6).fill(0)};game.u.atemp={a:Array(6).fill(0)};
    game.spl_book=[{sp_id:ONAMES.SPE_HEALING,sp_lev:1,sp_know:20000}];
    game._msg_history=[];game._pending_message='';game._toplin=0;
}
const text=()=>[...(game._msg_history||[]),game._pending_message||''].join('\n');
const check=async()=>{const energy={v:-1};const result=await spelleffects_check(0,energy);return {...result,energy:energy.v};};

for(const [pm,allowed]of [[PMNAMES.PM_WIZARD,true],[PMNAMES.PM_GIANT_ANT,false],
    [PMNAMES.PM_GREEN_SLIME,false],[PMNAMES.PM_KILLER_BEE,false],[PMNAMES.PM_WUMPUS,false],
    [PMNAMES.PM_ETTIN,true]]) {
    await setup();game.youmonst.data=mons[pm];
    assert.equal(can_chant(game.youmonst),allowed,String(pm));
}
await setup();game.u.intrinsic.HStrangled=5;
assert.equal(can_chant(game.youmonst),false);
assert.equal(can_chant({data:game.youmonst.data}),true,'hero strangling does not affect another monster');
for(const reason of ['stun','strangled']) {
    await setup();
    game.u.intrinsic[reason==='stun'?'HStun':'HStrangled']=5;
    enableRngLog();const result=await check();
    assert.deepEqual(result,{rejected:true,res:ECMD_OK,energy:0});
    assert.equal(getRngLog().length,0);assert.equal(game.u.uen,200);
}
for(const [weapon,shield,allowed]of [[null,false,true],[ONAMES.DAGGER,false,true],
    [ONAMES.DAGGER,true,false],[ONAMES.TWO_HANDED_SWORD,false,false],
    [ONAMES.QUARTERSTAFF,false,true]]) {
    await setup();
    if(weapon){const o=mksobj(weapon,false,false);o.cursed=true;await addinv(o);setworn(o,W_WEP);}
    if(shield){const o=mksobj(ONAMES.SMALL_SHIELD,false,false);o.cursed=true;await addinv(o);setworn(o,W_ARMS);}
    assert.equal(freehand(),!weapon||weapon===ONAMES.DAGGER&&!shield);
    const ref={v:-1};cmdq_add_key(CQ_CANNED,'a');
    assert.equal(await getspell(ref),allowed,'casting hand constraint');
    assert.equal(ref.v,allowed?0:-1);
}
for(const [n,key,valid,index]of [[1,'a',true,0],[1,'b',false,-1],[26,'z',true,25],
    [27,'A',true,26],[52,'Z',true,51],[52,'[',false,-1]]) {
    await setup();game.spl_book=Array.from({length:n},()=>({...game.spl_book[0]}));
    cmdq_add_key(CQ_CANNED,key);const ref={v:-1};
    assert.equal(await getspell(ref),valid);assert.equal(ref.v,index);
}
await setup();cmdq_add_int(CQ_CANNED,3);assert.equal(await getspell({v:-1}),false);
await setup();const unknown={v:12};enableRngLog();
assert.deepEqual(await spelleffects_check(-1,unknown),{rejected:true,res:ECMD_OK});
assert.equal(unknown.v,0);assert.equal(getRngLog().length,0);

// Values on both sides of each memory-warning boundary.
for(const [knowledge,message]of [[100,'strain to recall'],[101,'difficulty remembering'],
    [500,'difficulty remembering'],[501,'growing faint'],[1000,'growing faint'],
    [1001,'gradually fading'],[2000,'gradually fading'],[2001,null]]) {
    await setup();game.spl_book[0].sp_know=knowledge;game.u.uen=0;
    const result=await check();assert.equal(result.res,ECMD_OK);
    if(message)assert.ok(text().includes(message),String(knowledge));
    else assert.ok(!/recall|remembering|growing faint|gradually fading/.test(text()));
}
for(const [kind,otyp]of [['hungry',ONAMES.SPE_HEALING],['food',ONAMES.SPE_DETECT_FOOD],
    ['weak',ONAMES.SPE_HEALING],['restore',ONAMES.SPE_RESTORE_ABILITY]]) {
    await setup();game.spl_book[0].sp_id=otyp;
    await make_confused(30,false);
    if(['hungry','food'].includes(kind))game.u.uhunger=5;
    else game.u.acurr.a[A_STR]=3;
    enableRngLog();const result=await check();
    assert.equal(result.res,['hungry','weak'].includes(kind)?ECMD_OK:ECMD_TIME,kind);
    assert.equal(getRngLog().length,0,kind+': confusion skips the success roll');
    if(kind==='food')assert.equal(game.u.uhunger,5);
}
await setup();const stone=mksobj(ONAMES.LOADSTONE,false,false);
stone.quan=10;stone.owt=weight(stone);await addinv(stone);enableRngLog();
assert.equal((await check()).res,ECMD_TIME);assert.equal(getRngLog().length,0);
assert.ok(text().includes('Your concentration falters while carrying so much stuff.'));
for(const [max,peak,suffix]of [[20,20,'spell.'],[0,0,'spell yet.'],[0,10,'spell anymore.']]) {
    await setup();game.u.uen=0;game.u.uenmax=max;game.u.uenpeak=peak;
    enableRngLog();assert.equal((await check()).res,ECMD_OK);
    assert.ok(text().includes('enough energy to cast that '+suffix));assert.equal(getRngLog().length,0);
}
await setup();game.u.uen=5;game.u.uhave={amulet:true};initRng(1);enableRngLog();
assert.equal((await check()).res,ECMD_TIME);assert.equal(getRngLog().length,1);
const drain=Number(/=(\d+)/.exec(getRngLog()[0])[1]);
assert.equal(game.u.uen,Math.max(0,5-drain));assert.equal(game.u.uhunger,600);
for(const [wizard,intell,hunger,cost]of [[true,14,600,10],[true,15,600,5],
    [true,16,600,2],[true,17,600,0],[true,25,600,0],[false,18,600,10],
    [false,18,11,8]]) {
    await setup();game.u.acurr.a[A_INT]=intell;game.u.uhunger=hunger;
    if(!wizard)game.urole={...game.urole,malenum:PMNAMES.PM_MONK,mnum:PMNAMES.PM_MONK};
    await make_confused(30,false);enableRngLog();
    assert.equal((await check()).res,ECMD_TIME);
    assert.equal(game.u.uhunger,hunger-cost);assert.equal(game.u.uen,198);
    assert.equal(getRngLog().length,0);
}

// All durations, additive confusion, and timer clamping with permanent bits.
for(const level of [1,2,3,4,5,6,7])for(const old of [0,9,FROMOUTSIDE|9]) {
    await setup();game.spl_book[0].sp_lev=level;game.spl_book[0].sp_know=0;
    game.u.intrinsic.HConfusion=old;game.u.uen=0;game.u.uhunger=0;
    initRng(level);enableRngLog();
    assert.equal((await check()).res,ECMD_TIME);
    const value=Number(/=(\d+)/.exec(getRngLog()[0])[1]),duration=[0,6,9,12,15,18,21,24][level];
    const conf=value<4?duration:value<7?duration*2/3:value<9?duration/3:0;
    assert.equal(game.u.intrinsic.HConfusion||0,(old&~TIMEOUT)|((old&TIMEOUT)+conf));
    assert.equal(game.u.intrinsic.HStun||0,duration-conf);assert.equal(game.u.uen,0);
}
for(const [fn,key,permanent]of [[make_confused,'HConfusion',FROMOUTSIDE],[make_stunned,'HStun',FROMFORM]])
    for(const timeout of [-1,0,5,TIMEOUT+100]) {
        await setup();game.u.intrinsic[key]=permanent|9;
        await fn(timeout,false);
        assert.equal(game.u.intrinsic[key],permanent|Math.max(0,Math.min(TIMEOUT,timeout)));
    }
console.log(`spell memory state: ${replays} replays, ${backfires} backfires, ${amnesias} amnesia selections and source controls passed`);
