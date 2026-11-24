// C uhitm.c:5198 missum. Constructed boundaries use real game helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup,clearMessages,messages,seed,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {polymon} from '../js/polyself.js';
import {makemon} from '../js/makemon.js';
import {missum,known_hitum,hmonas} from '../js/uhitm.js';
import {could_seduce} from '../js/mhitu.js';
import {mon_nam,christen_monst} from '../js/do_name.js';
import {canspotmon,pline} from '../js/display.js';
import {helpless,perceives} from '../js/mondata.js';
import {peffects,make_blinded,make_hallucinated} from '../js/potion.js';
import {Invis,Blind,Hallucination} from '../js/youprop.js';
import {mksobj} from '../js/mkobj.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare({form=P.PM_WOOD_NYMPH,gender=C.MM_MALE,invisible=false,sleep=true}={}) {
    const run=await setup();
    assert.equal(await polymon(form),1);
    assert.equal(game.youmonst.data,game.mons[form]);
    const mon=await makemon(game.mons[P.PM_OGRE],x+1,y,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG|gender|(invisible?C.MM_MINVIS:0));
    assert.equal(mon.data,game.mons[P.PM_OGRE]);
    Object.assign(mon,{msleeping:sleep?1:0,mpeaceful:1,mhp:100,mhpmax:100});
    Object.assign(game.u,{dx:1,dy:0});game.bhitpos={x:x+1,y};game.notonhead=false;
    assert.equal(game.u.uhitinc||0,0);assert.equal(game.u.uwep,undefined);
    clearMessages();seed(2);
    return {run,mon,attack:game.youmonst.data.mattk[0]};
}
function sameBody(mon) {
    assert.equal(mon.mhp,100);assert.equal(mon.mhpmax,100);
    assert.equal(mon.msleeping,1);assert.equal(mon.mpeaceful,1);
}
async function pendingMore(run,invoke,inspect) {
    let enter,timer,done=false;const releases=[];
    const reached=new Promise(resolve=>{enter=resolve;});
    run._display.onEmptyQueue=()=>{enter();return new Promise(resolve=>releases.push(resolve));};
    const owner=invoke().then(value=>{done=true;return value;});
    try {
        await Promise.race([reached,owner.then(()=>{throw Error('owner completed before required More');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('More not reached')),2000);})]);
        await setImmediate();inspect({done,reads:releases.length});
    }finally{
        clearTimeout(timer);run._display.onEmptyQueue=()=>32;
        for(const release of releases)release(32);
        await owner;await setImmediate();
    }
    return owner;
}

for(const [gender,compat] of [[C.MM_MALE,1],[C.MM_FEMALE,2]])
 for(const index of [0,1])test(`nymph compatibility ${compat}, natural attack ${index}, has friendly miss feedback`,async()=>{
    const s=await prepare({gender}),attack=game.youmonst.data.mattk[index];
    assert.equal(could_seduce(game.youmonst,s.mon,attack),compat);
    assert.equal(await missum(s.mon,attack,false),undefined);
    assert.equal(messages(),'You pretend to be friendly to the ogre.');
    sameBody(s.mon);assert.deepEqual(getRngLog(),[]);
});
test('amorous demon compatible attack uses the same miss branch',async()=>{
    const s=await prepare({form:P.PM_AMOROUS_DEMON,gender:C.MM_FEMALE});
    assert.equal(could_seduce(game.youmonst,s.mon,s.attack),1);
    await missum(s.mon,s.attack,false);assert.match(messages(),/pretend to be friendly to the ogre/);
    sameBody(s.mon);assert.deepEqual(getRngLog(),[]);
});
for(const [form,index] of [[P.PM_AMOROUS_DEMON,0],[P.PM_AMOROUS_DEMON,1],[P.PM_MONKEY,0],[P.PM_GNOME,0]])
 test(`incompatible real attack ${form}/${index} retains ordinary miss`,async()=>{
    const s=await prepare({form}),attack=game.youmonst.data.mattk[index];
    assert.equal(could_seduce(game.youmonst,s.mon,attack),0);
    await missum(s.mon,attack,false);assert.equal(messages(),'You miss the ogre.');
    sameBody(s.mon);assert.deepEqual(getRngLog(),[]);
});
test('compatible feedback precedes the verbose condition',async()=>{
    const s=await prepare();game.flags.verbose=false;
    await missum(s.mon,s.attack,false);assert.equal(messages(),'You pretend to be friendly to the ogre.');
    sameBody(s.mon);
});
test('unseen compatible defender is named it, not an ordinary miss',async()=>{
    const s=await prepare({invisible:true});assert.equal(canspotmon(s.mon),false);
    assert.equal(could_seduce(game.youmonst,s.mon,s.attack),1);
    await missum(s.mon,s.attack,false);assert.equal(messages(),'You pretend to be friendly to it.');
    sameBody(s.mon);assert.deepEqual(getRngLog(),[]);
});
for(const kind of ['unseen','quiet'])test(`ordinary ${kind} miss retains it feedback`,async()=>{
    const s=await prepare({form:P.PM_GNOME,invisible:kind==='unseen'});
    if(kind==='quiet')game.flags.verbose=false;
    assert.equal(canspotmon(s.mon),kind!=='unseen');
    await missum(s.mon,s.attack,false);assert.equal(messages(),'You miss it.');
    sameBody(s.mon);assert.deepEqual(getRngLog(),[]);
});
test('real named target uses canonical mon_nam',async()=>{
    const s=await prepare();christen_monst(s.mon,'Oswald');
    await missum(s.mon,s.attack,false);assert.equal(messages(),'You pretend to be friendly to Oswald.');
    sameBody(s.mon);assert.deepEqual(getRngLog(),[]);
});
test('actual hero blindness preserves compatibility and uses unseen name',async()=>{
    const s=await prepare();await make_blinded(20,false);assert.ok(Blind());
    assert.equal(canspotmon(s.mon),false);clearMessages();seed(2);
    await missum(s.mon,s.attack,false);assert.equal(messages(),'You pretend to be friendly to it.');
    sameBody(s.mon);assert.deepEqual(getRngLog(),[]);
});
test('invisible nymph blocks only AD_SEDU when defender cannot perceive',async()=>{
    const s=await prepare();await peffects(mksobj(O.POT_INVISIBILITY,false,false));
    assert.ok(Invis());assert.equal(perceives(s.mon.data),false);
    const attacks=game.youmonst.data.mattk;
    assert.equal(attacks[0][1],A.AD_SITM);assert.equal(attacks[1][1],A.AD_SEDU);
    assert.equal(could_seduce(game.youmonst,s.mon,attacks[0]),1);
    assert.equal(could_seduce(game.youmonst,s.mon,attacks[1]),0);
    clearMessages();seed(2);await missum(s.mon,attacks[0],false);
    assert.equal(messages(),'You pretend to be friendly to the ogre.');
    clearMessages();await missum(s.mon,attacks[1],false);
    assert.equal(messages(),'You miss the ogre.');sameBody(s.mon);assert.deepEqual(getRngLog(),[]);
});
test('hallucinated name is produced once with its original RNG sequence',async()=>{
    const s=await prepare();await make_hallucinated(20,false,0);assert.ok(Hallucination());
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__rng_log_disp');
    const displayState=structuredClone(game.dispCtx);
    try {
        globalThis.__rng_log_disp=true;
        clearMessages();seed(2);const name=mon_nam(s.mon),nameRng=[...getRngLog()];
        assert.ok(nameRng.length>0);assert.ok(nameRng.every(call=>call.startsWith('~drn2(')));
        game.dispCtx=structuredClone(displayState);seed(2);await missum(s.mon,s.attack,false);
        assert.equal(messages(),`You pretend to be friendly to ${name}.`);
        assert.deepEqual(getRngLog(),nameRng);sameBody(s.mon);
    }finally{
        if(previous)Object.defineProperty(globalThis,'__rng_log_disp',previous);
        else delete globalThis.__rng_log_disp;
    }
});
test('paralyzed awake defender keeps its helpless state and peacefulness',async()=>{
    const s=await prepare({sleep:false});s.mon.mcanmove=0;s.mon.mfrozen=12;
    assert.ok(helpless(s.mon));await missum(s.mon,s.attack,false);
    assert.match(messages(),/pretend to be friendly/);assert.equal(s.mon.mpeaceful,1);
    assert.equal(s.mon.mfrozen,12);assert.equal(s.mon.mcanmove,0);assert.deepEqual(getRngLog(),[]);
});
test('compatible miss still angers an awake mobile defender after feedback',async()=>{
    const s=await prepare({sleep:false});assert.equal(helpless(s.mon),false);
    await missum(s.mon,s.attack,false);
    assert.ok(messages().indexOf('pretend to be friendly')<messages().indexOf('gets angry'));
    assert.equal(s.mon.mpeaceful,0);assert.equal(s.mon.mhp,100);
});
test('armor penalty message precedes friendly feedback',async()=>{
    const s=await prepare();await missum(s.mon,s.attack,true);
    assert.ok(messages().indexOf('armor is rather cumbersome')<messages().indexOf('pretend to be friendly'));
    sameBody(s.mon);assert.deepEqual(getRngLog(),[]);
});
test('known_hitum converts its real named record for the shared miss helper',async()=>{
    const s=await prepare(),a=s.attack,hit=[0];
    const named={aatyp:a[0],adtyp:a[1],damn:a[2],damd:a[3]};
    assert.equal(await known_hitum(s.mon,null,hit,0,0,named,20),true);
    assert.deepEqual(hit,[0]);assert.equal(messages(),'You pretend to be friendly to the ogre.');
    sameBody(s.mon);assert.deepEqual(getRngLog(),[]);
});
test('direct owner waits for real More before wakeup and anger',async()=>{
    const s=await prepare({sleep:false});
    await pline('A prior message occupies enough of the topline to require acknowledgment.');seed(2);
    await pendingMore(s.run,()=>missum(s.mon,s.attack,false),state=>{
        assert.equal(state.done,false);assert.equal(state.reads,1);assert.equal(s.mon.mpeaceful,1);
        assert.equal(s.mon.mhp,100);assert.deepEqual(getRngLog(),[]);
    });
    assert.match(messages(),/pretend to be friendly/);assert.equal(s.mon.mpeaceful,0);
});
test('hmonas awaits miss feedback before continuing to its second natural attack',async()=>{
    const s=await prepare();seed(2);
    await pline('A prior message occupies enough of the topline to require acknowledgment.');
    const result=await pendingMore(s.run,()=>hmonas(s.mon),state=>{
        assert.equal(state.done,false);assert.equal(state.reads,1);
        assert.deepEqual(getRngLog(),['rnd(20)=14']);sameBody(s.mon);
    });
    assert.equal(result,true);assert.match(messages(),/pretend to be friendly/);
    assert.equal(game.twohits,0);sameBody(s.mon);
});
