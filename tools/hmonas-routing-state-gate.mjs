// C uhitm.c:5424 hmonas. Constructed state boundaries, actual game helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup,clearMessages,messages,seed,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {polymon} from '../js/polyself.js';
import {makemon} from '../js/makemon.js';
import {hmonas,damageum} from '../js/uhitm.js';
import {could_seduce,getmattk} from '../js/mhitu.js';
import {m_at} from '../js/mon.js';
import {count_wsegs} from '../js/worm.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {mpickobj} from '../js/steal.js';
import {setuwep} from '../js/wield.js';
import {setworn,m_dowear,which_armor} from '../js/worn.js';
import {Ring_on} from '../js/do_wear.js';
import {christen_monst} from '../js/do_name.js';
import {peffects,make_blinded,make_hallucinated} from '../js/potion.js';
import {Invis,Blind,Hallucination} from '../js/youprop.js';
import {haseyes,perceives} from '../js/mondata.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare(form=P.PM_LICH,victim=P.PM_OGRE,{armed=true,gender=0,accuracy=30}={}) {
    const run=await setup();
    assert.equal(await polymon(form),1);
    assert.equal(game.youmonst.data,game.mons[form]);
    const ring=mksobj(O.RIN_INCREASE_ACCURACY,false,false);ring.spe=accuracy;
    await addinv(ring);setworn(ring,C.W_RINGR);await Ring_on(ring);
    assert.equal(game.u.uhitinc,accuracy);
    const mon=await makemon(game.mons[victim],x+1,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG|gender);
    assert.equal(mon.data,game.mons[victim]);
    Object.assign(mon,{mhp:100,mhpmax:100,msleeping:1,mpeaceful:1});
    Object.assign(game.u,{dx:1,dy:0});game.bhitpos={x:x+1,y};game.notonhead=false;
    let weapon;
    if(armed){weapon=mksobj(O.CLUB,false,false);await addinv(weapon);await setuwep(weapon);}
    clearMessages();seed(2);
    return {run,mon,weapon};
}
async function treasure(mon) {
    const obj=mksobj(O.DAGGER,false,false);await mpickobj(mon,obj);return obj;
}
const selected=mon=>getmattk(game.youmonst,mon,0,Array(C.NATTK).fill(C.M_ATTK_MISS));
const dice=()=>getRngLog().filter(s=>/^d\(/.test(s));
function noSeduction(){assert.doesNotMatch(messages(),/smile at|talk to|seductively|engagingly/);}
async function pendingMore(run,invoke,inspect,accept=()=>true) {
    let enter,timer,done=false;const releases=[];
    const reached=new Promise(resolve=>{enter=resolve;});
    run._display.onEmptyQueue=()=>{if(!accept())return 32;enter();return new Promise(resolve=>releases.push(resolve));};
    const owner=invoke().then(value=>{done=true;return value;});
    try {
        await Promise.race([reached,owner.then(()=>{throw Error('completed before required More');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('More not reached')),2000);})]);
        await setImmediate();inspect({done,reads:releases.length});
    } finally {
        clearTimeout(timer);run._display.onEmptyQueue=()=>32;
        for(const release of releases)release(32);
        await owner;await setImmediate();
    }
    return owner;
}

test('lich weapon hit precedes one cold handler without a second hit message',async()=>{
    const s=await prepare();assert.equal(selected(s.mon)[1],A.AD_COLD);
    assert.equal(await hmonas(s.mon),true);assert.equal(s.mon.mhp,97);
    assert.equal(messages().match(/You hit the ogre/g)?.length,1);
    assert.match(messages(),/covered in frost/);
    assert.equal(s.mon.msleeping,0);assert.equal(s.mon.mpeaceful,0);
    assert.deepEqual(getRngLog(),['rnd(20)=14','rnd(3)=1','rn2(25)=8','d(1,10)=2',
        'rn2(10)=3','rn2(5)=1','rn2(3)=0','rn2(3)=2','rn2(6)=5']);
});
test('getmattk changes resistant lich touch to physical before the weapon guard',async()=>{
    const s=await prepare(P.PM_LICH,P.PM_ICE_TROLL);
    assert.deepEqual([...selected(s.mon)],[A.AT_TUCH,A.AD_PHYS,1,6]);
    assert.equal(selected(s.mon).getmattk_alternate,true);
    assert.equal(await hmonas(s.mon),true);assert.equal(s.mon.mhp,99);
    assert.doesNotMatch(messages(),/covered in frost/);assert.deepEqual(dice(),[]);
});
for(const [form,type] of [[P.PM_GNOME,A.AD_PHYS],[P.PM_GNOMISH_WIZARD,A.AD_SPEL]])
 test(`successful weapon excludes damage type ${type}`,async()=>{
    const s=await prepare(form);assert.equal(selected(s.mon)[1],type);
    assert.equal(await hmonas(s.mon),true);assert.equal(s.mon.mhp,99);
    assert.match(messages(),/You hit the ogre/);assert.deepEqual(dice(),[]);
    assert.deepEqual(getRngLog(),['rnd(20)=14','rnd(3)=1','rn2(25)=8','rn2(3)=0','rn2(3)=0','rn2(6)=1']);
});
test('weapon miss does not dispatch its cold damage',async()=>{
    const s=await prepare(P.PM_LICH,P.PM_OGRE,{accuracy:-30});
    assert.equal(await hmonas(s.mon),true);assert.equal(s.mon.mhp,100);
    assert.match(messages(),/You miss the ogre/);assert.deepEqual(dice(),[]);
});
test('shade keeps cold selection but harmless weapon hit clears the hit flag',async()=>{
    const s=await prepare(P.PM_LICH,P.PM_SHADE);assert.equal(selected(s.mon)[1],A.AD_COLD);
    assert.equal(await hmonas(s.mon),true);assert.equal(s.mon.mhp,100);
    assert.doesNotMatch(messages(),/covered in frost/);assert.deepEqual(dice(),[]);
});
test('weapon death skips the special damage handler',async()=>{
    const s=await prepare();s.mon.mhp=1;const kills=game.u.uconduct.killer;
    assert.equal(await hmonas(s.mon),false);assert.equal(s.mon.mhp,0);
    assert.equal(game.u.uconduct.killer,kills+1);assert.deepEqual(dice(),[]);
    assert.doesNotMatch(messages(),/covered in frost/);
});
test('barrow wight weapon drains before the remaining physical and cold attacks',async()=>{
    const s=await prepare(P.PM_BARROW_WIGHT);seed(19);
    assert.equal(await hmonas(s.mon),true);assert.equal(s.mon.m_lev,3);
    assert.equal(s.mon.mhpmax,92);assert.equal(s.mon.mhp,87);
    assert.deepEqual(dice(),['d(0,0)=0','d(2,6)=8','d(1,4)=3','d(1,4)=1']);
    assert.ok(messages().indexOf('becomes weaker')<messages().indexOf('You touch'));
});
test('nymph weapon dispatches zero-dice theft before its natural seduction',async()=>{
    const s=await prepare(P.PM_WOOD_NYMPH,P.PM_OGRE,{gender:C.MM_MALE});const obj=await treasure(s.mon);
    clearMessages();seed(2);assert.equal(await hmonas(s.mon),true);
    assert.ok(game.invent.includes(obj));assert.equal(s.mon.minvent.includes(obj),false);
    assert.equal(s.mon.msleeping,0);assert.equal(s.mon.mpeaceful,0);
    assert.ok(messages().indexOf('You hit')<messages().indexOf('You steal'));
    assert.match(messages(),/smile at the ogre seductively/);
});
test('real severed terminal worm segment skips special damage and passive draws',async()=>{
    const s=await prepare(P.PM_LICH,P.PM_LONG_WORM);const tail=game.worms.wtails[s.mon.wormno];
    const count=count_wsegs(s.mon);assert.ok(count>0);
    const tx=tail.wx,ty=tail.wy;assert.notDeepEqual([tx,ty],[s.mon.mx,s.mon.my]);
    assert.equal(m_at(tx,ty),s.mon);
    const offset=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]
        .find(([dx,dy])=>!m_at(tx-dx,ty-dy)&&game.level.at(tx-dx,ty-dy).typ===C.ROOM);
    assert.ok(offset,'real vacant square beside the generated terminal tail');
    const [dx,dy]=offset;assert.equal(m_at(tx-dx,ty-dy),null);
    Object.assign(game.u,{ux:tx-dx,uy:ty-dy,dx,dy});game.bhitpos={x:tx,y:ty};game.notonhead=true;
    const blade=mksobj(O.DAGGER,false,false);await addinv(blade);await setuwep(blade);
    clearMessages();seed(2);assert.equal(await hmonas(s.mon),true);
    assert.notEqual(m_at(tx,ty),s.mon);assert.equal(count_wsegs(s.mon),count-1);
    assert.equal(s.mon.mhp,99);assert.doesNotMatch(messages(),/covered in frost/);
    assert.deepEqual(getRngLog(),['rnd(20)=14','rnd(3)=1','rn2(25)=8','rnd(20)=12']);
});
for(const [gender,compat,word] of [[C.MM_MALE,1,'seductively'],[C.MM_FEMALE,2,'engagingly']])
 test(`compatible nymph ${word} retains sleeping peaceful target and steals real item`,async()=>{
    const s=await prepare(P.PM_WOOD_NYMPH,P.PM_OGRE,{armed:false,gender});const obj=await treasure(s.mon);
    assert.equal(could_seduce(game.youmonst,s.mon,selected(s.mon)),compat);
    clearMessages();seed(2);assert.equal(await hmonas(s.mon),true);
    assert.equal(messages().match(new RegExp(`smile at the ogre ${word}`,'g'))?.length,2);
    assert.ok(game.invent.includes(obj));assert.equal(s.mon.mhp,100);
    assert.equal(s.mon.msleeping,1);assert.equal(s.mon.mpeaceful,1);
    assert.doesNotMatch(messages(),/You hit|wakes up|gets angry/);
});
test('eyeless target receives talk feedback',async()=>{
    const s=await prepare(P.PM_WOOD_NYMPH,P.PM_YELLOW_LIGHT,{armed:false});
    assert.equal(haseyes(s.mon.data),false);await treasure(s.mon);clearMessages();seed(2);
    assert.equal(await hmonas(s.mon),true);assert.match(messages(),/talk to the yellow light engagingly/);
    assert.equal(s.mon.msleeping,1);assert.equal(s.mon.mpeaceful,1);
});
test('actual raven blinding changes subsequent seduction from smile to talk',async()=>{
    const s=await prepare(P.PM_RAVEN,P.PM_OGRE,{armed:false,gender:C.MM_MALE});
    const blinding=game.youmonst.data.mattk.find(a=>a[1]===A.AD_BLND);
    await damageum(s.mon,blinding,0);assert.equal(s.mon.mcansee,0);assert.ok(s.mon.mblinded>0);
    await polymon(P.PM_WOOD_NYMPH);await treasure(s.mon);clearMessages();seed(2);
    assert.equal(await hmonas(s.mon),true);assert.match(messages(),/talk to the ogre seductively/);
    assert.equal(s.mon.msleeping,1);assert.equal(s.mon.mpeaceful,1);
});
test('animal theft is incompatible and follows normal wakeup path',async()=>{
    const s=await prepare(P.PM_MONKEY,P.PM_OGRE,{armed:false});const obj=await treasure(s.mon);
    assert.equal(could_seduce(game.youmonst,s.mon,selected(s.mon)),0);
    clearMessages();seed(2);assert.equal(await hmonas(s.mon),true);noSeduction();
    assert.ok(game.invent.includes(obj));assert.equal(s.mon.msleeping,0);assert.equal(s.mon.mpeaceful,0);
});
for(const compatible of [false,true])test(`amorous demon compatibility=${compatible}, later claws still wake`,async()=>{
    const s=await prepare(P.PM_AMOROUS_DEMON,P.PM_OGRE,{armed:false});
    // Constructed gender boundary on a real monster, not a keyboard/native claim.
    s.mon.female=compatible?!game.flags.female:game.flags.female;
    assert.equal(could_seduce(game.youmonst,s.mon,selected(s.mon)),compatible?1:0);
    await treasure(s.mon);clearMessages();seed(2);assert.equal(await hmonas(s.mon),true);
    if(compatible)assert.match(messages(),/smile at the ogre seductively/);else noSeduction();
    assert.equal(s.mon.msleeping,0);assert.equal(s.mon.mpeaceful,0);assert.ok(s.mon.mhp<100);
});
test('actual invisibility suppresses AD_SEDU but not the first AD_SITM smile',async()=>{
    const s=await prepare(P.PM_WOOD_NYMPH,P.PM_OGRE,{armed:false,gender:C.MM_MALE});
    await peffects(mksobj(O.POT_INVISIBILITY,false,false));assert.equal(!!Invis(),true);assert.equal(perceives(s.mon.data),false);
    const attacks=game.youmonst.data.mattk;assert.equal(could_seduce(game.youmonst,s.mon,attacks[0]),1);
    assert.equal(could_seduce(game.youmonst,s.mon,attacks[1]),0);
    await treasure(s.mon);clearMessages();seed(2);assert.equal(await hmonas(s.mon),true);
    assert.equal(messages().match(/smile at/g)?.length,1);assert.match(messages(),/You hit the ogre/);
    assert.equal(s.mon.msleeping,0);assert.equal(s.mon.mpeaceful,0);
});
test('seeing invisible defender preserves both invisible nymph seduction routes',async()=>{
    const s=await prepare(P.PM_WOOD_NYMPH,P.PM_ELF,{armed:false,gender:C.MM_MALE});
    assert.equal(perceives(s.mon.data),true);await peffects(mksobj(O.POT_INVISIBILITY,false,false));
    assert.equal(!!Invis(),true);await treasure(s.mon);clearMessages();seed(2);
    assert.equal(await hmonas(s.mon),true);assert.equal(messages().match(/smile at/g)?.length,2);
    assert.equal(s.mon.msleeping,1);assert.equal(s.mon.mpeaceful,1);
});
test('swallowed boundary excludes compatible seduction before wakeup',async()=>{
    const s=await prepare(P.PM_WOOD_NYMPH,P.PM_PURPLE_WORM,{armed:false});
    assert.ok(could_seduce(game.youmonst,s.mon,selected(s.mon)));
    // C state boundary. No claim that these assignments are ordinary input.
    game.u.uswallow=true;game.u.ustuck=s.mon;await treasure(s.mon);clearMessages();seed(2);
    assert.equal(await hmonas(s.mon),true);noSeduction();assert.equal(s.mon.msleeping,0);assert.equal(s.mon.mpeaceful,0);
});
for(const condition of ['blind','hallucinating'])test(`hero ${condition} retains compatible seduction`,async()=>{
    const s=await prepare(P.PM_WOOD_NYMPH,P.PM_OGRE,{armed:false,gender:C.MM_MALE});await treasure(s.mon);
    if(condition==='blind'){await make_blinded(20,false);assert.equal(!!Blind(),true);}
    else{await make_hallucinated(20,false,0);assert.equal(!!Hallucination(),true);}
    clearMessages();seed(2);assert.equal(await hmonas(s.mon),true);
    assert.equal(messages().match(/smile at/g)?.length,2);assert.match(messages(),/seductively/);
    assert.equal(s.mon.msleeping,1);assert.equal(s.mon.mpeaceful,1);
});
test('seduction More precedes theft, damage and wakeup',async()=>{
    const s=await prepare(P.PM_WOOD_NYMPH,P.PM_OGRE,{armed:false,gender:C.MM_MALE});const obj=await treasure(s.mon);
    clearMessages();await pline('A prior message occupies enough of the topline to require acknowledgment.');seed(2);
    assert.equal(await pendingMore(s.run,()=>hmonas(s.mon),state=>{
        assert.equal(state.done,false);assert.equal(state.reads,1);
        assert.equal(s.mon.mhp,100);assert.equal(s.mon.msleeping,1);assert.equal(s.mon.mpeaceful,1);
        assert.ok(s.mon.minvent.includes(obj));assert.equal(game.invent.includes(obj),false);
        assert.deepEqual(getRngLog(),['rnd(20)=14']);
    }),true);
    assert.ok(game.invent.includes(obj));assert.equal(s.mon.msleeping,1);assert.equal(game.twohits,0);
});
test('cold More waits after weapon damage and before cold damage',async()=>{
    const s=await prepare();christen_monst(s.mon,'An ogre with a particularly long personal name');await pline('A prior message occupies enough of the topline to require acknowledgment.');seed(2);
    assert.equal(await pendingMore(s.run,()=>hmonas(s.mon),state=>{
        assert.equal(state.done,false);assert.equal(state.reads,1);assert.equal(s.mon.mhp,99);
        assert.equal(s.mon.msleeping,0);assert.ok(getRngLog().includes('d(1,10)=2'));
    },()=>getRngLog().includes('d(1,10)=2')),true);
    assert.equal(s.mon.mhp,97);assert.equal(game.twohits,0);
});

for(const form of [P.PM_LICH,P.PM_DINGO])test(`C death result survives real life saving in passive caller, form=${form}`,async()=>{
    const armed=form===P.PM_LICH;
    const s=await prepare(form,P.PM_ORACLE,{armed});
    const amulet=mksobj(O.AMULET_OF_LIFE_SAVING,false,false);
    await mpickobj(s.mon,amulet);await m_dowear(s.mon,true);
    assert.equal(which_armor(s.mon,C.W_AMUL),amulet);s.mon.mhp=armed?2:1;
    clearMessages();seed(2);assert.equal(await hmonas(s.mon),true);
    assert.equal(s.mon.mhp,100);assert.equal(s.mon.minvent.includes(amulet),false);
    assert.match(messages(),/medallion crumbles to dust/);
    assert.match(messages(),/magic missiles appearing from thin air/);
    const calls=getRngLog();const passiveDice=calls.findIndex(c=>/^d\(12,4\)=/.test(c));
    assert.ok(passiveDice>0);
    // C passes malive=false from the damageum result even after life saving.
    // Oracle still retaliates in passive's unconditional first switch, then
    // only the two knockback draws remain, with no living-passive rn2(3).
    assert.equal(calls.length-passiveDice,3);
    assert.match(calls.at(-2),/^rn2\(3\)=/);assert.match(calls.at(-1),/^rn2\(6\)=/);
});
