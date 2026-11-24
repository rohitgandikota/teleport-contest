// C uhitm.c:3652-3687. Real makers, speed helper, dispatch and message input.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, clearMessages, messages, seed, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {polymon} from '../js/polyself.js';
import {mhitm_ad_slow, mhitm_adtyping} from '../js/uhitm.js';
import {mdamagem} from '../js/mhitm.js';
import {magic_negation} from '../js/mhitu.js';
import {mon_adjust_speed, m_dowear} from '../js/worn.js';
import {mksobj} from '../js/mkobj.js';
import {mpickobj} from '../js/steal.js';
import {make_hallucinated, make_deaf} from '../js/potion.js';
import {canseemon, canspotmon, pline} from '../js/display.js';
import {defended} from '../js/mondata.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P, ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare({hero=false, accessible=false, visible=true, species=P.PM_OGRE}={}) {
    const run=await setup();
    let reads=0;
    run._display.onEmptyQueue=()=>{assert.ok(++reads<40,'bounded actual message input');return 32;};
    const flags=C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG;
    const attacker=hero ? (assert.equal(await polymon(P.PM_SKELETON),1),game.youmonst)
        : await makemon(game.mons[P.PM_SKELETON],x+1,y,flags);
    const defender=await makemon(game.mons[species],x+2,y,flags|(visible?0:C.MM_MINVIS));
    assert.ok(attacker && defender);
    assert.equal(attacker.data,game.mons[P.PM_SKELETON]);
    assert.equal(defender.data,game.mons[species]);
    const attack=attacker.data.mattk.find(a=>a[1]===A.AD_SLOW);
    assert.deepEqual(attack,[A.AT_TUCH,A.AD_SLOW,1,6]);
    attacker.mpeaceful=0;defender.mpeaceful=0;defender.msleeping=0;
    defender.mhp=defender.mhpmax=80;
    defender.mstrategy=C.STRAT_WAITFORU|C.STRAT_CLOSE;
    game.vis=true;game.flags.accessiblemsg=accessible;game.iflags.getpos_coords='m';
    assert.equal(!!canseemon(defender),visible);
    clearMessages();seed(19);
    return {run,attacker,defender,attack};
}
const mhm=()=>({damage:4,hitflags:C.M_ATTK_MISS,permdmg:0,specialdmg:0,done:false});
const calls=()=>getRngLog().map(s=>s.replace(/\s*@\s.*$/,''));
function verifyMessages(accessible,hero=false) {
    const text=messages();
    assert.ok(text.includes(`${accessible?'<33,10>: ':''}The ogre seems to be moving slower.`),text);
    assert.ok(text.includes(`${accessible&&!hero?'<33,10>: ':''}The ogre slows down.`),text);
    if(accessible&&hero)assert.ok(!text.includes('<33,10>: The ogre slows down.'),text);
    assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
}
async function heldMessage(run,start,inspect) {
    let entered,timer,completed=false;
    const waiting=new Promise(resolve=>{entered=resolve;});
    const releases=[];
    run._display.onEmptyQueue=()=>{
        entered();
        return new Promise(resolve=>{releases.push(resolve);});
    };
    const pending=start().then(value=>{completed=true;return value;});
    try {
        await Promise.race([waiting,pending.then(()=>{throw Error('owner completed without pending More');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('missing More')),2000);})]);
        await setImmediate();
        inspect({completed,reads:releases.length});
    } finally {
        clearTimeout(timer);run._display.onEmptyQueue=()=>32;
        for(const release of releases)release(32);
        await pending;await setImmediate();
    }
    return pending;
}

for(const accessible of [false,true]) for(const route of ['hero-handler','monster-handler','monster-dispatch','damage-tail']) {
    test(`pending speed feedback preserves C completion: ${route}, accessible=${accessible}`,async()=>{
        const hero=route==='hero-handler';
        const {run,attacker,defender,attack}=await prepare({hero,accessible});
        await pline('An earlier message leaves no room for the next speed change message.');
        const hp=defender.mhp,strategy=defender.mstrategy,record=mhm();
        seed(19);
        const invoke=()=>route==='damage-tail' ? mdamagem(attacker,defender,attack,null,0)
            :route==='monster-dispatch' ? mhitm_adtyping(attacker,attack,defender,record)
            :mhitm_ad_slow(attacker,attack,defender,record);
        await heldMessage(run,invoke,state=>{
            console.log('PENDING '+JSON.stringify({route,accessible,...state,speed:defender.mspeed,
                permanent:defender.permspeed,strategy:defender.mstrategy,hp:defender.mhp,text:game._toplines,rng:calls()}));
            assert.equal(state.completed,false,'caller must wait');
            assert.equal(state.reads,1,'C has one pending message, not overlapping reads');
            assert.equal(defender.permspeed,C.MSLOW,'speed mutates before its own message');
            assert.equal(defender.mspeed,C.MSLOW);
            assert.equal(defender.mstrategy,strategy,'strategy cleanup follows speed message completion');
            assert.equal(defender.mhp,hp,'damage tail follows completed handler');
            assert.deepEqual(calls(),route==='damage-tail' ? ['d(1,6)=5','rn2(10)=6'] : ['rn2(10)=0']);
            assert.doesNotMatch(messages(),/The ogre slows down\./,'owner feedback has not started');
        });
        assert.equal(defender.mstrategy,hero?strategy:(strategy&~C.STRAT_WAITFORU));
        if(route==='damage-tail')assert.equal(defender.mhp,hp-5);else assert.equal(defender.mhp,hp);
        verifyMessages(accessible,hero);
    });
}

for(const hero of [false,true]) for(const fast of [false,true]) {
    test(`real speed transition and unchanged damage record: hero=${hero}, fast=${fast}`,async()=>{
        const {attacker,defender,attack}=await prepare({hero});
        if(fast)assert.equal(mon_adjust_speed(defender,2,null),undefined);
        clearMessages();seed(19);const record=mhm(),before=structuredClone(record);
        await mhitm_adtyping(attacker,attack,defender,record);
        assert.equal(defender.permspeed,fast?0:C.MSLOW);assert.equal(defender.mspeed,fast?0:C.MSLOW);
        assert.deepEqual(record,before);assert.deepEqual(calls(),['rn2(10)=0']);
        verifyMessages(false,hero);
    });
}

for(const kind of ['cancelled','already-slow','speed-boots','blue-dragon','invisible','sleeping','frozen']) {
    test(`real helper negative/visibility contract: ${kind}`,async()=>{
        const {attacker,defender,attack}=await prepare({visible:kind!=='invisible',species:kind==='blue-dragon'?P.PM_BLUE_DRAGON:P.PM_OGRE});
        if(kind==='cancelled')attacker.mcan=1;
        if(kind==='already-slow')await mon_adjust_speed(defender,-1,null);
        if(kind==='speed-boots') {
            const boots=mksobj(O.SPEED_BOOTS,false,false);await mpickobj(defender,boots);await m_dowear(defender,true);
            assert.ok(boots.owornmask&C.W_ARMF);assert.equal(defender.mspeed,C.MFAST);
        }
        if(kind==='blue-dragon')assert.equal(defended(defender,A.AD_SLOW),true);
        if(kind==='sleeping')defender.msleeping=1;
        if(kind==='frozen')defender.mfrozen=1;
        clearMessages();seed(19);const strategy=defender.mstrategy,record=mhm();
        await mhitm_adtyping(attacker,attack,defender,record);
        const blocked=['cancelled','already-slow','blue-dragon'].includes(kind);
        assert.equal(defender.mstrategy,blocked?strategy:(strategy&~C.STRAT_WAITFORU));
        assert.deepEqual(calls(),kind==='cancelled'?[]:['rn2(10)=0']);
        assert.equal(record.damage,4);
        if(kind==='speed-boots'){
            assert.equal(defender.permspeed,C.MSLOW);assert.equal(defender.mspeed,C.MFAST);
            assert.equal(messages().trim(),'');
        }else if(kind==='sleeping'||kind==='frozen'){
            assert.equal(defender.mspeed,C.MSLOW);
            assert.doesNotMatch(messages(),/seems to be moving/);
            assert.match(messages(),/The ogre slows down\./,'C owner feedback is independent of helper immobility suppression');
        }else if(kind==='invisible'){
            assert.equal(defender.mspeed,C.MSLOW);assert.equal(canspotmon(defender),false);assert.equal(messages().trim(),'');
        }else assert.equal(messages().trim(),'');
    });
}
for(const status of ['deaf','hallucinating'])test(`actual status keeps located speed feedback: ${status}`,async()=>{
    const {attacker,defender,attack}=await prepare({accessible:true});
    if(status==='deaf')await make_deaf(100,false);else await make_hallucinated(100,false);
    clearMessages();seed(19);
    await mhitm_adtyping(attacker,attack,defender,mhm());
    assert.equal(defender.mspeed,C.MSLOW);
    assert.match(messages(),/<33,10>: .* seems to be moving slower\./);
    assert.match(messages(),/<33,10>: .* slows down\./);
    assert.deepEqual(calls(),['rn2(10)=0']);
});

test('real worn cloak negates slowing before speed or strategy changes',async()=>{
    const {attacker,defender,attack}=await prepare();
    const cloak=mksobj(O.ELVEN_CLOAK,false,false);await mpickobj(defender,cloak);await m_dowear(defender,true);
    assert.ok(cloak.owornmask&C.W_ARMC);assert.ok(magic_negation(defender)>=1);
    clearMessages();seed(19);const strategy=defender.mstrategy;
    await mhitm_adtyping(attacker,attack,defender,mhm());
    assert.equal(defender.mspeed,0);assert.equal(defender.mstrategy,strategy);
    assert.deepEqual(calls(),['rn2(10)=0']);assert.equal(messages().trim(),'');
});
test('hero-target branch retains hit feedback without a monster speed mutation',async()=>{
    const {attacker,attack}=await prepare();const record=mhm();
    assert.equal(game.u.intrinsic.HFast||0,0);
    await mhitm_adtyping(attacker,attack,game.youmonst,record);
    assert.equal(game.u.intrinsic.HFast||0,0);assert.equal(record.damage,4);
    assert.match(messages(),/skeleton touches you/);assert.deepEqual(calls(),['rn2(10)=0']);
});
test('helper visibility is independent of the owner gv.vis feedback guard',async()=>{
    const {attacker,defender,attack}=await prepare({accessible:true});game.vis=false;
    await mhitm_adtyping(attacker,attack,defender,mhm());
    assert.equal(defender.mspeed,C.MSLOW);assert.equal(defender.mstrategy&C.STRAT_WAITFORU,0);
    assert.match(messages(),/<33,10>: The ogre seems to be moving slower\./);
    assert.doesNotMatch(messages(),/The ogre slows down\./);
});
